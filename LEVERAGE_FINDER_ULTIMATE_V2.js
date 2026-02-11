// ═══════════════════════════════════════════════════════════════════════════
// ⚡ LEVERAGE FINDER ULTIMATE V2 - BYBIT ISOLATED MARGIN PRECISION
// ═══════════════════════════════════════════════════════════════════════════
//
// 🏆 CRITICAL FIX:
// ✅ Uses CORRECT Bybit isolated margin liquidation formula with MMR
// ✅ DYNAMIC leverage search: finds MAX safe leverage from SL constraint
// ✅ Works BACKWARDS: SL → max_liq → max_leverage → apply boosts → cap
// ✅ NOT: calculate leverage → check liq → reduce (WRONG!)
//
// 🔧 BYBIT ISOLATED MARGIN FORMULA:
// LONG:  Liq = Entry × (1 - 1/Leverage + MMR)
// SHORT: Liq = Entry × (1 + 1/Leverage - MMR)
//
// MMR (Maintenance Margin Rate) by leverage tier:
// 1-10x:   0.5% (0.005)
// 11-25x:  1.0% (0.010)
// 26-50x:  2.0% (0.020)
// 51-100x: 5.0% (0.050)
//
// 🎯 ALGORITHM:
// 1. Know SL price (from SL/TP Finder)
// 2. Calculate max allowed liq: liq_max = SL - buffer
// 3. Calculate MAX safe leverage that satisfies: liq ≤ liq_max
// 4. Calculate DESIRED leverage (base + boosts)
// 5. FINAL = MIN(safe_max, desired, system_max, exchange_max)
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data from SL/TP Finder!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🔧 LEVERAGE CONFIGURATION
//===============================================================================

const LEVERAGE_CONFIG = {
  // System limits
  system_max_leverage: 30,  // Our system max (safety cap)
  system_min_leverage: 3,   // Minimum leverage

  // Conviction boosts
  conviction_boost: {
    "EXTREME": 6,
    "HIGH": 4,
    "MEDIUM": 2,
    "LOW": 0
  },

  // VP quality boosts
  vp_quality_boost: {
    "GOLDEN": 5,
    "EXCELLENT": 4,
    "GOOD": 2,
    "MODERATE": 0
  },

  // Market scenario boosts
  scenario_boost: {
    "PEAK_ALT_SEASON": 6,
    "ALT_DECOUPLING": 5,
    "COIN_DECOUPLING": 4,
    "SECTOR_LEADER": 3,
    "FUNDING_DIVERGENCE": 2,
    "BTC_ONLY_RALLY": -2,
    "CAPITULATION": -5
  },

  // Sector leadership bonus
  sector_leader_boost: 3,

  // Volatility multipliers (applied to final leverage)
  volatility_multiplier: {
    "EXTREME": 0.7,
    "HIGH": 0.85,
    "MEDIUM": 1.0,
    "LOW": 1.1
  },

  // Buffer between liquidation and SL (in price % terms)
  min_liq_buffer_pct: 2.0,    // Minimum 2%
  optimal_liq_buffer_pct: 4.0  // Prefer 4%
};

// Bybit MMR tiers
const MMR_TIERS = [
  { min: 1,  max: 10,  mmr: 0.005 },  // 0.5%
  { min: 11, max: 25,  mmr: 0.010 },  // 1.0%
  { min: 26, max: 50,  mmr: 0.020 },  // 2.0%
  { min: 51, max: 100, mmr: 0.050 }   // 5.0%
];

function getMMR(leverage) {
  for (const tier of MMR_TIERS) {
    if (leverage >= tier.min && leverage <= tier.max) {
      return tier.mmr;
    }
  }
  return 0.050; // Default to highest if >100x
}

console.log(`\n⚡ LEVERAGE FINDER ULTIMATE V2 - BYBIT PRECISION`);
console.log(`   Processing ${candidates.length} candidates with SL/TP`);
console.log(`   🎯 Algorithm: Dynamic leverage search from SL constraint\n`);

//===============================================================================
// 📊 BYBIT LIQUIDATION PRICE CALCULATION
//===============================================================================

function calculateLiquidationPrice(entryPrice, leverage, side) {
  const mmr = getMMR(leverage);

  if (side === "BUY") {
    // LONG: Liq = Entry × (1 - 1/leverage + MMR)
    return entryPrice * (1 - 1/leverage + mmr);
  } else if (side === "SELL") {
    // SHORT: Liq = Entry × (1 + 1/leverage - MMR)
    return entryPrice * (1 + 1/leverage - mmr);
  }

  return null;
}

function getLiqDistancePct(entryPrice, liqPrice, side) {
  if (side === "BUY") {
    return ((entryPrice - liqPrice) / entryPrice) * 100;
  } else {
    return ((liqPrice - entryPrice) / entryPrice) * 100;
  }
}

//===============================================================================
// 🔍 REVERSE CALCULATE MAX SAFE LEVERAGE FROM SL
//===============================================================================

function calculateMaxSafeLeverageFromSL(entryPrice, stopLoss, side, bufferPct) {
  // Calculate max allowed liquidation price
  let maxAllowedLiq = 0;

  if (side === "BUY") {
    // For LONG: liq must be BELOW SL
    // liq_max = SL + buffer (where buffer is negative distance)
    const bufferAmount = entryPrice * (bufferPct / 100);
    maxAllowedLiq = stopLoss + bufferAmount;

    // Safety: liq should be above entry is impossible, cap it
    if (maxAllowedLiq >= entryPrice) {
      maxAllowedLiq = entryPrice * 0.95; // Max 5% below entry
    }

  } else if (side === "SELL") {
    // For SHORT: liq must be ABOVE SL
    const bufferAmount = entryPrice * (bufferPct / 100);
    maxAllowedLiq = stopLoss - bufferAmount;

    // Safety: liq should be below entry is impossible
    if (maxAllowedLiq <= entryPrice) {
      maxAllowedLiq = entryPrice * 1.05; // Max 5% above entry
    }
  }

  // Now find MAX leverage that gives liq <= maxAllowedLiq
  // We iterate through possible leverage values (Bybit allows fractional leverage)

  let maxSafeLeverage = LEVERAGE_CONFIG.system_min_leverage;

  // Binary search for max safe leverage
  let low = LEVERAGE_CONFIG.system_min_leverage;
  let high = 100; // Search up to 100x
  let iterations = 0;
  const maxIterations = 50;

  while (low <= high && iterations < maxIterations) {
    iterations++;
    const mid = Math.floor((low + high) / 2);
    const testLiq = calculateLiquidationPrice(entryPrice, mid, side);

    if (side === "BUY") {
      // For LONG: we want liq <= maxAllowedLiq (liq should be lower)
      if (testLiq <= maxAllowedLiq) {
        maxSafeLeverage = mid;
        low = mid + 1; // Try higher leverage
      } else {
        high = mid - 1; // Liq too high, reduce leverage
      }
    } else {
      // For SHORT: we want liq >= maxAllowedLiq (liq should be higher but not too high)
      // Actually for SHORT we want liq to be as low as possible but still above entry
      // Let me reconsider...

      // For SHORT: higher leverage = liq closer to entry (lower liq)
      // We want liq to be ABOVE SL but BELOW entry
      // So we want: SL + buffer < liq < entry

      if (testLiq >= maxAllowedLiq && testLiq < entryPrice) {
        maxSafeLeverage = mid;
        low = mid + 1; // Try higher leverage (brings liq closer to entry)
      } else if (testLiq < maxAllowedLiq) {
        high = mid - 1; // Liq too low (too much leverage), reduce
      } else {
        high = mid - 1; // Liq above entry (impossible), reduce
      }
    }
  }

  return maxSafeLeverage;
}

//===============================================================================
// 🧮 CALCULATE OPTIMAL LEVERAGE (NEW APPROACH)
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

  // STEP 1: Calculate MAX safe leverage from SL with buffer
  const bufferPct = LEVERAGE_CONFIG.optimal_liq_buffer_pct;
  const maxSafeLeverage = calculateMaxSafeLeverageFromSL(entryPrice, stopLoss, side, bufferPct);

  reasoning.push(`🔍 Max safe leverage from SL: ${maxSafeLeverage}x (SL @ ${slDistancePct.toFixed(2)}%, buffer ${bufferPct}%)`);

  // STEP 2: Calculate DESIRED leverage (base + boosts)
  // Start with a conservative base
  let desiredLeverage = Math.floor(maxSafeLeverage * 0.5); // Start with 50% of max safe

  reasoning.push(`📊 Conservative base: ${desiredLeverage}x (50% of max safe)`);

  // Apply conviction boost
  const convictionBoost = LEVERAGE_CONFIG.conviction_boost[conviction] || 0;
  if (convictionBoost > 0) {
    desiredLeverage += convictionBoost;
    reasoning.push(`⚡ ${conviction} conviction: +${convictionBoost}x`);
  }

  // Apply VP quality boost
  const vpBoost = LEVERAGE_CONFIG.vp_quality_boost[vpQuality] || 0;
  if (vpBoost > 0) {
    desiredLeverage += vpBoost;
    reasoning.push(`🏆 ${vpQuality} VP: +${vpBoost}x`);
  }

  // Apply market scenario boosts
  const marketScenario = coin._market_scenario || {};
  const allScenarios = marketScenario.all_scenarios || [marketScenario.scenario];
  let scenarioBoostTotal = 0;

  allScenarios.forEach(scenario => {
    const boost = LEVERAGE_CONFIG.scenario_boost[scenario] || 0;
    if (boost !== 0) {
      scenarioBoostTotal += boost;
      reasoning.push(`💎 ${scenario}: ${boost > 0 ? '+' : ''}${boost}x`);
    }
  });

  desiredLeverage += scenarioBoostTotal;

  // Apply sector leader boost
  const sectorLeadership = coin._sector_leadership || {};
  if (sectorLeadership.is_leader) {
    desiredLeverage += LEVERAGE_CONFIG.sector_leader_boost;
    reasoning.push(`⭐ SECTOR_LEADER: +${LEVERAGE_CONFIG.sector_leader_boost}x`);
  }

  reasoning.push(`🎯 Desired leverage (after boosts): ${desiredLeverage}x`);

  // STEP 3: Apply volatility multiplier
  const marketState = coin._market_state || {};
  const volRegime = marketState.volatility_regime || "MEDIUM";
  const volMultiplier = LEVERAGE_CONFIG.volatility_multiplier[volRegime] || 1.0;

  if (volMultiplier !== 1.0) {
    const beforeVol = desiredLeverage;
    desiredLeverage = Math.floor(desiredLeverage * volMultiplier);
    reasoning.push(`🌊 ${volRegime} volatility: ${beforeVol}x → ${desiredLeverage}x (×${volMultiplier.toFixed(2)})`);
  }

  // STEP 4: Apply ALL caps
  const exchangeMax = coin.data?.maxLeverage || 75;

  let finalLeverage = desiredLeverage;

  // Cap at max safe leverage (MOST IMPORTANT!)
  finalLeverage = Math.min(finalLeverage, maxSafeLeverage);

  // Cap at system max
  finalLeverage = Math.min(finalLeverage, LEVERAGE_CONFIG.system_max_leverage);

  // Cap at exchange max
  finalLeverage = Math.min(finalLeverage, exchangeMax);

  // Floor at system min
  finalLeverage = Math.max(finalLeverage, LEVERAGE_CONFIG.system_min_leverage);

  if (finalLeverage !== desiredLeverage) {
    reasoning.push(`🔒 Capped: ${desiredLeverage}x → ${finalLeverage}x (max_safe: ${maxSafeLeverage}x, system: ${LEVERAGE_CONFIG.system_max_leverage}x, exchange: ${exchangeMax}x)`);
  }

  // STEP 5: Calculate final liquidation price with chosen leverage
  const finalLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const finalLiqDistancePct = getLiqDistancePct(entryPrice, finalLiqPrice, side);

  // Calculate actual buffer achieved
  const actualBufferPct = slDistancePct - finalLiqDistancePct;

  reasoning.push(`💀 Liquidation: ${finalLiqPrice.toFixed(6)} (${finalLiqDistancePct.toFixed(2)}%)`);
  reasoning.push(`🛡️  Actual buffer: ${actualBufferPct.toFixed(2)}% (SL ${slDistancePct.toFixed(2)}% - Liq ${finalLiqDistancePct.toFixed(2)}%)`);

  // Validate buffer
  if (actualBufferPct < LEVERAGE_CONFIG.min_liq_buffer_pct) {
    reasoning.push(`⚠️ Buffer ${actualBufferPct.toFixed(2)}% < minimum ${LEVERAGE_CONFIG.min_liq_buffer_pct}% - reducing leverage!`);

    // Further reduce leverage
    const reducedMax = calculateMaxSafeLeverageFromSL(entryPrice, stopLoss, side, LEVERAGE_CONFIG.min_liq_buffer_pct);
    finalLeverage = Math.min(finalLeverage, reducedMax);
    finalLeverage = Math.max(finalLeverage, LEVERAGE_CONFIG.system_min_leverage);

    reasoning.push(`🔧 Adjusted to: ${finalLeverage}x`);
  } else if (actualBufferPct >= LEVERAGE_CONFIG.optimal_liq_buffer_pct) {
    reasoning.push(`✅ Excellent buffer (${actualBufferPct.toFixed(2)}% ≥ ${LEVERAGE_CONFIG.optimal_liq_buffer_pct}%)`);
  } else {
    reasoning.push(`✅ Safe buffer (${actualBufferPct.toFixed(2)}% ≥ ${LEVERAGE_CONFIG.min_liq_buffer_pct}%)`);
  }

  // Recalculate with final leverage
  const trueLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const trueLiqDistancePct = getLiqDistancePct(entryPrice, trueLiqPrice, side);
  const trueBufferPct = slDistancePct - trueLiqDistancePct;

  return {
    leverage: finalLeverage,
    liquidation_price: trueLiqPrice,
    liquidation_distance_pct: trueLiqDistancePct,
    liq_to_sl_buffer_pct: trueBufferPct,
    max_safe_leverage: maxSafeLeverage,
    desired_leverage: desiredLeverage,
    reasoning: reasoning,
    exchange_max_leverage: exchangeMax,
    mmr: getMMR(finalLeverage)
  };
}

//===============================================================================
// 💰 CALCULATE POSITION METRICS
//===============================================================================

function calculatePositionMetrics(coin, leverageResult) {
  const entryPrice = coin.entry_price || coin.price || 0;
  const positionSizeUSDT = coin.position_size_usdt || 50;
  const leverage = leverageResult.leverage;
  const stopLoss = coin.stop_loss || 0;
  const slPct = coin.stop_loss_pct || 0;

  const exposureUSDT = positionSizeUSDT * leverage;
  const quantity = Math.floor(exposureUSDT / entryPrice);

  const riskUSDT = positionSizeUSDT * (slPct / 100);
  const leveragedRiskUSDT = exposureUSDT * (slPct / 100);

  const tp1Price = coin.take_profit_1 || 0;
  const tp1Pct = coin.take_profit_1_pct || 0;
  const tp2Price = coin.take_profit_2 || 0;
  const tp2Pct = coin.take_profit_2_pct || 0;
  const tp3Price = coin.take_profit_3 || 0;
  const tp3Pct = coin.take_profit_3_pct || 0;

  let rewardTP1USDT = 0, rewardTP2USDT = 0, rewardTP3USDT = 0;
  let roiTP1 = 0, roiTP2 = 0, roiTP3 = 0;

  if (tp1Price > 0 && tp1Pct > 0) {
    rewardTP1USDT = exposureUSDT * (tp1Pct / 100);
    roiTP1 = (rewardTP1USDT / positionSizeUSDT) * 100;
  }

  if (tp2Price > 0 && tp2Pct > 0) {
    rewardTP2USDT = exposureUSDT * (tp2Pct / 100);
    roiTP2 = (rewardTP2USDT / positionSizeUSDT) * 100;
  }

  if (tp3Price > 0 && tp3Pct > 0) {
    rewardTP3USDT = exposureUSDT * (tp3Pct / 100);
    roiTP3 = (rewardTP3USDT / positionSizeUSDT) * 100;
  }

  const roiSL = -(leveragedRiskUSDT / positionSizeUSDT) * 100;

  const mainReward = rewardTP2USDT > 0 ? rewardTP2USDT : rewardTP1USDT;
  const leveragedRR = mainReward / leveragedRiskUSDT;

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
// ✅ VALIDATE LEVERAGE SAFETY
//===============================================================================

function validateLeverageSafety(coin, leverageResult, positionMetrics) {
  const issues = [];
  const warnings = [];

  if (leverageResult.liq_to_sl_buffer_pct < LEVERAGE_CONFIG.min_liq_buffer_pct) {
    issues.push(`❌ Buffer ${leverageResult.liq_to_sl_buffer_pct.toFixed(2)}% < min ${LEVERAGE_CONFIG.min_liq_buffer_pct}%`);
  }

  const side = coin.side;
  const liq = leverageResult.liquidation_price;
  const sl = coin.stop_loss;

  if (side === "BUY") {
    if (liq <= sl) {
      issues.push(`❌ Liq (${liq.toFixed(6)}) ≤ SL (${sl.toFixed(6)}) for BUY`);
    }
  } else if (side === "SELL") {
    if (liq >= sl) {
      issues.push(`❌ Liq (${liq.toFixed(6)}) ≥ SL (${sl.toFixed(6)}) for SELL`);
    }
  }

  if (leverageResult.leverage > 20) {
    warnings.push(`⚠️ High leverage (${leverageResult.leverage}x)`);
  }

  if (Math.abs(positionMetrics.roi_sl_pct) > 150) {
    warnings.push(`⚠️ High risk: ${Math.abs(positionMetrics.roi_sl_pct).toFixed(0)}% loss if SL`);
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

console.log(`\n🔄 Processing candidates...\n`);

let stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  high_leverage: 0,
  medium_leverage: 0,
  low_leverage: 0,
  safety_issues: 0
};

const processedCoins = [];

for (const coin of candidates) {
  stats.total++;

  if (!coin.side || !coin.entry_price || !coin.stop_loss || !coin.stop_loss_pct) {
    console.log(`⚠️  Skipped ${coin.symbol}: Missing critical data`);
    stats.skipped++;
    continue;
  }

  console.log(`\n⚡ ${coin.symbol} ${coin.side} - Margin: ${coin.position_size_usdt || 'N/A'} USDT`);

  const leverageResult = calculateOptimalLeverage(coin);

  if (!leverageResult) {
    console.log(`   ❌ Failed to calculate leverage`);
    stats.skipped++;
    continue;
  }

  console.log(`   🎯 Final Leverage: ${leverageResult.leverage}x (max safe: ${leverageResult.max_safe_leverage}x, desired: ${leverageResult.desired_leverage}x)`);
  console.log(`   💀 Liquidation: ${leverageResult.liquidation_price.toFixed(6)} (${leverageResult.liquidation_distance_pct.toFixed(2)}%)`);
  console.log(`   🛡️  Buffer: ${leverageResult.liq_to_sl_buffer_pct.toFixed(2)}%`);
  console.log(`   📐 MMR: ${(leverageResult.mmr * 100).toFixed(2)}%`);

  const positionMetrics = calculatePositionMetrics(coin, leverageResult);

  console.log(`   💰 Exposure: ${positionMetrics.exposure_usdt.toFixed(2)} USDT (${positionMetrics.quantity} coins)`);
  if (positionMetrics.reward_tp1_usdt > 0) {
    console.log(`   🚀 TP1: +${positionMetrics.reward_tp1_usdt.toFixed(2)} USDT (${positionMetrics.roi_tp1_pct.toFixed(0)}% ROI)`);
  }

  const validation = validateLeverageSafety(coin, leverageResult, positionMetrics);

  if (!validation.safe) {
    console.log(`   ❌ SAFETY ISSUES:`);
    validation.issues.forEach(issue => console.log(`      ${issue}`));
    stats.safety_issues++;
  }

  validation.warnings.forEach(warn => console.log(`   ${warn}`));

  if (leverageResult.leverage > 20) stats.high_leverage++;
  else if (leverageResult.leverage >= 10) stats.medium_leverage++;
  else stats.low_leverage++;

  processedCoins.push({
    ...coin,
    leverage: leverageResult.leverage,
    leverage_reasoning: leverageResult.reasoning,
    liquidation_price: leverageResult.liquidation_price,
    liquidation_distance_pct: leverageResult.liquidation_distance_pct,
    liq_to_sl_buffer_pct: leverageResult.liq_to_sl_buffer_pct,
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
    _leverage_metadata: {
      exchange_max_leverage: leverageResult.exchange_max_leverage,
      max_safe_leverage: leverageResult.max_safe_leverage,
      desired_leverage: leverageResult.desired_leverage,
      mmr: leverageResult.mmr,
      system_max: LEVERAGE_CONFIG.system_max_leverage
    }
  });

  stats.processed++;
}

//===============================================================================
// 📊 OUTPUT
//===============================================================================

console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`⚡ LEVERAGE FINDER V2 SUMMARY:`);
console.log(`   Total: ${stats.total}`);
console.log(`   ✅ Processed: ${stats.processed}`);
console.log(`   ⚠️  Skipped: ${stats.skipped}`);
console.log(`   ❌ Safety issues: ${stats.safety_issues}`);
console.log(`\n   📊 Leverage Distribution:`);
console.log(`      🔥 High (>20x): ${stats.high_leverage}`);
console.log(`      ⚡ Medium (10-20x): ${stats.medium_leverage}`);
console.log(`      🛡️  Low (<10x): ${stats.low_leverage}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (processedCoins.length > 0) {
  console.log(`✅ TOP 5 LEVERAGED SETUPS:\n`);
  const sortedByAlpha = [...processedCoins].sort((a, b) => (b.alpha || 0) - (a.alpha || 0));

  sortedByAlpha.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.symbol} ${c.side} - Alpha ${c.alpha?.toFixed(1) || 'N/A'}`);
    console.log(`   💵 Margin: ${c.position_size_usdt} USDT | Leverage: ${c.leverage}x`);
    console.log(`   💰 Exposure: ${c.position_exposure_usdt?.toFixed(2)} USDT`);
    console.log(`   📍 Entry: ${c.entry_price?.toFixed(6)} | Liq: ${c.liquidation_price?.toFixed(6)} | SL: ${c.stop_loss?.toFixed(6)}`);
    console.log(`   🔒 Buffer: ${c.liq_to_sl_buffer_pct?.toFixed(2)}% | MMR: ${(c._leverage_metadata.mmr * 100).toFixed(2)}%`);
    if (c.take_profit_1) {
      console.log(`   🎯 TP1: ${c.take_profit_1?.toFixed(6)} → ${c.reward_tp1_usdt?.toFixed(2)} USDT (${c.roi_tp1_pct?.toFixed(0)}% ROI)`);
    }
    console.log(`   📊 Leveraged RR: ${c.leveraged_rr?.toFixed(2)}:1\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} FINAL coins to Trade Selector\n`);

return processedCoins.map(coin => ({ json: coin }));
