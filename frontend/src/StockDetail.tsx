import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import axios from "axios";
import { motion } from "framer-motion";
import type { ChartOptions } from 'chart.js';
const API_BASE = import.meta.env.VITE_API_URL;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

export default function StockDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState("1D");
  const [chartData, setChartData] = useState<any>(null);
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ shortTerm: string; longTerm: string; highlights: string} | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchChartData() {
      if (!symbol) return;
      try {
        const res = await axios.get(`${API_BASE}/api/chart/${symbol}?range=${selectedPeriod}`);
        const chartPoints = res.data;
        setChartData({
          labels: chartPoints.map((point: any) => new Date(point.t)),
          datasets: [
            {
              label: `${symbol} Close Price`,
              data: chartPoints.map((point: any) => point.c),
              borderColor: "rgb(147, 51, 234)",
              backgroundColor: "rgba(147, 51, 234, 0.5)",
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: "rgb(147, 51, 234)",
            },
          ],
        });
      } catch (err) {
        console.error("Chart fetch error:", err);
      }
    }
    fetchChartData();
  }, [symbol, selectedPeriod]);

  useEffect(() => {
    if (!symbol) return;
    async function fetchRealTimeData() {
      try {
        const res = await axios.get(`${API_BASE}/api/quote/${symbol}`);
        setRealTimeData(res.data);
      } catch (err) {
        console.error("Real-time fetch error:", err);
      }
    }
    fetchRealTimeData();
  }, [symbol]);

  useEffect(() => {
    async function fetchAISuggestion() {
      try {
        const res = await axios.get(`${API_BASE}/api/ai/suggest/${symbol}`);
        setAiSuggestion(res.data);
      } catch (err) {
        console.error("AI suggestion error:", err);
      }
    }
    if (symbol) fetchAISuggestion();
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/news/${symbol}`);
        if (res.status === 404) {
          setNews([]);
        } else {
          setNews(res.data);
        }        
      } catch (err: any) {
        console.error(`News fetch error for ${symbol}:`, err.message);
        setNews([]);
      }
    };
    fetchNews();
  }, [symbol]);

  const dataSource = realTimeData;
  if (!dataSource) {
    return <div className="text-white p-6">Loading stock data...</div>;
  }

  const currentPrice = dataSource.price;
  const changePercent = dataSource.changePercent;

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit:
            selectedPeriod === "1D" ? "hour" :
            selectedPeriod === "1W" ? "day" :
            selectedPeriod === "1M" ? "day" :
            selectedPeriod === "6M" ? "month" :
            selectedPeriod === "1Y" ? "month" : "year",
        },
        grid: { display: false },
        ticks: { color: "#9ca3af" },
      },
      y: {
        grid: { color: "rgba(75, 85, 99, 0.2)" },
        ticks: {
          color: "#9ca3af",
          callback: (val: any) => `$${val.toFixed(2)}`
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgb(147, 51, 234)",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx) => `$${ctx.parsed.y.toFixed(2)}`
        }
      }
    }
  };

  const periods = ["1D", "1W", "1M", "6M", "1Y", "ALL"];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <motion.button
        onClick={() => navigate('/')}
        whileHover={{ scale: 1.05 }}
        className="mb-4 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
      >
        ← Back to Dashboard
      </motion.button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
        <div className="bg-gray-900 p-6 mt-2 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">{dataSource.name || "N/A"}</h1>
              <p className="text-gray-400">{dataSource.symbol || symbol} • {dataSource.exchange || "Unknown Exchange"}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">${Number(currentPrice).toFixed(2)}</div>
              <div className={Number(changePercent) >= 0 ? "text-green-400" : "text-red-400"}>
                {Number(changePercent) >= 0 ? "+" : ""}{Number(changePercent).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="h-[400px] mb-6">
            {chartData?.labels?.length ? (
              <Line data={chartData} options={options} />
            ) : (
              <div className="text-red-400 text-center mt-12">⚠️ No chart data available for {symbol} - {selectedPeriod}</div>
            )}
          </div>
          
          <div className="flex justify-center gap-4">
            {periods.map((period) => (
              <button
                key={period}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? "bg-purple-500 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gray-900 p-6 mt-2 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
            <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Market Stats
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400">Open Price</p>
                <p className="text-xl">${dataSource.open?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Previous Close</p>
                <p className="text-xl">${dataSource.prevClose?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Day’s Range</p>
                <p className="text-xl">${dataSource.low?.toFixed(2)} – ${dataSource.high?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400">52-Week Range</p>
                <p className="text-xl">
                  ${dataSource.week52Low?.toFixed(2) ?? "N/A"} – ${dataSource.week52High?.toFixed(2) ?? "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Volume</p>
                <p className="text-xl">{dataSource.volume?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400">Avg. Volume</p>
                <p className="text-xl">{dataSource.avgVolume?.toLocaleString() ?? "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-400">Market Cap</p>
                <p className="text-xl">
                  {dataSource.marketCap
                    ? `$${(dataSource.marketCap / 1e12).toFixed(2)}T`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-6 mt-12 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
            <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Company Overview
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {dataSource.description
                ? dataSource.description
                : `${dataSource.name} (${dataSource.symbol}) is a leading company in the ${dataSource.sector} sector, traded on the ${dataSource.exchange}.`}
            </p>
          </div>
        </div>
      </div>

      {aiSuggestion && (
        <div className="bg-gray-900 p-6 mt-12 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
          <h2 className="text-xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            AI Suggestions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-purple-400 transition-all">
              <h3 className="text-lg font-bold text-purple-400 mb-2">Short-Term Outlook</h3>
              <p>{aiSuggestion.shortTerm.replace(/\*\*/g, '').replace(/^Short-Term.*?:/, '').trim()}</p>
              </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-purple-400 transition-all">
              <h3 className="text-lg font-bold text-purple-400 mb-2">Long-Term Outlook</h3>
              <p>{aiSuggestion.longTerm.replace(/\*\*/g, '').replace(/^Long-Term.*?:/, '').trim()}</p>
              </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-purple-400 transition-all">
            <h3 className="text-lg font-bold text-purple-400 mb-4">Key Drivers / AI Highlights</h3>
            <ul className="space-y-2 list-disc list-inside text-gray-300">
              {aiSuggestion.highlights
                .split("*")
                .map((item) => item.trim())
                .filter((line) => line.length > 0)
                .map((line, idx) => {
                  const [title, ...rest] = line.split(":");
                  const description = rest.join(":").trim();

                  return (
                    <li key={idx} className="flex items-baseline text-gray-300 leading-6">
                      <span className="text-purple-400 mr-2">•</span>
                      <span>
                        <span className="font-semibold">{title.trim()}</span>
                        {description && <>: {description}</>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <div className="bg-gray-900 p-6 mt-12 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
          <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            AI Chatbot Q&A
          </h2>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="mb-4 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            {chatOpen ? "Hide Chat" : "💬 Ask AI About This Stock"}
          </button>

          {chatOpen && (
            <div className="transition-all space-y-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What's the outlook for TSLA?"
                className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={async () => {
                  setLoading(true);
                  setAnswer("");
                  try {
                    const res = await axios.post(`${API_BASE}/api/ai/chat`, {
                      question,
                      symbol,
                    });
                    setAnswer(res.data.answer);
                  } catch {
                    setAnswer("❌ Failed to get a response.");
                  }
                  setLoading(false);
                }}
                disabled={loading}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition disabled:opacity-50"
              >
                {loading ? "Thinking..." : "Ask"}
              </button>
              {answer && (
                <div className="bg-gray-800 p-4 rounded-lg border border-purple-500 text-gray-300 whitespace-pre-wrap">
                  {answer}
                </div>
              )}
            </div>
          )}
        </div>

        {news.length > 0 && (
          <div className="bg-gray-900 p-6 mt-12 rounded-lg border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.8)] transition-shadow">
            <h2 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Latest News & Sentiment
            </h2>
            <div className="space-y-4">
              {news.map((article) => (
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
                    {new Date(article.published_utc).toLocaleString()}
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
        )}
        <div className="text-center text-xs text-gray-500 mt-8 mb-4">
          © 2025 Daniil Goncharuk. All rights reserved.
        </div>
    </div>
  );
}
