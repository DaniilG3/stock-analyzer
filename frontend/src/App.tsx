import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AsyncSelect from "react-select/async";
import axios from "axios";

// Types for the data structures

type Stock = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
};

type IndexData = {
  name: string;
  price: number;
  changePercent: number;
};

type Sector = {
  name: string;
  changePercent: number;
};

type NewsItem = {
  title: string;
  url: string;
  published: string;
  source: string;
  sentiment: string;
};

export default function App() {
  const navigate = useNavigate();

  // State variables
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [topGainers, setTopGainers] = useState<Stock[]>([]);
  const [topLosers, setTopLosers] = useState<Stock[]>([]);
  const [mostActive, setMostActive] = useState<Stock[]>([]);
  const [topNews, setTopNews] = useState<NewsItem[]>([]);
  const [marketStatus, setMarketStatus] = useState("LOADING...");
  const [quickPicks, setQuickPicks] = useState<Stock[]>([]);

  // Navigate to stock detail page
  const handleClick = async (symbol: string) => {
    try {
      await axios.get(`http://localhost:4000/api/quote/${symbol}`);
      navigate(`/stock/${symbol}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert(`⚠️ No data available for ${symbol}`);
      } else {
        alert(`❌ Failed to load ${symbol}`);
      }
    }
  };

  useEffect(() => {
    // Load quick popular stock cards
    const popularSymbols = ["AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "GOOGL"];
    Promise.all(
      popularSymbols.map((sym) =>
        axios.get(`http://localhost:4000/api/quote/${sym}`).then((res) => res.data)
      )
    ).then((results) => setQuickPicks(results));

    // Fetch all necessary market data
    const fetchAllData = async () => {
      const indexSymbols = [
        { symbol: "SPY", name: "S&P 500" },
        { symbol: "QQQ", name: "NASDAQ 100" },
        { symbol: "DIA", name: "Dow Jones" },
      ];

      const indexResults: IndexData[] = [];

      for (const idx of indexSymbols) {
        try {
          const res = await axios.get(`http://localhost:4000/api/quote/${idx.symbol}`);
          indexResults.push({
            name: idx.name,
            price: res.data.price,
            changePercent: res.data.changePercent,
          });
        } catch (err) {
          console.error(`Error fetching index ${idx.symbol}:`, (err as any).message);
        }
      }

      setIndices(indexResults);

      // Sector performance
      try {
        const sectorRes = await axios.get("http://localhost:4000/api/sectors");
        setSectors(sectorRes.data);
      } catch (err) {
        console.error("Sector fetch error:", (err as any).message);
      }

      // Top gainers, losers, and most active
      try {
        const [gainersRes, losersRes, activeRes] = await Promise.all([
          axios.get("http://localhost:4000/api/top-gainers"),
          axios.get("http://localhost:4000/api/top-losers"),
          axios.get("http://localhost:4000/api/most-active"),
        ]);
        setTopGainers(gainersRes.data);
        setTopLosers(losersRes.data);
        setMostActive(activeRes.data);
      } catch (err) {
        console.error("Top stocks fetch error:", (err as any).message);
      }

      // News
      try {
        const newsRes = await axios.get("http://localhost:4000/api/news/top");
        setTopNews(newsRes.data);
      } catch (err) {
        console.error("Failed to fetch top news", (err as any).message);
      }
    };

    axios
      .get("http://localhost:4000/api/market-status")
      .then((res) => setMarketStatus(res.data.status))
      .catch(() => setMarketStatus("UNKNOWN"));

    fetchAllData();
  }, []);

  // Stock search bar options
  type Option = {
    label: string;
    value: string;
  };

  const loadOptions = async (inputValue: string): Promise<Option[]> => {
    if (!inputValue) return [];
    const res = await axios.get(`http://localhost:4000/api/search/${inputValue}`);
    return res.data.map((stock: any) => ({
      label: `${stock.ticker} - ${stock.name}`,
      value: stock.ticker,
    }));
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Search bar at top of page */}
        <AsyncSelect
          cacheOptions
          loadOptions={loadOptions}
          onChange={(selected: Option | null) => {
            if (selected) navigate(`/stock/${selected.value}`);
          }}
          placeholder="Search stocks..."
          className="text-black"
          styles={{
            control: (base, state) => ({
              ...base,
              backgroundColor: "#0F172A",
              borderColor: state.isFocused ? "#9333EA" : "#4B5563",
              boxShadow: state.isFocused ? "0 0 10px #9333EA" : "none",
              borderRadius: "0.5rem",
              paddingLeft: "0.5rem",
              minHeight: "44px",
              color: "white",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
            }),
            input: (base) => ({
              ...base,
              color: "white",
              margin: 0,
              padding: 0,
            }),
            valueContainer: (base) => ({
              ...base,
              padding: "2px 8px",
            }),
            singleValue: (base) => ({
              ...base,
              color: "white",
            }),
            option: (base, { isFocused }) => ({
              ...base,
              backgroundColor: isFocused ? "#334155" : "#0F172A",
              color: "white",
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: "#0F172A",
              zIndex: 10,
            }),
          }}
        />

        {/* Popular Stocks */}    
        <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all">
        <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Popular Stocks
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
            {quickPicks.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => handleClick(stock.symbol)}
                className="cursor-pointer p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500 rounded-lg transition flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-white">{stock.symbol}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-300">${stock.price.toFixed(2)}</div>
                  <div className={`text-sm ${stock.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(stock.changePercent >= 0 ? "+" : "") + stock.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Market Status */}
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all w-full">
            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Market Status
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>NYSE</span>
                <span className={`font-semibold ${marketStatus === "OPEN" ? "text-green-400" : "text-red-400"}`}>
                  {marketStatus}
                </span>
              </div>
              {indices.map((index) => (
                <div key={index.name} className="flex justify-between">
                  <div>
                    <div className="font-semibold">{index.name}</div>
                    <div className="text-sm text-gray-400">
                      ${index.price.toFixed(2)} <span className="ml-2 text-xs">via ETF</span>
                    </div>
                  </div>
                  <span className={index.changePercent >= 0 ? "text-green-400" : "text-red-400"}>
                    {(index.changePercent >= 0 ? "+" : "") + index.changePercent.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sector Performance */}
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all w-full">
            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Sector Performance
            </h2>
            <div className="space-y-3">
              {sectors.map((sector) => (
                <div key={sector.name} className="flex justify-between items-center">
                  <span>{sector.name}</span>
                  <div className="flex items-center gap-1">
                    <span className={sector.changePercent >= 0 ? "text-green-400" : "text-red-400"}>
                      {(sector.changePercent >= 0 ? "+" : "") + sector.changePercent.toFixed(1)}%
                    </span>
                    <span>{sector.changePercent >= 0 ? "📈" : "📉"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top Gainers */}
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all w-full">
            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Top Gainers
            </h2>
            <div className="space-y-2">
              {topGainers.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => handleClick(stock.symbol)}
                  className="space-y-1 cursor-pointer hover:bg-gray-800 p-2 rounded transition"
                >
                  <div className="flex justify-between font-semibold">
                    <span>{stock.symbol}</span>
                    <span className="text-green-400">{stock.changePercent.toFixed(2)}%</span>
                  </div>
                  <div className="text-sm text-gray-400 flex justify-between">
                    <span>{stock.name || stock.symbol}</span>
                    <span>{stock.price > 0 ? `$${stock.price.toFixed(2)}` : "N/A"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all w-full">
            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Top Losers
            </h2>
            <div className="space-y-2">
              {topLosers.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => handleClick(stock.symbol)}
                  className="space-y-1 cursor-pointer hover:bg-gray-800 p-2 rounded transition"
                >
                  <div className="flex justify-between font-semibold">
                    <span>{stock.symbol}</span>
                    <span className="text-red-400">{stock.changePercent.toFixed(2)}%</span>
                  </div>
                  <div className="text-sm text-gray-400 flex justify-between">
                    <span>{stock.name || stock.symbol}</span>
                    <span>{stock.price > 0 ? `$${stock.price.toFixed(2)}` : "N/A"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Active */}
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] transition-all w-full">
            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Most Active
            </h2>
            <div className="space-y-2">
              {mostActive.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => handleClick(stock.symbol)}
                  className="flex justify-between items-center cursor-pointer hover:bg-gray-800 p-2 rounded transition"
                >
                  <div>
                    <div className="font-bold">{stock.symbol}</div>
                    <div className="text-sm text-gray-400">{stock.name || stock.symbol}</div>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    <div>Volume</div>
                    <div className="text-white">{stock.volume.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Top 5 News Overall */}
        <div className="bg-gray-900 p-6 mt-12 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
          <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Latest News & Sentiment
          </h2>
          <div className="space-y-4">
            {topNews.map((article) => (
              <div
                key={article.url}
                className="p-4 rounded-md border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-purple-500 hover:shadow-purple-500/50 transition-all duration-200"
              >
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-purple-300 hover:underline"
                >
                  {article.title}
                </a>
                <div className="text-sm text-gray-400">
                  {article.published
                    ? new Date(article.published).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Unknown date"}
                  </div>
                <div className="mt-1 text-sm">
                  <span className="font-semibold text-white">Sentiment:</span>{" "}
                  <span
                    className={
                      article.sentiment === "Positive"
                        ? "text-green-400"
                        : article.sentiment === "Negative"
                        ? "text-red-400"
                        : "text-yellow-300"
                    }
                  >
                    {article.sentiment} {article.sentiment === "Positive" ? "😄" : article.sentiment === "Negative" ? "😠" : "😐"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-500 mt-8 mb-4">
        © 2025 Daniil Goncharuk. All rights reserved.
      </div>
    </div>
  );
}
