// ═══════════════════════════════════════════════════════════════════════════
// ⚡ LEVERAGE FINDER ULTIMATE V4.0 - PERFECT EDITION
// ═══════════════════════════════════════════════════════════════════════════
//
// 🎯 PROVEN STRATEGY:
// - Target: 6-8x leverage sweet spot (conservative & profitable)
// - NEVER touch liquidation price (buffer ALWAYS beyond SL)
// - Work BACKWARDS: SL → max safe leverage → apply smart boosts
// - Quality SL/TP placement = lower risk = higher leverage potential
//
// 🔧 KEY PRINCIPLES:
// 1. Buffer is ADDITIONAL distance BEYOND stop loss
//    Example: SL @ -9%, Buffer 4% → Liquidation @ -13%
// 2. Conservative base (30% of max safe) + smart boosts
// 3. Bybit isolated margin formula with MMR tiers
// 4. Analytical solution (exact math, no guessing)
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data from SL/TP Finder!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🎯 LEVERAGE CONFIGURATION (REFINED & PROVEN)
//===============================================================================

const CONFIG = {
  // System limits (conservative for safety)
  system_max_leverage: 12,
  system_min_leverage: 3,

  // Target range: 6-10x is the SWEET SPOT
  target_min: 6,
  target_max: 10,

  // Base calculation: Conservative 30% of max safe
  base_percentage: 0.30,

  // Liquidation buffer (ADDITIONAL distance beyond SL)
  // SL @ -9%, optimal buffer 4% → Liq @ -13%
  buffer: {
    minimum: 2.5,    // Absolute minimum safety margin
    optimal: 4.0,    // Preferred for most trades
    excellent: 6.0   // Extra safety for uncertain setups
  },

  // Smart boosts based on signal quality
  boosts: {
    // Conviction level (how strong the signal is)
    conviction: {
      "EXTREME": 2.0,   // Highest confidence → +2x
      "HIGH": 1.5,      // Strong signal → +1.5x
      "MEDIUM": 1.0,    // Good signal → +1x
      "LOW": 0         // Weak signal → no boost
    },

    // VP setup quality (institutional level precision)
    vp_quality: {
      "GOLDEN": 1.5,      // Perfect VP alignment → +1.5x
      "EXCELLENT": 1.0,   // Great VP levels → +1x
      "GOOD": 0.5,        // Decent levels → +0.5x
      "MODERATE": 0       // Average → no boost
    },

    // Market scenario (bullish conditions)
    scenario: {
      "PEAK_ALT_SEASON": 1.5,        // Best conditions → +1.5x
      "ALT_DECOUPLING": 1.0,         // Strong alt narrative → +1x
      "COIN_DECOUPLING": 0.5,        // Independent move → +0.5x
      "SECTOR_LEADER": 0.5,          // Leading sector → +0.5x
      "FUNDING_DIVERGENCE": 0,       // Neutral
      "BTC_ONLY_RALLY": -0.5,        // Alts weak → -0.5x
      "CAPITULATION": -1.0           // Bear market → -1x
    }
  },

  // Volatility adjustment (reduce in high vol)
  volatility_multiplier: {
    "EXTREME": 0.65,   // Crazy vol → 65% leverage
    "HIGH": 0.80,      // High vol → 80% leverage
    "MEDIUM": 1.00,    // Normal vol → 100% leverage
    "LOW": 1.05        // Low vol → 105% leverage (slight boost)
  }
};

//===============================================================================
// 📊 BYBIT ISOLATED MARGIN - MMR TIERS
//===============================================================================

const MMR_TIERS = [
  { min: 1,  max: 10,  mmr: 0.005 },   // 0.5% MMR for 1-10x
  { min: 11, max: 25,  mmr: 0.010 },   // 1.0% MMR for 11-25x
  { min: 26, max: 50,  mmr: 0.020 },   // 2.0% MMR for 26-50x
  { min: 51, max: 100, mmr: 0.050 }    // 5.0% MMR for 51-100x
];

function getMMR(leverage) {
  for (const tier of MMR_TIERS) {
    if (leverage >= tier.min && leverage <= tier.max) {
      return tier.mmr;
    }
  }
  return 0.050; // Default to highest
}

//===============================================================================
// 🧮 BYBIT LIQUIDATION PRICE CALCULATION
//===============================================================================

function calculateLiquidationPrice(entryPrice, leverage, side) {
  const mmr = getMMR(leverage);

  if (side === "BUY") {
    // LONG liquidation formula
    // Liq = Entry × (1 - 1/Leverage + MMR)
    return entryPrice * (1 - 1/leverage + mmr);
  } else if (side === "SELL") {
    // SHORT liquidation formula
    // Liq = Entry × (1 + 1/Leverage - MMR)
    return entryPrice * (1 + 1/leverage - mmr);
  }

  return null;
}

function getLiqDistancePct(entryPrice, liqPrice, side) {
  if (side === "BUY") {
    // Distance from entry to liq (positive %)
    return ((entryPrice - liqPrice) / entryPrice) * 100;
  } else {
    // Distance from entry to liq (positive %)
    return ((liqPrice - entryPrice) / entryPrice) * 100;
  }
}

//===============================================================================
// 🔍 CALCULATE MAX SAFE LEVERAGE (ANALYTICAL SOLUTION)
//===============================================================================
//
// This is the CORE calculation - we work BACKWARDS from SL to find max leverage
// that keeps liquidation safely away from stop loss.
//
// Steps:
// 1. Calculate SL distance from entry (e.g., -9%)
// 2. Add buffer to get target liq distance (e.g., -9% - 4% = -13%)
// 3. Solve Bybit formula for max leverage that puts liq at target
//
//===============================================================================

function calculateMaxSafeLeverage(entryPrice, stopLoss, side, bufferPct) {
  // Step 1: Calculate SL distance from entry (always positive %)
  let slDistanceFromEntry = 0;

  if (side === "BUY") {
    slDistanceFromEntry = ((entryPrice - stopLoss) / entryPrice) * 100;
  } else if (side === "SELL") {
    slDistanceFromEntry = ((stopLoss - entryPrice) / entryPrice) * 100;
  }

  // Step 2: Add buffer (liquidation should be FURTHER than SL)
  // If SL is -9% and buffer is 4%, liq should be at -13% from entry
  const targetLiqDistanceFromEntry = slDistanceFromEntry + bufferPct;

  // Step 3: Calculate target liquidation price
  let targetLiqPrice = 0;

  if (side === "BUY") {
    // For LONG: liq is BELOW entry
    targetLiqPrice = entryPrice * (1 - targetLiqDistanceFromEntry / 100);
  } else if (side === "SELL") {
    // For SHORT: liq is ABOVE entry
    targetLiqPrice = entryPrice * (1 + targetLiqDistanceFromEntry / 100);
  }

  // Safety check: liq should be on correct side of entry
  if (side === "BUY" && targetLiqPrice >= entryPrice) {
    console.log(`   ⚠️  Invalid liq target for BUY, using min leverage`);
    return CONFIG.system_min_leverage;
  }
  if (side === "SELL" && targetLiqPrice <= entryPrice) {
    console.log(`   ⚠️  Invalid liq target for SELL, using min leverage`);
    return CONFIG.system_min_leverage;
  }

  // Step 4: Solve for max leverage using Bybit formula
  // We try each MMR tier to find the one that matches our leverage
  let maxLeverage = CONFIG.system_min_leverage;

  for (const tier of MMR_TIERS) {
    const mmr = tier.mmr;
    let L = 0;

    if (side === "BUY") {
      // Solve: targetLiqPrice = entryPrice × (1 - 1/L + MMR)
      // targetLiqPrice / entryPrice = 1 - 1/L + MMR
      // 1/L = 1 + MMR - targetLiqPrice / entryPrice
      // L = 1 / (1 + MMR - targetLiqPrice / entryPrice)

      const ratio = targetLiqPrice / entryPrice;
      const denominator = 1 + mmr - ratio;

      if (denominator > 0) {
        L = 1 / denominator;
      } else {
        continue;
      }

    } else if (side === "SELL") {
      // Solve: targetLiqPrice = entryPrice × (1 + 1/L - MMR)
      // targetLiqPrice / entryPrice = 1 + 1/L - MMR
      // 1/L = targetLiqPrice / entryPrice - 1 + MMR
      // L = 1 / (targetLiqPrice / entryPrice - 1 + MMR)

      const ratio = targetLiqPrice / entryPrice;
      const denominator = ratio - 1 + mmr;

      if (denominator > 0) {
        L = 1 / denominator;
      } else {
        continue;
      }
    }

    // Check if calculated L is within this tier's range
    if (L >= tier.min && L <= tier.max) {
      // Verify with actual liq calculation
      const testLiq = calculateLiquidationPrice(entryPrice, Math.floor(L), side);

      // Ensure liq is safe
      if (side === "BUY" && testLiq <= targetLiqPrice) {
        maxLeverage = Math.max(maxLeverage, Math.floor(L));
      } else if (side === "SELL" && testLiq >= targetLiqPrice) {
        maxLeverage = Math.max(maxLeverage, Math.floor(L));
      }
    } else if (L > tier.max) {
      // Try tier max
      const testLiq = calculateLiquidationPrice(entryPrice, tier.max, side);

      if (side === "BUY" && testLiq <= targetLiqPrice) {
        maxLeverage = Math.max(maxLeverage, tier.max);
      } else if (side === "SELL" && testLiq >= targetLiqPrice) {
        maxLeverage = Math.max(maxLeverage, tier.max);
      }
    }
  }

  return Math.max(maxLeverage, CONFIG.system_min_leverage);
}

//===============================================================================
// 🎯 CALCULATE OPTIMAL LEVERAGE (SMART BOOSTS)
//===============================================================================

function calculateOptimalLeverage(coin) {
  const entryPrice = coin.entry_price || coin.price || 0;
  const stopLoss = coin.stop_loss || 0;
  const slDistancePct = coin.stop_loss_pct || 0;
  const side = coin.side || "BUY";
  const conviction = coin.conviction || "MEDIUM";
  const vpQuality = coin.vp_setup_quality || "GOOD";

  if (entryPrice <= 0 || stopLoss <= 0 || slDistancePct <= 0) {
    return null;
  }

  const reasoning = [];

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Determine buffer size based on setup quality
  // ═══════════════════════════════════════════════════════════════════════

  let bufferPct = CONFIG.buffer.optimal; // Default: 4%

  // Use excellent buffer for weaker setups (extra safety)
  if (conviction === "LOW" || vpQuality === "MODERATE") {
    bufferPct = CONFIG.buffer.excellent; // 6%
    reasoning.push(`🛡️  Buffer: ${bufferPct}% (EXCELLENT - weaker setup needs safety)`);
  }
  // Use optimal buffer for strong setups
  else if (conviction === "EXTREME" && (vpQuality === "GOLDEN" || vpQuality === "EXCELLENT")) {
    bufferPct = CONFIG.buffer.optimal; // 4%
    reasoning.push(`🛡️  Buffer: ${bufferPct}% (OPTIMAL - high quality setup)`);
  }
  // Use slightly larger buffer for mixed quality
  else {
    bufferPct = (CONFIG.buffer.optimal + CONFIG.buffer.excellent) / 2; // 5%
    reasoning.push(`🛡️  Buffer: ${bufferPct}% (BALANCED - mixed quality)`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Calculate MAX safe leverage with buffer
  // ═══════════════════════════════════════════════════════════════════════

  const maxSafeLeverage = calculateMaxSafeLeverage(entryPrice, stopLoss, side, bufferPct);

  reasoning.push(`📐 Max safe leverage: ${maxSafeLeverage}x (SL ${slDistancePct.toFixed(2)}% + buffer ${bufferPct}%)`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Calculate DESIRED leverage (conservative base + smart boosts)
  // ═══════════════════════════════════════════════════════════════════════

  // Start with 30% of max safe (conservative!)
  let desiredLeverage = Math.floor(maxSafeLeverage * CONFIG.base_percentage);

  reasoning.push(`🎯 Conservative base: ${desiredLeverage}x (${(CONFIG.base_percentage * 100)}% of max safe)`);

  // Add conviction boost
  const convictionBoost = CONFIG.boosts.conviction[conviction] || 0;
  if (convictionBoost > 0) {
    desiredLeverage += convictionBoost;
    reasoning.push(`⚡ ${conviction} conviction: +${convictionBoost}x`);
  }

  // Add VP quality boost
  const vpBoost = CONFIG.boosts.vp_quality[vpQuality] || 0;
  if (vpBoost > 0) {
    desiredLeverage += vpBoost;
    reasoning.push(`🏆 ${vpQuality} VP setup: +${vpBoost}x`);
  }

  // Add market scenario boosts
  const marketScenario = coin._market_scenario || {};
  const allScenarios = marketScenario.all_scenarios || [marketScenario.scenario];
  let scenarioBoostTotal = 0;

  allScenarios.forEach(scenario => {
    const boost = CONFIG.boosts.scenario[scenario] || 0;
    if (boost !== 0) {
      scenarioBoostTotal += boost;
      const sign = boost > 0 ? '+' : '';
      reasoning.push(`💎 ${scenario}: ${sign}${boost}x`);
    }
  });

  desiredLeverage += scenarioBoostTotal;

  // Sector leadership bonus
  const sectorLeadership = coin._sector_leadership || {};
  if (sectorLeadership.is_leader && !allScenarios.includes("SECTOR_LEADER")) {
    const leaderBoost = CONFIG.boosts.scenario["SECTOR_LEADER"];
    desiredLeverage += leaderBoost;
    reasoning.push(`⭐ Sector leader: +${leaderBoost}x`);
  }

  reasoning.push(`🎲 Desired (after boosts): ${desiredLeverage.toFixed(1)}x`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Apply volatility multiplier
  // ═══════════════════════════════════════════════════════════════════════

  const marketState = coin._market_state || {};
  const volRegime = marketState.volatility_regime || "MEDIUM";
  const volMultiplier = CONFIG.volatility_multiplier[volRegime] || 1.0;

  if (volMultiplier !== 1.0) {
    const beforeVol = desiredLeverage;
    desiredLeverage = desiredLeverage * volMultiplier;
    reasoning.push(`🌊 ${volRegime} vol: ${beforeVol.toFixed(1)}x × ${volMultiplier.toFixed(2)} = ${desiredLeverage.toFixed(1)}x`);
  }

  desiredLeverage = Math.floor(desiredLeverage);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Apply caps and limits
  // ═══════════════════════════════════════════════════════════════════════

  const exchangeMax = coin.data?.maxLeverage || 75;
  let finalLeverage = desiredLeverage;

  // Cap at max safe (MOST IMPORTANT!)
  finalLeverage = Math.min(finalLeverage, maxSafeLeverage);

  // Cap at system max
  finalLeverage = Math.min(finalLeverage, CONFIG.system_max_leverage);

  // Cap at exchange max
  finalLeverage = Math.min(finalLeverage, exchangeMax);

  // Ensure minimum
  finalLeverage = Math.max(finalLeverage, CONFIG.system_min_leverage);

  if (finalLeverage !== desiredLeverage) {
    const caps = [];
    if (finalLeverage === maxSafeLeverage) caps.push(`max_safe: ${maxSafeLeverage}x`);
    if (finalLeverage === CONFIG.system_max_leverage) caps.push(`system: ${CONFIG.system_max_leverage}x`);
    if (finalLeverage === exchangeMax) caps.push(`exchange: ${exchangeMax}x`);

    reasoning.push(`🔒 Capped: ${desiredLeverage}x → ${finalLeverage}x (${caps.join(', ')})`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Final validation
  // ═══════════════════════════════════════════════════════════════════════

  const finalLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const finalLiqDistancePct = getLiqDistancePct(entryPrice, finalLiqPrice, side);
  const actualBufferPct = finalLiqDistancePct - slDistancePct;

  reasoning.push(`💀 Liquidation: ${finalLiqPrice.toFixed(6)} (${finalLiqDistancePct.toFixed(2)}% from entry)`);
  reasoning.push(`✅ Final buffer: ${actualBufferPct.toFixed(2)}% (Liq ${finalLiqDistancePct.toFixed(2)}% - SL ${slDistancePct.toFixed(2)}%)`);

  // Verify buffer is adequate
  if (actualBufferPct < CONFIG.buffer.minimum) {
    reasoning.push(`⚠️ UNSAFE! Buffer ${actualBufferPct.toFixed(2)}% < minimum ${CONFIG.buffer.minimum}%`);

    // Force reduction
    const saferMax = calculateMaxSafeLeverage(entryPrice, stopLoss, side, CONFIG.buffer.minimum);
    finalLeverage = Math.min(finalLeverage, saferMax);
    finalLeverage = Math.max(finalLeverage, CONFIG.system_min_leverage);

    reasoning.push(`🔧 FORCED REDUCTION: ${finalLeverage}x (enforcing ${CONFIG.buffer.minimum}% minimum)`);
  }

  // Check if in target range (6-10x sweet spot)
  const inSweetSpot = finalLeverage >= CONFIG.target_min && finalLeverage <= CONFIG.target_max;

  if (inSweetSpot) {
    reasoning.push(`🎯 IN SWEET SPOT (${CONFIG.target_min}-${CONFIG.target_max}x) ✅`);
  } else if (finalLeverage < CONFIG.target_min) {
    reasoning.push(`🛡️  Below sweet spot (conservative, extra safe)`);
  } else {
    reasoning.push(`⚠️ Above sweet spot (aggressive, monitor closely)`);
  }

  // Recalculate final values
  const trueLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const trueLiqDistancePct = getLiqDistancePct(entryPrice, trueLiqPrice, side);
  const trueBufferPct = trueLiqDistancePct - slDistancePct;

  return {
    leverage: finalLeverage,
    liquidation_price: trueLiqPrice,
    liquidation_distance_pct: trueLiqDistancePct,
    liq_buffer_pct: trueBufferPct,
    max_safe_leverage: maxSafeLeverage,
    desired_leverage_before_caps: Math.floor(desiredLeverage),
    in_sweet_spot: inSweetSpot,
    reasoning: reasoning,
    exchange_max_leverage: exchangeMax,
    mmr: getMMR(finalLeverage),
    buffer_used_pct: bufferPct
  };
}

//===============================================================================
// 💰 POSITION METRICS
//===============================================================================

function calculatePositionMetrics(coin, leverageResult) {
  const entryPrice = coin.entry_price || coin.price || 0;
  const positionSizeUSDT = coin.position_size_usdt || 50;
  const leverage = leverageResult.leverage;
  const slPct = coin.stop_loss_pct || 0;

  // Total exposure with leverage
  const exposureUSDT = positionSizeUSDT * leverage;

  // Quantity of coins
  const quantity = Math.floor(exposureUSDT / entryPrice);

  // Risk calculations
  const riskUSDT = positionSizeUSDT * (slPct / 100);  // Unleveraged risk
  const leveragedRiskUSDT = exposureUSDT * (slPct / 100);  // Actual risk with leverage

  // Reward calculations (from exposure)
  const tp1Pct = coin.take_profit_1_pct || 0;
  const tp2Pct = coin.take_profit_2_pct || 0;
  const tp3Pct = coin.take_profit_3_pct || 0;

  const rewardTP1USDT = tp1Pct > 0 ? exposureUSDT * (tp1Pct / 100) : 0;
  const rewardTP2USDT = tp2Pct > 0 ? exposureUSDT * (tp2Pct / 100) : 0;
  const rewardTP3USDT = tp3Pct > 0 ? exposureUSDT * (tp3Pct / 100) : 0;

  // ROI on actual position size
  const roiTP1 = rewardTP1USDT > 0 ? (rewardTP1USDT / positionSizeUSDT) * 100 : 0;
  const roiTP2 = rewardTP2USDT > 0 ? (rewardTP2USDT / positionSizeUSDT) * 100 : 0;
  const roiTP3 = rewardTP3USDT > 0 ? (rewardTP3USDT / positionSizeUSDT) * 100 : 0;
  const roiSL = -(leveragedRiskUSDT / positionSizeUSDT) * 100;

  // Leveraged risk/reward ratio
  const mainReward = rewardTP2USDT > 0 ? rewardTP2USDT : rewardTP1USDT;
  const leveragedRR = leveragedRiskUSDT > 0 ? mainReward / leveragedRiskUSDT : 0;

  return {
    position_size_usdt: positionSizeUSDT,
    exposure_usdt: exposureUSDT,
    quantity: quantity,
    risk_usdt: riskUSDT,
    leveraged_risk_usdt: leveragedRiskUSDT,
    reward_tp1_usdt: rewardTP1USDT,
    reward_tp2_usdt: rewardTP2USDT,
    reward_tp3_usdt: rewardTP3USDT,
    roi_tp1_pct: roiTP1,
    roi_tp2_pct: roiTP2,
    roi_tp3_pct: roiTP3,
    roi_sl_pct: roiSL,
    leveraged_rr: leveragedRR
  };
}

//===============================================================================
// ✅ VALIDATION
//===============================================================================

function validateLeverageSafety(coin, leverageResult, positionMetrics) {
  const issues = [];
  const warnings = [];

  // Critical: Buffer check
  if (leverageResult.liq_buffer_pct < CONFIG.buffer.minimum) {
    issues.push(`❌ Buffer ${leverageResult.liq_buffer_pct.toFixed(2)}% < minimum ${CONFIG.buffer.minimum}%`);
  }

  // Critical: Liq vs SL check
  const side = coin.side;
  const liq = leverageResult.liquidation_price;
  const sl = coin.stop_loss;

  if (side === "BUY" && liq >= sl) {
    issues.push(`❌ CRITICAL: Liq (${liq.toFixed(6)}) ≥ SL (${sl.toFixed(6)}) for BUY`);
  } else if (side === "SELL" && liq <= sl) {
    issues.push(`❌ CRITICAL: Liq (${liq.toFixed(6)}) ≤ SL (${sl.toFixed(6)}) for SELL`);
  }

  // Warning: High leverage
  if (leverageResult.leverage > CONFIG.target_max) {
    warnings.push(`⚠️ Leverage ${leverageResult.leverage}x > ${CONFIG.target_max}x (above sweet spot)`);
  }

  // Warning: High ROI risk
  if (Math.abs(positionMetrics.roi_sl_pct) > 100) {
    warnings.push(`⚠️ High risk: ${Math.abs(positionMetrics.roi_sl_pct).toFixed(0)}% loss if SL hit`);
  }

  // Warning: Low leverage
  if (leverageResult.leverage < CONFIG.target_min) {
    warnings.push(`ℹ️ Leverage ${leverageResult.leverage}x < ${CONFIG.target_min}x (conservative)`);
  }

  return {
    safe: issues.length === 0,
    issues: issues,
    warnings: warnings
  };
}

//===============================================================================
// 🎯 MAIN PROCESSING
//===============================================================================

console.log(`\n⚡ LEVERAGE FINDER ULTIMATE V4.0 - PERFECT EDITION`);
console.log(`   Target: ${CONFIG.target_min}-${CONFIG.target_max}x SWEET SPOT`);
console.log(`   Processing ${candidates.length} candidates\n`);

let stats = {
  total: 0,
  processed: 0,
  failed: 0,
  sweet_spot: 0,        // 6-10x
  conservative: 0,       // <6x
  aggressive: 0          // >10x
};

const processedCoins = [];

for (const coin of candidates) {
  stats.total++;

  if (!coin.side || !coin.entry_price || !coin.stop_loss || !coin.stop_loss_pct) {
    console.log(`⚠️  ${coin.symbol}: Missing data - SKIPPED`);
    stats.failed++;
    processedCoins.push({
      ...coin,
      leverage_status: "FAILED",
      leverage_error: "Missing critical data"
    });
    continue;
  }

  console.log(`\n⚡ ${coin.symbol} ${coin.side}`);

  const leverageResult = calculateOptimalLeverage(coin);

  if (!leverageResult) {
    console.log(`   ❌ Could not calculate leverage`);
    stats.failed++;
    processedCoins.push({
      ...coin,
      leverage_status: "FAILED",
      leverage_error: "Calculation failed"
    });
    continue;
  }

  console.log(`   🎯 LEVERAGE: ${leverageResult.leverage}x`);
  console.log(`   💀 Liquidation: ${leverageResult.liquidation_price.toFixed(6)} (${leverageResult.liquidation_distance_pct.toFixed(2)}%)`);
  console.log(`   🛡️  Buffer: ${leverageResult.liq_buffer_pct.toFixed(2)}% ${leverageResult.in_sweet_spot ? '✅' : ''}`);

  const positionMetrics = calculatePositionMetrics(coin, leverageResult);

  console.log(`   💰 Exposure: ${positionMetrics.exposure_usdt.toFixed(0)} USDT (${leverageResult.leverage}x × ${positionMetrics.position_size_usdt})`);

  const validation = validateLeverageSafety(coin, leverageResult, positionMetrics);

  if (!validation.safe) {
    console.log(`   ❌ SAFETY ISSUES:`);
    validation.issues.forEach(issue => console.log(`      ${issue}`));
  }

  validation.warnings.forEach(warn => console.log(`   ${warn}`));

  // Track distribution
  if (leverageResult.in_sweet_spot) {
    stats.sweet_spot++;
  } else if (leverageResult.leverage < CONFIG.target_min) {
    stats.conservative++;
  } else {
    stats.aggressive++;
  }

  processedCoins.push({
    ...coin,
    leverage: leverageResult.leverage,
    leverage_reasoning: leverageResult.reasoning,
    liquidation_price: leverageResult.liquidation_price,
    liquidation_distance_pct: leverageResult.liquidation_distance_pct,
    liq_buffer_pct: leverageResult.liq_buffer_pct,
    in_sweet_spot: leverageResult.in_sweet_spot,
    position_exposure_usdt: positionMetrics.exposure_usdt,
    quantity: positionMetrics.quantity,
    risk_usdt: positionMetrics.risk_usdt,
    leveraged_risk_usdt: positionMetrics.leveraged_risk_usdt,
    reward_tp1_usdt: positionMetrics.reward_tp1_usdt,
    reward_tp2_usdt: positionMetrics.reward_tp2_usdt,
    reward_tp3_usdt: positionMetrics.reward_tp3_usdt,
    roi_tp1_pct: positionMetrics.roi_tp1_pct,
    roi_tp2_pct: positionMetrics.roi_tp2_pct,
    roi_tp3_pct: positionMetrics.roi_tp3_pct,
    roi_sl_pct: positionMetrics.roi_sl_pct,
    leveraged_rr: positionMetrics.leveraged_rr,
    leverage_validation: validation,
    leverage_status: "SUCCESS",
    _leverage_metadata: {
      exchange_max_leverage: leverageResult.exchange_max_leverage,
      max_safe_leverage: leverageResult.max_safe_leverage,
      desired_leverage_before_caps: leverageResult.desired_leverage_before_caps,
      buffer_used_pct: leverageResult.buffer_used_pct,
      mmr: leverageResult.mmr,
      system_max: CONFIG.system_max_leverage,
      target_range: `${CONFIG.target_min}-${CONFIG.target_max}x`
    }
  });

  stats.processed++;
}

//===============================================================================
// 📊 SUMMARY OUTPUT
//===============================================================================

console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`⚡ LEVERAGE FINDER V4.0 - PERFECT EDITION`);
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`   Total candidates: ${stats.total}`);
console.log(`   ✅ Processed: ${stats.processed}`);
console.log(`   ❌ Failed: ${stats.failed}`);
console.log(`\n   📊 LEVERAGE DISTRIBUTION:`);
console.log(`      🎯 SWEET SPOT (${CONFIG.target_min}-${CONFIG.target_max}x): ${stats.sweet_spot} ${stats.sweet_spot > 0 ? '✅' : ''}`);
console.log(`      🛡️  Conservative (<${CONFIG.target_min}x): ${stats.conservative}`);
console.log(`      ⚠️  Aggressive (>${CONFIG.target_max}x): ${stats.aggressive}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (processedCoins.length > 0) {
  console.log(`✅ TOP 5 SETUPS:\n`);
  const successful = processedCoins.filter(c => c.leverage_status === "SUCCESS");
  const sortedByAlpha = [...successful].sort((a, b) => (b.alpha || 0) - (a.alpha || 0));

  sortedByAlpha.slice(0, 5).forEach((c, i) => {
    const spotIcon = c.in_sweet_spot ? '🎯' : (c.leverage < CONFIG.target_min ? '🛡️' : '⚠️');
    console.log(`${i + 1}. ${spotIcon} ${c.symbol} ${c.side} - ${c.leverage}x`);
    console.log(`   💰 ${c.position_exposure_usdt?.toFixed(0)} USDT | Buffer: ${c.liq_buffer_pct?.toFixed(2)}%`);
    console.log(`   📈 Alpha: ${c.alpha?.toFixed(1)} | Conviction: ${c.conviction}\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} coins to Trade Selector\n`);

return processedCoins.map(coin => ({ json: coin }));
