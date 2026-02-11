// ═══════════════════════════════════════════════════════════════════════════
// ⚡ LEVERAGE FINDER ULTIMATE V5.0 - MAXIMUM SAFE LEVERAGE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🎯 FILOZOFIJA:
// NEMA univerzalnog optimala! Svaki trade je DRUGAČIJI!
// - Uži SL (5%) → Veći safe leverage (15x moguće!)
// - Širi SL (12%) → Manji safe leverage (5-7x)
//
// 🔧 STRATEGIJA:
// 1. Nađi MAKSIMALNI safe leverage sa minimalnim bufferom
// 2. KORISTI GA! (sa safety faktorom 90-95%)
// 3. Kvalitetniji setup → manji buffer → VEĆI max leverage
// 4. Nemoj arbitrary limite ili konzervativne baze!
//
// 💎 MAKSIMIZIRAMO SAFE LEVERAGE!
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data from SL/TP Finder!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🎯 LEVERAGE CONFIGURATION - MAXIMUM SAFE!
//===============================================================================

const CONFIG = {
  // System absolute limits
  system_max_leverage: 20,    // Increased! Let math decide, not arbitrary limits
  system_min_leverage: 3,

  // Safety factor: Use X% of calculated max safe leverage
  // This is our ONLY reduction from pure max
  safety_factor: 0.93,         // Use 93% of max safe (small safety margin)

  // Buffer configuration (MINIMALNI ali siguran!)
  buffer: {
    // Base buffers (koliko dodatno od SL-a)
    minimum: 2.0,        // Apsolutni minimum
    base: 2.5,           // Standardni za quality setupove
    safe: 3.5,           // Za slabije setupove

    // Adjustments based on setup quality
    adjustments: {
      // SMANJUJU buffer (bolji setup = manji buffer = VEĆI leverage!)
      conviction: {
        "EXTREME": -0.5,    // -0.5% buffer (tighter = više leveragea)
        "HIGH": -0.25,      // -0.25% buffer
        "MEDIUM": 0,        // Bez promjene
        "LOW": +0.75        // +0.75% buffer (više sigurnosti)
      },

      vp_quality: {
        "GOLDEN": -0.5,     // Savršen VP = tighter buffer
        "EXCELLENT": -0.25, // Odličan VP = malo tighter
        "GOOD": 0,          // Standard
        "MODERATE": +0.5    // Slabiji VP = veći buffer
      },

      // POVEĆAVAJU buffer (veća volatilnost = veći buffer = manji leverage)
      volatility: {
        "EXTREME": +1.0,    // Luda vol = veći buffer za sigurnost
        "HIGH": +0.5,       // Visoka vol = malo veći buffer
        "MEDIUM": 0,        // Normalno
        "LOW": -0.25        // Niska vol = može tighter buffer
      }
    }
  }
};

//===============================================================================
// 📊 BYBIT ISOLATED MARGIN - MMR TIERS
//===============================================================================

const MMR_TIERS = [
  { min: 1,  max: 10,  mmr: 0.005 },   // 0.5% MMR
  { min: 11, max: 25,  mmr: 0.010 },   // 1.0% MMR
  { min: 26, max: 50,  mmr: 0.020 },   // 2.0% MMR
  { min: 51, max: 100, mmr: 0.050 }    // 5.0% MMR
];

function getMMR(leverage) {
  for (const tier of MMR_TIERS) {
    if (leverage >= tier.min && leverage <= tier.max) {
      return tier.mmr;
    }
  }
  return 0.050;
}

//===============================================================================
// 🧮 BYBIT LIQUIDATION PRICE
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
// 🔍 CALCULATE MAXIMUM SAFE LEVERAGE - ANALYTICAL
//===============================================================================

function calculateMaxSafeLeverage(entryPrice, stopLoss, side, bufferPct) {
  // Step 1: SL distance from entry
  let slDistanceFromEntry = 0;

  if (side === "BUY") {
    slDistanceFromEntry = ((entryPrice - stopLoss) / entryPrice) * 100;
  } else if (side === "SELL") {
    slDistanceFromEntry = ((stopLoss - entryPrice) / entryPrice) * 100;
  }

  // Step 2: Target liq distance = SL distance + buffer
  const targetLiqDistanceFromEntry = slDistanceFromEntry + bufferPct;

  // Step 3: Target liq price
  let targetLiqPrice = 0;

  if (side === "BUY") {
    targetLiqPrice = entryPrice * (1 - targetLiqDistanceFromEntry / 100);
  } else if (side === "SELL") {
    targetLiqPrice = entryPrice * (1 + targetLiqDistanceFromEntry / 100);
  }

  // Safety check
  if (side === "BUY" && targetLiqPrice >= entryPrice) {
    return CONFIG.system_min_leverage;
  }
  if (side === "SELL" && targetLiqPrice <= entryPrice) {
    return CONFIG.system_min_leverage;
  }

  // Step 4: Solve for max leverage across all MMR tiers
  let maxLeverage = CONFIG.system_min_leverage;

  for (const tier of MMR_TIERS) {
    const mmr = tier.mmr;
    let L = 0;

    if (side === "BUY") {
      // L = 1 / (1 + MMR - targetLiqPrice / entryPrice)
      const ratio = targetLiqPrice / entryPrice;
      const denominator = 1 + mmr - ratio;

      if (denominator > 0) {
        L = 1 / denominator;
      } else {
        continue;
      }

    } else if (side === "SELL") {
      // L = 1 / (targetLiqPrice / entryPrice - 1 + MMR)
      const ratio = targetLiqPrice / entryPrice;
      const denominator = ratio - 1 + mmr;

      if (denominator > 0) {
        L = 1 / denominator;
      } else {
        continue;
      }
    }

    // Check if L is within tier range
    if (L >= tier.min && L <= tier.max) {
      // Verify
      const testLiq = calculateLiquidationPrice(entryPrice, Math.floor(L), side);

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
// 🎯 CALCULATE OPTIMAL BUFFER (DYNAMIC!)
//===============================================================================

function calculateOptimalBuffer(coin) {
  const conviction = coin.conviction || "MEDIUM";
  const vpQuality = coin.vp_setup_quality || "GOOD";
  const marketState = coin._market_state || {};
  const volRegime = marketState.volatility_regime || "MEDIUM";

  // Start with base buffer
  let bufferPct = CONFIG.buffer.base; // 2.5%

  const adjustments = [];

  // Conviction adjustment (bolji signal = manji buffer!)
  const convictionAdj = CONFIG.buffer.adjustments.conviction[conviction] || 0;
  if (convictionAdj !== 0) {
    bufferPct += convictionAdj;
    const sign = convictionAdj > 0 ? '+' : '';
    adjustments.push(`${conviction}: ${sign}${convictionAdj.toFixed(2)}%`);
  }

  // VP quality adjustment (bolji VP = manji buffer!)
  const vpAdj = CONFIG.buffer.adjustments.vp_quality[vpQuality] || 0;
  if (vpAdj !== 0) {
    bufferPct += vpAdj;
    const sign = vpAdj > 0 ? '+' : '';
    adjustments.push(`${vpQuality} VP: ${sign}${vpAdj.toFixed(2)}%`);
  }

  // Volatility adjustment (veća vol = VEĆI buffer!)
  const volAdj = CONFIG.buffer.adjustments.volatility[volRegime] || 0;
  if (volAdj !== 0) {
    bufferPct += volAdj;
    const sign = volAdj > 0 ? '+' : '';
    adjustments.push(`${volRegime} vol: ${sign}${volAdj.toFixed(2)}%`);
  }

  // Ensure within limits
  bufferPct = Math.max(bufferPct, CONFIG.buffer.minimum);
  bufferPct = Math.min(bufferPct, CONFIG.buffer.safe);

  return {
    bufferPct: bufferPct,
    adjustments: adjustments
  };
}

//===============================================================================
// 🎯 CALCULATE OPTIMAL LEVERAGE - MAXIMUM SAFE!
//===============================================================================

function calculateOptimalLeverage(coin) {
  const entryPrice = coin.entry_price || coin.price || 0;
  const stopLoss = coin.stop_loss || 0;
  const slDistancePct = coin.stop_loss_pct || 0;
  const side = coin.side || "BUY";

  if (entryPrice <= 0 || stopLoss <= 0 || slDistancePct <= 0) {
    return null;
  }

  const reasoning = [];

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Calculate optimal buffer (dynamic based on setup quality!)
  // ═══════════════════════════════════════════════════════════════════════

  const bufferResult = calculateOptimalBuffer(coin);
  const bufferPct = bufferResult.bufferPct;

  reasoning.push(`🛡️  Buffer calculation (base ${CONFIG.buffer.base}%):`);
  if (bufferResult.adjustments.length > 0) {
    bufferResult.adjustments.forEach(adj => reasoning.push(`   └─ ${adj}`));
  }
  reasoning.push(`   💎 Final buffer: ${bufferPct.toFixed(2)}%`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Calculate MAXIMUM safe leverage
  // ═══════════════════════════════════════════════════════════════════════

  const maxSafeLeverage = calculateMaxSafeLeverage(entryPrice, stopLoss, side, bufferPct);

  reasoning.push(`📐 MAX SAFE: ${maxSafeLeverage}x (SL ${slDistancePct.toFixed(2)}% + buffer ${bufferPct.toFixed(2)}%)`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Apply safety factor (93-95% od max safe)
  // ═══════════════════════════════════════════════════════════════════════

  let finalLeverage = Math.floor(maxSafeLeverage * CONFIG.safety_factor);

  reasoning.push(`🎯 Applied safety factor: ${maxSafeLeverage}x × ${(CONFIG.safety_factor * 100).toFixed(0)}% = ${finalLeverage}x`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Apply hard limits
  // ═══════════════════════════════════════════════════════════════════════

  const exchangeMax = coin.data?.maxLeverage || 75;
  const beforeCaps = finalLeverage;

  finalLeverage = Math.min(finalLeverage, CONFIG.system_max_leverage);
  finalLeverage = Math.min(finalLeverage, exchangeMax);
  finalLeverage = Math.max(finalLeverage, CONFIG.system_min_leverage);

  if (finalLeverage !== beforeCaps) {
    const caps = [];
    if (finalLeverage === CONFIG.system_max_leverage) caps.push(`system ${CONFIG.system_max_leverage}x`);
    if (finalLeverage === exchangeMax) caps.push(`exchange ${exchangeMax}x`);

    reasoning.push(`🔒 Capped: ${beforeCaps}x → ${finalLeverage}x (${caps.join(', ')})`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Final validation
  // ═══════════════════════════════════════════════════════════════════════

  const finalLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const finalLiqDistancePct = getLiqDistancePct(entryPrice, finalLiqPrice, side);
  const actualBufferPct = finalLiqDistancePct - slDistancePct;

  reasoning.push(`💀 Liquidation: ${finalLiqPrice.toFixed(6)} (${finalLiqDistancePct.toFixed(2)}% from entry)`);
  reasoning.push(`✅ Actual buffer: ${actualBufferPct.toFixed(2)}% (Liq ${finalLiqDistancePct.toFixed(2)}% - SL ${slDistancePct.toFixed(2)}%)`);

  // Safety check
  if (actualBufferPct < CONFIG.buffer.minimum) {
    reasoning.push(`⚠️ UNSAFE! Buffer ${actualBufferPct.toFixed(2)}% < minimum ${CONFIG.buffer.minimum}%`);

    // Recalculate with minimum buffer
    const saferMax = calculateMaxSafeLeverage(entryPrice, stopLoss, side, CONFIG.buffer.minimum);
    finalLeverage = Math.floor(saferMax * CONFIG.safety_factor);
    finalLeverage = Math.max(finalLeverage, CONFIG.system_min_leverage);

    reasoning.push(`🔧 RECALCULATED: ${finalLeverage}x (enforcing ${CONFIG.buffer.minimum}% minimum)`);
  }

  // Recalculate true values
  const trueLiqPrice = calculateLiquidationPrice(entryPrice, finalLeverage, side);
  const trueLiqDistancePct = getLiqDistancePct(entryPrice, trueLiqPrice, side);
  const trueBufferPct = trueLiqDistancePct - slDistancePct;

  // Calculate leverage efficiency
  const leverageEfficiency = (finalLeverage / maxSafeLeverage) * 100;

  reasoning.push(`📊 Efficiency: ${leverageEfficiency.toFixed(1)}% of max safe (${finalLeverage}x / ${maxSafeLeverage}x)`);

  return {
    leverage: finalLeverage,
    liquidation_price: trueLiqPrice,
    liquidation_distance_pct: trueLiqDistancePct,
    liq_buffer_pct: trueBufferPct,
    max_safe_leverage: maxSafeLeverage,
    leverage_efficiency_pct: leverageEfficiency,
    buffer_used_pct: bufferPct,
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

  // Critical: Buffer check
  if (leverageResult.liq_buffer_pct < CONFIG.buffer.minimum) {
    issues.push(`❌ Buffer ${leverageResult.liq_buffer_pct.toFixed(2)}% < minimum ${CONFIG.buffer.minimum}%`);
  }

  // Critical: Liq vs SL
  const side = coin.side;
  const liq = leverageResult.liquidation_price;
  const sl = coin.stop_loss;

  if (side === "BUY" && liq >= sl) {
    issues.push(`❌ CRITICAL: Liq (${liq.toFixed(6)}) ≥ SL (${sl.toFixed(6)})`);
  } else if (side === "SELL" && liq <= sl) {
    issues.push(`❌ CRITICAL: Liq (${liq.toFixed(6)}) ≤ SL (${sl.toFixed(6)})`);
  }

  // Info: Efficiency
  if (leverageResult.leverage_efficiency_pct < 80) {
    warnings.push(`ℹ️ Low efficiency: ${leverageResult.leverage_efficiency_pct.toFixed(1)}% of max safe`);
  }

  // Warning: High ROI risk
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

console.log(`\n⚡ LEVERAGE FINDER ULTIMATE V5.0 - MAXIMUM SAFE LEVERAGE`);
console.log(`   Strategy: Find MAX safe leverage for each trade!`);
console.log(`   Uži SL = Veći leverage | Širi SL = Manji leverage`);
console.log(`   Processing ${candidates.length} candidates\n`);

let stats = {
  total: 0,
  processed: 0,
  failed: 0,
  leverage_under_6: 0,
  leverage_6_to_10: 0,
  leverage_11_to_15: 0,
  leverage_over_15: 0,
  total_leverage: 0,
  max_leverage: 0,
  min_leverage: 999
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

  console.log(`\n⚡ ${coin.symbol} ${coin.side} (SL: ${coin.stop_loss_pct.toFixed(2)}%)`);

  const leverageResult = calculateOptimalLeverage(coin);

  if (!leverageResult) {
    console.log(`   ❌ Could not calculate`);
    stats.failed++;
    processedCoins.push({
      ...coin,
      leverage_status: "FAILED",
      leverage_error: "Calculation failed"
    });
    continue;
  }

  console.log(`   🎯 LEVERAGE: ${leverageResult.leverage}x (max safe: ${leverageResult.max_safe_leverage}x)`);
  console.log(`   💀 Liq: ${leverageResult.liquidation_price.toFixed(6)} (${leverageResult.liquidation_distance_pct.toFixed(2)}%)`);
  console.log(`   🛡️  Buffer: ${leverageResult.liq_buffer_pct.toFixed(2)}%`);
  console.log(`   📊 Efficiency: ${leverageResult.leverage_efficiency_pct.toFixed(1)}%`);

  const positionMetrics = calculatePositionMetrics(coin, leverageResult);

  console.log(`   💰 Exposure: ${positionMetrics.exposure_usdt.toFixed(0)} USDT`);

  const validation = validateLeverageSafety(coin, leverageResult, positionMetrics);

  if (!validation.safe) {
    console.log(`   ❌ SAFETY ISSUES:`);
    validation.issues.forEach(issue => console.log(`      ${issue}`));
  }

  validation.warnings.forEach(warn => console.log(`   ${warn}`));

  // Track stats
  stats.total_leverage += leverageResult.leverage;
  stats.max_leverage = Math.max(stats.max_leverage, leverageResult.leverage);
  stats.min_leverage = Math.min(stats.min_leverage, leverageResult.leverage);

  if (leverageResult.leverage < 6) stats.leverage_under_6++;
  else if (leverageResult.leverage <= 10) stats.leverage_6_to_10++;
  else if (leverageResult.leverage <= 15) stats.leverage_11_to_15++;
  else stats.leverage_over_15++;

  processedCoins.push({
    ...coin,
    leverage: leverageResult.leverage,
    leverage_reasoning: leverageResult.reasoning,
    liquidation_price: leverageResult.liquidation_price,
    liquidation_distance_pct: leverageResult.liquidation_distance_pct,
    liq_buffer_pct: leverageResult.liq_buffer_pct,
    leverage_efficiency_pct: leverageResult.leverage_efficiency_pct,
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
      buffer_used_pct: leverageResult.buffer_used_pct,
      safety_factor: CONFIG.safety_factor,
      mmr: leverageResult.mmr,
      system_max: CONFIG.system_max_leverage
    }
  });

  stats.processed++;
}

//===============================================================================
// 📊 SUMMARY OUTPUT
//===============================================================================

const avgLeverage = stats.processed > 0 ? stats.total_leverage / stats.processed : 0;

console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`⚡ LEVERAGE FINDER V5.0 - MAXIMUM SAFE LEVERAGE`);
console.log(`═══════════════════════════════════════════════════════════════`);
console.log(`   Total candidates: ${stats.total}`);
console.log(`   ✅ Processed: ${stats.processed}`);
console.log(`   ❌ Failed: ${stats.failed}`);
console.log(`\n   📊 LEVERAGE STATISTICS:`);
console.log(`      Average: ${avgLeverage.toFixed(1)}x`);
console.log(`      Range: ${stats.min_leverage}x - ${stats.max_leverage}x`);
console.log(`\n   📈 DISTRIBUTION:`);
console.log(`      <6x: ${stats.leverage_under_6} (wide SL)`);
console.log(`      6-10x: ${stats.leverage_6_to_10}`);
console.log(`      11-15x: ${stats.leverage_11_to_15}`);
console.log(`      >15x: ${stats.leverage_over_15} (tight SL)`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (processedCoins.length > 0) {
  console.log(`✅ TOP 5 (by alpha):\n`);
  const successful = processedCoins.filter(c => c.leverage_status === "SUCCESS");
  const sortedByAlpha = [...successful].sort((a, b) => (b.alpha || 0) - (a.alpha || 0));

  sortedByAlpha.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.symbol} ${c.side} - ${c.leverage}x (max safe: ${c._leverage_metadata?.max_safe_leverage}x)`);
    console.log(`   💰 ${c.position_exposure_usdt?.toFixed(0)} USDT | SL: ${c.stop_loss_pct?.toFixed(2)}% | Buffer: ${c.liq_buffer_pct?.toFixed(2)}%`);
    console.log(`   📊 Efficiency: ${c.leverage_efficiency_pct?.toFixed(1)}%\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} coins to Trade Selector\n`);

return processedCoins.map(coin => ({ json: coin }));
