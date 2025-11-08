// ═══════════════════════════════════════════════════════════════════════════
// ⚡ LEVERAGE FINDER ULTIMATE V3.1 - FIXED BUFFER CALCULATION
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔧 CRITICAL FIX FROM V3:
// Buffer is ADDITIONAL distance BEYOND SL, not from entry!
// If SL is -9% and buffer is 8%, liq should be at -17% (9% + 8%)!
//
// Example:
// Entry: 100, SL: 91 (-9%), Buffer: 8%
// Liq target: 100 × (1 - 0.17) = 83 (-17%) ✅
// NOT: 91 + 8 = 99 (would be ABOVE entry!) ❌
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data from SL/TP Finder!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🔧 LEVERAGE CONFIGURATION (CONSERVATIVE!)
//===============================================================================

const LEVERAGE_CONFIG = {
  system_max_leverage: 12,
  system_min_leverage: 3,

  conviction_boost: {
    "EXTREME": 1.5,
    "HIGH": 1.0,
    "MEDIUM": 0.5,
    "LOW": 0
  },

  vp_quality_boost: {
    "GOLDEN": 1.5,
    "EXCELLENT": 1.0,
    "GOOD": 0.5,
    "MODERATE": 0
  },

  scenario_boost: {
    "PEAK_ALT_SEASON": 1.5,
    "ALT_DECOUPLING": 1.0,
    "COIN_DECOUPLING": 0.5,
    "SECTOR_LEADER": 0.5,
    "FUNDING_DIVERGENCE": 0,
    "BTC_ONLY_RALLY": -0.5,
    "CAPITULATION": -1.0
  },

  sector_leader_boost: 0.5,

  volatility_multiplier: {
    "EXTREME": 0.6,
    "HIGH": 0.8,
    "MEDIUM": 1.0,
    "LOW": 1.05
  },

  // Buffer is ADDITIONAL % beyond SL
  min_liq_buffer_pct: 2.5,      // Liq = SL - 2.5% (further away)
  optimal_liq_buffer_pct: 4.0,  // Liq = SL - 4% (preferred)

  base_percentage: 0.3
};

const MMR_TIERS = [
  { min: 1,  max: 10,  mmr: 0.005 },
  { min: 11, max: 25,  mmr: 0.010 },
  { min: 26, max: 50,  mmr: 0.020 },
  { min: 51, max: 100, mmr: 0.050 }
];

function getMMR(leverage) {
  for (const tier of MMR_TIERS) {
    if (leverage >= tier.min && leverage <= tier.max) {
      return tier.mmr;
    }
  }
  return 0.050;
}

console.log(`\n⚡ LEVERAGE FINDER ULTIMATE V3.1 - FIXED BUFFER CALC`);
console.log(`   Processing ${candidates.length} candidates`);
console.log(`   🛡️  Buffer = ADDITIONAL distance beyond SL (not from entry!)\n`);

//===============================================================================
// 📐 ANALYTICAL SOLUTION - FIXED!
//===============================================================================

function calculateMaxSafeLeverageAnalytical(entryPrice, stopLoss, side, bufferPct) {
  // Calculate SL distance from entry
  let slDistanceFromEntry = 0;

  if (side === "BUY") {
    slDistanceFromEntry = ((entryPrice - stopLoss) / entryPrice) * 100; // Positive %
  } else if (side === "SELL") {
    slDistanceFromEntry = ((stopLoss - entryPrice) / entryPrice) * 100; // Positive %
  }

  // Liq should be FURTHER away than SL by buffer amount
  // If SL is -9% from entry, and buffer is 8%, liq should be -17% from entry
  const liqDistanceFromEntry = slDistanceFromEntry + bufferPct;

  // Calculate target liq price
  let targetLiqPrice = 0;

  if (side === "BUY") {
    // For LONG: liq is BELOW entry
    targetLiqPrice = entryPrice * (1 - liqDistanceFromEntry / 100);
  } else if (side === "SELL") {
    // For SHORT: liq is ABOVE entry
    targetLiqPrice = entryPrice * (1 + liqDistanceFromEntry / 100);
  }

  // Safety check
  if (side === "BUY" && targetLiqPrice >= entryPrice) {
    console.log(`   ⚠️  Liq target (${targetLiqPrice.toFixed(6)}) >= entry, using min leverage`);
    return LEVERAGE_CONFIG.system_min_leverage;
  }
  if (side === "SELL" && targetLiqPrice <= entryPrice) {
    console.log(`   ⚠️  Liq target (${targetLiqPrice.toFixed(6)}) <= entry, using min leverage`);
    return LEVERAGE_CONFIG.system_min_leverage;
  }

  // Now solve for leverage for each MMR tier
  let bestLeverage = LEVERAGE_CONFIG.system_min_leverage;

  for (const tier of MMR_TIERS) {
    const mmr = tier.mmr;
    let L = 0;

    if (side === "BUY") {
      // Liq = Entry × (1 - 1/L + MMR)
      // targetLiqPrice = entryPrice × (1 - 1/L + MMR)
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
      // Liq = Entry × (1 + 1/L - MMR)
      // targetLiqPrice = entryPrice × (1 + 1/L - MMR)
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

    // Check if L is within this tier's range
    if (L >= tier.min && L <= tier.max) {
      // Verify
      const testLiq = calculateLiquidationPrice(entryPrice, Math.floor(L), side);

      // Check that testLiq is safer than targetLiq
      if (side === "BUY" && testLiq <= targetLiqPrice) {
        bestLeverage = Math.max(bestLeverage, Math.floor(L));
      } else if (side === "SELL" && testLiq >= targetLiqPrice) {
        bestLeverage = Math.max(bestLeverage, Math.floor(L));
      }
    } else if (L > tier.max) {
      // Try tier max
      const testLiq = calculateLiquidationPrice(entryPrice, tier.max, side);

      if (side === "BUY" && testLiq <= targetLiqPrice) {
        bestLeverage = Math.max(bestLeverage, tier.max);
      } else if (side === "SELL" && testLiq >= targetLiqPrice) {
        bestLeverage = Math.max(bestLeverage, tier.max);
      }
    }
  }

  return Math.max(bestLeverage, LEVERAGE_CONFIG.system_min_leverage);
}

//===============================================================================
// 📊 BYBIT LIQUIDATION PRICE
//===============================================================================

function calculateLiquidationPrice(entryPrice, leverage, side) {
  const mmr = getMMR(leverage);

  if (side === "BUY") {
    return entryPrice * (1 - 1/leverage + mmr);
  } else if (side === "SELL") {
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
// 🧮 CALCULATE OPTIMAL LEVERAGE
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

  // STEP 1: Calculate MAX safe leverage with optimal buffer
  const bufferPct = LEVERAGE_CONFIG.optimal_liq_buffer_pct;
  const maxSafeLeverage = calculateMaxSafeLeverageAnalytical(entryPrice, stopLoss, side, bufferPct);

  reasoning.push(`🔍 Max safe leverage: ${maxSafeLeverage}x (SL @ ${slDistancePct.toFixed(2)}%, buffer ${bufferPct}% beyond SL)`);

  // STEP 2: Calculate DESIRED leverage
  let desiredLeverage = Math.floor(maxSafeLeverage * LEVERAGE_CONFIG.base_percentage);

  reasoning.push(`📊 Conservative base: ${desiredLeverage}x (${(LEVERAGE_CONFIG.base_percentage * 100).toFixed(0)}% of max safe)`);

  // Apply boosts
  const convictionBoost = LEVERAGE_CONFIG.conviction_boost[conviction] || 0;
  if (convictionBoost > 0) {
    desiredLeverage += convictionBoost;
    reasoning.push(`⚡ ${conviction} conviction: +${convictionBoost}x`);
  }

  const vpBoost = LEVERAGE_CONFIG.vp_quality_boost[vpQuality] || 0;
  if (vpBoost > 0) {
    desiredLeverage += vpBoost;
    reasoning.push(`🏆 ${vpQuality} VP: +${vpBoost}x`);
  }

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

  const sectorLeadership = coin._sector_leadership || {};
  if (sectorLeadership.is_leader) {
    desiredLeverage += LEVERAGE_CONFIG.sector_leader_boost;
    reasoning.push(`⭐ SECTOR_LEADER: +${LEVERAGE_CONFIG.sector_leader_boost}x`);
  }

  reasoning.push(`🎯 Desired leverage (after boosts): ${desiredLeverage.toFixed(1)}x`);

  // STEP 3: Apply volatility multiplier
  const marketState = coin._market_state || {};
  const volRegime = marketState.volatility_regime || "MEDIUM";
  const volMultiplier = LEVERAGE_CONFIG.volatility_multiplier[volRegime] || 1.0;

  if (volMultiplier !== 1.0) {
    const beforeVol = desiredLeverage;
    desiredLeverage = desiredLeverage * volMultiplier;
    reasoning.push(`🌊 ${volRegime} volatility: ${beforeVol.toFixed(1)}x → ${desiredLeverage.toFixed(1)}x (×${volMultiplier.toFixed(2)})`);
  }

  desiredLeverage = Math.floor(desiredLeverage);

  // STEP 4: Apply caps
  const exchangeMax = coin.data?.maxLeverage || 75;

  let finalLeverage = desiredLeverage;
  finalLeverage = Math.min(finalLeverage, maxSafeLeverage);
  finalLeverage = Math.min(finalLeverage, LEVERAGE_CONFIG.system_max_leverage);
  finalLeverage = Math.min(finalLeverage, exchangeMax);
  finalLeverage = Math.max(finalLeverage, LEVERAGE_CONFIG.system_min_leverage);

  if (finalLeverage !== desiredLeverage) {
    const caps = [];
    if (finalLeverage === maxSafeLeverage) caps.push(`max_safe: ${maxSafeLeverage}x`);
    if (finalLeverage === LEVERAGE_CONFIG.system_max_leverage) caps.push(`system: ${LEVERAGE_CONFIG.system_max_leverage}x`);
    if (finalLeverage === exchangeMax) caps.push(`exchange: ${exchangeMax}x`);

    reasoning.push(`🔒 Capped: ${desiredLeverage}x → ${finalLeverage}x (${caps.join(', ')})`);
  }

  // STEP 5: Validate
  const finalLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const finalLiqDistancePct = getLiqDistancePct(entryPrice, finalLiqPrice, side);
  const actualBufferPct = finalLiqDistancePct - slDistancePct;

  reasoning.push(`💀 Liquidation: ${finalLiqPrice.toFixed(6)} (${finalLiqDistancePct.toFixed(2)}% from entry)`);
  reasoning.push(`🛡️  Buffer: ${actualBufferPct.toFixed(2)}% (Liq ${finalLiqDistancePct.toFixed(2)}% - SL ${slDistancePct.toFixed(2)}%)`);

  if (actualBufferPct < LEVERAGE_CONFIG.min_liq_buffer_pct) {
    reasoning.push(`⚠️ Buffer ${actualBufferPct.toFixed(2)}% < min ${LEVERAGE_CONFIG.min_liq_buffer_pct}% - reducing!`);

    const saferMax = calculateMaxSafeLeverageAnalytical(entryPrice, stopLoss, side, LEVERAGE_CONFIG.min_liq_buffer_pct);
    finalLeverage = Math.min(finalLeverage, saferMax);
    finalLeverage = Math.max(finalLeverage, LEVERAGE_CONFIG.system_min_leverage);

    reasoning.push(`🔧 Reduced to: ${finalLeverage}x (enforcing ${LEVERAGE_CONFIG.min_liq_buffer_pct}% min buffer)`);
  } else if (actualBufferPct >= LEVERAGE_CONFIG.optimal_liq_buffer_pct) {
    reasoning.push(`✅ EXCELLENT buffer (${actualBufferPct.toFixed(2)}% ≥ ${LEVERAGE_CONFIG.optimal_liq_buffer_pct}%)`);
  } else {
    reasoning.push(`✅ SAFE buffer (${actualBufferPct.toFixed(2)}% ≥ ${LEVERAGE_CONFIG.min_liq_buffer_pct}%)`);
  }

  const trueLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const trueLiqDistancePct = getLiqDistancePct(entryPrice, trueLiqPrice, side);
  const trueBufferPct = trueLiqDistancePct - slDistancePct;

  return {
    leverage: finalLeverage,
    liquidation_price: trueLiqPrice,
    liquidation_distance_pct: trueLiqDistancePct,
    liq_to_sl_buffer_pct: trueBufferPct,
    max_safe_leverage: maxSafeLeverage,
    desired_leverage: Math.floor(desiredLeverage),
    reasoning: reasoning,
    exchange_max_leverage: exchangeMax,
    mmr: getMMR(finalLeverage)
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

  const exposureUSDT = positionSizeUSDT * leverage;
  const quantity = Math.floor(exposureUSDT / entryPrice);

  const riskUSDT = positionSizeUSDT * (slPct / 100);
  const leveragedRiskUSDT = exposureUSDT * (slPct / 100);

  const tp1Pct = coin.take_profit_1_pct || 0;
  const tp2Pct = coin.take_profit_2_pct || 0;
  const tp3Pct = coin.take_profit_3_pct || 0;

  const rewardTP1USDT = tp1Pct > 0 ? exposureUSDT * (tp1Pct / 100) : 0;
  const rewardTP2USDT = tp2Pct > 0 ? exposureUSDT * (tp2Pct / 100) : 0;
  const rewardTP3USDT = tp3Pct > 0 ? exposureUSDT * (tp3Pct / 100) : 0;

  const roiTP1 = rewardTP1USDT > 0 ? (rewardTP1USDT / positionSizeUSDT) * 100 : 0;
  const roiTP2 = rewardTP2USDT > 0 ? (rewardTP2USDT / positionSizeUSDT) * 100 : 0;
  const roiTP3 = rewardTP3USDT > 0 ? (rewardTP3USDT / positionSizeUSDT) * 100 : 0;
  const roiSL = -(leveragedRiskUSDT / positionSizeUSDT) * 100;

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

  if (leverageResult.liq_to_sl_buffer_pct < LEVERAGE_CONFIG.min_liq_buffer_pct) {
    issues.push(`❌ Buffer ${leverageResult.liq_to_sl_buffer_pct.toFixed(2)}% < min ${LEVERAGE_CONFIG.min_liq_buffer_pct}%`);
  }

  const side = coin.side;
  const liq = leverageResult.liquidation_price;
  const sl = coin.stop_loss;

  if (side === "BUY" && liq >= sl) {
    issues.push(`❌ Liq (${liq.toFixed(6)}) ≥ SL (${sl.toFixed(6)}) for BUY`);
  } else if (side === "SELL" && liq <= sl) {
    issues.push(`❌ Liq (${liq.toFixed(6)}) ≤ SL (${sl.toFixed(6)}) for SELL`);
  }

  if (leverageResult.leverage > 10) {
    warnings.push(`⚠️ Leverage ${leverageResult.leverage}x > 10x (aggressive)`);
  }

  if (Math.abs(positionMetrics.roi_sl_pct) > 100) {
    warnings.push(`⚠️ Risk: ${Math.abs(positionMetrics.roi_sl_pct).toFixed(0)}% loss if SL`);
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

console.log(`\n🔄 Processing...\n`);

let stats = {
  total: 0,
  processed: 0,
  failed: 0,
  leverage_6_to_10: 0,
  leverage_under_6: 0,
  leverage_over_10: 0
};

const processedCoins = [];

for (const coin of candidates) {
  stats.total++;

  if (!coin.side || !coin.entry_price || !coin.stop_loss || !coin.stop_loss_pct) {
    console.log(`⚠️  Skipped ${coin.symbol}: Missing data`);
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
    console.log(`   ❌ Could not calculate`);
    stats.failed++;
    processedCoins.push({
      ...coin,
      leverage_status: "FAILED",
      leverage_error: "Could not calculate"
    });
    continue;
  }

  console.log(`   🎯 Leverage: ${leverageResult.leverage}x (max safe: ${leverageResult.max_safe_leverage}x)`);
  console.log(`   💀 Liq: ${leverageResult.liquidation_price.toFixed(6)} (${leverageResult.liquidation_distance_pct.toFixed(2)}%)`);
  console.log(`   🛡️  Buffer: ${leverageResult.liq_to_sl_buffer_pct.toFixed(2)}%`);

  const positionMetrics = calculatePositionMetrics(coin, leverageResult);

  console.log(`   💰 Exposure: ${positionMetrics.exposure_usdt.toFixed(2)} USDT`);

  const validation = validateLeverageSafety(coin, leverageResult, positionMetrics);

  if (!validation.safe) {
    console.log(`   ❌ SAFETY ISSUES:`);
    validation.issues.forEach(issue => console.log(`      ${issue}`));
  }

  validation.warnings.forEach(warn => console.log(`   ${warn}`));

  if (leverageResult.leverage >= 6 && leverageResult.leverage <= 10) stats.leverage_6_to_10++;
  else if (leverageResult.leverage < 6) stats.leverage_under_6++;
  else stats.leverage_over_10++;

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
    leverage_status: "SUCCESS",
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
console.log(`⚡ LEVERAGE FINDER V3.1 SUMMARY:`);
console.log(`   Total: ${stats.total}`);
console.log(`   ✅ Success: ${stats.processed}`);
console.log(`   ❌ Failed: ${stats.failed}`);
console.log(`\n   📊 Leverage Distribution:`);
console.log(`      🛡️  <6x: ${stats.leverage_under_6}`);
console.log(`      ✅ 6-10x: ${stats.leverage_6_to_10} (SWEET SPOT!)`);
console.log(`      ⚠️  >10x: ${stats.leverage_over_10}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (processedCoins.length > 0) {
  console.log(`✅ TOP 5:\n`);
  const successful = processedCoins.filter(c => c.leverage_status === "SUCCESS");
  const sortedByAlpha = [...successful].sort((a, b) => (b.alpha || 0) - (a.alpha || 0));

  sortedByAlpha.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.symbol} ${c.side} - ${c.leverage}x`);
    console.log(`   💰 ${c.position_exposure_usdt?.toFixed(0)} USDT | Buffer: ${c.liq_to_sl_buffer_pct?.toFixed(2)}%\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} coins to Trade Selector\n`);

return processedCoins.map(coin => ({ json: coin }));
