# Node-by-Node Improvement Guide

## 📊 Data Flow Understanding

```
Adaptive Engine v8 (Top 50 coins)
    ↓
Get Klines (15m, 1h, 4h) - parallel fetch
    ↓
TA Processors (proces 15min, process 1h, proces 4h) - calculate indicators + VP
    ↓
Merge all TA data by symbol
    ↓
Fetch Order Book + Funding History
    ↓
Final Merge (Code in JavaScript2)
    ↓
RATING NODE ← You are here! (receives full enriched data)
    ↓
SL/TP Finder
    ↓
Leverage Finder
    ↓
Trade Selector
    ↓
Trade Execution
```

---

## 🎯 Rating Node Input Structure

The rating node receives coins with this structure:

```javascript
{
  // FROM ADAPTIVE ENGINE
  symbol: "ETHUSDT",
  name: "Ethereum",
  price: 3245.50,
  logo: "https://...",
  score: 87.5,              // Adaptive engine score (0-100)
  tier: "A",                // A, B, C tier
  tags: ["ALTRANK_IMPROVING", "HIGH_ENGAGEMENT"],
  reasons: ["AltRank ↑ by 75", "Sentiment 82"],

  derived: {
    pct_change_1h: 2.1,
    pct_change_24h: 4.5,
    volatility: 0.045,
    oi_ratio: 0.28,
    engagement_efficiency: 65,
    galaxy: 72.5,
    galaxy_jump: 5.2,
    alt_rank: 145,
    alt_rank_jump: 85,
    sentiment: 68,
    volume24h: 45000000,
    turnover24h: 150000000,
    openInterestValue: 35000000,
    fundingRate: 0.0001
  },

  raw: {
    // Full raw data from Bybit + LunarCrush
    bybit_symbol: "ETHUSDT",
    lastPrice: 3245.50,
    // ... more fields
  },

  // FROM TA PROCESSORS (15m, 1h, 4h)
  ta_15m_with_vp: {
    ema_20: 3240.20,
    ema_50: 3230.10,
    ema_200: 3180.50,
    rsi: 62.5,
    atr: 45.20,
    adx: 28.5,
    plusDI: 25.3,
    minusDI: 18.2,
    bollinger: {
      upper: 3280.00,
      middle: 3245.00,
      lower: 3210.00,
      bandwidth: 2.15
    },
    market_structure: {
      structure: "UPTREND",
      support: 3220.00,
      resistance: 3280.00,
      support_levels: [3220, 3200, 3180],
      resistance_levels: [3280, 3300, 3320]
    },
    fibonacci: {
      swing_high: 3300,
      swing_low: 3150,
      retracements: {...}
    },

    // 🆕 VOLUME PROFILE (S-Tier)
    volume_profile: {
      point_of_control: 3245.00,  // Price with highest volume
      value_area_high: 3270.00,   // Top of 70% volume zone
      value_area_low: 3220.00,    // Bottom of 70% volume zone
      price_position: "INSIDE_VALUE",  // or "AT_POC", "ABOVE_VALUE", "BELOW_VALUE"
      at_POC: false,
      poc_distance_pct: 0.15,

      high_volume_nodes: [        // Institutional support/resistance
        { price: 3245.00, volume: 12500000, percentile: 0.95 },
        { price: 3230.00, volume: 8500000, percentile: 0.88 },
        { price: 3260.00, volume: 7500000, percentile: 0.82 }
      ],

      low_volume_nodes: [         // Weak zones (price will fly through)
        { price: 3290.00, volume: 250000, percentile: 0.12 }
      ],

      volume_distribution: [...], // Full distribution
      total_volume: 45000000
    }
  },

  ta_1h_with_vp: {
    // Same structure as 15m
  },

  ta_4h_with_vp: {
    // Same structure as 15m
  },

  // FROM ORDER BOOK
  order_book: {
    bids: [...],
    asks: [...],
    bid_volume: 12500,
    ask_volume: 8500,
    imbalance: 0.19,  // (bid_vol - ask_vol) / (bid_vol + ask_vol)
    spread_bps: 8.5
  },

  // FROM FUNDING HISTORY
  funding_history: [
    { timestamp: ..., fundingRate: 0.0001 },
    // ...
  ],

  // FROM INSTRUMENT INFO
  data: {
    tickSize: 0.01,
    qtyStep: 0.001,
    maxLeverage: 25,
    minOrderQty: 0.001
  }
}
```

---

## 🔧 Node 1: RATING NODE - Improved Version

### Current Problems in v4.0

The current rating node is actually already quite good! But we can enhance it:

❌ **No momentum decay detection** (momentum from 12h ago vs 1h ago)
❌ **No volatility regime classification** (uses raw volatility number)
❌ **VP scoring could be smarter** (doesn't check multi-TF POC alignment)
❌ **Missing correlation with BTC** (should reduce score if BTC bearish)
❌ **No funding rate sentiment** (extreme funding should affect score)

### NEW RATING NODE v5.0

<function_calls>
<invoke name="Write">
<parameter name="content">// ═══════════════════════════════════════════════════════════════════════════
// 🎯 RATING NODE v5.0 - ENHANCED WITH SMARTER VP + MOMENTUM DECAY ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v5.0:
// ✅ Momentum decay detection (recent vs old momentum)
// ✅ Volatility regime classification (5 levels)
// ✅ Multi-timeframe POC alignment bonus (+15 pts)
// ✅ BTC correlation adjustment (reduce score if BTC bearish)
// ✅ Funding rate sentiment (extreme funding = contrarian signal)
// ✅ Order book imbalance weighting (>70% = extra points)
// ✅ Volume Profile quality tiers (S/A/B/C/D)
// ✅ Social momentum vs price action alignment check
//
// IMPROVEMENTS FROM v4.0:
// - Smarter VP usage (checks alignment across TFs)
// - Momentum recency weighting (1h > 24h)
// - BTC regime filter (don't long alts in BTC dump)
// - Funding contrarian signals
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

console.log(`\n🎯 RATING NODE v5.0 ENHANCED - Processing ${candidates.length} coins`);
console.log(`   🆕 Momentum Decay + Multi-TF POC + BTC Correlation!`);

//===============================================================================
// CONFIGURATION
//===============================================================================

const CONFIG = {
  // VP Quality Scoring
  VP_QUALITY_SCORES: {
    MULTI_TF_POC: 15,        // All 3 TFs at POC = GOLDEN
    ALL_IN_VALUE: 10,        // All 3 TFs in value area
    SINGLE_POC_4H: 8,        // 4H at POC only
    SINGLE_POC_1H: 5,        // 1H at POC only
    IN_VALUE_4H: 6,          // 4H in value area
    IN_VALUE_1H: 4,          // 1H in value area
    NO_VP: 0                 // No VP data
  },

  // Momentum Decay Weights
  MOMENTUM_RECENCY: {
    VERY_RECENT: 1.0,    // 1h momentum (full weight)
    RECENT: 0.7,         // 4h momentum (70% weight)
    OLD: 0.4             // 24h momentum (40% weight)
  },

  // Volatility Regime Thresholds
  VOLATILITY_REGIMES: {
    VERY_LOW: 0.015,
    LOW: 0.03,
    NORMAL: 0.08,
    HIGH: 0.15,
    EXTREME: 0.25
  },

  // BTC Correlation Adjustments
  BTC_REGIME: {
    STRONG_BULL: { min_pct: 3, alpha_multiplier: 1.15 },
    BULL: { min_pct: 1, alpha_multiplier: 1.08 },
    NEUTRAL: { min_pct: -1, alpha_multiplier: 1.0 },
    BEAR: { min_pct: -3, alpha_multiplier: 0.85 },
    STRONG_BEAR: { min_pct: -Infinity, alpha_multiplier: 0.70 }
  },

  // Funding Rate Signals (Contrarian)
  FUNDING_THRESHOLDS: {
    EXTREME_LONG: 0.0005,    // 0.05% funding = longs crowded
    EXTREME_SHORT: -0.0005,  // -0.05% funding = shorts crowded
    CONTRARIAN_BONUS: 8      // Bonus for contrarian setup
  },

  // Order Book Imbalance
  OB_IMBALANCE_STRONG: 0.70,  // >70% imbalance
  OB_BONUS: 5,

  // Alpha Score Adjustments
  MIN_ALPHA_REQUIRED: 50,
  SOCIAL_PRICE_ALIGNMENT_BONUS: 5
};

//===============================================================================
// HELPER FUNCTIONS
//===============================================================================

function safeNum(v, d = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
}

function classifyVolatilityRegime(volatility) {
  const v = safeNum(volatility, 0);

  if (v < CONFIG.VOLATILITY_REGIMES.VERY_LOW) return { regime: 'VERY_LOW', score_multiplier: 1.05 };
  if (v < CONFIG.VOLATILITY_REGIMES.LOW) return { regime: 'LOW', score_multiplier: 1.02 };
  if (v < CONFIG.VOLATILITY_REGIMES.NORMAL) return { regime: 'NORMAL', score_multiplier: 1.0 };
  if (v < CONFIG.VOLATILITY_REGIMES.HIGH) return { regime: 'HIGH', score_multiplier: 0.95 };
  return { regime: 'EXTREME', score_multiplier: 0.85 };
}

function detectBTCRegime(btcData) {
  if (!btcData) return 'NEUTRAL';

  const btcPct4h = safeNum(btcData.derived?.pct_change_24h, 0);  // Using 24h as proxy for 4h

  if (btcPct4h >= CONFIG.BTC_REGIME.STRONG_BULL.min_pct) return 'STRONG_BULL';
  if (btcPct4h >= CONFIG.BTC_REGIME.BULL.min_pct) return 'BULL';
  if (btcPct4h >= CONFIG.BTC_REGIME.NEUTRAL.min_pct) return 'NEUTRAL';
  if (btcPct4h >= CONFIG.BTC_REGIME.BEAR.min_pct) return 'BEAR';
  return 'STRONG_BEAR';
}

function getBTCAlphaMultiplier(regime) {
  return CONFIG.BTC_REGIME[regime]?.alpha_multiplier || 1.0;
}

//===============================================================================
// VOLUME PROFILE QUALITY ASSESSMENT
//===============================================================================

function assessVPQuality(coin) {
  const vp_15m = coin.ta_15m_with_vp?.volume_profile;
  const vp_1h = coin.ta_1h_with_vp?.volume_profile;
  const vp_4h = coin.ta_4h_with_vp?.volume_profile;

  let vpScore = 0;
  let vpQuality = "NONE";
  const vpReasons = [];

  // Check if we have any VP data
  if (!vp_15m && !vp_1h && !vp_4h) {
    return { vpScore: 0, vpQuality: "NONE", vpReasons: ["No VP data"], tier: "D" };
  }

  // 🏆 GOLDEN: All 3 timeframes at POC
  const allAtPOC = vp_15m?.at_POC && vp_1h?.at_POC && vp_4h?.at_POC;
  if (allAtPOC) {
    vpScore = CONFIG.VP_QUALITY_SCORES.MULTI_TF_POC;
    vpQuality = "GOLDEN";
    vpReasons.push("All 3 TF @ POC (GOLDEN)");
    return { vpScore, vpQuality, vpReasons, tier: "S" };
  }

  // 🥈 EXCELLENT: All 3 in value area
  const allInValue =
    (vp_15m?.price_position === "INSIDE_VALUE" || vp_15m?.at_POC) &&
    (vp_1h?.price_position === "INSIDE_VALUE" || vp_1h?.at_POC) &&
    (vp_4h?.price_position === "INSIDE_VALUE" || vp_4h?.at_POC);

  if (allInValue) {
    vpScore = CONFIG.VP_QUALITY_SCORES.ALL_IN_VALUE;
    vpQuality = "EXCELLENT";
    vpReasons.push("All 3 TF in value area");
    return { vpScore, vpQuality, vpReasons, tier: "A" };
  }

  // 🥉 GOOD: 4H at POC
  if (vp_4h?.at_POC) {
    vpScore += CONFIG.VP_QUALITY_SCORES.SINGLE_POC_4H;
    vpQuality = "GOOD";
    vpReasons.push("4H @ POC");
  } else if (vp_4h?.price_position === "INSIDE_VALUE") {
    vpScore += CONFIG.VP_QUALITY_SCORES.IN_VALUE_4H;
    vpQuality = "GOOD";
    vpReasons.push("4H in value area");
  }

  // Additional scoring for 1H
  if (vp_1h?.at_POC) {
    vpScore += CONFIG.VP_QUALITY_SCORES.SINGLE_POC_1H;
    vpReasons.push("1H @ POC");
  } else if (vp_1h?.price_position === "INSIDE_VALUE") {
    vpScore += CONFIG.VP_QUALITY_SCORES.IN_VALUE_1H;
    vpReasons.push("1H in value");
  }

  // Determine tier
  let tier = "C";
  if (vpScore >= 12) tier = "A";
  else if (vpScore >= 8) tier = "B";
  else if (vpScore >= 4) tier = "C";
  else tier = "D";

  if (vpQuality === "NONE") vpQuality = "MODERATE";

  return { vpScore, vpQuality, vpReasons, tier };
}

//===============================================================================
// MOMENTUM DECAY DETECTION
//===============================================================================

function calculateWeightedMomentum(coin) {
  // Weight recent momentum more than old momentum
  const pct1h = safeNum(coin.derived?.pct_change_1h, 0);
  const pct4h = safeNum(coin.derived?.pct_change_24h, 0) / 6;  // Approximate 4h from 24h
  const pct24h = safeNum(coin.derived?.pct_change_24h, 0);

  const weightedMomentum =
    pct1h * CONFIG.MOMENTUM_RECENCY.VERY_RECENT +
    pct4h * CONFIG.MOMENTUM_RECENCY.RECENT +
    pct24h * CONFIG.MOMENTUM_RECENCY.OLD;

  // Momentum acceleration (is it accelerating or decaying?)
  const isAccelerating = pct1h > pct4h && pct4h > (pct24h / 6);
  const isDecaying = pct1h < pct4h || pct4h < (pct24h / 6);

  return {
    weightedMomentum: weightedMomentum / 2.1,  // Normalize
    isAccelerating: isAccelerating,
    isDecaying: isDecaying,
    momentumQuality: isAccelerating ? "STRONG" : (isDecaying ? "WEAK" : "STABLE")
  };
}

//===============================================================================
// FUNDING RATE CONTRARIAN SIGNALS
//===============================================================================

function checkFundingContrarian(coin, side) {
  const fundingRate = safeNum(coin.derived?.fundingRate, 0);

  // Contrarian logic:
  // - If funding very positive (longs crowded) → good for SHORTS
  // - If funding very negative (shorts crowded) → good for LONGS

  let contrarianBonus = 0;
  let fundingSignal = "NEUTRAL";

  if (side === "SELL" && fundingRate > CONFIG.FUNDING_THRESHOLDS.EXTREME_LONG) {
    contrarianBonus = CONFIG.FUNDING_THRESHOLDS.CONTRARIAN_BONUS;
    fundingSignal = "CONTRARIAN_SHORT";
  } else if (side === "BUY" && fundingRate < CONFIG.FUNDING_THRESHOLDS.EXTREME_SHORT) {
    contrarianBonus = CONFIG.FUNDING_THRESHOLDS.CONTRARIAN_BONUS;
    fundingSignal = "CONTRARIAN_LONG";
  }

  return { contrarianBonus, fundingSignal };
}

//===============================================================================
// SOCIAL VS PRICE ALIGNMENT
//===============================================================================

function checkSocialPriceAlignment(coin) {
  const sentiment = safeNum(coin.derived?.sentiment, 50);
  const pct24h = safeNum(coin.derived?.pct_change_24h, 0);

  // Check if social sentiment matches price action
  const socialBullish = sentiment > 60;
  const priceBullish = pct24h > 2;

  const socialBearish = sentiment < 40;
  const priceBearish = pct24h < -2;

  // Alignment = both agree
  const aligned = (socialBullish && priceBullish) || (socialBearish && priceBearish);

  return {
    aligned: aligned,
    bonus: aligned ? CONFIG.SOCIAL_PRICE_ALIGNMENT_BONUS : 0
  };
}

//===============================================================================
// MAIN RATING FUNCTION
//===============================================================================

function rateCoin(coin, btcRegime, btcMultiplier) {
  const symbol = coin.symbol || "UNKNOWN";

  // Get base alpha score
  const baseAlpha = safeNum(coin.score, 0);

  if (baseAlpha < CONFIG.MIN_ALPHA_REQUIRED) {
    console.log(`   ⏭️  ${symbol}: Alpha ${baseAlpha} < ${CONFIG.MIN_ALPHA_REQUIRED} (skip)`);
    return null;
  }

  // 1. VOLUME PROFILE ASSESSMENT
  const vpAssessment = assessVPQuality(coin);

  // 2. VOLATILITY REGIME
  const volatility = safeNum(coin.derived?.volatility, 0.05);
  const volRegime = classifyVolatilityRegime(volatility);

  // 3. MOMENTUM WITH DECAY
  const momentum = calculateWeightedMomentum(coin);

  // 4. BTC REGIME ADJUSTMENT
  const btcAdjustedAlpha = baseAlpha * btcMultiplier * volRegime.score_multiplier;

  // 5. ORDER BOOK IMBALANCE
  const obImbalance = Math.abs(safeNum(coin.order_book?.imbalance, 0));
  const obBonus = obImbalance > CONFIG.OB_IMBALANCE_STRONG ? CONFIG.OB_BONUS : 0;

  // 6. SOCIAL-PRICE ALIGNMENT
  const socialAlignment = checkSocialPriceAlignment(coin);

  // 7. DETERMINE SIDE (LONG/SHORT)
  // Simple logic: If weighted momentum > 0 and alpha > 70 = LONG, else if alpha > 70 and momentum < 0 = SHORT
  let side = "HOLD";

  const ema_trend_15m = coin.ta_15m_with_vp?.ema_20 > coin.ta_15m_with_vp?.ema_50;
  const ema_trend_1h = coin.ta_1h_with_vp?.ema_20 > coin.ta_1h_with_vp?.ema_50;
  const ema_trend_4h = coin.ta_4h_with_vp?.ema_20 > coin.ta_4h_with_vp?.ema_50;

  const bullishCount = [ema_trend_15m, ema_trend_1h, ema_trend_4h].filter(Boolean).length;

  if (btcAdjustedAlpha >= 70 && bullishCount >= 2 && momentum.weightedMomentum > 0) {
    side = "BUY";
  } else if (btcAdjustedAlpha >= 75 && bullishCount <= 1 && momentum.weightedMomentum < -1) {
    side = "SHORT";  // Higher alpha required for shorts
  }

  if (side === "HOLD") {
    console.log(`   ⏭️  ${symbol}: No clear directional bias (HOLD)`);
    return null;
  }

  // 8. FUNDING CONTRARIAN CHECK
  const fundingCheck = checkFundingContrarian(coin, side);

  // 9. CALCULATE FINAL ALPHA
  let finalAlpha = btcAdjustedAlpha + vpAssessment.vpScore + obBonus + socialAlignment.bonus + fundingCheck.contrarianBonus;

  // Momentum quality adjustment
  if (momentum.isAccelerating) finalAlpha *= 1.05;
  if (momentum.isDecaying) finalAlpha *= 0.95;

  // Cap at 100
  finalAlpha = Math.min(100, finalAlpha);

  console.log(`   ✅ ${symbol} ${side} (${vpAssessment.tier}): α${finalAlpha.toFixed(1)} (base ${baseAlpha} → adj ${btcAdjustedAlpha.toFixed(1)} + VP ${vpAssessment.vpScore} + OB ${obBonus} + ${fundingCheck.fundingSignal})`);

  return {
    ...coin,
    side: side,
    alpha: finalAlpha,
    base_alpha: baseAlpha,
    btc_adjusted_alpha: btcAdjustedAlpha,
    vp_setup_quality: vpAssessment.vpQuality,
    vp_score: vpAssessment.vpScore,
    vp_tier: vpAssessment.tier,
    vp_reasons: vpAssessment.vpReasons,
    vp_4h_at_poc: coin.ta_4h_with_vp?.volume_profile?.at_POC || false,
    vp_4h_signal: coin.ta_4h_with_vp?.volume_profile?.price_position || "UNKNOWN",
    vp_multi_tf_aligned: vpAssessment.vpQuality === "GOLDEN",
    volatility_regime: volRegime.regime,
    momentum_quality: momentum.momentumQuality,
    momentum_accelerating: momentum.isAccelerating,
    ob_imbalance: obImbalance,
    funding_signal: fundingCheck.fundingSignal,
    social_price_aligned: socialAlignment.aligned,
    btc_regime: btcRegime,
    rating_version: "v5.0-enhanced"
  };
}

//===============================================================================
// PROCESS ALL COINS
//===============================================================================

// Find BTC for regime detection
const btcData = candidates.find(c => c.symbol === "BTC" || c.symbol === "BTCUSDT");
const btcRegime = detectBTCRegime(btcData);
const btcMultiplier = getBTCAlphaMultiplier(btcRegime);

console.log(`\n🌍 BTC REGIME: ${btcRegime} (α multiplier: ${(btcMultiplier * 100).toFixed(0)}%)`);

const ratedCoins = [];

for (const coin of candidates) {
  const rated = rateCoin(coin, btcRegime, btcMultiplier);
  if (rated) {
    ratedCoins.push(rated);
  }
}

// Sort by final alpha
ratedCoins.sort((a, b) => b.alpha - a.alpha);

console.log(`\n📤 RATING NODE v5.0 OUTPUT:`);
console.log(`   Input: ${candidates.length} coins`);
console.log(`   Rated: ${ratedCoins.length} coins`);
console.log(`   Skipped: ${candidates.length - ratedCoins.length}`);

const goldenCount = ratedCoins.filter(c => c.vp_setup_quality === "GOLDEN").length;
const longCount = ratedCoins.filter(c => c.side === "BUY").length;
const shortCount = ratedCoins.filter(c => c.side === "SELL").length;

console.log(`   🏆 GOLDEN setups: ${goldenCount}`);
console.log(`   📈 LONG: ${longCount} | 📉 SHORT: ${shortCount}`);

return ratedCoins.map(coin => ({ json: coin }));
