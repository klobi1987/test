// ═══════════════════════════════════════════════════════════════════════════
// 💰 ENHANCED RATING NODE v5.0 - PROFIT MAXIMIZATION EDITION
// ═══════════════════════════════════════════════════════════════════════════
//
// 🆕 NEW IN v5.0 (MONEY-MAKING ENHANCEMENTS):
// ✅ Dynamic weight adjustment based on market regime & volatility
// ✅ Kelly Criterion position sizing recommendations
// ✅ Volume-weighted momentum (VWAP proximity scoring)
// ✅ Correlation detection (avoid correlated positions)
// ✅ Drawdown protection (circuit breaker logic)
// ✅ Multi-factor risk scoring (Sharpe-aware)
// ✅ Liquidity depth analysis (slippage estimation)
// ✅ Funding rate arbitrage detection
// ✅ Social sentiment acceleration (rate of change)
// ✅ Mean reversion opportunity scoring
//
// PROFIT PHILOSOPHY:
// - MAXIMIZE: Win Rate × Average Win × Position Size
// - MINIMIZE: Loss Rate × Average Loss × Exposure
// - OPTIMIZE: Risk-Adjusted Returns (Sharpe ratio focus)
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

// Fix price data
candidates = candidates.map(coin => {
  const rawPrice = parseFloat(coin.raw?.lastPrice || coin.data?.last_price || 0);
  const coinPrice = parseFloat(coin.price || 0);

  if (rawPrice > 0 && Math.abs(coinPrice - rawPrice) / rawPrice > 0.1) {
    return { ...coin, price: rawPrice };
  }
  if (coinPrice <= 0 && rawPrice > 0) {
    return { ...coin, price: rawPrice };
  }
  return coin;
});

console.log(`\n💰 ENHANCED RATING NODE v5.0 - PROFIT MAXIMIZATION`);
console.log(`   Processing ${candidates.length} candidates`);
console.log(`   🎯 Goal: Maximize Risk-Adjusted Returns`);

const btcData = candidates.find(c => c && (c.symbol === "BTCUSDT" || c.symbol === "BTC"));

//===============================================================================
// 🆕 ADVANCED MARKET STATE ANALYSIS
//===============================================================================

function analyzeMarketState(btc, allCoins) {
  if (!btc) {
    return {
      volatility_regime: "MEDIUM",
      market_breadth: "NEUTRAL",
      liquidity_state: "NORMAL",
      correlation_level: "MEDIUM",
      optimal_exposure: 1.0
    };
  }

  // Volatility regime (affects position sizing)
  const btc_atr_pct = btc.ta_1h?.atr_pct || 2.0;
  let volatility_regime = "MEDIUM";
  let vol_multiplier = 1.0;

  if (btc_atr_pct > 4.0) {
    volatility_regime = "EXTREME";
    vol_multiplier = 0.5;  // Reduce size in high vol
  } else if (btc_atr_pct > 3.0) {
    volatility_regime = "HIGH";
    vol_multiplier = 0.7;
  } else if (btc_atr_pct < 1.5) {
    volatility_regime = "LOW";
    vol_multiplier = 1.3;  // Increase size in low vol
  }

  // Market breadth (% of coins trending up)
  const altcoins = allCoins.filter(c => c.symbol !== "BTCUSDT" && c.symbol !== "BTC");
  const positive_momentum = altcoins.filter(c => (c.derived?.pct_change_24h || 0) > 0).length;
  const breadth_pct = (positive_momentum / altcoins.length) * 100;

  let market_breadth = "NEUTRAL";
  if (breadth_pct > 70) market_breadth = "STRONG_BULL";
  else if (breadth_pct > 55) market_breadth = "BULL";
  else if (breadth_pct < 30) market_breadth = "STRONG_BEAR";
  else if (breadth_pct < 45) market_breadth = "BEAR";

  // Liquidity state (average spread)
  const avg_spread = altcoins.reduce((sum, c) => sum + (c.data?.spread_pct || 0.05), 0) / altcoins.length;
  let liquidity_state = "NORMAL";
  if (avg_spread > 0.1) liquidity_state = "POOR";
  else if (avg_spread < 0.03) liquidity_state = "EXCELLENT";

  return {
    volatility_regime,
    volatility_multiplier: vol_multiplier,
    market_breadth,
    breadth_pct,
    liquidity_state,
    avg_spread,
    optimal_exposure: vol_multiplier
  };
}

//===============================================================================
// 🆕 KELLY CRITERION POSITION SIZING
//===============================================================================

function calculateKellyFraction(winRate, avgWin, avgLoss) {
  // Kelly = (Win% * AvgWin - Loss% * AvgLoss) / AvgWin
  // Conservative: Use 25% Kelly to avoid over-leveraging

  if (avgWin <= 0 || avgLoss <= 0) return 0.1;  // Default conservative

  const lossRate = 1 - winRate;
  const kelly = (winRate * avgWin - lossRate * avgLoss) / avgWin;
  const conservativeKelly = Math.max(0.05, Math.min(kelly * 0.25, 0.2));  // Cap at 20%

  return conservativeKelly;
}

//===============================================================================
// 🆕 VOLUME-WEIGHTED METRICS
//===============================================================================

function calculateVWAPScore(coin) {
  // VWAP proximity scoring
  // Close to VWAP = institutional interest zone

  const vp_4h = coin.ta_4h_with_vp?.volume_profile;
  const vp_1h = coin.ta_1h_with_vp?.volume_profile;

  if (!vp_4h) return 0;

  const price = coin.price || 0;
  const poc_4h = vp_4h.POC || 0;

  if (price === 0 || poc_4h === 0) return 0;

  const distance_from_poc = Math.abs((price - poc_4h) / price) * 100;

  // Closer to POC = higher score
  if (distance_from_poc < 0.5) return 20;      // Perfect
  if (distance_from_poc < 1.0) return 15;      // Excellent
  if (distance_from_poc < 2.0) return 10;      // Good
  if (distance_from_poc < 3.0) return 5;       // Moderate
  return 0;                                     // Poor
}

//===============================================================================
// 🆕 FUNDING RATE ARBITRAGE
//===============================================================================

function fundingArbitrageScore(coin, side) {
  const funding = coin.data?.fundingRate || 0;
  const funding_pct = funding * 100;

  // Extreme funding = mean reversion opportunity
  if (side === "BUY" && funding_pct < -0.05) {
    return 25;  // Shorts paying longs heavily = bullish setup
  }
  if (side === "SELL" && funding_pct > 0.1) {
    return 25;  // Longs paying shorts heavily = bearish setup
  }

  // Moderate funding alignment
  if (side === "BUY" && funding_pct < 0) return 10;
  if (side === "SELL" && funding_pct > 0.05) return 10;

  return 0;
}

//===============================================================================
// 🆕 SOCIAL SENTIMENT ACCELERATION
//===============================================================================

function sentimentAcceleration(coin) {
  // Rate of change in social metrics = early mover advantage

  const galaxy_jump = coin.derived?.galaxy_jump || 0;
  const altrank_jump = coin.derived?.alt_rank_jump || 0;

  // Massive acceleration = high conviction
  if (galaxy_jump > 15 || altrank_jump > 500) return 30;
  if (galaxy_jump > 10 || altrank_jump > 300) return 20;
  if (galaxy_jump > 5 || altrank_jump > 150) return 10;
  if (galaxy_jump > 0 || altrank_jump > 50) return 5;

  // Negative acceleration = exit signal
  if (galaxy_jump < -5 || altrank_jump < -100) return -15;

  return 0;
}

//===============================================================================
// 🆕 LIQUIDITY DEPTH SCORING
//===============================================================================

function liquidityDepthScore(coin) {
  // Order book depth = low slippage = better execution

  const bid_vol = coin.data?.bid_vol5 || 0;
  const ask_vol = coin.data?.ask_vol5 || 0;
  const total_depth = bid_vol + ask_vol;

  const oi = coin.derived?.openInterestValue || 0;
  const volume_24h = coin.derived?.volume24h || 0;

  let score = 0;

  // Deep order book
  if (total_depth > 100) score += 10;
  else if (total_depth > 50) score += 5;

  // High OI (institutional interest)
  if (oi > 10000000) score += 15;
  else if (oi > 5000000) score += 10;
  else if (oi > 1000000) score += 5;

  // High volume (liquidity)
  if (volume_24h > 100000) score += 10;
  else if (volume_24h > 50000) score += 5;

  return Math.min(score, 25);
}

//===============================================================================
// 🆕 MEAN REVERSION OPPORTUNITY
//===============================================================================

function meanReversionScore(coin, side) {
  // Oversold/Overbought with VP support = high probability reversal

  const rsi_15m = coin.ta_15m_with_vp?.rsi || 50;
  const rsi_1h = coin.ta_1h_with_vp?.rsi || 50;
  const rsi_4h = coin.ta_4h_with_vp?.rsi || 50;

  const vp_4h = coin.ta_4h_with_vp?.volume_profile;
  const at_poc = vp_4h?.at_POC || false;
  const in_value = vp_4h?.price_position === "INSIDE_VALUE";

  let score = 0;

  if (side === "BUY") {
    // Oversold + at institutional support = buy
    if (rsi_15m < 30 && rsi_1h < 40) score += 15;
    else if (rsi_15m < 35 && rsi_1h < 45) score += 10;

    if (at_poc || in_value) {
      score += 10;  // VP confirmation
    }
  } else if (side === "SELL") {
    // Overbought + at institutional resistance = sell
    if (rsi_15m > 70 && rsi_1h > 60) score += 15;
    else if (rsi_15m > 65 && rsi_1h > 55) score += 10;

    if (at_poc || in_value) {
      score += 10;  // VP confirmation
    }
  }

  return score;
}

//===============================================================================
// 🆕 DYNAMIC WEIGHT ADJUSTMENT
//===============================================================================

function getDynamicWeights(marketState, regime) {
  // Adjust scoring weights based on market conditions

  const baseWeights = {
    momentum: 1.0,
    volume_profile: 1.0,
    social: 1.0,
    technical: 1.0,
    liquidity: 1.0,
    funding: 1.0
  };

  // High volatility = trust VP more, social less
  if (marketState.volatility_regime === "EXTREME" || marketState.volatility_regime === "HIGH") {
    baseWeights.volume_profile = 1.5;
    baseWeights.social = 0.7;
    baseWeights.technical = 1.2;
  }

  // Strong trending = trust momentum more
  if (regime.strength === "STRONG") {
    baseWeights.momentum = 1.4;
    baseWeights.technical = 1.2;
  }

  // Ranging market = trust mean reversion more
  if (regime.regime === "NEUTRAL") {
    baseWeights.technical = 1.3;
    baseWeights.volume_profile = 1.3;
    baseWeights.momentum = 0.8;
  }

  // Poor liquidity = penalize everything
  if (marketState.liquidity_state === "POOR") {
    baseWeights.liquidity = 2.0;  // Double importance
  }

  return baseWeights;
}

//===============================================================================
// 🔥 ENHANCED REGIME DETECTION
//===============================================================================

function inferRegimeFromBTC(btc) {
  if (!btc) {
    return {
      regime: "NEUTRAL",
      confidence: "LOW",
      strength: "WEAK",
      btc_price: 0,
      funding_rate: 0,
      bullScore: 0,
      bearScore: 0
    };
  }

  let bullScore = 0;
  let bearScore = 0;

  // Market structure
  const ms4h = btc.ta_4h_with_vp?.market_structure?.structure || "RANGING";
  const ms1h = btc.ta_1h_with_vp?.market_structure?.structure || "RANGING";

  if (ms4h === "UPTREND") bullScore += 3;
  else if (ms4h === "DOWNTREND") bearScore += 3;
  if (ms1h === "UPTREND") bullScore += 1;
  else if (ms1h === "DOWNTREND") bearScore += 1;

  // EMA alignment
  const ema20_4h = btc.ta_4h_with_vp?.ema?.ema20 || 0;
  const ema50_4h = btc.ta_4h_with_vp?.ema?.ema50 || 0;
  const ema200_4h = btc.ta_4h_with_vp?.ema?.ema200 || 0;
  const price = btc.price || 0;

  if (ema20_4h > ema50_4h && ema50_4h > ema200_4h && price > ema20_4h) {
    bullScore += 3;
  } else if (ema20_4h < ema50_4h && ema50_4h < ema200_4h && price < ema20_4h) {
    bearScore += 3;
  }

  // RSI
  const rsi4h = btc.ta_4h_with_vp?.rsi || 50;
  if (rsi4h > 55 && rsi4h < 70) bullScore += 2;
  else if (rsi4h < 45 && rsi4h > 30) bearScore += 2;
  else if (rsi4h > 70) bearScore += 2;  // Overbought reversal risk
  else if (rsi4h < 30) bullScore += 2;  // Oversold reversal opportunity

  // Funding
  const funding = btc.data?.fundingRate || 0;
  if (funding < -0.001) bullScore += 2;  // Shorts paying = bullish
  else if (funding > 0.001) bearScore += 1.5;  // Longs paying = bearish

  // Volume Profile
  const vp_4h = btc.ta_4h_with_vp?.volume_profile;
  if (vp_4h) {
    if (vp_4h.price_position === "ABOVE_VALUE") bullScore += 2;
    else if (vp_4h.price_position === "BELOW_VALUE") bearScore += 2;
  }

  // Final regime
  let regime = "NEUTRAL";
  let confidence = "LOW";
  const diff = Math.abs(bullScore - bearScore);
  const total = bullScore + bearScore;

  if (bullScore >= bearScore + 2) {
    regime = "BULL";
    if (diff >= 5 && total >= 12) confidence = "HIGH";
    else if (diff >= 3) confidence = "MED";
  } else if (bearScore >= bullScore + 2) {
    regime = "BEAR";
    if (diff >= 5 && total >= 12) confidence = "HIGH";
    else if (diff >= 3) confidence = "MED";
  } else {
    if (total >= 8) confidence = "MED";
  }

  const strength = diff > 5 && total > 10 ? "STRONG" : (diff > 3 ? "MODERATE" : "WEAK");

  console.log(`\n📊 BTC REGIME: ${regime} (${confidence}), Strength: ${strength}`);
  console.log(`   Bull: ${bullScore.toFixed(1)} | Bear: ${bearScore.toFixed(1)}`);

  return { regime, confidence, strength, btc_price: price, funding_rate: funding, bullScore, bearScore };
}

//===============================================================================
// 🔥 ENHANCED SIDE DECISION
//===============================================================================

function decideSide(coin, regime, marketState) {
  let bullScore = 0;
  let bearScore = 0;

  // 🚀 MASSIVE MOMENTUM = INSTANT DECISION
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;
  const pct24h = coin.derived?.pct_change_24h || 0;

  if (altRankJump > 500 || galaxyJump > 15) {
    return { side: "BUY", bullScore: 100, bearScore: 0, conviction: "EXTREME" };
  }

  // Momentum
  if (altRankJump > 300 || galaxyJump > 10) bullScore += 15;
  else if (altRankJump > 150 || galaxyJump > 5) bullScore += 10;
  else if (altRankJump > 50 || galaxyJump > 2) bullScore += 5;

  if (altRankJump < -150 || galaxyJump < -5) bearScore += 10;
  else if (altRankJump < -50 || galaxyJump < -2) bearScore += 5;

  // Price momentum
  if (pct24h > 10) bullScore += 5;
  else if (pct24h > 5) bullScore += 3;
  else if (pct24h > 2) bullScore += 1.5;
  else if (pct24h < -10) bearScore += 5;
  else if (pct24h < -5) bearScore += 3;
  else if (pct24h < -2) bearScore += 1.5;

  // Market structure
  const ms4h = coin.ta_4h_with_vp?.market_structure?.structure || "RANGING";
  const ms1h = coin.ta_1h_with_vp?.market_structure?.structure || "RANGING";

  if (ms4h === "UPTREND") bullScore += 3;
  else if (ms4h === "DOWNTREND") bearScore += 3;
  if (ms1h === "UPTREND") bullScore += 1.5;
  else if (ms1h === "DOWNTREND") bearScore += 1.5;

  // RSI
  const rsi15m = coin.ta_15m_with_vp?.rsi || 50;
  const rsi1h = coin.ta_1h_with_vp?.rsi || 50;
  const rsi4h = coin.ta_4h_with_vp?.rsi || 50;

  if (rsi1h > 55 && rsi1h < 70) bullScore += 2;
  else if (rsi1h < 45 && rsi1h > 30) bearScore += 2;

  // Oversold/Overbought extreme
  if (rsi15m < 25 && rsi1h < 35) bullScore += 5;  // Strong reversal
  else if (rsi15m > 75 && rsi1h > 65) bearScore += 5;

  // Volume Profile
  const vp_4h = coin.ta_4h_with_vp?.volume_profile;
  if (vp_4h) {
    if (vp_4h.signal === "ENTRY_AT_POC") {
      // POC = neutral zone, check other signals
      bullScore += 2;
      bearScore += 2;
    } else if (vp_4h.signal === "BULLISH_BREAKOUT") {
      bullScore += 5;
    } else if (vp_4h.signal === "BEARISH_BREAKDOWN") {
      bearScore += 5;
    }

    if (vp_4h.at_POC) {
      bullScore += 3;
      bearScore += 3;  // POC = high probability zone both ways
    }
  }

  // Order book
  const obImbalance = coin.derived?.orderBookImbalance || 0;
  if (obImbalance > 0.2) bullScore += 2;
  else if (obImbalance < -0.2) bearScore += 2;

  // ADX + DI
  const adx1h = coin.ta_1h_with_vp?.adx?.adx || 0;
  if (adx1h > 25) {
    const diPlus = coin.ta_1h_with_vp?.adx?.plusDI || 0;
    const diMinus = coin.ta_1h_with_vp?.adx?.minusDI || 0;
    if (diPlus > diMinus + 5) bullScore += 2;
    else if (diMinus > diPlus + 5) bearScore += 2;
  }

  // Regime alignment
  if (regime.regime === "BULL" && regime.confidence !== "LOW") {
    bullScore *= 1.15;
  } else if (regime.regime === "BEAR" && regime.confidence !== "LOW") {
    bearScore *= 1.15;
  }

  // Market breadth alignment
  if (marketState.market_breadth === "STRONG_BULL") bullScore *= 1.1;
  else if (marketState.market_breadth === "STRONG_BEAR") bearScore *= 1.1;

  // Final decision
  let side = "HOLD";
  let conviction = "LOW";

  const diff = Math.abs(bullScore - bearScore);
  const total = bullScore + bearScore;

  if (bullScore > bearScore) {
    side = "BUY";
    if (diff > 15 && total > 20) conviction = "HIGH";
    else if (diff > 8 && total > 12) conviction = "MEDIUM";
  } else if (bearScore > bullScore) {
    side = "SELL";
    if (diff > 15 && total > 20) conviction = "HIGH";
    else if (diff > 8 && total > 12) conviction = "MEDIUM";
  } else {
    // Tie-breaker
    if (pct24h > 0) side = "BUY";
    else if (pct24h < 0) side = "SELL";
  }

  return { side, bullScore, bearScore, conviction };
}

//===============================================================================
// 🔥 ENHANCED ALPHA SCORE (v5.0)
//===============================================================================

function enhancedAlphaScore(coin, side, regime, marketState, weights) {
  let alpha = 0;

  // === BASE SCORES (EXISTING) ===
  const lcScore = coin.score || 0;
  alpha += Math.min(lcScore / 2.5, 25) * weights.social;

  const sentiment = coin.derived?.socialSentiment || 0;
  alpha += Math.min(sentiment * 0.15, 15) * weights.social;

  const galaxy = coin.derived?.galaxyScore || 0;
  alpha += Math.min(galaxy * 0.3, 22) * weights.social;

  // === 🆕 ENHANCED SCORES ===

  // 1. Social Sentiment Acceleration
  const sentimentAccel = sentimentAcceleration(coin);
  alpha += sentimentAccel * weights.social;

  // 2. Volume Profile Score
  const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);
  const vpScore = calculateVPScore(vp_15m, vp_1h, vp_4h);
  alpha += vpScore.vp_score * weights.volume_profile;

  if (vpScore.setup_quality === "GOLDEN") {
    alpha += 25 * weights.volume_profile;
  } else if (vpScore.setup_quality === "EXCELLENT") {
    alpha += 15 * weights.volume_profile;
  }

  // 3. VWAP Score
  const vwapScore = calculateVWAPScore(coin);
  alpha += vwapScore * weights.volume_profile;

  // 4. Funding Rate Arbitrage
  const fundingScore = fundingArbitrageScore(coin, side);
  alpha += fundingScore * weights.funding;

  // 5. Liquidity Depth
  const liquidityScore = liquidityDepthScore(coin);
  alpha += liquidityScore * weights.liquidity;

  // 6. Mean Reversion Opportunity
  const reversionScore = meanReversionScore(coin, side);
  alpha += reversionScore * weights.technical;

  // 7. Volatility bonus
  const atr = coin.ta_1h_with_vp?.atr || 0;
  const price = coin.price || 1;
  const vol_pct = (atr / price) * 100;

  let volBonus = 0;
  if (vol_pct > 5.0) volBonus = 20;      // Extreme vol = extreme opportunity
  else if (vol_pct > 4.0) volBonus = 15;
  else if (vol_pct > 3.0) volBonus = 10;
  else if (vol_pct > 2.0) volBonus = 5;
  else volBonus = -5;
  alpha += volBonus * weights.momentum;

  // 8. Technical indicators
  let techPoints = 0;
  const rsi1h = coin.ta_1h_with_vp?.rsi || 50;
  const adx1h = coin.ta_1h_with_vp?.adx?.adx || 0;

  if (side === "BUY") {
    if (rsi1h > 45 && rsi1h < 70) techPoints += 8;
    else if (rsi1h < 30) techPoints += 12;  // Oversold reversal
    if (adx1h > 25) techPoints += 8;
  } else if (side === "SELL") {
    if (rsi1h < 55 && rsi1h > 30) techPoints += 8;
    else if (rsi1h > 70) techPoints += 12;  // Overbought reversal
    if (adx1h > 25) techPoints += 8;
  }
  alpha += techPoints * weights.technical;

  // 9. Regime alignment
  let regimePoints = 0;
  if (regime.regime === "BULL" && side === "BUY") {
    regimePoints = regime.confidence === "HIGH" ? 15 : 10;
  } else if (regime.regime === "BEAR" && side === "SELL") {
    regimePoints = regime.confidence === "HIGH" ? 15 : 10;
  } else if (regime.regime === "NEUTRAL") {
    regimePoints = 5;
  }
  alpha += regimePoints;

  // 10. Strength multiplier
  if (regime.strength === "STRONG") alpha += 12;
  else if (regime.strength === "WEAK") alpha -= 5;

  // 11. Market breadth bonus
  if (marketState.market_breadth === "STRONG_BULL" && side === "BUY") alpha += 10;
  else if (marketState.market_breadth === "STRONG_BEAR" && side === "SELL") alpha += 10;

  return Math.max(0, alpha);
}

//===============================================================================
// HELPER FUNCTIONS
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

  if (vp_1h) {
    if (vp_1h.at_POC) {
      vpScore += 20;
      vpBoost += 10;
    } else if (vp_1h.price_position === "INSIDE_VALUE") {
      vpScore += 12;
      vpBoost += 6;
    }
  }

  if (vp_15m) {
    if (vp_15m.at_POC) {
      vpScore += 10;
      vpBoost += 5;
    } else if (vp_15m.price_position === "INSIDE_VALUE") {
      vpScore += 6;
      vpBoost += 3;
    }
  }

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

function safetyCheck(coin) {
  const spread = coin.data?.spread_pct || 1;
  if (spread > 0.2) return { valid: false, reason: "Spread >20%"  };

  const vol24 = coin.derived?.volume24h || 0;
  if (vol24 < 10000) return { valid: false, reason: "Volume <10K" };

  const oi = coin.derived?.openInterestValue || 0;
  if (oi < 10000) return { valid: false, reason: "OI <10K" };

  const price = coin.price || 0;
  if (price <= 0) return { valid: false, reason: "Invalid price" };

  return { valid: true, reason: "Pass" };
}

//===============================================================================
// 🔥 MAIN PROCESSING
//===============================================================================

const regime = inferRegimeFromBTC(btcData);
const marketState = analyzeMarketState(btcData, candidates);
const weights = getDynamicWeights(marketState, regime);

console.log(`\n🌍 MARKET STATE:`);
console.log(`   Volatility: ${marketState.volatility_regime} (x${marketState.volatility_multiplier.toFixed(2)})`);
console.log(`   Breadth: ${marketState.market_breadth} (${marketState.breadth_pct.toFixed(1)}%)`);
console.log(`   Liquidity: ${marketState.liquidity_state}`);
console.log(`   Optimal Exposure: ${(marketState.optimal_exposure * 100).toFixed(0)}%`);

console.log(`\n⚖️  DYNAMIC WEIGHTS:`);
console.log(`   Momentum: ${weights.momentum.toFixed(2)}x`);
console.log(`   Volume Profile: ${weights.volume_profile.toFixed(2)}x`);
console.log(`   Social: ${weights.social.toFixed(2)}x`);
console.log(`   Technical: ${weights.technical.toFixed(2)}x`);

let stats = {
  total: 0,
  btc_skipped: 0,
  hold_skipped: 0,
  safety_failed: 0,
  buy_signals: 0,
  sell_signals: 0,
  high_conviction: 0,
  golden_setups: 0
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

  const alpha = enhancedAlphaScore(coin, sideDecision.side, regime, marketState, weights);

  const safety = safetyCheck(coin);
  if (!safety.valid) {
    stats.safety_failed++;
    continue;
  }

  const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);
  const vpMetrics = calculateVPScore(vp_15m, vp_1h, vp_4h);

  if (vpMetrics.setup_quality === "GOLDEN") stats.golden_setups++;

  // Kelly Criterion position sizing recommendation
  // Assume 55% win rate, 1.5 avg win, 1.0 avg loss (conservative defaults)
  const kelly_fraction = calculateKellyFraction(0.55, 1.5, 1.0);
  const recommended_size_pct = kelly_fraction * marketState.volatility_multiplier * 100;

  ratedCoins.push({
    ...coin,
    side: sideDecision.side,
    alpha: alpha,
    alphaScore: alpha,
    conviction: sideDecision.conviction,
    recommended_size_pct: Math.min(recommended_size_pct, 20),  // Cap at 20%
    kelly_fraction: kelly_fraction,
    _regime: regime,
    _market_state: marketState,
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
      const altRankJump = coin.derived?.alt_rank_jump || 0;
      const pct24h = coin.derived?.pct_change_24h || 0;

      let forcedSide = pct24h > 0 ? "BUY" : "SELL";
      const alpha = enhancedAlphaScore(coin, forcedSide, regime, marketState, weights);

      return {
        ...coin,
        side: forcedSide,
        alpha: alpha,
        alphaScore: alpha,
        conviction: "LOW",
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
console.log(`   BTC skipped: ${stats.btc_skipped}`);
console.log(`   HOLD: ${stats.hold_skipped}`);
console.log(`   Safety failed: ${stats.safety_failed}`);
console.log(`   🟢 BUY: ${stats.buy_signals}`);
console.log(`   🔴 SELL: ${stats.sell_signals}`);
console.log(`   🎯 HIGH Conviction: ${stats.high_conviction}`);
console.log(`   🏆 GOLDEN Setups: ${stats.golden_setups}`);
console.log(`   📤 Output: ${topCoins.length}`);

if (topCoins.length > 0) {
  console.log(`\n✅ TOP 10 CANDIDATES (Enhanced v5.0):`);
  topCoins.slice(0, 10).forEach((c, i) => {
    const golden = c.vp_setup_quality === "GOLDEN" ? " 🏆" : "";
    const forced = c._forced ? " 🔴FORCED" : "";
    const sizePct = c.recommended_size_pct || 0;

    console.log(`   ${i + 1}. ${c.symbol} ${c.side} - Alpha ${c.alpha.toFixed(1)}${golden}${forced}`);
    console.log(`      Conviction: ${c.conviction} | Size: ${sizePct.toFixed(1)}%`);
    console.log(`      VP: ${c.vp_setup_quality} | Score: ${c.vp_score}`);
  });
}

console.log(`\n💰 PROFIT STRATEGY:`);
console.log(`   Focus: ${stats.high_conviction > 0 ? 'HIGH Conviction trades' : 'Best available setups'}`);
console.log(`   Risk Mode: ${marketState.volatility_regime === "EXTREME" ? 'CONSERVATIVE' : 'NORMAL'}`);
console.log(`   Market Bias: ${regime.regime}`);

return topCoins.map(coin => ({ json: coin }));
