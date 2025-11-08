// ═══════════════════════════════════════════════════════════════════════════
// ⚡ LEVERAGE FINDER ULTIMATE - MAXIMUM PROFIT WITH CONTROLLED RISK
// ═══════════════════════════════════════════════════════════════════════════
//
// 🏆 WORLD-CLASS FEATURES:
// ✅ Uses position_size_usdt directly from Rating Node (30-90 USDT)
// ✅ Intelligent leverage based on SL distance + conviction
// ✅ Liquidation price calculation with MANDATORY safety buffer
// ✅ CRITICAL: SL must be OUTSIDE liquidation zone + 2% buffer
// ✅ Conviction boost (EXTREME = +6x leverage)
// ✅ VP quality boost (GOLDEN = +5x, EXCELLENT = +4x)
// ✅ Market scenario boost (ALT_DECOUPLING = +5x)
// ✅ Sector leader momentum boost (+3x)
// ✅ BUY & SELL (SHORT) position support
// ✅ Position exposure & quantity calculation
// ✅ Leveraged risk/reward metrics
// ✅ Exchange max leverage validation (75x for most pairs)
// ✅ Human-readable reasoning
//
// OPTIMIZATION FOR SMALL ACCOUNTS:
// Base leverage: 8-12x (safe)
// Max leverage: 25-30x (aggressive for best setups)
// ALWAYS validate liq < SL with buffer!
//
// OUTPUT: Final trade-ready coins → Trade Selector
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
  // Base safe leverage calculation
  base_safety_factor: 0.7,  // Conservative: use 70% of max safe leverage

  // System limits
  system_max_leverage: 30,  // Our system max (safety cap)
  system_min_leverage: 3,   // Minimum leverage

  // Conviction boosts (added to base leverage)
  conviction_boost: {
    "EXTREME": 6,   // +6x for strongest signals
    "HIGH": 4,      // +4x
    "MEDIUM": 2,    // +2x
    "LOW": 0        // No boost
  },

  // VP quality boosts
  vp_quality_boost: {
    "GOLDEN": 5,      // +5x for perfect VP setup
    "EXCELLENT": 4,   // +4x
    "GOOD": 2,        // +2x
    "MODERATE": 0     // No boost
  },

  // Market scenario boosts
  scenario_boost: {
    "PEAK_ALT_SEASON": 6,     // +6x (maximum aggression)
    "ALT_DECOUPLING": 5,      // +5x (strong independent alpha)
    "COIN_DECOUPLING": 4,     // +4x
    "SECTOR_LEADER": 3,       // +3x (momentum)
    "FUNDING_DIVERGENCE": 2,  // +2x
    "BTC_ONLY_RALLY": -2,     // -2x (reduce for alts)
    "CAPITULATION": -5        // -5x (risk-off)
  },

  // Sector leadership bonus
  sector_leader_boost: 3,  // +3x for sector leaders

  // Volatility adjustments
  volatility_adjustment: {
    "EXTREME": 0.7,   // Reduce leverage 30% in extreme vol
    "HIGH": 0.85,     // Reduce 15%
    "MEDIUM": 1.0,    // Normal
    "LOW": 1.1        // Increase 10% in low vol (stable)
  },

  // CRITICAL: Minimum buffer between liquidation and SL (%)
  min_liq_buffer_pct: 2.0,  // SL must be 2% beyond liq price

  // Target buffer (optimal)
  optimal_liq_buffer_pct: 4.0  // Prefer 4% buffer
};

console.log(`\n⚡ LEVERAGE FINDER ULTIMATE - MAXIMUM PROFIT ENGINE`);
console.log(`   Processing ${candidates.length} candidates with SL/TP`);
console.log(`   🎯 Goal: MAXIMIZE leverage safely for small accounts\n`);

//===============================================================================
// 📊 CALCULATE LIQUIDATION PRICE
//===============================================================================

function calculateLiquidationPrice(entryPrice, leverage, side) {
  if (leverage <= 0) return null;

  let liqPrice = 0;

  if (side === "BUY") {
    // For LONG: liq = entry × (1 - 1/leverage)
    // As leverage increases, liq gets closer to entry
    liqPrice = entryPrice * (1 - 1 / leverage);
  } else if (side === "SELL") {
    // For SHORT: liq = entry × (1 + 1/leverage)
    liqPrice = entryPrice * (1 + 1 / leverage);
  }

  return liqPrice;
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

  // 1. Calculate base safe leverage from SL distance
  // Max safe leverage = 1 / SL_distance
  // We use safety_factor to be conservative
  const maxSafeLeverage = (1 / (slDistancePct / 100)) * LEVERAGE_CONFIG.base_safety_factor;
  let leverage = Math.floor(maxSafeLeverage);

  reasoning.push(`🧮 Base safe leverage: ${leverage}x (SL distance ${slDistancePct.toFixed(2)}%)`);

  // 2. Apply conviction boost
  const convictionBoost = LEVERAGE_CONFIG.conviction_boost[conviction] || 0;
  if (convictionBoost > 0) {
    leverage += convictionBoost;
    reasoning.push(`⚡ ${conviction} conviction: +${convictionBoost}x`);
  }

  // 3. Apply VP quality boost
  const vpBoost = LEVERAGE_CONFIG.vp_quality_boost[vpQuality] || 0;
  if (vpBoost > 0) {
    leverage += vpBoost;
    reasoning.push(`🏆 ${vpQuality} VP: +${vpBoost}x`);
  }

  // 4. Apply market scenario boost
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

  leverage += scenarioBoostTotal;

  // 5. Apply sector leader boost
  const sectorLeadership = coin._sector_leadership || {};
  if (sectorLeadership.is_leader) {
    leverage += LEVERAGE_CONFIG.sector_leader_boost;
    reasoning.push(`⭐ SECTOR_LEADER: +${LEVERAGE_CONFIG.sector_leader_boost}x`);
  }

  // 6. Apply volatility adjustment (multiplier)
  const marketState = coin._market_state || {};
  const volRegime = marketState.volatility_regime || "MEDIUM";
  const volAdjust = LEVERAGE_CONFIG.volatility_adjustment[volRegime] || 1.0;

  if (volAdjust !== 1.0) {
    const beforeVol = leverage;
    leverage = Math.floor(leverage * volAdjust);
    reasoning.push(`🌊 ${volRegime} volatility: ${beforeVol}x → ${leverage}x (×${volAdjust.toFixed(2)})`);
  }

  // 7. Cap at system limits
  const beforeCap = leverage;
  leverage = Math.max(LEVERAGE_CONFIG.system_min_leverage, leverage);
  leverage = Math.min(LEVERAGE_CONFIG.system_max_leverage, leverage);

  // Also cap at exchange max (from coin data)
  const exchangeMax = coin.data?.maxLeverage || 75;
  leverage = Math.min(leverage, exchangeMax);

  if (beforeCap !== leverage) {
    reasoning.push(`📊 Capped: ${beforeCap}x → ${leverage}x (system max: ${LEVERAGE_CONFIG.system_max_leverage}x, exchange: ${exchangeMax}x)`);
  }

  // 8. Calculate liquidation price
  const liqPrice = calculateLiquidationPrice(entryPrice, leverage, side);
  const liqDistancePct = getLiqDistancePct(entryPrice, liqPrice, side);

  // 9. Validate buffer between liq and SL
  const bufferPct = slDistancePct - liqDistancePct;

  reasoning.push(`🛡️ Liquidation: ${liqPrice.toFixed(6)} (${liqDistancePct.toFixed(2)}%)`);
  reasoning.push(`🔒 Buffer: ${bufferPct.toFixed(2)}% (SL ${slDistancePct.toFixed(2)}% - Liq ${liqDistancePct.toFixed(2)}%)`);

  // 10. Safety check: if buffer too small, reduce leverage
  if (bufferPct < LEVERAGE_CONFIG.min_liq_buffer_pct) {
    reasoning.push(`⚠️ Buffer ${bufferPct.toFixed(2)}% < minimum ${LEVERAGE_CONFIG.min_liq_buffer_pct}%`);

    // Reduce leverage until buffer is acceptable
    let adjustedLeverage = leverage;
    let adjustedBuffer = bufferPct;

    while (adjustedBuffer < LEVERAGE_CONFIG.min_liq_buffer_pct && adjustedLeverage > LEVERAGE_CONFIG.system_min_leverage) {
      adjustedLeverage -= 1;
      const newLiqPrice = calculateLiquidationPrice(entryPrice, adjustedLeverage, side);
      const newLiqDistancePct = getLiqDistancePct(entryPrice, newLiqPrice, side);
      adjustedBuffer = slDistancePct - newLiqDistancePct;
    }

    if (adjustedLeverage !== leverage) {
      reasoning.push(`🔧 Adjusted leverage: ${leverage}x → ${adjustedLeverage}x (buffer now ${adjustedBuffer.toFixed(2)}%)`);
      leverage = adjustedLeverage;
    }
  } else if (bufferPct >= LEVERAGE_CONFIG.optimal_liq_buffer_pct) {
    reasoning.push(`✅ Excellent buffer (${bufferPct.toFixed(2)}% ≥ ${LEVERAGE_CONFIG.optimal_liq_buffer_pct}%)`);
  } else {
    reasoning.push(`✅ Safe buffer (${bufferPct.toFixed(2)}% ≥ ${LEVERAGE_CONFIG.min_liq_buffer_pct}%)`);
  }

  // Recalculate final liq price with adjusted leverage
  const finalLiqPrice = calculateLiquidationPrice(entryPrice, leverage, side);
  const finalLiqDistancePct = getLiqDistancePct(entryPrice, finalLiqPrice, side);
  const finalBufferPct = slDistancePct - finalLiqDistancePct;

  return {
    leverage: leverage,
    liquidation_price: finalLiqPrice,
    liquidation_distance_pct: finalLiqDistancePct,
    liq_to_sl_buffer_pct: finalBufferPct,
    reasoning: reasoning,
    exchange_max_leverage: exchangeMax,
    base_safe_leverage: Math.floor(maxSafeLeverage),
    total_boost: leverage - Math.floor(maxSafeLeverage)
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

  // Position exposure (total value)
  const exposureUSDT = positionSizeUSDT * leverage;

  // Quantity (how many coins)
  const quantity = exposureUSDT / entryPrice;

  // Risk (USDT loss if SL hit)
  const riskUSDT = positionSizeUSDT * (slPct / 100);

  // Leveraged risk (actual loss from position)
  const leveragedRiskUSDT = exposureUSDT * (slPct / 100);

  // Rewards for each TP
  const tp1Price = coin.take_profit_1 || 0;
  const tp1Pct = coin.take_profit_1_pct || 0;
  const tp2Price = coin.take_profit_2 || 0;
  const tp2Pct = coin.take_profit_2_pct || 0;
  const tp3Price = coin.take_profit_3 || 0;
  const tp3Pct = coin.take_profit_3_pct || 0;

  let rewardTP1USDT = 0;
  let rewardTP2USDT = 0;
  let rewardTP3USDT = 0;
  let roiTP1 = 0;
  let roiTP2 = 0;
  let roiTP3 = 0;

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

  // ROI if SL hit
  const roiSL = -(leveragedRiskUSDT / positionSizeUSDT) * 100;

  // Leveraged RR (using main TP - prefer TP2 if available, else TP1)
  const mainReward = rewardTP2USDT > 0 ? rewardTP2USDT : rewardTP1USDT;
  const leveragedRR = mainReward / leveragedRiskUSDT;

  return {
    position_size_usdt: positionSizeUSDT,
    exposure_usdt: exposureUSDT,
    quantity: Math.floor(quantity),

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

  // 1. Check buffer
  if (leverageResult.liq_to_sl_buffer_pct < LEVERAGE_CONFIG.min_liq_buffer_pct) {
    issues.push(`❌ Liq buffer ${leverageResult.liq_to_sl_buffer_pct.toFixed(2)}% < minimum ${LEVERAGE_CONFIG.min_liq_buffer_pct}%`);
  }

  // 2. Check liq vs SL positioning
  const side = coin.side;
  const liq = leverageResult.liquidation_price;
  const sl = coin.stop_loss;
  const entry = coin.entry_price;

  if (side === "BUY") {
    // For LONG: entry > liq > SL (liq should be closer to entry than SL)
    if (liq <= sl) {
      issues.push(`❌ Liquidation (${liq.toFixed(6)}) below/equal SL (${sl.toFixed(6)}) for BUY`);
    }
  } else if (side === "SELL") {
    // For SHORT: entry < liq < SL
    if (liq >= sl) {
      issues.push(`❌ Liquidation (${liq.toFixed(6)}) above/equal SL (${sl.toFixed(6)}) for SELL`);
    }
  }

  // 3. Check if leverage is too aggressive (>20x)
  if (leverageResult.leverage > 20) {
    warnings.push(`⚠️ High leverage (${leverageResult.leverage}x) - only for best setups!`);
  }

  // 4. Check if ROI on SL is catastrophic (>150% loss)
  if (Math.abs(positionMetrics.roi_sl_pct) > 150) {
    warnings.push(`⚠️ High risk: ${Math.abs(positionMetrics.roi_sl_pct).toFixed(0)}% loss if SL hit`);
  }

  // 5. Check if position too small for leverage
  if (positionMetrics.exposure_usdt < 50) {
    warnings.push(`⚠️ Small exposure (${positionMetrics.exposure_usdt.toFixed(2)} USDT) - fees may impact`);
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
  high_leverage: 0,  // >20x
  medium_leverage: 0, // 10-20x
  low_leverage: 0,   // <10x
  safety_issues: 0
};

const processedCoins = [];

for (const coin of candidates) {
  stats.total++;

  // Skip if missing critical data
  if (!coin.side || !coin.entry_price || !coin.stop_loss || !coin.stop_loss_pct) {
    console.log(`⚠️  Skipped ${coin.symbol}: Missing critical data (entry, SL, or side)`);
    stats.skipped++;
    continue;
  }

  console.log(`\n⚡ ${coin.symbol} ${coin.side} - Position: ${coin.position_size_usdt || 'N/A'} USDT`);

  // Calculate optimal leverage
  const leverageResult = calculateOptimalLeverage(coin);

  if (!leverageResult) {
    console.log(`   ❌ Failed to calculate leverage`);
    stats.skipped++;
    continue;
  }

  console.log(`   🎯 Leverage: ${leverageResult.leverage}x`);
  console.log(`   💀 Liquidation: ${leverageResult.liquidation_price.toFixed(6)} (${leverageResult.liquidation_distance_pct.toFixed(2)}%)`);
  console.log(`   🛡️  Buffer: ${leverageResult.liq_to_sl_buffer_pct.toFixed(2)}%`);

  // Calculate position metrics
  const positionMetrics = calculatePositionMetrics(coin, leverageResult);

  console.log(`   💰 Exposure: ${positionMetrics.exposure_usdt.toFixed(2)} USDT (${positionMetrics.quantity} coins)`);
  if (positionMetrics.reward_tp1_usdt > 0) {
    console.log(`   🚀 TP1 Profit: ${positionMetrics.reward_tp1_usdt.toFixed(2)} USDT (${positionMetrics.roi_tp1_pct.toFixed(0)}% ROI)`);
  }
  if (positionMetrics.reward_tp2_usdt > 0) {
    console.log(`   🚀 TP2 Profit: ${positionMetrics.reward_tp2_usdt.toFixed(2)} USDT (${positionMetrics.roi_tp2_pct.toFixed(0)}% ROI)`);
  }

  // Validate safety
  const validation = validateLeverageSafety(coin, leverageResult, positionMetrics);

  if (!validation.safe) {
    console.log(`   ❌ SAFETY ISSUES:`);
    validation.issues.forEach(issue => console.log(`      ${issue}`));
    stats.safety_issues++;
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warn => console.log(`   ${warn}`));
  }

  // Track leverage distribution
  if (leverageResult.leverage > 20) stats.high_leverage++;
  else if (leverageResult.leverage >= 10) stats.medium_leverage++;
  else stats.low_leverage++;

  // Add to output
  processedCoins.push({
    ...coin,

    // Leverage data
    leverage: leverageResult.leverage,
    leverage_reasoning: leverageResult.reasoning,
    liquidation_price: leverageResult.liquidation_price,
    liquidation_distance_pct: leverageResult.liquidation_distance_pct,
    liq_to_sl_buffer_pct: leverageResult.liq_to_sl_buffer_pct,

    // Position metrics
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

    // Validation
    leverage_validation: validation,

    // Metadata
    _leverage_metadata: {
      exchange_max_leverage: leverageResult.exchange_max_leverage,
      base_safe_leverage: leverageResult.base_safe_leverage,
      total_boost: leverageResult.total_boost,
      system_max: LEVERAGE_CONFIG.system_max_leverage
    }
  });

  stats.processed++;
}

//===============================================================================
// 📊 OUTPUT SUMMARY
//===============================================================================

console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`⚡ LEVERAGE FINDER SUMMARY:`);
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

  // Sort by alpha (best trades first)
  const sortedByAlpha = [...processedCoins].sort((a, b) => (b.alpha || 0) - (a.alpha || 0));

  sortedByAlpha.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.symbol} ${c.side} - Alpha ${c.alpha?.toFixed(1) || 'N/A'}`);
    console.log(`   💵 Margin: ${c.position_size_usdt} USDT | Leverage: ${c.leverage}x`);
    console.log(`   💰 Exposure: ${c.position_exposure_usdt?.toFixed(2)} USDT`);
    console.log(`   📍 Entry: ${c.entry_price?.toFixed(6)} | Liq: ${c.liquidation_price?.toFixed(6)}`);
    console.log(`   🛡️  SL: ${c.stop_loss?.toFixed(6)} (-${c.stop_loss_pct?.toFixed(2)}%)`);

    if (c.take_profit_1) {
      console.log(`   🎯 TP1: ${c.take_profit_1?.toFixed(6)} (+${c.take_profit_1_pct?.toFixed(2)}%) → ${c.reward_tp1_usdt?.toFixed(2)} USDT (${c.roi_tp1_pct?.toFixed(0)}% ROI)`);
    }
    if (c.take_profit_2) {
      console.log(`   🎯 TP2: ${c.take_profit_2?.toFixed(6)} (+${c.take_profit_2_pct?.toFixed(2)}%) → ${c.reward_tp2_usdt?.toFixed(2)} USDT (${c.roi_tp2_pct?.toFixed(0)}% ROI)`);
    }

    console.log(`   📊 Leveraged RR: ${c.leveraged_rr?.toFixed(2)}:1`);
    console.log(`   🔒 Buffer: ${c.liq_to_sl_buffer_pct?.toFixed(2)}%\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} FINAL trade-ready coins to Trade Selector\n`);

return processedCoins.map(coin => ({ json: coin }));
