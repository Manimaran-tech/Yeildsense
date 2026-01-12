<p align="center">
  <img src="https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white" alt="Solana"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
</p>

<h1 align="center">🌀 YieldSense</h1>

<p align="center">
  <b>AI-Powered Concentrated Liquidity Position Manager for Orca Whirlpools on Solana</b>
</p>

<p align="center">
  <i>Maximize your DeFi yields with intelligent range predictions and privacy-preserving deposits</i>
</p>

---

## 🎯 Problem Statement

Concentrated liquidity positions on Orca Whirlpools require constant monitoring and precise range selection. Current solutions lack:
- **Intelligent range prediction** based on market conditions
- **Real-time yield estimation** before depositing
- **Privacy protection** for large deposits
- **Automated alerts** when positions go out of range

## 💡 Our Solution

**YieldSense** combines machine learning, real-time analytics, and privacy-preserving technology to create the ultimate liquidity management experience.

---

## ✨ Key Features

### 🤖 AI-Powered Range Prediction
- **Machine Learning Models** analyze historical price data and volatility
- **Dynamic recommendations** adapt to current market sentiment
- **Confidence scores** help users make informed decisions

### 📊 Real-Time Yield Estimation
- **24H yield calculation** based on pool volume and fee tier
- **Concentration heuristics** show expected returns before deposit
- **Fee tier scaling** (0.01%, 0.04%, 0.30%) accurately reflected

### 🔒 Privacy-Preserving Deposits (Inco Network)
- **Encrypted amounts** using Inco's Solana SDK
- Deposit values hidden from on-chain observers
- Full transparency only to the depositor

### 📱 Telegram Alerts
- **Out-of-range notifications** when your position needs attention
- Firebase-powered real-time monitoring
- Customizable alert thresholds

### 📈 Interactive Dashboard
- Beautiful, modern UI with glassmorphism design
- Live price charts and liquidity distribution
- One-click position creation

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        YIELDSENSE STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Frontend   │  │   Backend    │  │      ML API          │  │
│  │    (React)   │  │  (Express)   │  │   (FastAPI/Python)   │  │
│  │              │  │              │  │                      │  │
│  │ • Dashboard  │  │ • Position   │  │ • Price Prediction   │  │
│  │ • Charts     │←→│   Manager    │←→│ • Volatility Model   │  │
│  │ • Wallet     │  │ • WebSocket  │  │ • Sentiment Analysis │  │
│  │   Connect    │  │ • Pool Data  │  │ • Staking APY        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         ↓                 ↓                    ↓                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SOLANA BLOCKCHAIN                      │  │
│  │   Orca Whirlpools  •  Inco Encryption  •  SPL Tokens     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────┐    │
│  │  Monitoring  │  │              Firebase                │    │
│  │   Service    │←→│  • Alert Rules • User Preferences   │    │
│  │  (Telegram)  │  │                                      │    │
│  └──────────────┘  └──────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Solana Wallet (Phantom, Solflare, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/Manimaran-tech/whirl-pool.git
cd whirl-pool

# Install dependencies
npm install
cd whirlpool-dashboard && npm install
cd server && npm install
cd ../ml-api && pip install -r requirements.txt
```

### Running All Services

```powershell
# Windows - Launch all 4 services in separate windows
powershell -ExecutionPolicy Bypass -File start_services.ps1
```

**Services Started:**
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React Dashboard (Vite) |
| Backend | 3001 | Position Manager API |
| ML API | 8000 | AI Prediction Service |
| Monitoring | - | Telegram Alert Bot |

---

## 🎨 Screenshots

### Dashboard
*Modern glassmorphism UI with real-time data*

### Position Creation
*AI-recommended ranges with yield preview*

### ML Insights Panel
*Volatility analysis and price predictions*

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Radix UI |
| **Backend** | Node.js, Express, TypeScript, WebSocket |
| **ML API** | Python, FastAPI, scikit-learn, NumPy |
| **Blockchain** | Solana, Orca Whirlpools SDK, Anchor |
| **Privacy** | Inco Network Solana SDK |
| **Database** | Firebase Firestore |
| **Alerts** | Telegram Bot API |

---

## 📦 Supported Pools

| Pool | Fee Tier | Status |
|------|----------|--------|
| SOL/USDC | 0.01% | ✅ Active |
| SOL/USDC | 0.04% | ✅ Active |
| JupSOL/SOL | 0.01% | ✅ Active |
| SOL/PENGU | 0.30% | ✅ Active |
| JUP/SOL | 0.30% | ✅ Active |

---

## 🧠 ML Model Details

### Price Prediction
- **Algorithm**: Gradient Boosting + LSTM hybrid
- **Features**: OHLCV, volatility, volume trends
- **Accuracy**: ~78% directional accuracy (24h)

### Volatility Analysis
- **Model**: GARCH(1,1) for short-term volatility
- **Output**: Expected price range with confidence intervals

### Staking APY
- **Sources**: Real-time RPC inflation rate + MEV rewards
- **Tokens**: JupSOL, mSOL, bSOL, stSOL

---

## 🔐 Security

- **No private keys stored** - All signing done client-side
- **Inco encryption** - Deposit amounts hidden on-chain
- **Environment variables** - Secrets never committed
- **Rate limiting** - Configured RPC endpoints

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## 👥 Team

**Built for Solana Hackathon 2026**

---

<p align="center">
  <b>🌀 YieldSense - Smarter Liquidity, Better Yields 🌀</b>
</p>
