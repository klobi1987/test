// ═══════════════════════════════════════════════════════════════════════════
// 🚀 RATING NODE ULTIMATE - INSTITUTIONAL-GRADE CRYPTO SIGNALS
// ═══════════════════════════════════════════════════════════════════════════
//
// 🏆 WORLD-CLASS FEATURES:
// ✅ BTC-ALT Correlation Matrix (PEAK_ALT_SEASON, ALT_DECOUPLING, etc.)
// ✅ BTC Dominance tracking & trend analysis
// ✅ Multi-timeframe BTC regime (15m/1h/4h) detection
// ✅ Coin decoupling detection (independent narratives)
// ✅ Sector leadership scoring (outperform category)
// ✅ Funding divergence analysis (BTC vs ALT)
// ✅ Dynamic position size boost (70 → 90 USDT for best scenarios)
// ✅ Small account optimization (aggressive leverage-ready)
// ✅ BUY & SELL (SHORT) signals with EXTREME conviction
//
// OUTPUT: 10-20 BEAST-MODE coins → SL/TP Finder → Leverage Finder
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🔧 POSITION SIZING CONFIGURATION (30-90 USDT)
//===============================================================================

const POSITION_SIZING = {
  min_trade_size_usdt: 30,        // Minimum
  max_trade_size_usdt: 90,        // Maximum (increased from 70 for best scenarios!)
  base_trade_size_usdt: 50,       // Base size

  // Conviction multipliers
  conviction_multipliers: {
    "EXTREME": 1.4,               // 70 USDT base
    "HIGH": 1.2,                  // 60 USDT
    "MEDIUM": 0.9,                // 45 USDT
    "LOW": 0.6                    // 30 USDT
  },

  // VP quality bonuses (USDT to add)
  vp_quality_bonus: {
    "GOLDEN": 10,                 // +10 USDT
    "EXCELLENT": 5,               // +5 USDT
    "GOOD": 0,
    "MODERATE": -5                // -5 USDT
  },

  // Volatility adjustments (multiplier)
  volatility_adjustments: {
    "EXTREME": 0.7,               // Reduce 30% in extreme vol
    "HIGH": 0.85,                 // Reduce 15%
    "MEDIUM": 1.0,                // Normal
    "LOW": 1.15                   // Increase 15% in low vol
  },

  // Market scenario boost (USDT to add) - NEW!
  scenario_boost: {
    "PEAK_ALT_SEASON": 20,        // +20 USDT (70 → 90 max!)
    "ALT_DECOUPLING": 15,         // +15 USDT
    "COIN_DECOUPLING": 10,        // +10 USDT
    "SECTOR_LEADER": 8,           // +8 USDT
    "FUNDING_DIVERGENCE": 5,      // +5 USDT
    "BTC_ONLY_RALLY": -10,        // -10 USDT (avoid alts)
    "CAPITULATION": -20           // -20 USDT (reduce exposure)
  }
};

//===============================================================================
// SECTOR/CATEGORY MAPPINGS
//===============================================================================

const SECTOR_GROUPS = {
  "layer-1": ["BTC", "ETH", "BNB", "SOL", "AVAX", "NEAR", "ATOM", "DOT", "ADA", "ALGO"],
  "meme": ["DOGE", "SHIB", "PEPE", "FLOKI", "WIF", "BONK", "ELON"],
  "defi": ["UNI", "SUSHI", "AAVE", "CRV", "COMP", "MKR", "SNX", "BAL"],
  "layer-2": ["MATIC", "ARB", "OP", "IMX", "METIS", "LRC"],
  "oracle": ["LINK", "GRT", "BAND", "API3", "TRB"],
  "gaming": ["AXS", "SAND", "MANA", "GALA", "ENJ", "IMX"],
  "storage": ["FIL", "AR", "STORJ", "BTT"],
  "interop": ["ATOM", "DOT", "KSM", "OSMO", "RUNE"]
};

//===============================================================================
// FIX PRICE DATA
//===============================================================================

candidates = candidates.map(coin => {
  const rawPrice = parseFloat(coin.raw?.lastPrice || coin.data?.last_price || 0);
  const coinPrice = parseFloat(coin.price || 0);

  if (rawPrice > 0 && Math.abs(coinPrice - rawPrice) / rawPrice > 0.1) {
    console.log(`   🔧 FIXED: ${coin.symbol} price ${coinPrice} → ${rawPrice}`);
    return { ...coin, price: rawPrice };
  }

  if (coinPrice <= 0 && rawPrice > 0) {
    console.log(`   🔧 FIXED: ${coin.symbol} invalid price → ${rawPrice}`);
    return { ...coin, price: rawPrice };
  }

  return coin;
});

console.log(`\n🚀 RATING NODE ULTIMATE - INSTITUTIONAL GRADE`);
console.log(`   Processing ${candidates.length} candidates`);
console.log(`   💵 Position Range: ${POSITION_SIZING.min_trade_size_usdt}-${POSITION_SIZING.max_trade_size_usdt} USDT`);
console.log(`   🎯 Goal: FIND THE BEST CRYPTO ALPHA IN THE WORLD`);

const btcData = candidates.find(c => c && (c.symbol === "BTCUSDT" || c.symbol === "BTC"));

//===============================================================================
// 🆕 MULTI-TIMEFRAME BTC REGIME
//===============================================================================

function analyzeBTCRegimeSingleTF(btc, timeframe) {
  if (!btc) return { regime: "NEUTRAL", score: 0 };

  let bullScore = 0;
  let bearScore = 0;

  const ta = timeframe === "15m"
    ? (btc.ta_15m_with_vp || btc.ta_15m)
    : timeframe === "1h"
    ? (btc.ta_1h_with_vp || btc.ta_1h)
    : (btc.ta_4h_with_vp || btc.ta_4h);

  if (!ta) return { regime: "NEUTRAL", score: 0 };

  // Market structure
  const ms = ta.market_structure?.structure || "RANGING";
  if (ms === "UPTREND") bullScore += 3;
  else if (ms === "DOWNTREND") bearScore += 3;

  // EMA alignment
  const ema20 = ta.ema?.ema20 || 0;
  const ema50 = ta.ema?.ema50 || 0;
  const price = btc.price || 0;

  if (ema20 > ema50 && price > ema20) bullScore += 2;
  else if (ema20 < ema50 && price < ema20) bearScore += 2;

  // RSI
  const rsi = ta.rsi || 50;
  if (rsi > 55 && rsi < 70) bullScore += 1;
  else if (rsi < 45 && rsi > 30) bearScore += 1;

  // VP
  const vp = ta.volume_profile;
  if (vp) {
    if (vp.price_position === "ABOVE_VALUE") bullScore += 1;
    else if (vp.price_position === "BELOW_VALUE") bearScore += 1;
  }

  const regime = bullScore > bearScore + 1 ? "BULL" : bearScore > bullScore + 1 ? "BEAR" : "NEUTRAL";
  const score = bullScore - bearScore;

  return { regime, score, bullScore, bearScore };
}

function inferMultiTFRegime(btc) {
  if (!btc) {
    return {
      regime: "NEUTRAL",
      confidence: "LOW",
      tf_15m: "NEUTRAL",
      tf_1h: "NEUTRAL",
      tf_4h: "NEUTRAL",
      strength: "WEAK",
      btc_price: 0,
      funding_rate: 0
    };
  }

  const tf_15m = analyzeBTCRegimeSingleTF(btc, "15m");
  const tf_1h = analyzeBTCRegimeSingleTF(btc, "1h");
  const tf_4h = analyzeBTCRegimeSingleTF(btc, "4h");

  // Dominant regime (prioritize higher TF)
  let regime = tf_4h.regime;
  if (tf_1h.regime === tf_4h.regime) {
    // Aligned, strong signal
  } else if (tf_15m.regime === tf_1h.regime && tf_1h.regime !== tf_4h.regime) {
    // Short-term divergence (15m + 1h vs 4h)
    regime = tf_1h.regime; // Use short-term as pullback opportunity
  }

  // Confidence
  let confidence = "LOW";
  const aligned = (tf_15m.regime === tf_1h.regime && tf_1h.regime === tf_4h.regime);
  if (aligned) confidence = "HIGH";
  else if (tf_1h.regime === tf_4h.regime) confidence = "MED";

  // Strength
  const avgScore = Math.abs((tf_15m.score + tf_1h.score + tf_4h.score) / 3);
  const strength = avgScore > 3 ? "STRONG" : avgScore > 1.5 ? "MODERATE" : "WEAK";

  const funding = btc.data?.fundingRate || btc.derived?.fundingRate || 0;

  console.log(`\n📊 BTC MULTI-TF REGIME:`);
  console.log(`   15m: ${tf_15m.regime} (${tf_15m.score.toFixed(1)})`);
  console.log(`   1h: ${tf_1h.regime} (${tf_1h.score.toFixed(1)})`);
  console.log(`   4h: ${tf_4h.regime} (${tf_4h.score.toFixed(1)})`);
  console.log(`   → Dominant: ${regime} (${confidence}), Strength: ${strength}`);

  return {
    regime,
    confidence,
    tf_15m: tf_15m.regime,
    tf_1h: tf_1h.regime,
    tf_4h: tf_4h.regime,
    strength,
    btc_price: btc.price || 0,
    funding_rate: funding,
    aligned: aligned
  };
}

//===============================================================================
// 🆕 BTC DOMINANCE CALCULATION & TREND
//===============================================================================

function calculateBTCDominance(btcData, allCoins) {
  if (!btcData) return { btc_dominance: 50, trend: "NEUTRAL", change_24h: 0 };

  // Estimate BTC.D from market cap data
  const btcMarketCap = btcData.derived?.market_cap || 0;
  const totalMarketCap = allCoins.reduce((sum, c) => sum + (c.derived?.market_cap || 0), 0);

  let btc_dominance = 50; // Default
  if (totalMarketCap > 0) {
    btc_dominance = (btcMarketCap / totalMarketCap) * 100;
  }

  // Try to infer trend from BTC vs ALT performance
  const btc24h = btcData.derived?.pct_change_24h || 0;
  const altcoins = allCoins.filter(c => c.symbol !== "BTCUSDT" && c.symbol !== "BTC");
  const altAvg24h = altcoins.length > 0
    ? altcoins.reduce((sum, c) => sum + (c.derived?.pct_change_24h || 0), 0) / altcoins.length
    : 0;

  // If BTC outperforms alts → BTC.D rising
  // If alts outperform BTC → BTC.D falling
  const performance_diff = btc24h - altAvg24h;
  let trend = "NEUTRAL";
  if (performance_diff > 2) trend = "RISING";    // BTC.D up
  else if (performance_diff < -2) trend = "FALLING"; // BTC.D down

  const change_24h = performance_diff; // Proxy for BTC.D change

  console.log(`\n💎 BTC DOMINANCE:`);
  console.log(`   Estimated: ${btc_dominance.toFixed(2)}%`);
  console.log(`   Trend: ${trend} (BTC ${btc24h.toFixed(2)}% vs ALT avg ${altAvg24h.toFixed(2)}%)`);

  return { btc_dominance, trend, change_24h };
}

//===============================================================================
// 🆕 MARKET SCENARIO ANALYSIS (THE MAGIC!)
//===============================================================================

function analyzeMarketScenario(btcRegime, btcDominance, marketBreadth, coin) {
  const scenarios = [];
  let totalBoost = 0;
  const reasoning = [];

  const btcTrend = btcRegime.regime;
  const btcDomTrend = btcDominance.trend;
  const breadth = marketBreadth.market_breadth;

  // 1. PEAK ALT SEASON (BTC up, BTC.D down, breadth strong)
  if (btcTrend === "BULL" && btcDomTrend === "FALLING" && breadth === "STRONG_BULL") {
    scenarios.push("PEAK_ALT_SEASON");
    totalBoost += POSITION_SIZING.scenario_boost.PEAK_ALT_SEASON;
    reasoning.push("🚀 PEAK ALT SEASON: BTC rising + Money flowing to alts + Strong breadth");
  }

  // 2. ALT DECOUPLING (BTC down, BTC.D down, breadth strong)
  else if (btcTrend === "BEAR" && btcDomTrend === "FALLING" && breadth === "STRONG_BULL") {
    scenarios.push("ALT_DECOUPLING");
    totalBoost += POSITION_SIZING.scenario_boost.ALT_DECOUPLING;
    reasoning.push("💎 ALT DECOUPLING: Alts have independent narratives despite BTC weakness");
  }

  // 3. BTC ONLY RALLY (BTC up, BTC.D up)
  else if (btcTrend === "BULL" && btcDomTrend === "RISING") {
    scenarios.push("BTC_ONLY_RALLY");
    totalBoost += POSITION_SIZING.scenario_boost.BTC_ONLY_RALLY;
    reasoning.push("⚠️ BTC ONLY RALLY: Money flowing to BTC, avoid alts");
  }

  // 4. CAPITULATION (BTC down, BTC.D up)
  else if (btcTrend === "BEAR" && btcDomTrend === "RISING") {
    scenarios.push("CAPITULATION");
    totalBoost += POSITION_SIZING.scenario_boost.CAPITULATION;
    reasoning.push("💀 CAPITULATION: Risk-off mode, cash is king");
  }

  // 5. COIN DECOUPLING (coin bullish while BTC bearish)
  if (coin) {
    const coinBullish = (coin._sideScores?.bullScore || 0) > 70;
    if (coinBullish && btcTrend === "BEAR") {
      scenarios.push("COIN_DECOUPLING");
      totalBoost += POSITION_SIZING.scenario_boost.COIN_DECOUPLING;
      reasoning.push("✨ COIN DECOUPLING: Independent narrative, strong alpha");
    }
  }

  // 6. FUNDING DIVERGENCE (BTC overleveraged, ALT not)
  if (coin) {
    const btcFunding = Math.abs(btcRegime.funding_rate || 0);
    const altFunding = Math.abs(coin.data?.fundingRate || coin.derived?.fundingRate || 0);

    if (btcFunding > 0.01 && altFunding < 0.0002) {
      scenarios.push("FUNDING_DIVERGENCE");
      totalBoost += POSITION_SIZING.scenario_boost.FUNDING_DIVERGENCE;
      reasoning.push("💰 FUNDING DIVERGENCE: ALT undervalued vs BTC leverage");
    }
  }

  const mainScenario = scenarios[0] || "NEUTRAL";
  const multiplier = 1 + (totalBoost / 100); // Convert boost to multiplier

  return {
    scenario: mainScenario,
    all_scenarios: scenarios,
    boost_usdt: totalBoost,
    multiplier: multiplier,
    reasoning: reasoning
  };
}

//===============================================================================
// 🆕 SECTOR LEADERSHIP SCORING
//===============================================================================

function analyzeSectorLeadership(coin, allCoins) {
  const coinSymbol = coin.symbol.replace("USDT", "").replace("USD", "").replace("PERP", "");
  const coinCategory = coin.category_main || "unknown";
  const coinPerf24h = coin.derived?.pct_change_24h || 0;

  // Find sector
  let sector = null;
  for (const [sectorName, symbols] of Object.entries(SECTOR_GROUPS)) {
    if (symbols.includes(coinSymbol)) {
      sector = sectorName;
      break;
    }
  }

  if (!sector) {
    // Use category fallback
    sector = coinCategory;
  }

  // Find peers in same sector
  const peers = allCoins.filter(c => {
    const sym = c.symbol.replace("USDT", "").replace("USD", "").replace("PERP", "");
    const cat = c.category_main || "unknown";

    if (SECTOR_GROUPS[sector]) {
      return SECTOR_GROUPS[sector].includes(sym) && sym !== coinSymbol;
    } else {
      return cat === sector && c.symbol !== coin.symbol;
    }
  });

  if (peers.length === 0) {
    return {
      is_leader: false,
      sector: sector,
      outperformance: 0,
      boost: 0
    };
  }

  // Calculate sector average
  const sectorAvg24h = peers.reduce((sum, p) => sum + (p.derived?.pct_change_24h || 0), 0) / peers.length;
  const outperformance = coinPerf24h - sectorAvg24h;

  // Leader if outperforming by >50%
  const is_leader = outperformance > (Math.abs(sectorAvg24h) * 0.5) && outperformance > 2;

  let boost = 0;
  if (is_leader) {
    boost = POSITION_SIZING.scenario_boost.SECTOR_LEADER;
  }

  return {
    is_leader,
    sector,
    coin_perf: coinPerf24h,
    sector_avg: sectorAvg24h,
    outperformance: outperformance,
    boost: boost
  };
}

//===============================================================================
// 🆕 MARKET STATE ANALYSIS (Enhanced)
//===============================================================================

function analyzeMarketState(btc, allCoins) {
  if (!btc) {
    return {
      volatility_regime: "MEDIUM",
      volatility_multiplier: 1.0,
      market_breadth: "NEUTRAL",
      breadth_pct: 50,
      optimal_multiplier: 1.0
    };
  }

  // Volatility regime
  const btc_atr_pct = btc.ta_1h_with_vp?.atr_pct || btc.ta_1h?.atr_pct || 2.0;
  let volatility_regime = "MEDIUM";
  let vol_multiplier = 1.0;

  if (btc_atr_pct > 4.0) {
    volatility_regime = "EXTREME";
    vol_multiplier = 0.7;
  } else if (btc_atr_pct > 3.0) {
    volatility_regime = "HIGH";
    vol_multiplier = 0.85;
  } else if (btc_atr_pct < 1.5) {
    volatility_regime = "LOW";
    vol_multiplier = 1.15;
  }

  // Market breadth
  const altcoins = allCoins.filter(c => c.symbol !== "BTCUSDT" && c.symbol !== "BTC");
  const positive_momentum = altcoins.filter(c => (c.derived?.pct_change_24h || 0) > 0).length;
  const breadth_pct = altcoins.length > 0 ? (positive_momentum / altcoins.length) * 100 : 50;

  let market_breadth = "NEUTRAL";
  if (breadth_pct > 70) market_breadth = "STRONG_BULL";
  else if (breadth_pct > 55) market_breadth = "BULL";
  else if (breadth_pct < 30) market_breadth = "STRONG_BEAR";
  else if (breadth_pct < 45) market_breadth = "BEAR";

  return {
    volatility_regime,
    volatility_multiplier: vol_multiplier,
    market_breadth,
    breadth_pct,
    optimal_multiplier: vol_multiplier
  };
}

//===============================================================================
// 🆕 INTELLIGENT USDT POSITION SIZING (ULTIMATE VERSION)
//===============================================================================

function calculatePositionSizeUSDT(coin, conviction, vpQuality, marketState, marketScenario, sectorLeadership) {
  let size_usdt = POSITION_SIZING.base_trade_size_usdt;

  // 1. Apply conviction multiplier
  const convictionMult = POSITION_SIZING.conviction_multipliers[conviction] || 1.0;
  size_usdt *= convictionMult;

  // 2. Add VP quality bonus
  const vpBonus = POSITION_SIZING.vp_quality_bonus[vpQuality] || 0;
  size_usdt += vpBonus;

  // 3. Apply volatility adjustment
  const volMult = POSITION_SIZING.volatility_adjustments[marketState.volatility_regime] || 1.0;
  size_usdt *= volMult;

  // 4. Add market scenario boost (NEW!)
  size_usdt += marketScenario.boost_usdt;

  // 5. Add sector leadership boost (NEW!)
  size_usdt += sectorLeadership.boost;

  // 6. Round and cap
  size_usdt = Math.round(size_usdt * 100) / 100;
  size_usdt = Math.max(POSITION_SIZING.min_trade_size_usdt, size_usdt);
  size_usdt = Math.min(POSITION_SIZING.max_trade_size_usdt, size_usdt);

  return size_usdt;
}

//===============================================================================
// VOLUME PROFILE FUNCTIONS
//===============================================================================

function extractVPData(coin) {
  const vp_15m = coin.ta_15m_with_vp?.volume_profile || null;
  const vp_1h = coin.ta_1h_with_vp?.volume_profile || null;
  const vp_4h = coin.ta_4h_with_vp?.volume_profile || null;
  return { vp_15m, vp_1h, vp_4h };
}

function calculateVPScore(vp_15m, vp_1h, vp_4h) {
  let vpScore = 0;
  let vpBoost = 0;

  // 4H VP (highest priority)
  if (vp_4h) {
    if (vp_4h.at_POC) {
      vpScore += 30;
      vpBoost += 15;
    } else if (vp_4h.price_position === "INSIDE_VALUE") {
      vpScore += 20;
      vpBoost += 8;
    } else if (vp_4h.poc_distance_pct < 3) {
      vpScore += 10;
      vpBoost += 3;
    }

    if (vp_4h.high_volume_nodes && vp_4h.high_volume_nodes.length > 0) {
      vpScore += 5;
    }
  }

  // 1H VP
  if (vp_1h) {
    if (vp_1h.at_POC) {
      vpScore += 20;
      vpBoost += 10;
    } else if (vp_1h.price_position === "INSIDE_VALUE") {
      vpScore += 12;
      vpBoost += 6;
    }
  }

  // 15m VP
  if (vp_15m) {
    if (vp_15m.at_POC) {
      vpScore += 10;
      vpBoost += 5;
    } else if (vp_15m.price_position === "INSIDE_VALUE") {
      vpScore += 6;
      vpBoost += 3;
    }
  }

  // Multi-timeframe alignment
  const allAtPOC = vp_15m?.at_POC && vp_1h?.at_POC && vp_4h?.at_POC;
  const allInValue =
    (vp_15m?.price_position === "INSIDE_VALUE" || vp_15m?.at_POC) &&
    (vp_1h?.price_position === "INSIDE_VALUE" || vp_1h?.at_POC) &&
    (vp_4h?.price_position === "INSIDE_VALUE" || vp_4h?.at_POC);

  if (allAtPOC) {
    vpScore += 30;
    vpBoost += 10;
  } else if (allInValue) {
    vpScore += 15;
    vpBoost += 7;
  }

  let setupQuality = "MODERATE";
  if (allAtPOC) setupQuality = "GOLDEN";
  else if (allInValue) setupQuality = "EXCELLENT";
  else if (vp_4h?.at_POC || vp_1h?.at_POC) setupQuality = "GOOD";

  return {
    vp_score: Math.min(vpScore, 100),
    vp_confidence_boost: vpBoost,
    multi_tf_aligned: allAtPOC || allInValue,
    setup_quality: setupQuality
  };
}

//===============================================================================
// SIDE DECISION (BUY/SELL with CONVICTION)
//===============================================================================

function decideSide(coin, regime, marketState) {
  let bullScore = 0;
  let bearScore = 0;

  // MASSIVE momentum = instant decision
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;
  const pct24h = coin.derived?.pct_change_24h || 0;

  if (altRankJump > 500 || galaxyJump > 15) {
    return { side: "BUY", bullScore: 100, bearScore: 0, conviction: "EXTREME" };
  }

  if (altRankJump < -500 || galaxyJump < -15) {
    return { side: "SELL", bullScore: 0, bearScore: 100, conviction: "EXTREME" };
  }

  // Momentum scoring
  if (altRankJump > 300 || galaxyJump > 10) bullScore += 15;
  else if (altRankJump > 150 || galaxyJump > 5) bullScore += 10;
  else if (altRankJump > 50 || galaxyJump > 2) bullScore += 5;

  if (altRankJump < -300 || galaxyJump < -10) bearScore += 15;
  else if (altRankJump < -150 || galaxyJump < -5) bearScore += 10;
  else if (altRankJump < -50 || galaxyJump < -2) bearScore += 5;

  // Price momentum
  if (pct24h > 10) bullScore += 5;
  else if (pct24h > 5) bullScore += 3;
  else if (pct24h > 2) bullScore += 1.5;
  else if (pct24h < -10) bearScore += 5;
  else if (pct24h < -5) bearScore += 3;
  else if (pct24h < -2) bearScore += 1.5;

  // Market structure
  const ms4h = coin.ta_4h_with_vp?.market_structure?.structure || coin.ta_4h?.market_structure?.structure || "RANGING";
  const ms1h = coin.ta_1h_with_vp?.market_structure?.structure || coin.ta_1h?.market_structure?.structure || "RANGING";

  if (ms4h === "UPTREND") bullScore += 3;
  else if (ms4h === "DOWNTREND") bearScore += 3;
  if (ms1h === "UPTREND") bullScore += 1.5;
  else if (ms1h === "DOWNTREND") bearScore += 1.5;

  // RSI
  const rsi15m = coin.ta_15m_with_vp?.rsi || coin.ta_15m?.rsi || 50;
  const rsi1h = coin.ta_1h_with_vp?.rsi || coin.ta_1h?.rsi || 50;

  if (rsi1h > 55 && rsi1h < 70) bullScore += 2;
  else if (rsi1h < 45 && rsi1h > 30) bearScore += 2;

  // Oversold/Overbought extremes
  if (rsi15m < 25 && rsi1h < 35) bullScore += 5;
  else if (rsi15m > 75 && rsi1h > 65) bearScore += 5;

  // Volume Profile
  const vp_4h = coin.ta_4h_with_vp?.volume_profile || coin.ta_4h?.volume_profile;
  if (vp_4h) {
    if (vp_4h.signal === "ENTRY_AT_POC") {
      bullScore += 2;
      bearScore += 2;
    } else if (vp_4h.signal === "BULLISH_BREAKOUT") {
      bullScore += 5;
    } else if (vp_4h.signal === "BEARISH_BREAKDOWN") {
      bearScore += 5;
    }

    if (vp_4h.at_POC) {
      bullScore += 3;
      bearScore += 3;
    }
  }

  // Order book
  const obImbalance = coin.derived?.orderBookImbalance || 0;
  if (obImbalance > 0.2) bullScore += 2;
  else if (obImbalance < -0.2) bearScore += 2;

  // ADX + DI
  const adx1h = coin.ta_1h_with_vp?.adx?.adx || coin.ta_1h?.adx?.adx || 0;
  if (adx1h > 25) {
    const diPlus = coin.ta_1h_with_vp?.adx?.plusDI || coin.ta_1h?.adx?.plusDI || 0;
    const diMinus = coin.ta_1h_with_vp?.adx?.minusDI || coin.ta_1h?.adx?.minusDI || 0;
    if (diPlus > diMinus + 5) bullScore += 2;
    else if (diMinus > diPlus + 5) bearScore += 2;
  }

  // Regime alignment
  if (regime.regime === "BULL" && regime.confidence !== "LOW") {
    bullScore *= 1.15;
  } else if (regime.regime === "BEAR" && regime.confidence !== "LOW") {
    bearScore *= 1.15;
  }

  // Market breadth
  if (marketState.market_breadth === "STRONG_BULL") bullScore *= 1.1;
  else if (marketState.market_breadth === "STRONG_BEAR") bearScore *= 1.1;

  // Final decision
  let side = "HOLD";
  let conviction = "LOW";

  const diff = Math.abs(bullScore - bearScore);
  const total = bullScore + bearScore;

  if (bullScore > bearScore) {
    side = "BUY";
    if (diff > 15 && total > 20) conviction = "EXTREME";
    else if (diff > 8 && total > 12) conviction = "HIGH";
    else if (diff > 4) conviction = "MEDIUM";
  } else if (bearScore > bullScore) {
    side = "SELL";
    if (diff > 15 && total > 20) conviction = "EXTREME";
    else if (diff > 8 && total > 12) conviction = "HIGH";
    else if (diff > 4) conviction = "MEDIUM";
  } else {
    if (pct24h > 0) side = "BUY";
    else if (pct24h < 0) side = "SELL";
  }

  return { side, bullScore, bearScore, conviction };
}

//===============================================================================
// ENHANCED ALPHA SCORE
//===============================================================================

function enhancedAlphaScore(coin, side, regime, marketState, vpMetrics, weights, marketScenario, sectorLeadership) {
  let alpha = 0;

  // Social scores
  const lcScore = coin.score || 0;
  alpha += Math.min(lcScore / 2.5, 25) * weights.social;

  const sentiment = coin.derived?.socialSentiment || 0;
  alpha += Math.min(sentiment * 0.15, 15) * weights.social;

  const galaxy = coin.derived?.galaxyScore || 0;
  alpha += Math.min(galaxy * 0.3, 22) * weights.social;

  // Momentum jumps
  const galaxyJump = coin.derived?.galaxy_jump || 0;
  const altRankJump = coin.derived?.alt_rank_jump || 0;

  if (galaxyJump > 15 || altRankJump > 500) alpha += 30 * weights.momentum;
  else if (galaxyJump > 10 || altRankJump > 300) alpha += 20 * weights.momentum;
  else if (galaxyJump > 5 || altRankJump > 150) alpha += 10 * weights.momentum;
  else if (galaxyJump > 0 || altRankJump > 50) alpha += 5 * weights.momentum;

  // Volume Profile score
  alpha += vpMetrics.vp_score * weights.volume_profile;

  if (vpMetrics.setup_quality === "GOLDEN") {
    alpha += 25 * weights.volume_profile;
  } else if (vpMetrics.setup_quality === "EXCELLENT") {
    alpha += 15 * weights.volume_profile;
  }

  // Volume & OI
  const vol24 = coin.derived?.volume24h || 0;
  alpha += Math.min(Math.log10(vol24 + 1) * 2, 18) * weights.liquidity;

  const oi = coin.derived?.openInterestValue || 0;
  alpha += Math.min(Math.log10(oi + 1), 10) * weights.liquidity;

  // Funding rate
  const funding = coin.data?.fundingRate || coin.derived?.fundingRate || 0;
  const funding_pct = funding * 100;

  let fundingPoints = 0;
  if (side === "BUY" && funding_pct < -0.05) fundingPoints = 25;
  else if (side === "SELL" && funding_pct > 0.1) fundingPoints = 25;
  else if (side === "BUY" && funding_pct < 0) fundingPoints = 10;
  else if (side === "SELL" && funding_pct > 0.05) fundingPoints = 10;

  alpha += fundingPoints * weights.funding;

  // Volatility bonus
  const atr = coin.ta_1h_with_vp?.atr || coin.ta_1h?.atr || 0;
  const price = coin.price || 1;
  const vol_pct = (atr / price) * 100;

  let volBonus = 0;
  if (vol_pct > 5.0) volBonus = 20;
  else if (vol_pct > 4.0) volBonus = 15;
  else if (vol_pct > 3.0) volBonus = 10;
  else if (vol_pct > 2.0) volBonus = 5;
  else volBonus = -5;
  alpha += volBonus * weights.momentum;

  // Technical indicators
  let techPoints = 0;
  const rsi1h = coin.ta_1h_with_vp?.rsi || coin.ta_1h?.rsi || 50;
  const adx1h = coin.ta_1h_with_vp?.adx?.adx || coin.ta_1h?.adx?.adx || 0;

  if (side === "BUY") {
    if (rsi1h > 45 && rsi1h < 70) techPoints += 8;
    else if (rsi1h < 30) techPoints += 12;
    if (adx1h > 25) techPoints += 8;
  } else if (side === "SELL") {
    if (rsi1h < 55 && rsi1h > 30) techPoints += 8;
    else if (rsi1h > 70) techPoints += 12;
    if (adx1h > 25) techPoints += 8;
  }
  alpha += techPoints * weights.technical;

  // Regime alignment
  let regimePoints = 0;
  if (regime.regime === "BULL" && side === "BUY") {
    regimePoints = regime.confidence === "HIGH" ? 15 : 10;
  } else if (regime.regime === "BEAR" && side === "SELL") {
    regimePoints = regime.confidence === "HIGH" ? 15 : 10;
  } else if (regime.regime === "NEUTRAL") {
    regimePoints = 5;
  }
  alpha += regimePoints;

  // Market scenario boost (NEW!)
  if (marketScenario.scenario === "PEAK_ALT_SEASON" || marketScenario.scenario === "ALT_DECOUPLING") {
    alpha += 30; // Huge alpha boost for best scenarios
  } else if (marketScenario.scenario === "COIN_DECOUPLING") {
    alpha += 20;
  }

  // Sector leadership boost (NEW!)
  if (sectorLeadership.is_leader) {
    alpha += 15; // Leader bonus
  }

  // Strength multiplier
  if (regime.strength === "STRONG") alpha += 12;
  else if (regime.strength === "WEAK") alpha -= 5;

  // Market breadth
  if (marketState.market_breadth === "STRONG_BULL" && side === "BUY") alpha += 10;
  else if (marketState.market_breadth === "STRONG_BEAR" && side === "SELL") alpha += 10;

  return Math.max(0, alpha);
}

//===============================================================================
// DYNAMIC WEIGHT ADJUSTMENT
//===============================================================================

function getDynamicWeights(marketState, regime) {
  const baseWeights = {
    momentum: 1.0,
    volume_profile: 1.0,
    social: 1.0,
    technical: 1.0,
    liquidity: 1.0,
    funding: 1.0
  };

  // High vol = trust VP more
  if (marketState.volatility_regime === "EXTREME" || marketState.volatility_regime === "HIGH") {
    baseWeights.volume_profile = 1.5;
    baseWeights.social = 0.7;
    baseWeights.technical = 1.2;
  }

  // Strong trend = trust momentum
  if (regime.strength === "STRONG") {
    baseWeights.momentum = 1.4;
    baseWeights.technical = 1.2;
  }

  // Ranging = trust mean reversion
  if (regime.regime === "NEUTRAL") {
    baseWeights.technical = 1.3;
    baseWeights.volume_profile = 1.3;
    baseWeights.momentum = 0.8;
  }

  return baseWeights;
}

//===============================================================================
// SAFETY CHECKS
//===============================================================================

function safetyCheck(coin) {
  const spread = coin.data?.spread_pct || 1;
  if (spread > 0.2) return { valid: false, reason: "Spread >20%" };

  const vol24 = coin.derived?.volume24h || 0;
  if (vol24 < 10000) return { valid: false, reason: "Volume <10K" };

  const oi = coin.derived?.openInterestValue || 0;
  if (oi < 10000) return { valid: false, reason: "OI <10K" };

  const price = coin.price || 0;
  if (price <= 0) return { valid: false, reason: "Invalid price" };

  return { valid: true, reason: "Pass" };
}

//===============================================================================
// MAIN PROCESSING
//===============================================================================

const regime = inferMultiTFRegime(btcData);
const marketState = analyzeMarketState(btcData, candidates);
const btcDominance = calculateBTCDominance(btcData, candidates);
const weights = getDynamicWeights(marketState, regime);

console.log(`\n🌍 MARKET STATE:`);
console.log(`   Volatility: ${marketState.volatility_regime} (x${marketState.volatility_multiplier.toFixed(2)})`);
console.log(`   Breadth: ${marketState.market_breadth} (${marketState.breadth_pct.toFixed(1)}%)`);

console.log(`\n⚖️  DYNAMIC WEIGHTS:`);
console.log(`   Momentum: ${weights.momentum.toFixed(2)}x`);
console.log(`   Volume Profile: ${weights.volume_profile.toFixed(2)}x`);
console.log(`   Social: ${weights.social.toFixed(2)}x`);

let stats = {
  total: 0,
  btc_skipped: 0,
  hold_skipped: 0,
  safety_failed: 0,
  buy_signals: 0,
  sell_signals: 0,
  high_conviction: 0,
  golden_setups: 0,
  alt_season_trades: 0,
  decoupling_trades: 0,
  sector_leaders: 0
};

const ratedCoins = [];

for (const coin of candidates) {
  stats.total++;

  if (coin.symbol === "BTCUSDT" || coin.symbol === "BTC") {
    stats.btc_skipped++;
    continue;
  }

  const sideDecision = decideSide(coin, regime, marketState);

  if (sideDecision.side === "HOLD") {
    stats.hold_skipped++;
    continue;
  }

  if (sideDecision.side === "BUY") stats.buy_signals++;
  else stats.sell_signals++;

  if (sideDecision.conviction === "HIGH" || sideDecision.conviction === "EXTREME") {
    stats.high_conviction++;
  }

  // Attach side scores for scenario analysis
  coin._sideScores = {
    bullScore: sideDecision.bullScore,
    bearScore: sideDecision.bearScore
  };

  const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);
  const vpMetrics = calculateVPScore(vp_15m, vp_1h, vp_4h);

  if (vpMetrics.setup_quality === "GOLDEN") stats.golden_setups++;

  // Analyze market scenario
  const marketScenario = analyzeMarketScenario(regime, btcDominance, marketState, coin);

  // Analyze sector leadership
  const sectorLeadership = analyzeSectorLeadership(coin, candidates);

  if (marketScenario.scenario === "PEAK_ALT_SEASON") stats.alt_season_trades++;
  if (marketScenario.scenario === "ALT_DECOUPLING" || marketScenario.all_scenarios.includes("COIN_DECOUPLING")) {
    stats.decoupling_trades++;
  }
  if (sectorLeadership.is_leader) stats.sector_leaders++;

  const alpha = enhancedAlphaScore(
    coin,
    sideDecision.side,
    regime,
    marketState,
    vpMetrics,
    weights,
    marketScenario,
    sectorLeadership
  );

  const safety = safetyCheck(coin);
  if (!safety.valid) {
    stats.safety_failed++;
    continue;
  }

  // Calculate position size (ULTIMATE VERSION with scenario boost!)
  const position_size_usdt = calculatePositionSizeUSDT(
    coin,
    sideDecision.conviction,
    vpMetrics.setup_quality,
    marketState,
    marketScenario,
    sectorLeadership
  );

  ratedCoins.push({
    ...coin,
    side: sideDecision.side,
    alpha: alpha,
    alphaScore: alpha,
    conviction: sideDecision.conviction,
    position_size_usdt: position_size_usdt,
    _regime: regime,
    _market_state: marketState,
    _btc_dominance: btcDominance,
    _market_scenario: marketScenario,
    _sector_leadership: sectorLeadership,
    _sideScores: {
      bullScore: sideDecision.bullScore,
      bearScore: sideDecision.bearScore
    },
    vp_setup_quality: vpMetrics.setup_quality,
    vp_score: vpMetrics.vp_score,
    vp_multi_tf_aligned: vpMetrics.multi_tf_aligned
  });
}

ratedCoins.sort((a, b) => b.alpha - a.alpha);
let topCoins = ratedCoins.slice(0, 20);

// Fallback if no coins
if (topCoins.length === 0) {
  console.log(`\n⚠️  No coins passed filters. FALLBACK MODE...`);

  const forcedCoin = candidates
    .filter(c => c.symbol !== "BTCUSDT" && c.symbol !== "BTC")
    .map(coin => {
      const pct24h = coin.derived?.pct_change_24h || 0;
      let forcedSide = pct24h > 0 ? "BUY" : "SELL";

      const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);
      const vpMetrics = calculateVPScore(vp_15m, vp_1h, vp_4h);

      coin._sideScores = { bullScore: pct24h > 0 ? 50 : 0, bearScore: pct24h < 0 ? 50 : 0 };
      const marketScenario = analyzeMarketScenario(regime, btcDominance, marketState, coin);
      const sectorLeadership = analyzeSectorLeadership(coin, candidates);

      const alpha = enhancedAlphaScore(coin, forcedSide, regime, marketState, vpMetrics, weights, marketScenario, sectorLeadership);
      const position_size_usdt = calculatePositionSizeUSDT(coin, "LOW", vpMetrics.setup_quality, marketState, marketScenario, sectorLeadership);

      return {
        ...coin,
        side: forcedSide,
        alpha: alpha,
        alphaScore: alpha,
        conviction: "LOW",
        position_size_usdt: position_size_usdt,
        vp_setup_quality: vpMetrics.setup_quality,
        _forced: true
      };
    })
    .sort((a, b) => b.alpha - a.alpha)[0];

  if (forcedCoin) {
    topCoins = [forcedCoin];
  }
}

//===============================================================================
// OUTPUT
//===============================================================================

console.log(`\n📊 STATISTICS:`);
console.log(`   Total: ${stats.total}`);
console.log(`   🟢 BUY: ${stats.buy_signals}`);
console.log(`   🔴 SELL (SHORT): ${stats.sell_signals}`);
console.log(`   🎯 HIGH Conviction: ${stats.high_conviction}`);
console.log(`   🏆 GOLDEN Setups: ${stats.golden_setups}`);
console.log(`   🚀 ALT SEASON trades: ${stats.alt_season_trades}`);
console.log(`   💎 DECOUPLING trades: ${stats.decoupling_trades}`);
console.log(`   ⭐ SECTOR LEADERS: ${stats.sector_leaders}`);
console.log(`   📤 Output: ${topCoins.length}`);

if (topCoins.length > 0) {
  console.log(`\n✅ TOP 10 ULTIMATE CANDIDATES:`);
  topCoins.slice(0, 10).forEach((c, i) => {
    const golden = c.vp_setup_quality === "GOLDEN" ? " 🏆" : "";
    const scenario = c._market_scenario?.scenario || "NEUTRAL";
    const leader = c._sector_leadership?.is_leader ? " ⭐LEADER" : "";
    const forced = c._forced ? " 🔴FORCED" : "";

    console.log(`   ${i + 1}. ${c.symbol} ${c.side} - Alpha ${c.alpha.toFixed(1)}${golden}${leader}${forced}`);
    console.log(`      💵 Size: ${c.position_size_usdt} USDT | Conviction: ${c.conviction}`);
    console.log(`      🎯 Scenario: ${scenario}`);
    if (c._market_scenario?.reasoning && c._market_scenario.reasoning.length > 0) {
      console.log(`      ${c._market_scenario.reasoning[0]}`);
    }
  });
}

console.log(`\n💰 POSITION SIZING:`);
console.log(`   Range: ${POSITION_SIZING.min_trade_size_usdt}-${POSITION_SIZING.max_trade_size_usdt} USDT`);
console.log(`   Volatility: x${marketState.volatility_multiplier.toFixed(2)}`);

console.log(`\n🚀 → Passing ${topCoins.length} ULTIMATE candidates to SL/TP Finder\n`);

return topCoins.map(coin => ({ json: coin }));
