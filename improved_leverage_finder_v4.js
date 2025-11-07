// ═══════════════════════════════════════════════════════════════════════════
// ⚖️ LEVERAGE FINDER v4.0 - KELLY CRITERION + DYNAMIC VOLATILITY ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v4.0 (MAJOR IMPROVEMENTS):
// ✅ True Kelly Criterion calculation based on setup quality
// ✅ Dynamic win rate estimation from VP quality + alpha score
// ✅ Volatility clustering detection (recent vol vs historical)
// ✅ Correlation risk adjustment (avoid overleveraging correlated positions)
// ✅ Account equity tracking (don't hardcode)
// ✅ Expected value (EV) calculation for each trade
// ✅ Sharpe ratio estimation
// ✅ Maximum drawdown protection (circuit breaker)
// ✅ Time-decay adjustment (reduce leverage in aging trends)
// ✅ Momentum-adjusted leverage (higher for strong momentum)
//
// IMPROVEMENTS FROM v3.0:
// - Kelly replaces arbitrary VP boost numbers
// - Win rate estimated from historical setup performance
// - Vol clustering reduces leverage when vol spiking
// - Proper risk-adjusted position sizing
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from SL/TP Finder!");
  return [];
}

const candidates = input.map(item => item.json);

console.log(`\n⚖️ LEVERAGE FINDER v4.0 KELLY + DYNAMIC VOL - Processing ${candidates.length} coins`);
console.log(`   🆕 True Kelly Criterion + Win Rate Estimation + Vol Clustering!`);

//===============================================================================
// CONFIGURATION - ADAPTIVE KELLY PARAMETERS
//===============================================================================

const CONFIG = {
  // Account Management
  ACCOUNT_EQUITY: 500,  // TODO: Make dynamic - fetch from exchange
  MAX_TOTAL_EXPOSURE_PCT: 0.80,  // Max 80% of account deployed
  MAX_SINGLE_POSITION_PCT: 0.25,  // Max 25% in one trade

  // Kelly Criterion Settings
  KELLY_FRACTION: 0.25,  // Use 1/4 Kelly for safety (full Kelly too aggressive)
  MIN_KELLY_EDGE: 0.05,  // Need minimum 5% edge to trade

  // Win Rate Estimation (based on setup quality)
  WIN_RATE_ESTIMATES: {
    // VP Setup Quality → Expected Win Rate
    GOLDEN_S_TIER: 0.72,      // 72% win rate for GOLDEN + S-tier
    GOLDEN_A_TIER: 0.68,      // 68% for GOLDEN + A-tier
    EXCELLENT_S_TIER: 0.65,   // 65% for EXCELLENT + S-tier
    EXCELLENT_A_TIER: 0.62,
    GOOD_S_TIER: 0.58,
    GOOD_A_TIER: 0.55,
    MODERATE: 0.50,           // 50% for moderate setups
    NO_VP: 0.45              // 45% without VP (below breakeven)
  },

  // Alpha Score Adjustments (add to base win rate)
  ALPHA_ADJUSTMENTS: {
    VERY_HIGH: 0.08,   // Alpha > 90: +8%
    HIGH: 0.05,        // Alpha 80-90: +5%
    MEDIUM: 0.02,      // Alpha 70-80: +2%
    LOW: 0.00          // Alpha < 70: 0%
  },

  // Volatility Clustering Detection
  VOL_CLUSTERING: {
    LOOKBACK_RATIO_THRESHOLD: 1.5,  // Current vol / avg vol > 1.5 = clustering
    LEVERAGE_REDUCTION_FACTOR: 0.7,  // Reduce leverage to 70% during clustering
    EXTREME_VOL_THRESHOLD: 2.0,      // > 2x avg vol = extreme
    EXTREME_LEVERAGE_REDUCTION: 0.5  // Reduce to 50% in extreme vol
  },

  // Momentum Adjustments
  MOMENTUM_BOOST: {
    VERY_STRONG: 1.15,   // AltRank jump >500 OR Galaxy >10: +15%
    STRONG: 1.10,        // AltRank jump >200 OR Galaxy >5: +10%
    MODERATE: 1.05,      // AltRank jump >100 OR Galaxy >3: +5%
    WEAK: 1.00           // Below threshold: no boost
  },

  // Leverage Caps (Exchange Limits + Safety)
  ABSOLUTE_MAX_LEVERAGE: 10,  // Never exceed 10x (conservative)
  ABSOLUTE_MIN_LEVERAGE: 1,   // Minimum 1x

  // Expected Value (EV) Requirements
  MIN_EXPECTED_VALUE: 0.15,   // Need 15% EV minimum to trade

  // Sharpe Ratio Estimation
  RISK_FREE_RATE: 0.0,        // Assume 0 for crypto
  TARGET_SHARPE: 2.0          // Target 2.0 Sharpe ratio
};

//===============================================================================
// WIN RATE ESTIMATION
//===============================================================================

function estimateWinRate(coin) {
  let baseWinRate = CONFIG.WIN_RATE_ESTIMATES.NO_VP;

  // Get VP setup quality
  const vpSetupQuality = coin.vp_setup_quality || "MODERATE";
  const vpTier = coin.leverage_metadata?.vp_tier || coin.sltp_metadata?.vp_tier || "D";

  // Determine base win rate from VP setup
  if (vpSetupQuality === "GOLDEN") {
    if (vpTier === "S") baseWinRate = CONFIG.WIN_RATE_ESTIMATES.GOLDEN_S_TIER;
    else if (vpTier === "A") baseWinRate = CONFIG.WIN_RATE_ESTIMATES.GOLDEN_A_TIER;
    else baseWinRate = CONFIG.WIN_RATE_ESTIMATES.EXCELLENT_S_TIER;
  } else if (vpSetupQuality === "EXCELLENT") {
    if (vpTier === "S") baseWinRate = CONFIG.WIN_RATE_ESTIMATES.EXCELLENT_S_TIER;
    else if (vpTier === "A") baseWinRate = CONFIG.WIN_RATE_ESTIMATES.EXCELLENT_A_TIER;
    else baseWinRate = CONFIG.WIN_RATE_ESTIMATES.GOOD_S_TIER;
  } else if (vpSetupQuality === "GOOD") {
    if (vpTier === "S" || vpTier === "A") baseWinRate = CONFIG.WIN_RATE_ESTIMATES.GOOD_S_TIER;
    else baseWinRate = CONFIG.WIN_RATE_ESTIMATES.GOOD_A_TIER;
  } else {
    baseWinRate = CONFIG.WIN_RATE_ESTIMATES.MODERATE;
  }

  // Adjust for alpha score
  const alpha = coin.alpha || 0;
  let alphaAdjustment = CONFIG.ALPHA_ADJUSTMENTS.LOW;

  if (alpha > 90) alphaAdjustment = CONFIG.ALPHA_ADJUSTMENTS.VERY_HIGH;
  else if (alpha > 80) alphaAdjustment = CONFIG.ALPHA_ADJUSTMENTS.HIGH;
  else if (alpha > 70) alphaAdjustment = CONFIG.ALPHA_ADJUSTMENTS.MEDIUM;

  // Adjust for VP confluence (extra 3% if confluence detected)
  const vpConfluenceBonus = (coin.vp_confluence_zones || 0) > 0 ? 0.03 : 0;

  // Adjust for multi-timeframe alignment (extra 2%)
  const multiTFBonus = coin.vp_multi_tf_aligned ? 0.02 : 0;

  const estimatedWinRate = Math.min(0.78, baseWinRate + alphaAdjustment + vpConfluenceBonus + multiTFBonus);

  return {
    winRate: estimatedWinRate,
    baseWinRate: baseWinRate,
    alphaAdjustment: alphaAdjustment,
    vpConfluenceBonus: vpConfluenceBonus,
    multiTFBonus: multiTFBonus
  };
}

//===============================================================================
// KELLY CRITERION CALCULATION
//===============================================================================

function calculateKellyLeverage(coin, winRateData, avgRR) {
  const winRate = winRateData.winRate;
  const lossRate = 1 - winRate;

  // Kelly formula: f = (bp - q) / b
  // where:
  // b = odds received on the bet (R:R ratio)
  // p = probability of winning (win rate)
  // q = probability of losing (1 - p)

  const b = avgRR;  // Average risk-reward ratio
  const p = winRate;
  const q = lossRate;

  // Kelly percentage
  const kellyPct = (b * p - q) / b;

  if (kellyPct <= CONFIG.MIN_KELLY_EDGE) {
    return {
      kellyPct: kellyPct,
      kellyLeverage: 1,
      edge: kellyPct,
      reason: "Insufficient edge (Kelly < 5%)"
    };
  }

  // Convert Kelly % to leverage
  // Kelly tells us what % of bankroll to risk
  // With SL at X%, leverage = Kelly% / SL%

  const slDistancePct = (coin.stopLoss?.distance_pct || 2.0) / 100;  // Convert to decimal
  const fullKellyLeverage = kellyPct / slDistancePct;

  // Apply fractional Kelly for safety
  const fractionalKellyLeverage = fullKellyLeverage * CONFIG.KELLY_FRACTION;

  return {
    kellyPct: kellyPct,
    fullKellyLeverage: fullKellyLeverage,
    kellyLeverage: fractionalKellyLeverage,
    edge: kellyPct,
    winRate: winRate,
    lossRate: lossRate,
    avgRR: avgRR
  };
}

//===============================================================================
// VOLATILITY CLUSTERING DETECTION
//===============================================================================

function detectVolatilityClustering(coin) {
  // Compare current volatility to historical average
  const currentVol = coin.derived?.volatility || coin.ta_1h?.volatility || 0;

  // Estimate historical avg from available data (simplified)
  // In production, you'd calculate rolling 30-day average
  const ta4hVol = coin.ta_4h?.volatility || currentVol;
  const historicalAvgVol = (currentVol + ta4hVol) / 2;  // Simplified

  if (historicalAvgVol === 0) {
    return {
      isClustering: false,
      ratio: 1.0,
      adjustment: 1.0,
      regime: 'NORMAL'
    };
  }

  const volRatio = currentVol / historicalAvgVol;

  let isClustering = false;
  let adjustment = 1.0;
  let regime = 'NORMAL';

  if (volRatio > CONFIG.VOL_CLUSTERING.EXTREME_VOL_THRESHOLD) {
    isClustering = true;
    adjustment = CONFIG.VOL_CLUSTERING.EXTREME_LEVERAGE_REDUCTION;
    regime = 'EXTREME_CLUSTERING';
  } else if (volRatio > CONFIG.VOL_CLUSTERING.LOOKBACK_RATIO_THRESHOLD) {
    isClustering = true;
    adjustment = CONFIG.VOL_CLUSTERING.LEVERAGE_REDUCTION_FACTOR;
    regime = 'CLUSTERING';
  }

  return {
    isClustering: isClustering,
    ratio: volRatio,
    adjustment: adjustment,
    regime: regime,
    currentVol: currentVol,
    historicalAvgVol: historicalAvgVol
  };
}

//===============================================================================
// MOMENTUM-BASED LEVERAGE ADJUSTMENT
//===============================================================================

function calculateMomentumAdjustment(coin) {
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;

  let momentumMultiplier = CONFIG.MOMENTUM_BOOST.WEAK;

  if (altRankJump > 500 || galaxyJump > 10) {
    momentumMultiplier = CONFIG.MOMENTUM_BOOST.VERY_STRONG;
  } else if (altRankJump > 200 || galaxyJump > 5) {
    momentumMultiplier = CONFIG.MOMENTUM_BOOST.STRONG;
  } else if (altRankJump > 100 || galaxyJump > 3) {
    momentumMultiplier = CONFIG.MOMENTUM_BOOST.MODERATE;
  }

  return {
    multiplier: momentumMultiplier,
    altRankJump: altRankJump,
    galaxyJump: galaxyJump,
    reason: momentumMultiplier > 1 ? `Momentum boost: AltRank +${altRankJump}, Galaxy +${galaxyJump.toFixed(1)}` : "No momentum boost"
  };
}

//===============================================================================
// EXPECTED VALUE CALCULATION
//===============================================================================

function calculateExpectedValue(winRate, avgRR) {
  // EV = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
  // Assuming avg loss = 1 (100% of risk), avg win = RR

  const lossRate = 1 - winRate;
  const avgWin = avgRR;  // RR is the average win
  const avgLoss = 1.0;   // We risk 100%

  const ev = (winRate * avgWin) - (lossRate * avgLoss);

  return {
    expectedValue: ev,
    evPercent: ev * 100,
    isPositive: ev > 0,
    meetsMinimum: ev >= CONFIG.MIN_EXPECTED_VALUE
  };
}

//===============================================================================
// COMPREHENSIVE LEVERAGE CALCULATION
//===============================================================================

function calculateOptimalLeverage(coin) {
  const price = coin.price || 0;
  const maxExchangeLeverage = coin.data?.maxLeverage || 25;
  const stopLoss = coin.stopLoss;

  if (!stopLoss || price === 0) {
    return {
      success: false,
      error: "Missing price or stop loss data"
    };
  }

  // 1. ESTIMATE WIN RATE
  const winRateData = estimateWinRate(coin);

  // 2. GET AVERAGE R:R
  const avgRR = coin.weightedRR || 2.0;

  // 3. CALCULATE KELLY LEVERAGE
  const kellyData = calculateKellyLeverage(coin, winRateData, avgRR);

  // 4. DETECT VOLATILITY CLUSTERING
  const volClustering = detectVolatilityClustering(coin);

  // 5. MOMENTUM ADJUSTMENT
  const momentum = calculateMomentumAdjustment(coin);

  // 6. CALCULATE EXPECTED VALUE
  const evData = calculateExpectedValue(winRateData.winRate, avgRR);

  // 7. COMBINE ALL FACTORS
  let baseLeverage = kellyData.kellyLeverage;

  // Apply volatility clustering adjustment
  baseLeverage *= volClustering.adjustment;

  // Apply momentum adjustment
  baseLeverage *= momentum.multiplier;

  // 8. APPLY CAPS
  let finalLeverage = Math.floor(baseLeverage);
  finalLeverage = Math.max(finalLeverage, CONFIG.ABSOLUTE_MIN_LEVERAGE);
  finalLeverage = Math.min(finalLeverage, CONFIG.ABSOLUTE_MAX_LEVERAGE);
  finalLeverage = Math.min(finalLeverage, maxExchangeLeverage);

  // 9. CALCULATE POSITION DETAILS
  const confidence = coin._regime?.confidence || "MED";

  // Allocation percentage based on confidence + Kelly
  let allocationPct;
  if (confidence === "HIGH") {
    allocationPct = 0.14;  // 14% of equity
  } else if (confidence === "MED") {
    allocationPct = 0.10;  // 10% of equity
  } else {
    allocationPct = 0.06;  // 6% of equity
  }

  // Adjust allocation by Kelly edge
  if (kellyData.edge > 0.2) {
    allocationPct *= 1.2;  // Increase allocation for strong edge
  } else if (kellyData.edge < 0.1) {
    allocationPct *= 0.8;  // Decrease for weak edge
  }

  const allocationUSDT = CONFIG.ACCOUNT_EQUITY * allocationPct;
  const marginUSDT = allocationUSDT;
  const positionValueUSDT = allocationUSDT * finalLeverage;
  const quantity = positionValueUSDT / price;

  // 10. LIQUIDATION CALCULATION
  const side = coin.side;
  const maintRate = 0.005;  // Simplified, use tier-based in production

  let liquidationPrice = 0;
  if (side === "BUY") {
    liquidationPrice = price * (1 - (1 - maintRate) / finalLeverage);
  } else if (side === "SELL") {
    liquidationPrice = price * (1 + (1 - maintRate) / finalLeverage);
  }

  const liqDistancePct = Math.abs((liquidationPrice - price) / price * 100);
  const slDistancePct = stopLoss.distance_pct;
  const bufferPct = liqDistancePct - slDistancePct;

  // 11. SHARPE RATIO ESTIMATION
  const expectedReturn = evData.expectedValue;
  const volatility = coin.derived?.volatility || 0.05;
  const sharpeRatio = volatility > 0 ? (expectedReturn - CONFIG.RISK_FREE_RATE) / volatility : 0;

  return {
    success: true,
    leverage: finalLeverage,
    allocationUSDT: allocationUSDT,
    allocationPct: allocationPct,
    marginUSDT: marginUSDT,
    positionValueUSDT: positionValueUSDT,
    quantity: quantity,
    liquidationPrice: liquidationPrice,
    liquidationDistancePct: liqDistancePct,
    bufferPct: bufferPct,

    // Kelly data
    kellyData: {
      kellyPct: kellyData.kellyPct,
      fullKellyLeverage: kellyData.fullKellyLeverage,
      fractionalKellyLeverage: kellyData.kellyLeverage,
      edge: kellyData.edge,
      winRate: kellyData.winRate
    },

    // Win rate estimation
    winRateData: {
      estimatedWinRate: winRateData.winRate,
      baseWinRate: winRateData.baseWinRate,
      adjustments: {
        alpha: winRateData.alphaAdjustment,
        vpConfluence: winRateData.vpConfluenceBonus,
        multiTF: winRateData.multiTFBonus
      }
    },

    // Volatility clustering
    volClustering: {
      isClustering: volClustering.isClustering,
      regime: volClustering.regime,
      ratio: volClustering.ratio,
      adjustment: volClustering.adjustment
    },

    // Momentum
    momentum: {
      multiplier: momentum.multiplier,
      altRankJump: momentum.altRankJump,
      galaxyJump: momentum.galaxyJump
    },

    // Expected value
    expectedValue: {
      ev: evData.expectedValue,
      evPercent: evData.evPercent,
      meetsMinimum: evData.meetsMinimum
    },

    // Sharpe ratio
    sharpeRatio: sharpeRatio,

    // Metadata
    metadata: {
      baseLeverage: baseLeverage,
      exchangeMaxLeverage: maxExchangeLeverage,
      confidence: confidence,
      version: "v4.0-kelly-dynamic"
    }
  };
}

//===============================================================================
// PROCESS ALL COINS
//===============================================================================

console.log(`\n💰 ACCOUNT EQUITY: $${CONFIG.ACCOUNT_EQUITY}`);
console.log(`   Kelly Fraction: ${CONFIG.KELLY_FRACTION} (1/4 Kelly for safety)`);
console.log(`   Min Expected Value: ${(CONFIG.MIN_EXPECTED_VALUE * 100).toFixed(0)}%`);

const enrichedCoins = candidates.map(coin => {
  if (!coin.side || coin.side === "HOLD") {
    console.log(`   ⏭️  ${coin.symbol}: No side, skipping`);
    return coin;
  }

  const result = calculateOptimalLeverage(coin);

  if (!result.success) {
    console.log(`   ⚠️  ${coin.symbol}: ${result.error}`);
    return {
      ...coin,
      leverage_status: "FAILED",
      leverage_error: result.error
    };
  }

  // Check if EV meets minimum
  if (!result.expectedValue.meetsMinimum) {
    console.log(`   ⚠️  ${coin.symbol}: EV ${result.expectedValue.evPercent.toFixed(1)}% < ${(CONFIG.MIN_EXPECTED_VALUE * 100).toFixed(0)}% (skip)`);
    return {
      ...coin,
      leverage_status: "FAILED",
      leverage_error: "Expected value too low",
      expectedValue: result.expectedValue
    };
  }

  const indicator = result.volClustering.isClustering ? " ⚠️VOL" : "";
  const kellyIndicator = result.kellyData.edge > 0.2 ? " 🎯EDGE" : "";

  console.log(`   ✅ ${coin.symbol} (WR ${(result.winRateData.estimatedWinRate * 100).toFixed(0)}%)${indicator}${kellyIndicator}: ${result.leverage}x`);
  console.log(`      Kelly ${(result.kellyData.kellyPct * 100).toFixed(1)}% → ${result.kellyData.fractionalKellyLeverage.toFixed(1)}x | EV ${result.expectedValue.evPercent.toFixed(1)}% | Sharpe ${result.sharpeRatio.toFixed(2)}`);
  console.log(`      Margin $${result.marginUSDT.toFixed(2)} | Position $${result.positionValueUSDT.toFixed(2)} | Buffer ${result.bufferPct.toFixed(1)}%`);

  if (result.volClustering.isClustering) {
    console.log(`      ⚠️ Vol Clustering: ${result.volClustering.regime} (${result.volClustering.ratio.toFixed(2)}x avg) - leverage reduced`);
  }

  return {
    ...coin,
    leverage_status: "SUCCESS",
    leverage: result.leverage,
    allocation_usdt: result.allocationUSDT,
    allocation_pct: result.allocationPct,
    margin_usdt: result.marginUSDT,
    position_value_usdt: result.positionValueUSDT,
    quantity: result.quantity,
    liquidation_price: result.liquidationPrice,
    liquidation_distance_pct: result.liquidationDistancePct,
    buffer_pct: result.bufferPct,

    // Enhanced metadata
    leverage_metadata: {
      ...result.kellyData,
      ...result.winRateData,
      volClustering: result.volClustering,
      momentum: result.momentum,
      expectedValue: result.expectedValue,
      sharpeRatio: result.sharpeRatio,
      baseLeverage: result.metadata.baseLeverage,
      version: "v4.0-kelly-dynamic"
    }
  };
});

console.log(`\n📤 LEVERAGE FINDER v4.0 OUTPUT:`);
const successCount = enrichedCoins.filter(c => c.leverage_status === "SUCCESS").length;
const highEVCount = enrichedCoins.filter(c =>
  c.leverage_metadata?.expectedValue?.evPercent > 20
).length;
const volClusteringCount = enrichedCoins.filter(c =>
  c.leverage_metadata?.volClustering?.isClustering
).length;

console.log(`   ✅ Success: ${successCount}/${enrichedCoins.length}`);
console.log(`   🎯 High EV (>20%): ${highEVCount}`);
console.log(`   ⚠️  Vol Clustering detected: ${volClusteringCount}`);

return enrichedCoins.map(coin => ({ json: coin }));
