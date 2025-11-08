// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 SL/TP FINDER V2 - LIQUIDITY SWEEP PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════
//
// 🆕 V2 Changes from V1:
// ✅ SL placed BELOW support (not ON support) to avoid liquidity sweeps
// ✅ ATR-based minimum distance (avoid noise stop-outs)
// ✅ Sweep buffer for popular levels (4H VA, POC = obvious sweep targets)
// ✅ Multi-level validation (check for strong support BELOW proposed SL)
// ✅ Dynamic safety buffer based on volatility (not fixed 0.5%)
//
// 🔴 PROBLEM V1: SL placed ON support → easy sweep by MM
// ✅ SOLUTION V2: SL placed BELOW support + sweep protection buffer
//
// Example:
// V1: Support @ 0.8234 → SL @ 0.8234 ❌ (sweep target!)
// V2: Support @ 0.8234 → SL @ 0.8150 ✅ (below + sweep buffer)
//
// ═══════════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data from Rating Node!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🔧 SL/TP CONFIGURATION V2
//===============================================================================

const SLTP_CONFIG = {
  // SL Distance targets (% from entry)
  sl_distance_targets: {
    "EXTREME": { min: 5, optimal: 7, max: 10 },
    "HIGH": { min: 6, optimal: 8, max: 12 },
    "MEDIUM": { min: 7, optimal: 10, max: 15 },
    "LOW": { min: 8, optimal: 12, max: 18 }
  },

  // 🆕 ATR-based minimum SL distance (avoid noise)
  atr_sl_multiplier: {
    "EXTREME": 1.5,  // 1.5× ATR minimum distance
    "HIGH": 1.8,
    "MEDIUM": 2.0,
    "LOW": 2.2
  },

  // 🆕 Sweep protection buffer (% BELOW obvious levels)
  sweep_protection: {
    high_weight_levels: 0.4,    // 4H VA, POC (weight >= 2.5): 0.4% extra below
    medium_weight_levels: 0.25,  // 1H levels (weight 2.0): 0.25% extra
    low_weight_levels: 0.15      // 15M levels (weight < 2.0): 0.15% extra
  },

  // 🆕 Clearance from support (SL must be THIS MUCH below support)
  support_clearance_pct: 0.5,  // Min 0.5% below nearest support

  // TP Distance multipliers
  tp_risk_multiples: {
    "EXTREME": { tp1: 1.5, tp2: 3.5, tp3: 7.0 },
    "HIGH": { tp1: 1.3, tp2: 3.0, tp3: 6.0 },
    "MEDIUM": { tp1: 1.2, tp2: 2.5, tp3: 5.0 },
    "LOW": { tp1: 1.0, tp2: 2.0, tp3: 4.0 }
  },

  // VP Quality adjustments
  vp_quality_sl_adjustment: {
    "GOLDEN": 0.85,
    "EXCELLENT": 0.92,
    "GOOD": 1.0,
    "MODERATE": 1.15
  },

  // 🆕 Dynamic safety buffer (based on volatility, not fixed!)
  volatility_safety_buffer: {
    "EXTREME": 1.0,   // 1.0% extra for slippage
    "HIGH": 0.75,     // 0.75% extra
    "MEDIUM": 0.5,    // 0.5% extra
    "LOW": 0.3        // 0.3% extra
  },

  // Volatility adjustments to base SL distance
  volatility_sl_adjustment: {
    "EXTREME": 1.3,
    "HIGH": 1.15,
    "MEDIUM": 1.0,
    "LOW": 0.95
  },

  // Market scenario TP extensions
  scenario_tp_extension: {
    "PEAK_ALT_SEASON": 1.5,
    "ALT_DECOUPLING": 1.3,
    "COIN_DECOUPLING": 1.2,
    "SECTOR_LEADER": 1.15,
    "BTC_ONLY_RALLY": 0.8,
    "CAPITULATION": 0.7
  },

  // Minimum acceptable Risk/Reward ratios
  min_rr: {
    "EXTREME": 2.5,
    "HIGH": 2.0,
    "MEDIUM": 1.8,
    "LOW": 1.5
  }
};

console.log(`\n🎯 SL/TP FINDER V2 - LIQUIDITY SWEEP PROTECTION`);
console.log(`   Processing ${candidates.length} rated candidates`);
console.log(`   🛡️  NEW: SL placed BELOW support to avoid sweeps\n`);

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

  // 4H VP (highest priority)
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

  // 1H VP
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

  // 15M VP
  const vp_15m = coin.ta_15m_with_vp?.volume_profile;
  if (vp_15m) {
    levels.poc_levels.push({ price: vp_15m.POC, tf: "15M", weight: 1.0 });
    levels.va_high.push({ price: vp_15m.value_area_high, tf: "15M", weight: 1.0 });
    levels.va_low.push({ price: vp_15m.value_area_low, tf: "15M", weight: 1.0 });
  }

  // Market structure
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

  if (fibs_4h?.retracements) {
    levels.supports.push({ price: fibs_4h.retracements["618"], tf: "4H", type: "Fib 0.618", weight: 2.0 });
    levels.supports.push({ price: fibs_4h.retracements["786"], tf: "4H", type: "Fib 0.786", weight: 1.5 });
  }

  if (fibs_4h?.extensions) {
    levels.resistances.push({ price: fibs_4h.extensions["1272"], tf: "4H", type: "Fib 1.272", weight: 2.0 });
    levels.resistances.push({ price: fibs_4h.extensions["1618"], tf: "4H", type: "Fib 1.618", weight: 2.5 });
  }

  // 🆕 Categorize ALL support/resistance levels
  if (side === "BUY") {
    levels.all_supports = [
      ...levels.va_low,
      ...levels.supports,
      ...levels.hvn_levels.filter(h => h.price < coin.price),
      ...levels.poc_levels.filter(p => p.price < coin.price)
    ].sort((a, b) => b.price - a.price); // Descending (closest first)

    levels.tp_candidates = [
      ...levels.va_high,
      ...levels.resistances,
      ...levels.poc_levels.filter(p => p.price > coin.price),
      ...levels.hvn_levels.filter(h => h.price > coin.price)
    ].sort((a, b) => a.price - b.price); // Ascending

  } else if (side === "SELL") {
    levels.all_supports = [
      ...levels.va_high,
      ...levels.resistances,
      ...levels.hvn_levels.filter(h => h.price > coin.price),
      ...levels.poc_levels.filter(p => p.price > coin.price)
    ].sort((a, b) => a.price - b.price); // Ascending (closest first)

    levels.tp_candidates = [
      ...levels.va_low,
      ...levels.supports,
      ...levels.poc_levels.filter(p => p.price < coin.price),
      ...levels.hvn_levels.filter(h => h.price < coin.price)
    ].sort((a, b) => b.price - a.price); // Descending
  }

  return levels;
}

//===============================================================================
// 🛡️ CALCULATE STOP LOSS V2 (BELOW SUPPORT + SWEEP PROTECTION)
//===============================================================================

function calculateStopLoss(coin, side, vpLevels, conviction, vpQuality, marketState) {
  const entryPrice = coin.price || 0;
  if (entryPrice <= 0) return null;

  console.log(`\n   🔍 Calculating SL for ${coin.symbol} ${side}`);

  // 1️⃣ Get base SL distance targets
  const slTargets = SLTP_CONFIG.sl_distance_targets[conviction] || SLTP_CONFIG.sl_distance_targets["MEDIUM"];

  // 2️⃣ VP & Volatility adjustments
  const vpAdjustment = SLTP_CONFIG.vp_quality_sl_adjustment[vpQuality] || 1.0;
  const volAdjustment = SLTP_CONFIG.volatility_sl_adjustment[marketState.volatility_regime] || 1.0;

  let optimalSlPct = slTargets.optimal * vpAdjustment * volAdjustment;
  const minSlPct = slTargets.min * volAdjustment;
  const maxSlPct = slTargets.max * volAdjustment;

  console.log(`   📊 Base SL: ${slTargets.optimal}% (VP adj: ${vpAdjustment}, Vol adj: ${volAdjustment})`);
  console.log(`   📏 Range: ${minSlPct.toFixed(1)}% - ${maxSlPct.toFixed(1)}% (optimal: ${optimalSlPct.toFixed(1)}%)`);

  // 3️⃣ 🆕 ATR-based MINIMUM distance (avoid noise)
  const atr_4h = coin.ta_4h_with_vp?.atr_14 || coin.ta_4h?.atr_14;
  let atrMinDistance = 0;

  if (atr_4h && atr_4h > 0) {
    const atrMultiplier = SLTP_CONFIG.atr_sl_multiplier[conviction] || 2.0;
    atrMinDistance = (atr_4h / entryPrice) * 100 * atrMultiplier;

    console.log(`   📈 ATR-based min: ${atrMinDistance.toFixed(2)}% (${atrMultiplier}× ATR)`);

    // Enforce ATR minimum
    if (atrMinDistance > minSlPct) {
      console.log(`   ⚡ ATR min (${atrMinDistance.toFixed(2)}%) > config min (${minSlPct.toFixed(1)}%) → using ATR`);
      optimalSlPct = Math.max(optimalSlPct, atrMinDistance);
    }
  }

  // 4️⃣ 🆕 Find support levels and place SL BELOW them
  let selectedSL = null;
  let slReasoning = [];

  if (vpLevels.all_supports && vpLevels.all_supports.length > 0) {
    console.log(`   🔍 Analyzing ${vpLevels.all_supports.length} support levels...`);

    // Strategy: Find support zone, place SL BELOW it
    for (const support of vpLevels.all_supports) {
      const supportPrice = support.price || 0;
      if (supportPrice <= 0) continue;

      // Calculate distance from entry to THIS support
      let supportDistanceFromEntry = 0;
      if (side === "BUY") {
        supportDistanceFromEntry = ((entryPrice - supportPrice) / entryPrice) * 100;
      } else {
        supportDistanceFromEntry = ((supportPrice - entryPrice) / entryPrice) * 100;
      }

      // Skip if support too close (within min range)
      if (supportDistanceFromEntry < minSlPct * 0.8) {
        console.log(`      ⏭️  ${support.tf} ${support.type || 'Support'} @ ${supportPrice.toFixed(6)} too close (${supportDistanceFromEntry.toFixed(2)}%)`);
        continue;
      }

      // Skip if support too far (beyond max range)
      if (supportDistanceFromEntry > maxSlPct * 1.5) {
        console.log(`      ⏭️  ${support.tf} ${support.type || 'Support'} @ ${supportPrice.toFixed(6)} too far (${supportDistanceFromEntry.toFixed(2)}%)`);
        break; // All further supports will be even further
      }

      // 🎯 This support is in reasonable range
      console.log(`      ✅ ${support.tf} ${support.type || 'Support'} @ ${supportPrice.toFixed(6)} (${supportDistanceFromEntry.toFixed(2)}% from entry)`);

      // 🆕 Place SL BELOW this support
      const clearance = SLTP_CONFIG.support_clearance_pct;  // 0.5% minimum clearance
      const sweepBuffer = getSweepBuffer(support.weight);   // 0.15-0.4% sweep protection

      let slPrice = 0;
      if (side === "BUY") {
        slPrice = supportPrice * (1 - (clearance + sweepBuffer) / 100);
      } else {
        slPrice = supportPrice * (1 + (clearance + sweepBuffer) / 100);
      }

      // Calculate final SL distance from entry
      let finalSlDistance = 0;
      if (side === "BUY") {
        finalSlDistance = ((entryPrice - slPrice) / entryPrice) * 100;
      } else {
        finalSlDistance = ((slPrice - entryPrice) / entryPrice) * 100;
      }

      console.log(`      🛡️  Proposed SL: ${slPrice.toFixed(6)} (${finalSlDistance.toFixed(2)}% from entry)`);
      console.log(`          Clearance: ${clearance}% + Sweep protection: ${sweepBuffer}%`);

      // Check if this SL is in acceptable range
      if (finalSlDistance >= minSlPct && finalSlDistance <= maxSlPct) {
        selectedSL = {
          price: slPrice,
          distance_pct: finalSlDistance,
          support_level: support,
          clearance_pct: clearance + sweepBuffer
        };

        slReasoning.push(`📍 Support: ${support.tf} ${support.type || 'Level'} @ ${supportPrice.toFixed(6)}`);
        slReasoning.push(`🛡️  SL placed ${(clearance + sweepBuffer).toFixed(2)}% BELOW support`);
        slReasoning.push(`🎯 Final SL: ${slPrice.toFixed(6)} (-${finalSlDistance.toFixed(2)}% from entry)`);
        slReasoning.push(`⚖️  Weight: ${support.weight?.toFixed(1) || 'N/A'}`);

        break; // Use first acceptable support (closest)
      } else {
        console.log(`      ❌ SL distance ${finalSlDistance.toFixed(2)}% out of range [${minSlPct.toFixed(1)}%-${maxSlPct.toFixed(1)}%]`);
      }
    }
  }

  // 5️⃣ Fallback: No suitable support found → use optimal distance
  if (!selectedSL) {
    console.log(`   ⚠️  No suitable support level found in range`);

    let slPrice = 0;
    if (side === "BUY") {
      slPrice = entryPrice * (1 - optimalSlPct / 100);
    } else {
      slPrice = entryPrice * (1 + optimalSlPct / 100);
    }

    selectedSL = {
      price: slPrice,
      distance_pct: optimalSlPct,
      clearance_pct: 0
    };

    slReasoning.push(`⚠️ No VP support in acceptable range`);
    slReasoning.push(`📊 Using ${optimalSlPct.toFixed(1)}% optimal distance`);
    slReasoning.push(`🎯 SL: ${slPrice.toFixed(6)}`);
  }

  // 6️⃣ 🆕 Dynamic safety buffer (slippage protection based on volatility)
  const safetyBuffer = SLTP_CONFIG.volatility_safety_buffer[marketState.volatility_regime] || 0.5;

  if (side === "BUY") {
    selectedSL.price = selectedSL.price * (1 - safetyBuffer / 100);
  } else {
    selectedSL.price = selectedSL.price * (1 + safetyBuffer / 100);
  }

  selectedSL.distance_pct += safetyBuffer;

  slReasoning.push(`🛡️  Slippage buffer: +${safetyBuffer}% (${marketState.volatility_regime} vol)`);

  // 7️⃣ 🆕 Validate: Check for strong support BELOW our SL (danger zone!)
  const dangerSupport = findSupportBelowSL(vpLevels.all_supports, selectedSL.price, entryPrice, side);
  if (dangerSupport) {
    slReasoning.push(`⚠️  WARNING: Strong ${dangerSupport.tf} support @ ${dangerSupport.price.toFixed(6)} just below SL!`);
  }

  console.log(`   ✅ Final SL: ${selectedSL.price.toFixed(6)} (-${selectedSL.distance_pct.toFixed(2)}%)`);

  return {
    price: selectedSL.price,
    distance_pct: selectedSL.distance_pct,
    support_reference: selectedSL.support_level || null,
    clearance_pct: selectedSL.clearance_pct || 0,
    reasoning: slReasoning
  };
}

// 🆕 Helper: Get sweep protection buffer based on level weight
function getSweepBuffer(weight) {
  if (weight >= 2.5) {
    return SLTP_CONFIG.sweep_protection.high_weight_levels;  // 0.4% for 4H levels
  } else if (weight >= 1.5) {
    return SLTP_CONFIG.sweep_protection.medium_weight_levels;  // 0.25%
  } else {
    return SLTP_CONFIG.sweep_protection.low_weight_levels;  // 0.15%
  }
}

// 🆕 Helper: Find strong support BELOW our SL (danger zone)
function findSupportBelowSL(allSupports, slPrice, entryPrice, side) {
  if (!allSupports || allSupports.length === 0) return null;

  for (const support of allSupports) {
    const supportPrice = support.price || 0;
    if (supportPrice <= 0) continue;

    // Check if support is BELOW SL
    let isBelowSL = false;
    if (side === "BUY") {
      isBelowSL = supportPrice < slPrice;
    } else {
      isBelowSL = supportPrice > slPrice;
    }

    if (!isBelowSL) continue;

    // Check if it's CLOSE to SL (within 2% of entry)
    let distanceFromSL = 0;
    if (side === "BUY") {
      distanceFromSL = ((slPrice - supportPrice) / entryPrice) * 100;
    } else {
      distanceFromSL = ((supportPrice - slPrice) / entryPrice) * 100;
    }

    // If strong support (weight >= 2.0) within 2% below SL → WARNING
    if (distanceFromSL < 2.0 && support.weight >= 2.0) {
      return support;
    }
  }

  return null;
}

//===============================================================================
// 🎯 CALCULATE TAKE PROFITS (Same as V1)
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

    if (actualDistance <= 0) continue;

    const deviation = Math.abs(actualDistance - targetDistancePct);

    if (deviation < targetDistancePct * 0.3) {
      const weightBonus = (level.weight || 1.0) * 0.1;
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
// 🔍 VALIDATE SL/TP
//===============================================================================

function validateSLTP(coin, side, slResult, tpResults, conviction) {
  const issues = [];
  const entryPrice = coin.price || 0;

  if (side === "BUY" && slResult.price >= entryPrice) {
    issues.push("⚠️ SL above entry for BUY");
  }
  if (side === "SELL" && slResult.price <= entryPrice) {
    issues.push("⚠️ SL below entry for SELL");
  }

  const minRR = SLTP_CONFIG.min_rr[conviction] || 1.5;
  const mainTP = tpResults.find(tp => tp.level === 2) || tpResults[0];

  if (mainTP) {
    const actualRR = parseFloat(mainTP.rr);
    if (actualRR < minRR) {
      issues.push(`⚠️ RR ${actualRR.toFixed(2)}:1 below minimum ${minRR}:1`);
    }
  }

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

  console.log(`\n📊 ${coin.symbol} ${side} (${conviction}, ${vpQuality} VP)`);

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
  if (slResult.support_reference) {
    console.log(`       📍 Reference: ${slResult.support_reference.tf} ${slResult.support_reference.type || 'Support'}`);
    console.log(`       🛡️  Clearance: ${slResult.clearance_pct.toFixed(2)}% below support`);
  }

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
  }

  // Calculate main RR
  const mainTP = tpResults.find(tp => tp.level === 2) || tpResults[0];
  const mainRR = parseFloat(mainTP.rr);

  // Add to output
  processedCoins.push({
    ...coin,
    entry_price: coin.price,
    stop_loss: slResult.price,
    stop_loss_pct: slResult.distance_pct,
    stop_loss_support_reference: slResult.support_reference,
    stop_loss_clearance_pct: slResult.clearance_pct,
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
      version: "V2",
      sl_placement_strategy: "BELOW_SUPPORT",
      support_levels_analyzed: vpLevels.all_supports?.length || 0,
      tp_levels_analyzed: vpLevels.tp_candidates?.length || 0,
      scenario_tp_multiplier: SLTP_CONFIG.scenario_tp_extension[marketScenario?.scenario] || 1.0
    }
  });

  stats.processed++;
}

//===============================================================================
// 📊 OUTPUT SUMMARY
//===============================================================================

console.log(`\n\n═══════════════════════════════════════════════════════════════`);
console.log(`📊 SL/TP FINDER V2 SUMMARY:`);
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
    if (c.stop_loss_support_reference) {
      console.log(`       ${c.stop_loss_clearance_pct?.toFixed(2)}% below ${c.stop_loss_support_reference.tf} support`);
    }
    console.log(`   🎯 TP1: ${c.take_profit_1?.toFixed(6)} (+${c.take_profit_1_pct?.toFixed(2)}%)`);
    console.log(`   🎯 TP2: ${c.take_profit_2?.toFixed(6)} (+${c.take_profit_2_pct?.toFixed(2)}%)`);
    console.log(`   🎯 TP3: ${c.take_profit_3?.toFixed(6)} (+${c.take_profit_3_pct?.toFixed(2)}%)`);
    console.log(`   📊 RR: ${c.risk_reward_ratio?.toFixed(2)}:1\n`);
  });
}

console.log(`\n🚀 → Passing ${processedCoins.length} coins with SL/TP (V2) to Leverage Finder\n`);

return processedCoins.map(coin => ({ json: coin }));
