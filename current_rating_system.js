// ═══════════════════════════════════════════════════════════════════════════
// 🎯 RATING NODE v4.0 - WITH VOLUME PROFILE (S-TIER) ✅ FIXED
// ═══════════════════════════════════════════════════════════════════════════
//
// FIX v4.0.1:
// ✅ FIXED: extractVPData() path (removed .data, VP is directly in ta_*_with_vp)
// ✅ FIXED: vp_4h_signal path (use vp_4h?.signal directly)
//
// NEW IN v4.0:
// ✅ Volume Profile scoring (up to +100 points for GOLDEN setups)
// ✅ Multi-timeframe VP alignment detection (+30 bonus)
// ✅ VP-based hard filters (skip coins far from institutional zones)
// ✅ HVN support/resistance risk assessment
// ✅ POC-based entry quality scoring
//
// ROLE: Screen & Rate coins, pass BOTH LONG & SHORT candidates to Trade Selector
//
// OUTPUT: 10-20 coins (MIX of long + short) with VP-enhanced alpha scores
// Trade Selector picks THE BEST ONE from this mix
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

// FIX: Validate and correct price data
candidates = candidates.map(coin => {
  const rawPrice = parseFloat(coin.raw?.lastPrice || coin.data?.last_price || 0);
  const coinPrice = parseFloat(coin.price || 0);

  // If coin.price is significantly different from raw.lastPrice, use raw
  if (rawPrice > 0 && Math.abs(coinPrice - rawPrice) / rawPrice > 0.1) {
    console.log(`   🔧 FIXED: ${coin.symbol} price ${coinPrice} → ${rawPrice}`);
    return { ...coin, price: rawPrice };
  }

  // If coin.price is zero or invalid, use raw
  if (coinPrice <= 0 && rawPrice > 0) {
    console.log(`   🔧 FIXED: ${coin.symbol} invalid price → ${rawPrice}`);
    return { ...coin, price: rawPrice };
  }

  return coin;
});

console.log(`\n🎯 RATING NODE v4.0.1 WITH VOLUME PROFILE (FIXED) - Processing ${candidates.length} coins`);
console.log(`   🆕 S-Tier VP scoring enabled!`);
console.log(`   Output: 10-20 rated coins (long+short mix) → Trade Selector`);

if (!Array.isArray(candidates) || candidates.length === 0) {
  console.error("❌ ERROR: Invalid input!");
  return [{json: {error: "Invalid input", candidates: []}}];
}

const btcData = candidates.find(c => c && (c.symbol === "BTCUSDT" || c.symbol === "BTC"));

//===============================================================================
// 🆕 VOLUME PROFILE FUNCTIONS (S-TIER)
//===============================================================================

/**
 * Extract VP data from merged TA sources
 * FIXED: VP is directly in ta_*_with_vp, NOT in ta_*_with_vp.data
 */
function extractVPData(coin) {
  // FIXED: Direct path without .data
  const vp_15m = coin.ta_15m_with_vp?.volume_profile || null;
  const vp_1h = coin.ta_1h_with_vp?.volume_profile || null;
  const vp_4h = coin.ta_4h_with_vp?.volume_profile || null;

  return { vp_15m, vp_1h, vp_4h };
}

/**
 * Calculate Volume Profile Score (0-100+)
 * Higher score = better institutional positioning
 */
function calculateVPScore(vp_15m, vp_1h, vp_4h) {
  let vpScore = 0;
  let vpBoost = 0;

  // 🔹 4H VP (HIGHEST PRIORITY - Strategic level)
  if (vp_4h) {
    if (vp_4h.at_POC) {
      vpScore += 30;  // @ POC = EXCELLENT
      vpBoost += 15;
    } else if (vp_4h.price_position === "INSIDE_VALUE") {
      vpScore += 20;  // In value area = GOOD
      vpBoost += 8;
    } else if (vp_4h.price_position === "ABOVE_VALUE") {
      // Above value area - potential breakout OR overextended
      if (vp_4h.poc_distance_pct < 3) {
        vpScore += 10;  // Close to value area
        vpBoost += 3;
      } else {
        vpScore += 0;   // Too far - risky
      }
    } else if (vp_4h.price_position === "BELOW_VALUE") {
      // Below value area - potential breakdown OR oversold
      if (vp_4h.poc_distance_pct < 3) {
        vpScore += 10;  // Close to value area
        vpBoost += 3;
      } else {
        vpScore += 0;   // Too far - risky
      }
    }

    // HVN support/resistance bonus
    if (vp_4h.high_volume_nodes && vp_4h.high_volume_nodes.length > 0) {
      vpScore += 5;  // Has institutional levels
    }
  }

  // 🔹 1H VP (MEDIUM PRIORITY - Tactical level)
  if (vp_1h) {
    if (vp_1h.at_POC) {
      vpScore += 20;
      vpBoost += 10;
    } else if (vp_1h.price_position === "INSIDE_VALUE") {
      vpScore += 12;
      vpBoost += 6;
    } else {
      if (vp_1h.poc_distance_pct < 2) {
        vpScore += 6;
        vpBoost += 3;
      }
    }
  }

  // 🔹 15min VP (LOW PRIORITY - Timing/Entry precision)
  if (vp_15m) {
    if (vp_15m.at_POC) {
      vpScore += 10;  // Perfect timing
      vpBoost += 5;
    } else if (vp_15m.price_position === "INSIDE_VALUE") {
      vpScore += 6;
      vpBoost += 3;
    }
  }

  // 🏆 MULTI-TIMEFRAME ALIGNMENT BONUS (GOLDEN SETUP)
  const allAtPOC = vp_15m?.at_POC && vp_1h?.at_POC && vp_4h?.at_POC;
  const allInValue =
    (vp_15m?.price_position === "INSIDE_VALUE" || vp_15m?.at_POC) &&
    (vp_1h?.price_position === "INSIDE_VALUE" || vp_1h?.at_POC) &&
    (vp_4h?.price_position === "INSIDE_VALUE" || vp_4h?.at_POC);

  if (allAtPOC) {
    vpScore += 30;  // 🏆 GOLDEN INSTITUTIONAL SETUP
    vpBoost += 10;
  } else if (allInValue) {
    vpScore += 15;  // All timeframes in fair value zone
    vpBoost += 7;
  }

  // Determine setup quality
  let setupQuality = "MODERATE";
  if (allAtPOC) setupQuality = "GOLDEN";
  else if (allInValue) setupQuality = "EXCELLENT";
  else if (vp_4h?.at_POC || vp_1h?.at_POC) setupQuality = "GOOD";

  return {
    vp_score: Math.min(vpScore, 100),  // Cap at 100
    vp_confidence_boost: vpBoost,
    multi_tf_aligned: allAtPOC || allInValue,
    setup_quality: setupQuality,
    // Raw data for debugging
    _vp_4h_at_poc: vp_4h?.at_POC || false,
    _vp_1h_at_poc: vp_1h?.at_POC || false,
    _vp_15m_at_poc: vp_15m?.at_POC || false
  };
}

/**
 * VP-based hard filters
 * Returns: { pass: boolean, reason: string }
 */
function vpHardFilters(vp_4h) {
  if (!vp_4h) {
    // No VP data = no filter (allow coin to pass)
    return { pass: true, reason: "No VP data" };
  }

  // SKIP: Coins too far from 4H value area (>5%)
  if (vp_4h.price_position === "ABOVE_VALUE" && vp_4h.poc_distance_pct > 5) {
    return { pass: false, reason: "Too far above 4H value area (>5%)" };
  }

  if (vp_4h.price_position === "BELOW_VALUE" && vp_4h.poc_distance_pct > 5) {
    return { pass: false, reason: "Too far below 4H value area (>5%)" };
  }

  // SKIP: Coins in low volume nodes (price will fly through)
  // This is optional - you can enable if you want stricter filtering
  /*
  if (vp_4h.low_volume_nodes && vp_4h.low_volume_nodes.length > 0) {
    const currentPrice = vp_4h.POC; // approximation
    const inLVN = vp_4h.low_volume_nodes.some(lvn =>
      Math.abs(lvn.price - currentPrice) / currentPrice < 0.01
    );
    if (inLVN) {
      return { pass: false, reason: "Price in LVN zone (low volume)" };
    }
  }
  */

  return { pass: true, reason: "VP filters passed" };
}

/**
 * HVN-based risk assessment
 * Returns: { risk: "LOW"|"MEDIUM"|"HIGH", support_levels: number, resistance_levels: number }
 */
function hvnRiskAssessment(vp_4h, side, currentPrice) {
  if (!vp_4h || !vp_4h.high_volume_nodes || vp_4h.high_volume_nodes.length === 0) {
    return { risk: "UNKNOWN", support_levels: 0, resistance_levels: 0 };
  }

  const hvnAbove = vp_4h.high_volume_nodes.filter(h => h.price > currentPrice);
  const hvnBelow = vp_4h.high_volume_nodes.filter(h => h.price < currentPrice);

  if (side === "BUY") {
    // LONG position: Check if we have HVN support below (good)
    // and limited HVN resistance above (good)
    const risk = hvnBelow.length >= 2 ? "LOW" :
                 (hvnBelow.length === 1 ? "MEDIUM" : "HIGH");

    return {
      risk,
      support_levels: hvnBelow.length,
      resistance_levels: hvnAbove.length
    };
  } else {
    // SHORT position: Check if we have HVN resistance above (good)
    // and limited HVN support below (good)
    const risk = hvnAbove.length >= 2 ? "LOW" :
                 (hvnAbove.length === 1 ? "MEDIUM" : "HIGH");

    return {
      risk,
      resistance_levels: hvnAbove.length,
      support_levels: hvnBelow.length
    };
  }
}

//===============================================================================
// HELPER FUNCTIONS (EXISTING)
//===============================================================================

function calculateTrendStrength(bullScore, bearScore) {
  const total = bullScore + bearScore;
  const diff = Math.abs(bullScore - bearScore);
  if (total === 0) return "WEAK";
  const diffPct = (diff / total) * 100;
  if (diffPct > 40 && total > 10) return "STRONG";
  else if (diffPct > 25) return "MODERATE";
  else return "WEAK";
}

function inferRegimeFromBTC(btc) {
  if (!btc) {
    return {
      regime: "NEUTRAL", confidence: "LOW", strength: "WEAK",
      btc_price: 0, funding_rate: 0, bullScore: 0, bearScore: 0
    };
  }

  let bullScore = 0;
  let bearScore = 0;

  const ms4h = btc.ta_4h?.market_structure?.trend || "UNKNOWN";
  const ms1h = btc.ta_1h?.market_structure?.trend || "UNKNOWN";
  const st4h = btc.ta_4h?.supertrend?.trend || "NEUTRAL";
  const st1h = btc.ta_1h?.supertrend?.trend || "NEUTRAL";
  const st15m = btc.ta_15m?.supertrend?.trend || "NEUTRAL";
  const funding = btc.derived?.fundingRate || btc.data?.fundingRate || 0;
  const ema20_4h = btc.ta_4h?.ema?.ema20 || 0;
  const ema50_4h = btc.ta_4h?.ema?.ema50 || 0;
  const ema200_4h = btc.ta_4h?.ema?.ema200 || 0;
  const price = btc.price || btc.derived?.lastPrice || 0;

  if (ms4h === "UPTREND") bullScore += 3;
  else if (ms4h === "DOWNTREND") bearScore += 3;
  if (ms1h === "UPTREND") bullScore += 1;
  else if (ms1h === "DOWNTREND") bearScore += 1;

  const bullishCount = [st4h, st1h, st15m].filter(t => t === "BULLISH").length;
  const bearishCount = [st4h, st1h, st15m].filter(t => t === "BEARISH").length;
  if (bullishCount === 3) bullScore += 3;
  else if (bullishCount === 2) bullScore += 1;
  if (bearishCount === 3) bearScore += 3;
  else if (bearishCount === 2) bearScore += 1;

  if (ema20_4h > ema50_4h && ema50_4h > ema200_4h && price > ema20_4h) {
    bullScore += 2;
  } else if (ema20_4h < ema50_4h && ema50_4h < ema200_4h && price < ema20_4h) {
    bearScore += 2;
  }

  const rsi4h = btc.ta_4h?.rsi?.value || 50;
  if (rsi4h > 55 && rsi4h < 70) bullScore += 1.5;
  else if (rsi4h < 45 && rsi4h > 30) bearScore += 1.5;

  const trendStrength = calculateTrendStrength(bullScore, bearScore);

  if (trendStrength === "STRONG" || trendStrength === "MODERATE") {
    if (bullScore > bearScore) {
      if (funding > 0.001) bullScore += 1;
      else if (funding < -0.001) bearScore += 2;
    } else if (bearScore > bullScore) {
      if (funding < -0.001) bearScore += 1;
      else if (funding > 0.001) bullScore += 2;
    }
  } else {
    if (funding < -0.0005) bullScore += 2;
    if (funding > 0.001) bearScore += 2;
  }

  let regime = "NEUTRAL";
  let confidence = "LOW";
  const diff = Math.abs(bullScore - bearScore);
  const total = bullScore + bearScore;

  if (bullScore >= bearScore + 2) {
    regime = "BULL";
    if (diff >= 5 && total >= 10) confidence = "HIGH";
    else if (diff >= 3) confidence = "MED";
  } else if (bearScore >= bullScore + 2) {
    regime = "BEAR";
    if (diff >= 5 && total >= 10) confidence = "HIGH";
    else if (diff >= 3) confidence = "MED";
  } else {
    if (total >= 8) confidence = "MED";
  }

  const strength = calculateTrendStrength(bullScore, bearScore);
  console.log(`\n📊 BTC REGIME: ${regime} (${confidence}), Strength: ${strength}`);

  return { regime, confidence, strength, btc_price: price, funding_rate: funding, bullScore, bearScore };
}

function decideSide(coin, regime) {
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;
  const pct24h = coin.derived?.pct_change_24h || 0;

  // 🚀 ABSOLUTE PRIORITY: MASSIVE momentum = instant decision (ignore all else)
  if (altRankJump > 500 || galaxyJump > 15) {
    return { side: "BUY", bullScore: 100, bearScore: 0 };
  }

  if (altRankJump > 200 || galaxyJump > 8) {
    if (pct24h > 0) {
      return { side: "BUY", bullScore: 50, bearScore: 0 };
    }
  }

  // Now calculate normal scores
  let bullScore = 0;
  let bearScore = 0;

  // Momentum indicators (high weight)
  if (altRankJump > 300 || galaxyJump > 8) bullScore += 10;
  else if (altRankJump > 100 || galaxyJump > 5) bullScore += 6;
  else if (altRankJump > 50 || galaxyJump > 2) bullScore += 3;

  if (altRankJump < -100 || galaxyJump < -5) bearScore += 6;

  // Price momentum (24h)
  if (pct24h > 5) bullScore += 2;
  else if (pct24h > 3) bullScore += 1.5;
  else if (pct24h > 1) bullScore += 0.5;
  else if (pct24h < -5) bearScore += 2;
  else if (pct24h < -3) bearScore += 1.5;
  else if (pct24h < -1) bearScore += 0.5;

  // Supertrend
  const st15m = coin.ta_15m?.supertrend?.trend || "NEUTRAL";
  const st1h = coin.ta_1h?.supertrend?.trend || "NEUTRAL";
  const st4h = coin.ta_4h?.supertrend?.trend || "NEUTRAL";

  if (st15m === "BULLISH") bullScore += 0.5;
  else if (st15m === "BEARISH") bearScore += 0.5;
  if (st1h === "BULLISH") bullScore += 1;
  else if (st1h === "BEARISH") bearScore += 1;
  if (st4h === "BULLISH") bullScore += 1.5;
  else if (st4h === "BEARISH") bearScore += 1.5;

  // Market Structure
  const ms1h = coin.ta_1h?.market_structure?.trend || "UNKNOWN";
  const ms4h = coin.ta_4h?.market_structure?.trend || "UNKNOWN";

  if (ms1h === "UPTREND") bullScore += 1;
  else if (ms1h === "DOWNTREND") bearScore += 1;
  if (ms4h === "UPTREND") bullScore += 1.5;
  else if (ms4h === "DOWNTREND") bearScore += 1.5;

  // RSI
  const rsi15m = coin.ta_15m?.rsi?.value || 50;
  if (rsi15m > 55 && rsi15m < 70) bullScore += 0.5;
  else if (rsi15m < 45 && rsi15m > 30) bearScore += 0.5;

  // Order Book Imbalance
  const obImbalance = coin.derived?.orderBookImbalance || 0;
  if (obImbalance > 0.1) bullScore += 1;
  else if (obImbalance < -0.1) bearScore += 1;

  // ADX + DI
  const adx1h = coin.ta_1h?.adx?.adx || 0;
  if (adx1h > 25) {
    const diPlus = coin.ta_1h?.adx?.plusDI || 0;
    const diMinus = coin.ta_1h?.adx?.minusDI || 0;
    if (diPlus > diMinus) bullScore += 1;
    else if (diMinus > diPlus) bearScore += 1;
  }

  // Momentum
  const momentum1h = coin.ta_1h?.momentum?.value || 0;
  if (momentum1h > 0) bullScore += 0.5;
  else if (momentum1h < 0) bearScore += 0.5;

  // Regime alignment (light touch)
  if (regime.regime === "BULL") bullScore *= 1.1;
  else if (regime.regime === "BEAR") bearScore *= 1.1;

  // Final decision
  let side = "HOLD";

  if (bullScore > bearScore) {
    side = "BUY";
  } else if (bearScore > bullScore) {
    side = "SELL";
  } else {
    if (pct24h > 0) side = "BUY";
    else if (pct24h < 0) side = "SELL";
  }

  return { side, bullScore, bearScore };
}

function alphaScore(coin, side, regime, vpMetrics) {
  let alpha = 0;

  const lcScore = coin.score || 0;
  alpha += Math.min(lcScore / 2.5, 25);

  const sentiment = coin.derived?.socialSentiment || 0;
  alpha += Math.min(sentiment * 0.15, 15);

  const galaxy = coin.derived?.galaxyScore || 0;
  alpha += Math.min(galaxy * 0.3, 22);

  const galaxyJump = coin.derived?.galaxy_jump || 0;
  if (galaxyJump > 10) alpha += 15;
  else if (galaxyJump > 5) alpha += 10;
  else if (galaxyJump > 0) alpha += 5;

  const altRankJump = coin.derived?.alt_rank_jump || 0;
  if (altRankJump > 500) alpha += 15;
  else if (altRankJump > 250) alpha += 10;
  else if (altRankJump > 100) alpha += 5;

  const vol24 = coin.derived?.volume24h || 0;
  alpha += Math.min(Math.log10(vol24 + 1) * 2, 18);

  const oi = coin.derived?.openInterestValue || 0;
  alpha += Math.min(Math.log10(oi + 1), 10);

  const funding = coin.data?.fundingRate || 0;
  let fundingPoints = 0;
  if (side === "BUY" && funding < 0) fundingPoints = 5;
  else if (side === "SELL" && funding > 0) fundingPoints = 5;
  else if (Math.abs(funding) < 0.0001) fundingPoints = 3;
  alpha += fundingPoints;

  const spread = coin.data?.spread_pct || 1;
  const obImbalance = Math.abs(coin.derived?.orderBookImbalance || 0);
  let obPoints = 0;
  if (spread < 0.02) obPoints += 4;
  else if (spread < 0.05) obPoints += 2;
  if (obImbalance > 0.2) obPoints += 4;
  alpha += Math.min(obPoints, 8);

  const atr = coin.ta_1h?.atr || 0;
  const price = coin.price || 1;
  const vol_pct = (atr / price) * 100;

  let volBonus = 0;
  if (vol_pct > 4.0) volBonus = +15;
  else if (vol_pct > 3.0) volBonus = +10;
  else if (vol_pct > 2.0) volBonus = +5;
  else if (vol_pct > 1.5) volBonus = 0;
  else volBonus = -5;
  alpha += volBonus;

  const engEfficiency = coin.derived?.engagement_efficiency || 0;
  if (engEfficiency > 200) alpha += 10;
  else if (engEfficiency > 100) alpha += 5;

  const momentum1h = coin.ta_1h?.momentum?.value || 0;
  alpha += Math.min(Math.abs(momentum1h) * 5, 10);

  let techPoints = 0;
  const rsi1h = coin.ta_1h?.rsi || 50;
  const macd1h = coin.ta_1h?.macd?.histogram || 0;
  const adx1h = coin.ta_1h?.adx?.adx || 0;

  if (side === "BUY") {
    if (rsi1h > 45 && rsi1h < 70) techPoints += 5;
    if (macd1h > 0) techPoints += 5;
    if (adx1h > 25) techPoints += 5;
  } else if (side === "SELL") {
    if (rsi1h < 55 && rsi1h > 30) techPoints += 5;
    if (macd1h < 0) techPoints += 5;
    if (adx1h > 25) techPoints += 5;
  }
  alpha += Math.min(techPoints, 15);

  let regimePoints = 0;
  if (regime.regime === "BULL" && side === "BUY") regimePoints = 8;
  else if (regime.regime === "BEAR" && side === "SELL") regimePoints = 8;
  else if (regime.regime === "NEUTRAL") regimePoints = 4;
  alpha += regimePoints;

  if (regime.strength === "STRONG") alpha += 10;
  else if (regime.strength === "WEAK") alpha -= 5;

  // 🆕 ADD VOLUME PROFILE SCORE
  if (vpMetrics) {
    alpha += vpMetrics.vp_score;

    // Extra bonus for GOLDEN setups
    if (vpMetrics.setup_quality === "GOLDEN") {
      alpha += 20;  // 🏆 GOLDEN = massive boost
    } else if (vpMetrics.setup_quality === "EXCELLENT") {
      alpha += 10;
    }
  }

  return Math.max(0, alpha);
}

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

const regime = inferRegimeFromBTC(btcData);

console.log(`\n🔍 Processing candidates with Volume Profile...`);

let stats = {
  total: 0, btc_skipped: 0, hold_skipped: 0,
  safety_failed: 0, vp_filtered: 0,
  buy_signals: 0, sell_signals: 0,
  vp_golden: 0, vp_excellent: 0, vp_good: 0
};

const ratedCoins = [];

for (const coin of candidates) {
  stats.total++;

  if (coin.symbol === "BTCUSDT" || coin.symbol === "BTC") {
    stats.btc_skipped++;
    continue;
  }

  // 🆕 EXTRACT VP DATA
  const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);

  // 🆕 APPLY VP HARD FILTERS
  const vpFilter = vpHardFilters(vp_4h);
  if (!vpFilter.pass) {
    stats.vp_filtered++;
    continue;
  }

  const sideDecision = decideSide(coin, regime);

  if (sideDecision.side === "HOLD") {
    stats.hold_skipped++;
    continue;
  }

  if (sideDecision.side === "BUY") stats.buy_signals++;
  else stats.sell_signals++;

  // 🆕 CALCULATE VP METRICS
  const vpMetrics = calculateVPScore(vp_15m, vp_1h, vp_4h);

  // Track VP setup quality
  if (vpMetrics.setup_quality === "GOLDEN") stats.vp_golden++;
  else if (vpMetrics.setup_quality === "EXCELLENT") stats.vp_excellent++;
  else if (vpMetrics.setup_quality === "GOOD") stats.vp_good++;

  // 🆕 CALCULATE ALPHA SCORE (with VP)
  const alpha = alphaScore(coin, sideDecision.side, regime, vpMetrics);

  const safety = safetyCheck(coin);
  if (!safety.valid) {
    stats.safety_failed++;
    continue;
  }

  // 🆕 HVN RISK ASSESSMENT
  const hvnRisk = hvnRiskAssessment(vp_4h, sideDecision.side, coin.price);

  ratedCoins.push({
    ...coin,
    side: sideDecision.side,
    alpha: alpha,
    alphaScore: alpha,
    _regime: regime,
    _sideScores: {
      bullScore: sideDecision.bullScore,
      bearScore: sideDecision.bearScore
    },
    // 🆕 VP METADATA
    vp_confidence_boost: vpMetrics.vp_confidence_boost,
    vp_setup_quality: vpMetrics.setup_quality,
    vp_multi_tf_aligned: vpMetrics.multi_tf_aligned,
    vp_score: vpMetrics.vp_score,
    vp_4h_at_poc: vpMetrics._vp_4h_at_poc,
    vp_4h_signal: vp_4h?.signal || "UNKNOWN",
    hvn_risk: hvnRisk.risk,
    hvn_support_levels: hvnRisk.support_levels,
    hvn_resistance_levels: hvnRisk.resistance_levels
  });
}

ratedCoins.sort((a, b) => b.alpha - a.alpha);
let topCoins = ratedCoins.slice(0, 20);

//===============================================================================
// ENSURE MINIMUM 1 COIN (workflow requirement)
//===============================================================================

if (topCoins.length === 0) {
  console.log(`\n⚠️  No coins passed filters. FALLBACK MODE - forcing top 1...`);

  const forcedCoin = candidates
    .filter(c => c.symbol !== "BTCUSDT" && c.symbol !== "BTC")
    .map(coin => {
      const altRankJump = coin.derived?.alt_rank_jump || 0;
      const galaxyJump = coin.derived?.galaxy_jump || 0;
      const pct24h = coin.derived?.pct_change_24h || 0;

      let forcedSide = "BUY";
      if (altRankJump > 0 || galaxyJump > 0 || pct24h > 0) {
        forcedSide = "BUY";
      } else if (altRankJump < 0 || galaxyJump < 0 || pct24h < 0) {
        forcedSide = "SELL";
      } else {
        const rsi1h = coin.ta_1h?.rsi || 50;
        forcedSide = rsi1h > 50 ? "BUY" : "SELL";
      }

      const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);
      const vpMetrics = calculateVPScore(vp_15m, vp_1h, vp_4h);
      const alpha = alphaScore(coin, forcedSide, regime, vpMetrics);

      return {
        ...coin,
        side: forcedSide,
        alpha: alpha,
        alphaScore: alpha,
        _regime: regime,
        _forced: true,
        vp_setup_quality: vpMetrics.setup_quality
      };
    })
    .sort((a, b) => b.alpha - a.alpha)[0];

  if (forcedCoin) {
    topCoins = [forcedCoin];
    console.log(`   🔴 Forced: ${forcedCoin.symbol} ${forcedCoin.side} - Alpha ${forcedCoin.alpha.toFixed(1)}`);
  }
}

//===============================================================================
// OUTPUT
//===============================================================================

console.log(`\n📊 STATISTICS:`);
console.log(`   Total processed: ${stats.total}`);
console.log(`   BTC skipped: ${stats.btc_skipped}`);
console.log(`   HOLD (no signal): ${stats.hold_skipped}`);
console.log(`   Safety failed: ${stats.safety_failed}`);
console.log(`   🆕 VP filtered (too far from value): ${stats.vp_filtered}`);
console.log(`   🟢 BUY signals: ${stats.buy_signals}`);
console.log(`   🔴 SELL signals: ${stats.sell_signals}`);
console.log(`   📦 Rated coins: ${ratedCoins.length}`);
console.log(`   📤 Passing to Trade Selector: ${topCoins.length}`);
console.log(`\n🏆 VP SETUP QUALITY:`);
console.log(`   🥇 GOLDEN setups: ${stats.vp_golden}`);
console.log(`   🥈 EXCELLENT setups: ${stats.vp_excellent}`);
console.log(`   🥉 GOOD setups: ${stats.vp_good}`);

if (topCoins.length > 0) {
  console.log(`\n✅ Top 10 Candidates (VP-Enhanced):`);
  topCoins.slice(0, 10).forEach((c, i) => {
    const altRank = c.derived?.alt_rank_jump || 0;
    const galaxy = c.derived?.galaxy_jump || 0;
    const pct24h = c.derived?.pct_change_24h || 0;
    const forced = c._forced ? " 🔴FORCED" : "";
    const vpQuality = c.vp_setup_quality || "N/A";
    const vpBoost = c.vp_confidence_boost || 0;
    const golden = vpQuality === "GOLDEN" ? " 🏆" : "";

    console.log(`   ${i + 1}. ${c.symbol} ${c.side} - Alpha ${c.alpha.toFixed(1)}${forced}${golden}`);
    console.log(`      24h: ${pct24h.toFixed(1)}% | AltRank: +${altRank} | Galaxy: +${galaxy.toFixed(1)}`);
    console.log(`      🆕 VP: ${vpQuality} (+${vpBoost}% boost) | 4H Signal: ${c.vp_4h_signal}`);
  });
}

console.log(`\n📤 Returning ${topCoins.length} VP-enhanced rated candidates`);
console.log(`   → Trade Selector will pick THE BEST ONE ✅`);

return topCoins.map(coin => ({ json: coin }));

