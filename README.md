# BET HORIZON | AI-Powered Sports Betting Optimization Platform

Outsmart traditional bookmakers with **BET HORIZON**. Modeled on the quantitative architecture of **FPL Horizon**, **BET HORIZON** leverages **Dixon-Coles Bivariate Poisson Matrices**, **Shin's Market De-Vigging Method**, **XGBoost Player Prop Regressors**, and **Fractional Kelly Staking Algorithms** to identify price mismatches (+EV bargains) and manage capital growth without emotional drawdown risk.

---

## 🌟 Key Features & Quantitative Modules

### 1. 🎯 Live Price Mismatch (+EV) Bargain Feed
- **Pinnacle Market Fusion:** Strips bookmaker overround (margin/vig) using Shin's Method to compute the true, un-biased market probability.
- **+EV Edge Calculation:** Automatically highlights mispriced odds on bookmaker platforms (e.g. SportyBet) where the offered price exceeds model fair value.
- **Copy Signal:** One-click copying of structured signal payloads formatted for telegram/whatsapp sharing.

### 2. 🧮 Dixon-Coles Poisson Scoreline Matrix
- Computes exact home vs away score probabilities using a bivariate Poisson distribution.
- Integrates tau-adjustment parameter to correct for low-score correlation biases (0-0, 1-0, 0-1, 1-1 scorelines).

### 3. 🤖 XGBoost Player Prop Regression Engine
- Regresses player prop lines (Anytime Goalscorer, Shots on Target, Assists) using expected goals per 90 (xG/90), expected assists (xA/90), fixture difficulty ratings, and predicted minutes (xMins).

### 4. 🛡️ Fractional Kelly Bankroll Manager & Capital Allocator
- Enforces strict 1%–3% per-bet staking limits based on fractional Kelly criterion (0.15x to 0.50x Kelly multiplier).
- Eliminates tilt, revenge betting, and emotional over-leveraging.
- Interactive 9-month compounding timeline projection assuming a +12% target monthly yield.

### 5. ⚙️ 3 Distinct Strategy Modes
- **SAFE Mode (1% Max Stake • 0.15x Kelly):** Capital preservation mode targeting high-probability match locks (odds 1.30–1.70) with minimal variance.
- **VALUE Mode (2% Max Stake • 0.25x Kelly — Default):** The mathematical sweet spot for optimal logarithmic compounding growth (+8% EV edge, odds 1.75–2.45).
- **RISKY Mode (3% Max Stake • 0.50x Kelly):** High-yield mode targeting major bookmaker mispriced longshots (+15% EV edge, odds 2.50+).

---

## 🛠️ Tech Stack & Design System

- **Framework:** React 19 + TypeScript + Vite
- **Styling:** TailwindCSS with custom FPL Horizon dark theme design system
  - `--color-fpl-green`: `#00ff85`
  - `--color-fpl-pink`: `#ff005a`
  - `--color-fpl-purple`: `#37003c`
  - `--color-card-bg`: `#0f172a`
- **Icons:** Lucide React (`lucide-react`)
- **Deployment:** Vercel

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/QuisTech/bet-admin.git
   cd bet-admin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server on port 3010:
   ```bash
   npm run dev -- --port 3010
   ```

4. Open your browser at [http://localhost:3010/](http://localhost:3010/).

### Production Build

To build the static bundle for production:
```bash
npm run build
```

---

## 🌐 Live Links & Deployment

- **GitHub Repository:** [https://github.com/QuisTech/bet-admin](https://github.com/QuisTech/bet-admin)
- **Production Deployment:** [https://bet-admin-aqkq0p55y-quistechs-projects.vercel.app](https://bet-admin-aqkq0p55y-quistechs-projects.vercel.app)

---

## ⚠️ Disclaimer

BET HORIZON is an analytical decision-support and expected value (+EV) research tool. It does not facilitate real-money gambling or bookmaking services. Always practice responsible bankroll management.
