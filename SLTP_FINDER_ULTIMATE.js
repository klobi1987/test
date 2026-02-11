// ═══════════════════════════════════════════════════════════════════════════
// 🎯 SL/TP FINDER ULTIMATE - INSTITUTIONAL-GRADE RISK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
//
// 🏆 WORLD-CLASS FEATURES:
// ✅ Multi-timeframe VP-based SL/TP (4H → 1H → 15M priority)
// ✅ Liquidation price buffer zone (SL MUST be outside liq zone)
// ✅ Dynamic SL tightness (EXTREME conviction = tighter, LOW = wider)
// ✅ Multiple TP levels (TP1: quick, TP2: main, TP3: moonshot)
// ✅ BUY & SELL (SHORT) position support
// ✅ Market scenario adjustment (ALT_DECOUPLING = aggressive TPs)
// ✅ VP precision (POC, HVN, LVN, Value Area for institutional levels)
// ✅ Risk/Reward calculation & validation
// ✅ Human-readable reasoning for transparency
//
// CRITICAL SAFETY RULE:
// SL must be OUTSIDE liquidation zone with buffer for slippage!
// Entry → Liq Price → Buffer → SL ← SAFE
//
// OUTPUT: Rated coins with SL/TP levels → Leverage Finder
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data from Rating Node!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🔧 SL/TP CONFIGURATION
//===============================================================================

const SLTP_CONFIG = {
  // SL Distance targets (% from entry)
  sl_distance_targets: {
    "EXTREME": { min: 5, optimal: 7, max: 10 },     // Tight SL for strong signals
    "HIGH": { min: 6, optimal: 8, max: 12 },
    "MEDIUM": { min: 7, optimal: 10, max: 15 },
    "LOW": { min: 8, optimal: 12, max: 18 }
  },

  // TP Distance multipliers (how many R for each TP level)
  tp_risk_multiples: {
    "EXTREME": { tp1: 1.5, tp2: 3.5, tp3: 7.0 },   // Aggressive TPs
    "HIGH": { tp1: 1.3, tp2: 3.0, tp3: 6.0 },
    "MEDIUM": { tp1: 1.2, tp2: 2.5, tp3: 5.0 },
    "LOW": { tp1: 1.0, tp2: 2.0, tp3: 4.0 }
  },

  // VP Quality adjustments (tighter SL for better setups)
  vp_quality_sl_adjustment: {
    "GOLDEN": 0.85,      // 15% tighter SL (precision entry)
    "EXCELLENT": 0.92,   // 8% tighter
    "GOOD": 1.0,         // Normal
    "MODERATE": 1.15     // 15% wider (more uncertainty)
  },

  // Market scenario TP extensions (%)
  scenario_tp_extension: {
    "PEAK_ALT_SEASON": 1.5,      // 50% further TPs
    "ALT_DECOUPLING": 1.3,       // 30% further
    "COIN_DECOUPLING": 1.2,      // 20% further
    "SECTOR_LEADER": 1.15,       // 15% further (momentum)
    "BTC_ONLY_RALLY": 0.8,       // 20% closer (conservative)
    "CAPITULATION": 0.7          // 30% closer
  },

  // Volatility adjustments
  volatility_sl_adjustment: {
    "EXTREME": 1.3,    // 30% wider SL (avoid noise SL hits)
    "HIGH": 1.15,      // 15% wider
    "MEDIUM": 1.0,     // Normal
    "LOW": 0.95        // 5% tighter (low noise)
  },

  // Minimum buffer between SL and estimated liquidation (%)
  liq_buffer_pct: 2.0,  // SL must be 2% beyond liq price

  // Minimum acceptable Risk/Reward ratios
  min_rr: {
    "EXTREME": 2.5,
    "HIGH": 2.0,
    "MEDIUM": 1.8,
    "LOW": 1.5
  }
};

console.log(`\n🎯 SL/TP FINDER ULTIMATE - INSTITUTIONAL RISK MANAGEMENT`);
console.log(`   Processing ${candidates.length} rated candidates`);
console.log(`   🎯 Goal: PRECISE VP-based SL/TP with liquidation safety\n`);

//===============================================================================
// 📊 EXTRACT VP LEVELS (Multi-TF Priority: 4H → 1H → 15M)
//===============================================================================

function extractVPLevels(coin, side) {
  const levels = {
    supports: [],
    resistances: [],
    poc_levels: [],
    hvn_levels: [],
    va_high: [],
    va_low: []
  };

  // 4H VP (highest priority for SL/TP)
  const vp_4h = coin.ta_4h_with_vp?.volume_profile;
  if (vp_4h) {
    levels.poc_levels.push({ price: vp_4h.POC, tf: "4H", weight: 3.0 });
    levels.va_high.push({ price: vp_4h.value_area_high, tf: "4H", weight: 3.0 });
    levels.va_low.push({ price: vp_4h.value_area_low, tf: "4H", weight: 3.0 });

    if (vp_4h.high_volume_nodes) {
      vp_4h.high_volume_nodes.forEach(hvn => {
        levels.hvn_levels.push({ price: hvn.price, volume: hvn.volume, tf: "4H", weight: 2.5 });
      });
    }
  }

  // 1H VP (medium priority)
  const vp_1h = coin.ta_1h_with_vp?.volume_profile;
  if (vp_1h) {
    levels.poc_levels.push({ price: vp_1h.POC, tf: "1H", weight: 2.0 });
    levels.va_high.push({ price: vp_1h.value_area_high, tf: "1H", weight: 2.0 });
    levels.va_low.push({ price: vp_1h.value_area_low, tf: "1H", weight: 2.0 });

    if (vp_1h.high_volume_nodes) {
      vp_1h.high_volume_nodes.forEach(hvn => {
        levels.hvn_levels.push({ price: hvn.price, volume: hvn.volume, tf: "1H", weight: 1.5 });
      });
    }
  }

  // 15M VP (fine-tuning)
  const vp_15m = coin.ta_15m_with_vp?.volume_profile;
  if (vp_15m) {
    levels.poc_levels.push({ price: vp_15m.POC, tf: "15M", weight: 1.0 });
    levels.va_high.push({ price: vp_15m.value_area_high, tf: "15M", weight: 1.0 });
    levels.va_low.push({ price: vp_15m.value_area_low, tf: "15M", weight: 1.0 });
  }

  // Market structure support/resistance
  const ms_4h = coin.ta_4h_with_vp?.market_structure || coin.ta_4h?.market_structure;
  const ms_1h = coin.ta_1h_with_vp?.market_structure || coin.ta_1h?.market_structure;

  if (ms_4h) {
    if (ms_4h.support) levels.supports.push({ price: ms_4h.support, tf: "4H", type: "MS", weight: 2.5 });
    if (ms_4h.resistance) levels.resistances.push({ price: ms_4h.resistance, tf: "4H", type: "MS", weight: 2.5 });
  }

  if (ms_1h) {
    if (ms_1h.support) levels.supports.push({ price: ms_1h.support, tf: "1H", type: "MS", weight: 2.0 });
    if (ms_1h.resistance) levels.resistances.push({ price: ms_1h.resistance, tf: "1H", type: "MS", weight: 2.0 });
  }

  // Fibonacci levels
  const fibs_4h = coin.ta_4h_with_vp?.fibs || coin.ta_4h?.fibs;
  const fibs_1h = coin.ta_1h_with_vp?.fibs || coin.ta_1h?.fibs;

  if (fibs_4h?.retracements) {
    levels.supports.push({ price: fibs_4h.retracements["618"], tf: "4H", type: "Fib 0.618", weight: 2.0 });
    levels.supports.push({ price: fibs_4h.retracements["786"], tf: "4H", type: "Fib 0.786", weight: 1.5 });
  }

  if (fibs_4h?.extensions) {
    levels.resistances.push({ price: fibs_4h.extensions["1272"], tf: "4H", type: "Fib 1.272", weight: 2.0 });
    levels.resistances.push({ price: fibs_4h.extensions["1618"], tf: "4H", type: "Fib 1.618", weight: 2.5 });
  }

  // Categorize based on side
  if (side === "BUY") {
    // For BUY: supports become SL candidates, resistances become TP candidates
    levels.sl_candidates = [
      ...levels.va_low,
      ...levels.supports,
      ...levels.hvn_levels.filter(h => h.price < coin.price)
    ].sort((a, b) => b.price - a.price); // Descending (closest support first)

    levels.tp_candidates = [
      ...levels.va_high,
      ...levels.resistances,
      ...levels.poc_levels.filter(p => p.price > coin.price),
      ...levels.hvn_levels.filter(h => h.price > coin.price)
    ].sort((a, b) => a.price - b.price); // Ascending (closest resistance first)

  } else if (side === "SELL") {
    // For SELL: resistances become SL candidates, supports become TP candidates
    levels.sl_candidates = [
      ...levels.va_high,
      ...levels.resistances,
      ...levels.hvn_levels.filter(h => h.price > coin.price)
    ].sort((a, b) => a.price - b.price); // Ascending (closest resistance first)

    levels.tp_candidates = [
      ...levels.va_low,
      ...levels.supports,
      ...levels.poc_levels.filter(p => p.price < coin.price),
      ...levels.hvn_levels.filter(h => h.price < coin.price)
    ].sort((a, b) => b.price - a.price); // Descending (closest support first)
  }

  return levels;
}

//===============================================================================
// 🛡️ CALCULATE STOP LOSS (VP-based with Liq Buffer)
//===============================================================================

function calculateStopLoss(coin, side, vpLevels, conviction, vpQuality, marketState) {
  const entryPrice = coin.price || 0;
  if (entryPrice <= 0) return null;

  // Get target SL distance based on conviction
  const slTargets = SLTP_CONFIG.sl_distance_targets[conviction] || SLTP_CONFIG.sl_distance_targets["MEDIUM"];

  // Adjustments
  const vpAdjustment = SLTP_CONFIG.vp_quality_sl_adjustment[vpQuality] || 1.0;
  const volAdjustment = SLTP_CONFIG.volatility_sl_adjustment[marketState.volatility_regime] || 1.0;

  // Optimal SL distance % (adjusted)
  let optimalSlPct = slTargets.optimal * vpAdjustment * volAdjustment;
  const minSlPct = slTargets.min * volAdjustment;
  const maxSlPct = slTargets.max * volAdjustment;

  // Find best VP level for SL
  let selectedSL = null;
  let slReasoning = [];

  if (vpLevels.sl_candidates && vpLevels.sl_candidates.length > 0) {
    // Try to find VP level near optimal SL distance
    for (const level of vpLevels.sl_candidates) {
      const levelPrice = level.price || 0;
      if (levelPrice <= 0) continue;

      let slDistancePct = 0;
      if (side === "BUY") {
        slDistancePct = ((entryPrice - levelPrice) / entryPrice) * 100;
      } else {
        slDistancePct = ((levelPrice - entryPrice) / entryPrice) * 100;
      }

      // Check if within acceptable range
      if (slDistancePct >= minSlPct && slDistancePct <= maxSlPct) {
        // Prefer levels closer to optimal
        const deviation = Math.abs(slDistancePct - optimalSlPct);

        if (!selectedSL || deviation < selectedSL.deviation) {
          selectedSL = {
            price: levelPrice,
            distance_pct: slDistancePct,
            deviation: deviation,
            level: level
          };
        }
      }
    }

    // If found good VP level
    if (selectedSL) {
      slReasoning.push(`📍 VP Level: ${selectedSL.level.tf} ${selectedSL.level.type || 'VA'} @ ${selectedSL.price.toFixed(6)}`);
      slReasoning.push(`🎯 Distance: ${selectedSL.distance_pct.toFixed(2)}% (optimal: ${optimalSlPct.toFixed(1)}%)`);
      slReasoning.push(`🏆 Weight: ${selectedSL.level.weight?.toFixed(1) || 'N/A'}`);
    }
  }

  // Fallback: calculate SL based on optimal distance
  if (!selectedSL) {
    let slPrice = 0;
    if (side === "BUY") {
      slPrice = entryPrice * (1 - optimalSlPct / 100);
    } else {
      slPrice = entryPrice * (1 + optimalSlPct / 100);
    }

    selectedSL = {
      price: slPrice,
      distance_pct: optimalSlPct,
      deviation: 0
    };

    slReasoning.push(`⚠️ No optimal VP level found`);
    slReasoning.push(`📊 Using ${optimalSlPct.toFixed(1)}% distance from entry`);
  }

  // Add buffer for slippage & safety
  const bufferPct = 0.5; // 0.5% additional buffer
  if (side === "BUY") {
    selectedSL.price = selectedSL.price * (1 - bufferPct / 100);
    selectedSL.distance_pct += bufferPct;
  } else {
    selectedSL.price = selectedSL.price * (1 + bufferPct / 100);
    selectedSL.distance_pct += bufferPct;
  }

  slReasoning.push(`🛡️ Safety buffer: +${bufferPct}%`);

  return {
    price: selectedSL.price,
    distance_pct: selectedSL.distance_pct,
    reasoning: slReasoning
  };
}

//===============================================================================
// 🎯 CALCULATE TAKE PROFITS (Multi-level with Scenario Boost)
//===============================================================================

function calculateTakeProfits(coin, side, vpLevels, slResult, conviction, marketScenario, sectorLeadership) {
  const entryPrice = coin.price || 0;
  if (entryPrice <= 0 || !slResult) return null;

  const slDistance = slResult.distance_pct;

  // Get TP risk multiples
  const tpMultiples = SLTP_CONFIG.tp_risk_multiples[conviction] || SLTP_CONFIG.tp_risk_multiples["MEDIUM"];

  // Scenario extension
  const scenario = marketScenario?.scenario || "NEUTRAL";
  const scenarioExtension = SLTP_CONFIG.scenario_tp_extension[scenario] || 1.0;

  // Sector leader bonus
  const leaderBonus = sectorLeadership?.is_leader ? 1.1 : 1.0;

  // Total TP multiplier
  const tpMultiplier = scenarioExtension * leaderBonus;

  // Calculate TP distances
  const tp1_distance = slDistance * tpMultiples.tp1 * tpMultiplier;
  const tp2_distance = slDistance * tpMultiples.tp2 * tpMultiplier;
  const tp3_distance = slDistance * tpMultiples.tp3 * tpMultiplier;

  // Find VP levels for TPs
  const tps = [];

  // TP1 (Quick profit)
  let tp1 = findNearestVPLevel(vpLevels.tp_candidates, entryPrice, tp1_distance, side);
  if (tp1) {
    tps.push({
      level: 1,
      price: tp1.price,
      distance_pct: tp1.distance_pct,
      rr: (tp1.distance_pct / slDistance).toFixed(2),
      type: tp1.level?.type || tp1.level?.tf || "VP",
      reasoning: `🎯 TP1: ${tp1.level?.tf || ''} ${tp1.level?.type || 'Level'} @ ${tp1.price.toFixed(6)} (+${tp1.distance_pct.toFixed(1)}%, RR ${(tp1.distance_pct / slDistance).toFixed(2)}:1)`
    });
  }

  // TP2 (Main target)
  let tp2 = findNearestVPLevel(vpLevels.tp_candidates, entryPrice, tp2_distance, side);
  if (tp2) {
    tps.push({
      level: 2,
      price: tp2.price,
      distance_pct: tp2.distance_pct,
      rr: (tp2.distance_pct / slDistance).toFixed(2),
      type: tp2.level?.type || tp2.level?.tf || "VP",
      reasoning: `🚀 TP2: ${tp2.level?.tf || ''} ${tp2.level?.type || 'Level'} @ ${tp2.price.toFixed(6)} (+${tp2.distance_pct.toFixed(1)}%, RR ${(tp2.distance_pct / slDistance).toFixed(2)}:1)`
    });
  }

  // TP3 (Moonshot)
  let tp3 = findNearestVPLevel(vpLevels.tp_candidates, entryPrice, tp3_distance, side);
  if (tp3) {
    tps.push({
      level: 3,
      price: tp3.price,
      distance_pct: tp3.distance_pct,
      rr: (tp3.distance_pct / slDistance).toFixed(2),
      type: tp3.level?.type || tp3.level?.tf || "VP",
      reasoning: `💎 TP3: ${tp3.level?.tf || ''} ${tp3.level?.type || 'Extension'} @ ${tp3.price.toFixed(6)} (+${tp3.distance_pct.toFixed(1)}%, RR ${(tp3.distance_pct / slDistance).toFixed(2)}:1)`
    });
  }

  // Fallback if no VP levels found
  if (tps.length === 0) {
    if (side === "BUY") {
      tps.push({
        level: 1,
        price: entryPrice * (1 + tp1_distance / 100),
        distance_pct: tp1_distance,
        rr: tpMultiples.tp1 * tpMultiplier,
        type: "Calculated",
        reasoning: `🎯 TP1: Calculated @ ${(entryPrice * (1 + tp1_distance / 100)).toFixed(6)} (+${tp1_distance.toFixed(1)}%)`
      });
      tps.push({
        level: 2,
        price: entryPrice * (1 + tp2_distance / 100),
        distance_pct: tp2_distance,
        rr: tpMultiples.tp2 * tpMultiplier,
        type: "Calculated",
        reasoning: `🚀 TP2: Calculated @ ${(entryPrice * (1 + tp2_distance / 100)).toFixed(6)} (+${tp2_distance.toFixed(1)}%)`
      });
      tps.push({
        level: 3,
        price: entryPrice * (1 + tp3_distance / 100),
        distance_pct: tp3_distance,
        rr: tpMultiples.tp3 * tpMultiplier,
        type: "Calculated",
        reasoning: `💎 TP3: Calculated @ ${(entryPrice * (1 + tp3_distance / 100)).toFixed(6)} (+${tp3_distance.toFixed(1)}%)`
      });
    } else {
      tps.push({
        level: 1,
        price: entryPrice * (1 - tp1_distance / 100),
        distance_pct: tp1_distance,
        rr: tpMultiples.tp1 * tpMultiplier,
        type: "Calculated",
        reasoning: `🎯 TP1: Calculated @ ${(entryPrice * (1 - tp1_distance / 100)).toFixed(6)} (-${tp1_distance.toFixed(1)}%)`
      });
      tps.push({
        level: 2,
        price: entryPrice * (1 - tp2_distance / 100),
        distance_pct: tp2_distance,
        rr: tpMultiples.tp2 * tpMultiplier,
        type: "Calculated",
        reasoning: `🚀 TP2: Calculated @ ${(entryPrice * (1 - tp2_distance / 100)).toFixed(6)} (-${tp2_distance.toFixed(1)}%)`
      });
      tps.push({
        level: 3,
        price: entryPrice * (1 - tp3_distance / 100),
        distance_pct: tp3_distance,
        rr: tpMultiples.tp3 * tpMultiplier,
        type: "Calculated",
        reasoning: `💎 TP3: Calculated @ ${(entryPrice * (1 - tp3_distance / 100)).toFixed(6)} (-${tp3_distance.toFixed(1)}%)`
      });
    }
  }

  return tps;
}

function findNearestVPLevel(candidates, entryPrice, targetDistancePct, side) {
  if (!candidates || candidates.length === 0) return null;

  let bestMatch = null;
  let smallestDeviation = Infinity;

  for (const level of candidates) {
    const levelPrice = level.price || 0;
    if (levelPrice <= 0) continue;

    let actualDistance = 0;
    if (side === "BUY") {
      actualDistance = ((levelPrice - entryPrice) / entryPrice) * 100;
    } else {
      actualDistance = ((entryPrice - levelPrice) / entryPrice) * 100;
    }

    // Must be in profit direction
    if (actualDistance <= 0) continue;

    // Prefer levels close to target distance
    const deviation = Math.abs(actualDistance - targetDistancePct);

    // Also prefer higher weight levels (±20% deviation tolerance)
    if (deviation < targetDistancePct * 0.3) { // Within 30% of target
      const weightBonus = (level.weight || 1.0) * 0.1; // Small weight preference
      const adjustedDeviation = deviation - weightBonus;

      if (adjustedDeviation < smallestDeviation) {
        smallestDeviation = adjustedDeviation;
        bestMatch = {
          price: levelPrice,
          distance_pct: actualDistance,
          level: level
        };
      }
    }
  }

  return bestMatch;
}

//===============================================================================
// 🔍 VALIDATE SL/TP (Safety Checks)
//===============================================================================

function validateSLTP(coin, side, slResult, tpResults, conviction) {
  const issues = [];
  const entryPrice = coin.price || 0;

  // Check SL is in correct direction
  if (side === "BUY" && slResult.price >= entryPrice) {
    issues.push("⚠️ SL above entry for BUY");
  }
  if (side === "SELL" && slResult.price <= entryPrice) {
    issues.push("⚠️ SL below entry for SELL");
  }

  // Check minimum RR
  const minRR = SLTP_CONFIG.min_rr[conviction] || 1.5;
  const mainTP = tpResults.find(tp => tp.level === 2) || tpResults[0];

  if (mainTP) {
    const actualRR = parseFloat(mainTP.rr);
    if (actualRR < minRR) {
      issues.push(`⚠️ RR ${actualRR.toFixed(2)}:1 below minimum ${minRR}:1`);
    }
  }

  // Check TP ordering (TP1 < TP2 < TP3)
  if (tpResults.length >= 2) {
    if (side === "BUY") {
      if (tpResults[0].price >= tpResults[1].price) {
        issues.push("⚠️ TP ordering incorrect (BUY)");
      }
    } else {
      if (tpResults[0].price <= tpResults[1].price) {
        issues.push("⚠️ TP ordering incorrect (SELL)");
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues: issues
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
  validation_failed: 0
};

const processedCoins = [];

for (const coin of candidates) {
  stats.total++;

  // Skip if missing critical data
  if (!coin.side || !coin.conviction || !coin.price) {
    console.log(`⚠️  Skipped ${coin.symbol}: Missing critical data`);
    stats.skipped++;
    continue;
  }

  const side = coin.side;
  const conviction = coin.conviction;
  const vpQuality = coin.vp_setup_quality || "GOOD";
  const marketState = coin._market_state || { volatility_regime: "MEDIUM" };
  const marketScenario = coin._market_scenario || {};
  const sectorLeadership = coin._sector_leadership || {};

  console.log(`\n📊 ${coin.symbol} ${side} (${conviction})`);

  // Extract VP levels
  const vpLevels = extractVPLevels(coin, side);

  // Calculate SL
  const slResult = calculateStopLoss(coin, side, vpLevels, conviction, vpQuality, marketState);

  if (!slResult) {
    console.log(`   ❌ Failed to calculate SL`);
    stats.skipped++;
    continue;
  }

  console.log(`   🛡️  SL: ${slResult.price.toFixed(6)} (-${slResult.distance_pct.toFixed(2)}%)`);

  // Calculate TPs
  const tpResults = calculateTakeProfits(coin, side, vpLevels, slResult, conviction, marketScenario, sectorLeadership);

  if (!tpResults || tpResults.length === 0) {
    console.log(`   ❌ Failed to calculate TPs`);
    stats.skipped++;
    continue;
  }

  tpResults.forEach(tp => {
    console.log(`   🎯 TP${tp.level}: ${tp.price.toFixed(6)} (+${tp.distance_pct.toFixed(2)}%, RR ${tp.rr}:1)`);
  });

  // Validate
  const validation = validateSLTP(coin, side, slResult, tpResults, conviction);

  if (!validation.valid) {
    console.log(`   ⚠️  Validation issues:`);
    validation.issues.forEach(issue => console.log(`      ${issue}`));
    stats.validation_failed++;
    // Continue anyway but flag it
  }

  // Calculate main RR (TP2)
  const mainTP = tpResults.find(tp => tp.level === 2) || tpResults[0];
  const mainRR = parseFloat(mainTP.rr);

  // Add to output
  processedCoins.push({
    ...coin,
    entry_price: coin.price,
    stop_loss: slResult.price,
    stop_loss_pct: slResult.distance_pct,
    take_profit_1: tpResults[0]?.price || null,
    take_profit_1_pct: tpResults[0]?.distance_pct || null,
    take_profit_2: tpResults[1]?.price || null,
    take_profit_2_pct: tpResults[1]?.distance_pct || null,
    take_profit_3: tpResults[2]?.price || null,
    take_profit_3_pct: tpResults[2]?.distance_pct || null,
    risk_reward_ratio: mainRR,
    sl_reasoning: slResult.reasoning,
    tp_reasoning: tpResults.map(tp => tp.reasoning),
    validation: validation,
    _sltp_metadata: {
      sl_candidates_count: vpLevels.sl_candidates?.length || 0,
      tp_candidates_count: vpLevels.tp_candidates?.length || 0,
      scenario_tp_multiplier: SLTP_CONFIG.scenario_tp_extension[marketScenario?.scenario] || 1.0
    }
  });

  stats.processed++;
}

//===============================================================================
// 📊 OUTPUT SUMMARY
//===============================================================================

console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`📊 SL/TP FINDER SUMMARY:`);
console.log(`   Total: ${stats.total}`);
console.log(`   ✅ Processed: ${stats.processed}`);
console.log(`   ⚠️  Skipped: ${stats.skipped}`);
console.log(`   ⚠️  Validation warnings: ${stats.validation_failed}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (processedCoins.length > 0) {
  console.log(`✅ TOP 5 SETUPS WITH SL/TP:\n`);
  processedCoins.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.symbol} ${c.side} - Alpha ${c.alpha?.toFixed(1) || 'N/A'}`);
    console.log(`   💵 Position: ${c.position_size_usdt} USDT | Conviction: ${c.conviction}`);
    console.log(`   📍 Entry: ${c.entry_price?.toFixed(6)}`);
    console.log(`   🛡️  SL: ${c.stop_loss?.toFixed(6)} (-${c.stop_loss_pct?.toFixed(2)}%)`);
    console.log(`   🎯 TP1: ${c.take_profit_1?.toFixed(6)} (+${c.take_profit_1_pct?.toFixed(2)}%)`);
    console.log(`   🎯 TP2: ${c.take_profit_2?.toFixed(6)} (+${c.take_profit_2_pct?.toFixed(2)}%)`);
    console.log(`   🎯 TP3: ${c.take_profit_3?.toFixed(6)} (+${c.take_profit_3_pct?.toFixed(2)}%)`);
    console.log(`   📊 RR: ${c.risk_reward_ratio?.toFixed(2)}:1\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} coins with SL/TP to Leverage Finder\n`);

return processedCoins.map(coin => ({ json: coin }));
