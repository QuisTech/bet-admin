# BET HORIZON | AI-Powered Sports Betting Optimization Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bet--admin--iota.vercel.app-emerald?style=for-the-badge&logo=vercel)](https://bet-admin-iota.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-cyan?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

Outsmart traditional bookmakers with **BET HORIZON**. Designed for quantitative research and decision support, **BET HORIZON** leverages **Dixon-Coles Bivariate Poisson Matrices**, **Shin's Market De-Vigging Method**, **Offline-Trained XGBoost Regressors**, and an **Evolutionary Strategy (Genetic Algorithm) Meta-Learner** to identify mathematical price mismatches (+EV bargains) and optimize capital growth with Fractional Kelly sizing.

---

## 🌐 Live Deployment

👉 **Production Application:** [https://bet-admin-iota.vercel.app/](https://bet-admin-iota.vercel.app/)

- **Immediate Access**: Loads with a pre-baked European benchmark dataset across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, and Champions League.
- **Optional Live Feed**: Paste your free [The Odds API](https://the-odds-api.com/) key in the settings modal to instantly switch to real-time sportsbook lines and live FPL player data.

---

## 🌟 Key Features & Quantitative Modules

### 1. 🎯 Dual-Pipeline Machine Learning & Consensus Engine
- **Pipeline 1: Domain Ensemble (Live Champion)**: Bivariate Dixon-Coles Poisson matrices, low-score tau corrections, and Shin (1993) Pinnacle de-vigging.
- **Pipeline 2: Trained XGBoost (Offline Challenger)**: 100 gradient-boosted decision trees trained on 5 complete European football seasons (~9,500 matches) with Platt scaling calibration.
- **Dynamic Consensus Blend**: Evaluates consensus probability, model delta spread, and flags divergence alerts.

### 2. 🧬 Evolutionary Strategy (ES) Meta-Learner
- In-browser genetic algorithm simulating **150 generations of natural selection, crossover, and mutation**.
- Optimizes blending weights ($\alpha$ Domain vs $\beta$ XGBoost) and Kelly multipliers per league.
- Pre-evolved Pareto-optimal factory weights for the Big 5 European leagues + Champions League.

### 3. 🛡️ Fractional Kelly Bankroll Allocator & Safety Modes
- **SAFE Mode (1% Max Stake • 0.15x Kelly)**: Capital preservation targeting high-probability match locks (odds 1.15–1.70).
- **VALUE Mode (2% Max Stake • 0.25x Kelly — Default)**: Optimal logarithmic compounding growth (+8% EV edge).
- **RISKY Mode (3% Max Stake • 0.50x Kelly)**: Aggressive growth targeting mispriced longshots (+15% EV edge).

### 4. 🧮 Empirical Bayesian Shrinkage for Player Props
- Regresses small sample sizes (< 450 minutes) toward positional baselines, preventing distortions on substitute players.
- Restricts Anytime Goalscorer lines strictly to starters with $\ge 50$ expected minutes.

### 5. ⚡ Multi-Criteria Sort & Quant Terminal
- Instant sorting by:
  - 🚀 **Highest +EV Edge (%)**
  - 🛡️ **Highest Win Probability (%)**
  - 🎯 **Strongest Model Agreement (Lowest Spread)**
  - 💰 **Highest Projected Profit (₦)**
  - 🔒 **Heavy Favorites First (Low Odds)**
  - ⚡ **Value Underdogs First (High Odds)**

---

## 🛠️ Tech Stack & Design System

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS with bespoke Obsidian Dark Theme design system
- **Charts & Graphs**: Recharts + Custom SVG Genetic Convergence Curves
- **Icons**: Lucide React (lucide-react)
- **Hosting**: Vercel (Static Client-Side SPA)

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   `ash
   git clone https://github.com/QuisTech/bet-admin.git
   cd bet-admin
   `

2. Install dependencies:
   `ash
   npm install
   `

3. Start the development server on port 3010:
   `ash
   npm run dev -- --port 3010
   `

4. Open your browser at [http://localhost:3010/](http://localhost:3010/).

### Production Build

`ash
npm run build
`

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

**Decision-Support Tool Only:** BET HORIZON is an analytical research and expected value (+EV) calculation engine. It does not accept wagers, place bets, or operate as a gambling operator. All odds, probabilities, and model projections are mathematical estimations for educational and decision-support purposes only. Users are strictly responsible for adhering to their local gambling laws and practicing responsible bankroll management. Past statistical edge is not indicative of future results.
