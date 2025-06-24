# 🚀 Stock Analyzer

A sleek, AI-powered stock market analytics web application. Get real-time stock data, AI-generated insights, news sentiment, and interactive charts — all in one place!

🌐 **Live Website:** [View Live](https://stock-analyzer-dg.vercel.app)

## ⚡ Features

- 🔍 **Stock Search** — Quickly look up any stock by symbol or company name.
- 📈 **Interactive Charts** — View open, close, SMA, and more using Chart.js.
- 🤖 **AI-Powered Summaries** — Get AI-generated stock outlooks and key drivers.
- 📰 **News with Sentiment** — See top news with sentiment analysis (Positive / Neutral / Negative).
- 💬 **AI Chatbot** — Ask natural-language questions about any stock.
- 📊 **Market Overview** — Track indices, top gainers/losers, and sectors at a glance.
- 🗄️ **SQL-Backed Data** — Stock data, AI summaries, and news sentiment stored and queried efficiently with PostgreSQL.

## 🛠 Tech Stack

| Frontend | Backend | AI | Data | Hosting |
|----------|---------|----|------|---------|
| React, TailwindCSS, Chart.js | Node.js, Express, FastAPI | Gemini API | Polygon.io, Yahoo Finance API, PostgreSQL | Vercel (frontend), Railway (backend) |

## 🚀 Getting Started

### 1️⃣ Clone the repo
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```
### 2️⃣ Set up environment variables
Create a `.env` file:
```
EMINI_API_KEY=your_gemini_key
POLYGON_API_KEY=your_polygon_key
```
### 3️⃣ Run the backend
```
cd backend
npm install
npm run dev
```
### 4️⃣ Run the frontend
```
cd frontend
npm install
npm run dev
```
