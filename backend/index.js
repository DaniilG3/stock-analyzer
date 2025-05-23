const express = require('express');
const dotenv = require('dotenv');
import rateLimit from 'express-rate-limit';
import axios from "axios";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { param, validationResult } from "express-validator";

dotenv.config();

if (!process.env.GEMINI_API_KEY || !process.env.POLYGON_API_KEY) {
  console.warn("⚠️ Warning: Missing GEMINI_API_KEY or POLYGON_API_KEY in .env file.");
}

const app = express();

// Middleware
app.use(cors({
  origin: 'https://stock-analyzer-fawn.vercel.app',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 500,
  message: "🚫 Too many requests from this IP. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// Quote endpoint
app.get("/api/quote/:symbol",
  param('symbol').isAlphanumeric().isLength({ min: 1, max: 10 }).withMessage('Invalid stock symbol'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    
    const { symbol } = req.params;
  
    try {
      const snapshotRes = await axios.get(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol.toUpperCase()}?apiKey=${POLYGON_API_KEY}`);
      const metaRes = await axios.get(`https://api.polygon.io/v3/reference/tickers/${symbol.toUpperCase()}?apiKey=${POLYGON_API_KEY}`);
  
      const snapshot = snapshotRes.data?.ticker;
      const metadata = metaRes.data?.results;

      if (!snapshot || Object.keys(snapshot).length === 0) {
        return res.status(404).json({ error: "Stock not found or no snapshot data available" });
      }

      const day = snapshot.day || {};
      const min = snapshot.min || {};

      const open = day.o || min.o || 0;
      const high = day.h || min.h || 0;
      const low = day.l || min.l || 0;
      const close = day.c || min.c || 0;
      const volume = day.v || min.v || 0;
   
      res.json({
        symbol: snapshot.ticker,
        name: metadata?.name ?? snapshot.ticker,
        exchange: metadata?.primary_exchange ?? "NASDAQ",
        price: Number(close),
        volume: volume,
        change: snapshot.todaysChange ?? 0,
        changePercent: snapshot.todaysChangePerc ?? 0,
        open: open,
        prevClose: snapshot.prevDay?.c ?? 0,
        high: high,
        low: low,
        avgVolume: metadata?.average_volume ?? null,
        marketCap: metadata?.market_cap ?? null,
        week52High: metadata?.week_52_high ?? null,
        week52Low: metadata?.week_52_low ?? null,
        description: metadata?.description ?? null,
      });      
    } catch (err) {
      console.error("Error fetching Polygon quote:", err.message);
      if (err.response && err.response.status === 404) {
        return res.status(404).json({ error: "Stock not found" });
      }
      res.status(500).json({ error: "Failed to fetch quote from Polygon" });
    }
  });

// Search endpoint
app.get("/api/search/:query", async (req, res) => {
    const { query } = req.params;
    try {
      const response = await axios.get(`https://api.polygon.io/v3/reference/tickers?search=${query}&active=true&limit=10&apiKey=${POLYGON_API_KEY}`);
      res.json(response.data.results || []);
    } catch (err) {
      console.error("Polygon search error:", err.message);
      if (err.response && err.response.status === 404) {
        return res.json([]); 
      }
      res.status(500).json({ error: "Search failed" });
    }
  });

// Chart endpoint
app.get("/api/chart/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const range = (req.query.range || "1D").toUpperCase();
  console.log(`📈 Chart requested: ${symbol} - ${range}`, req.query);

  const POLYGON_INTERVALS = {
    "1D": { multiplier: 1, timespan: "minute", from: 1 },
    "1W": { multiplier: 15, timespan: "minute", from: 7 },
    "1M": { multiplier: 1, timespan: "day", from: 30 },
    "6M": { multiplier: 1, timespan: "day", from: 180 },
    "1Y": { multiplier: 1, timespan: "day", from: 365 },
    "ALL": { multiplier: 1, timespan: "day", from: 1825 },
  };

  const { multiplier, timespan, from } = POLYGON_INTERVALS[range] || POLYGON_INTERVALS["1D"];
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setTime(toDate.getTime() - from * 24 * 60 * 60 * 1000);

  const fromStr = fromDate.toISOString().split("T")[0];
  const toStr = toDate.toISOString().split("T")[0];

  try {
    const polygonRes = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&apiKey=${POLYGON_API_KEY}`);
    const results = polygonRes.data?.results;

    if (!results || results.length === 0) {
      console.warn("⚠️ No chart data returned for:", symbol);
      return res.json([]);
    }

    res.json(results);
  } catch (err) {
    console.error("Chart data error:", err.message, err.response?.data);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});
  
// AI Suggestions  
app.get("/api/ai/suggest/:symbol", async (req, res) => {
    const { symbol } = req.params;
  
    const suggestionPrompt = `
  Give two bullet point suggestions for ${symbol} stock:
  1. Short-Term outlook (1-3 months)
  2. Long-Term outlook (6+ months)
  Use plain language, no disclaimers.
  `;
  
    const highlightsPrompt = `
  In 2-3 bullet points, explain the key drivers currently influencing ${symbol}'s stock trend.
  Use plain language. Return only the bullets.
  `;
  
    try {
      const suggestionRes = await genAI.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: "user", parts: [{ text: suggestionPrompt }] }],
      });
  
      const suggestionText = suggestionRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const [shortTerm, longTerm] = suggestionText
        .split(/\n/)
        .filter(line =>
          line.toLowerCase().includes("short-term") ||
          line.toLowerCase().includes("long-term")
        )
        .map(line => line.replace(/^(\*|\d+\.|\s)+/, "").trim());
  
      const highlightsRes = await genAI.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [{ role: "user", parts: [{ text: highlightsPrompt }] }],
      });
  
      const highlightsText = highlightsRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
      res.json({
        shortTerm: shortTerm ?? "Short-term insight unavailable.",
        longTerm: longTerm ?? "Long-term insight unavailable.",
        highlights: highlightsText.trim() || "No highlights available.",
      });
  
    } catch (err) {
      console.error("Gemini AI error:", err.message);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

// Top Gainers
app.get("/api/top-gainers", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_API_KEY}`
    );
  
    const result = response.data.tickers.map((t) => ({
      symbol: t.ticker,
      name: t.ticker, 
      price: t.lastTrade?.p ?? 0,
      changePercent: t.todaysChangePerc ?? 0,
      volume: t.day?.v ?? 0,
    }));

    res.json(result.slice(0, 5));
  } catch (err) {
    console.error("Top Gainers error:", err.message);
    res.status(500).json({ error: "Failed to fetch top gainers" });
  }
});
  
// Top Losers
app.get("/api/top-losers", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${POLYGON_API_KEY}`
    );

    const result = response.data.tickers.map((t) => ({
      symbol: t.ticker,
      name: t.ticker,
      price: t.lastTrade?.p ?? 0,
      changePercent: t.todaysChangePerc ?? 0,
      volume: t.day?.v ?? 0,
    }));

    res.json(result.slice(0, 5));
  } catch (err) {
    console.error("Top Losers error:", err.message);
    res.status(500).json({ error: "Failed to fetch top losers" });
  }
});
  
// Most Active Stocks
app.get("/api/most-active", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?sort=volume&order=desc&limit=100&apiKey=${POLYGON_API_KEY}`
    );

    const result = response.data.tickers
      .map((t) => ({
        symbol: t.ticker,
        name: t.ticker,
        price: t.lastTrade?.p ?? 0,
        changePercent: t.todaysChangePerc ?? 0,
        volume: t.day?.v ?? 0,
      }))
      .sort((a, b) => b.volume - a.volume) 
      .slice(0, 7); 

    res.json(result);
  } catch (err) {
    console.error("Most Active error:", err.message);
    res.status(500).json({ error: "Failed to fetch most active stocks" });
  }
});
  
// Top News
app.get("/api/news/top", async (req, res) => {
  try {
    const polygonRes = await axios.get(
      `https://api.polygon.io/v2/reference/news?limit=5&order=desc&apiKey=${POLYGON_API_KEY}`
    );

    const articles = polygonRes.data.results || [];
    if (!articles || articles.length === 0) {
      return res.status(404).json({ error: "No news found for this ticker" });
    }      

    const analyzed = await Promise.all(
      articles.map(async (article) => {
        const title = article.title;

        const prompt = `
Analyze the sentiment of the following news headline and return ONLY one word: Positive, Negative, or Neutral.

Headline: "${title}"
        `;

        try {
          const response = await genAI.models.generateContent({
            model: "gemini-1.5-pro",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          });

          const sentiment =
            response.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "Neutral";

          return {
            title,
            url: article.article_url,
            published: article.published_utc,
            source: article.publisher?.name || "Unknown",
            sentiment,
          };
        } catch (err) {
          console.error("Gemini error for:", title, err.message);
          return {
            title,
            url: article.article_url,
            published: article.published_utc,
            source: article.publisher?.name || "Unknown",
            sentiment: "Neutral",
          };
        }
      })
    );

    res.json(analyzed);
  } catch (err) {
    console.error("Top News error:", err.message);
    res.status(500).json({ error: "Failed to fetch top news" });
  }
});

// AI Chatbot
app.post("/api/ai/chat", async (req, res) => {
  const { question, symbol } = req.body;

  const prompt = `
You are a helpful AI financial assistant. Answer this question related to the stock ${symbol}:

"${question}"

Respond with a concise, investor-friendly answer.`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-1.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Sorry, I couldn’t find an answer.";
    res.json({ answer: text });
  } catch (err) {
    console.error("Gemini Chat error:", err.message);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

// Sector Overview
app.get("/api/sectors", async (req, res) => {
  const sectorETFs = [
    { name: "Technology", symbol: "XLK" },
    { name: "Healthcare", symbol: "XLV" },
    { name: "Financials", symbol: "XLF" },
    { name: "Energy", symbol: "XLE" },
    { name: "Consumer Discretionary", symbol: "XLY" },
  ];

  try {
    const results = await Promise.all(
      sectorETFs.map(async ({ name, symbol }) => {
        const res = await axios.get(
          `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON_API_KEY}`
        );
        return {
          name,
          changePercent: res.data.ticker.todaysChangePerc ?? 0,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Sector data fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch sector data" });
  }
});

// News by Symbol with Sentiment
app.get("/api/news/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const polygonRes = await axios.get(
      `https://api.polygon.io/v2/reference/news?ticker=${symbol.toUpperCase()}&limit=5&order=desc&apiKey=${POLYGON_API_KEY}`
    );

    const articles = polygonRes.data.results || [];
    if (!articles || articles.length === 0) {
      return res.status(404).json({ error: "No news found for this ticker" });
    }

    const analyzed = await Promise.all(
      articles.map(async (article) => {
        const title = article.title;

        const prompt = `
Analyze the sentiment of the following news headline and return ONLY one word: Positive, Negative, or Neutral.

Headline: "${title}"
        `;

        try {
          const response = await genAI.models.generateContent({
            model: "gemini-1.5-pro",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          });

          const sentiment = response.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "Neutral";

          return {
            title,
            url: article.article_url,
            published_utc: article.published_utc ?? null,
            source: article.publisher?.name || "Unknown",
            sentiment,
          };
        } catch (err) {
          console.error("Gemini error for:", title, err.message);
          return {
            title,
            url: article.article_url,
            published_utc: article.published_utc ?? null,
            source: article.publisher?.name || "Unknown",
            sentiment: "Neutral",
          };
        }
      })
    );

    res.json(analyzed);
  } catch (err) {
    console.error("News fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch news for this ticker" });
  }
});

// Market Status
app.get("/api/market-status", async (req, res) => {
  try {
    const result = await axios.get(`https://api.polygon.io/v1/marketstatus/now?apiKey=${POLYGON_API_KEY}`);
    res.json({
      status: result.data.market === "open" ? "OPEN" : "CLOSED",
      nextOpen: result.data.nextOpen,
      nextClose: result.data.nextClose,
    });
  } catch (err) {
    console.error("Market status fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch market status" });
  }
});
  
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Backend live at http://localhost:${PORT}`);
});