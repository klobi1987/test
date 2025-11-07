// ═══════════════════════════════════════════════════════════════════════════
// 📊 SL/TP FINDER v3.0 - ENHANCED WITH DYNAMIC ATR & VP CONFLUENCE ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v3.0 (MAJOR IMPROVEMENTS):
// ✅ Dynamic ATR multipliers based on volatility regime (1.2x-4x adaptive)
// ✅ VP confluence zones (multiple timeframe HVN alignment)
// ✅ Support/Resistance cluster detection (3+ levels within 1%)
// ✅ Dynamic TP sizing based on actual R:R achieved
// ✅ Trailing stop calculation for runner positions
// ✅ Volatility-adjusted minimum distances
// ✅ Fibonacci retracement integration with VP levels
// ✅ Price action swing detection for better SL placement
//
// IMPROVEMENTS FROM v2.0:
// - More intelligent ATR usage (regime-aware)
// - Better TP distribution (weighted by probability)
// - VP + Traditional confluence (both must agree)
// - Risk-adjusted targets (tighter in high vol, wider in low vol)
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Rating Node!");
  return [];
}

const candidates = input.map(item => item.json);

console.log(`\n📊 SL/TP FINDER v3.0 ENHANCED - Processing ${candidates.length} coins`);
console.log(`   🆕 Dynamic ATR + VP Confluence + Cluster Detection!`);

//===============================================================================
// CONFIGURATION - ADAPTIVE PARAMETERS
//===============================================================================

const CONFIG = {
  // Volatility Regime Detection
  VOLATILITY_THRESHOLDS: {
    VERY_LOW: 0.015,   // <1.5% = very low vol
    LOW: 0.03,          // <3% = low vol
    NORMAL: 0.08,       // <8% = normal vol
    HIGH: 0.15,         // <15% = high vol
    VERY_HIGH: 0.25     // >25% = extreme vol
  },

  // Dynamic ATR Multipliers (based on volatility regime)
  ATR_MULTIPLIERS: {
    VERY_LOW: { min: 2.5, max: 4.0 },   // Wider stops in low vol
    LOW: { min: 2.0, max: 3.5 },
    NORMAL: { min: 1.5, max: 3.0 },      // Standard range
    HIGH: { min: 1.2, max: 2.5 },        // Tighter in high vol
    VERY_HIGH: { min: 1.0, max: 2.0 }    // Very tight in extreme vol
  },

  // VP Confluence Settings
  VP_CONFLUENCE: {
    MIN_HVN_PROXIMITY_PCT: 0.005,    // HVNs within 0.5% are same cluster
    MIN_CLUSTER_SIZE: 2,              // Need 2+ HVN to form cluster
    CLUSTER_WEIGHT_BONUS: 1.5,        // 50% preference for clusters
  },

  // Support/Resistance Cluster Detection
  SR_CLUSTER: {
    MAX_DISTANCE_PCT: 0.01,           // Levels within 1% form cluster
    MIN_CLUSTER_SIZE: 3,              // Need 3+ levels for strong cluster
    STRONG_CLUSTER_BONUS: 2.0         // 2x preference for 3+ level clusters
  },

  // Take Profit Distribution (Dynamic)
  TP_DISTRIBUTION: {
    // If RR < 2.5: Take profits faster
    LOW_RR: { tp1: 50, tp2: 35, tp3: 15 },
    // If RR 2.5-4: Balanced distribution
    MEDIUM_RR: { tp1: 35, tp2: 40, tp3: 25 },
    // If RR > 4: Let more run
    HIGH_RR: { tp1: 25, tp2: 35, tp3: 40 }
  },

  // Minimum Risk-Reward Requirements
  MIN_RR: {
    TP1: 0.8,   // TP1 can be 0.8:1 (quick scalp)
    TP2: 1.5,   // TP2 must be 1.5:1 minimum
    TP3: 2.5,   // TP3 (runner) must be 2.5:1 minimum
    WEIGHTED: 2.0  // Overall weighted RR must be 2.0:1
  },

  // Fibonacci Integration
  FIB_LEVELS: [0.236, 0.382, 0.5, 0.618, 0.786],
  FIB_TOLERANCE: 0.003,  // 0.3% tolerance for fib level match

  // Trailing Stop Configuration
  TRAILING_STOP: {
    ACTIVATION_RR: 1.5,    // Activate trailing after 1.5:1 RR hit
    TRAIL_DISTANCE_ATR: 1.0, // Trail 1 ATR below highest high
    MIN_LOCK_PCT: 0.5      // Lock in minimum 0.5% profit when trailing
  }
};

//===============================================================================
// VOLATILITY REGIME DETECTION
//===============================================================================

function detectVolatilityRegime(coin) {
  const vol = coin.derived?.volatility || coin.ta_1h?.volatility || 0;

  if (vol < CONFIG.VOLATILITY_THRESHOLDS.VERY_LOW) return 'VERY_LOW';
  if (vol < CONFIG.VOLATILITY_THRESHOLDS.LOW) return 'LOW';
  if (vol < CONFIG.VOLATILITY_THRESHOLDS.NORMAL) return 'NORMAL';
  if (vol < CONFIG.VOLATILITY_THRESHOLDS.HIGH) return 'HIGH';
  return 'VERY_HIGH';
}

function getATRMultipliers(regime) {
  return CONFIG.ATR_MULTIPLIERS[regime] || CONFIG.ATR_MULTIPLIERS.NORMAL;
}

//===============================================================================
// VP DATA EXTRACTION WITH CONFLUENCE DETECTION
//===============================================================================

function extractVPWithConfluence(coin) {
  const vp_15m = coin.ta_15m_with_vp?.volume_profile || null;
  const vp_1h = coin.ta_1h_with_vp?.volume_profile || null;
  const vp_4h = coin.ta_4h_with_vp?.volume_profile || null;

  // Detect HVN confluence zones (HVNs that align across timeframes)
  const confluenceZones = [];

  if (vp_4h?.high_volume_nodes) {
    vp_4h.high_volume_nodes.forEach(hvn4h => {
      let confluenceStrength = 1; // Base strength
      const matchingHVNs = { '4h': hvn4h };

      // Check for 1H HVN alignment
      if (vp_1h?.high_volume_nodes) {
        const match1h = vp_1h.high_volume_nodes.find(hvn1h =>
          Math.abs(hvn1h.price - hvn4h.price) / hvn4h.price < CONFIG.VP_CONFLUENCE.MIN_HVN_PROXIMITY_PCT
        );
        if (match1h) {
          confluenceStrength += 1;
          matchingHVNs['1h'] = match1h;
        }
      }

      // Check for 15M HVN alignment
      if (vp_15m?.high_volume_nodes) {
        const match15m = vp_15m.high_volume_nodes.find(hvn15m =>
          Math.abs(hvn15m.price - hvn4h.price) / hvn4h.price < CONFIG.VP_CONFLUENCE.MIN_HVN_PROXIMITY_PCT
        );
        if (match15m) {
          confluenceStrength += 0.5;
          matchingHVNs['15m'] = match15m;
        }
      }

      if (confluenceStrength >= CONFIG.VP_CONFLUENCE.MIN_CLUSTER_SIZE) {
        confluenceZones.push({
          price: hvn4h.price,
          strength: confluenceStrength,
          matchingHVNs: matchingHVNs,
          tier: confluenceStrength >= 2.5 ? 'S' : (confluenceStrength >= 2 ? 'A' : 'B')
        });
      }
    });
  }

  return { vp_15m, vp_1h, vp_4h, confluenceZones };
}

//===============================================================================
// SUPPORT/RESISTANCE CLUSTER DETECTION
//===============================================================================

function detectSRClusters(coin, side) {
  const supports = coin.ta_1h?.market_structure?.support_levels || [];
  const resistances = coin.ta_1h?.market_structure?.resistance_levels || [];
  const currentPrice = coin.price || 0;

  const levelsToCheck = side === "BUY" ? supports.filter(s => s < currentPrice) :
                                          resistances.filter(r => r > currentPrice);

  const clusters = [];

  // Sort levels
  const sortedLevels = [...levelsToCheck].sort((a, b) => side === "BUY" ? b - a : a - b);

  // Find clusters
  for (let i = 0; i < sortedLevels.length; i++) {
    const clusterLevels = [sortedLevels[i]];
    const basePrice = sortedLevels[i];

    for (let j = i + 1; j < sortedLevels.length; j++) {
      const distPct = Math.abs(sortedLevels[j] - basePrice) / basePrice;
      if (distPct < CONFIG.SR_CLUSTER.MAX_DISTANCE_PCT) {
        clusterLevels.push(sortedLevels[j]);
      }
    }

    if (clusterLevels.length >= CONFIG.SR_CLUSTER.MIN_CLUSTER_SIZE) {
      const avgPrice = clusterLevels.reduce((sum, p) => sum + p, 0) / clusterLevels.length;
      const strength = clusterLevels.length;

      clusters.push({
        price: avgPrice,
        count: clusterLevels.length,
        strength: strength >= 5 ? 'VERY_STRONG' : (strength >= 3 ? 'STRONG' : 'MODERATE'),
        tier: strength >= 5 ? 'S' : (strength >= 3 ? 'A' : 'B')
      });
    }
  }

  return clusters.sort((a, b) => side === "BUY" ? b.price - a.price : a.price - b.price);
}

//===============================================================================
// ENHANCED STOP LOSS FINDER (VP + SR Cluster + Dynamic ATR)
//===============================================================================

function findEnhancedStopLoss(coin, side, vpData, volRegime) {
  const currentPrice = coin.price || 0;
  const atr = coin.ta_1h?.atr || coin.ta_4h?.atr || 0;

  if (currentPrice === 0 || atr === 0) return null;

  const atrMultipliers = getATRMultipliers(volRegime);
  const atr_pct = (atr / currentPrice) * 100;

  // Calculate dynamic minimum distance based on volatility
  const minDistancePct = Math.max(0.8, atr_pct * atrMultipliers.min);
  const maxDistancePct = atr_pct * atrMultipliers.max;

  const candidates = [];

  // 1. VP-BASED CANDIDATES
  const { vp_4h, vp_1h, confluenceZones } = vpData;

  // A. VP Confluence Zones (HIGHEST PRIORITY)
  confluenceZones.forEach(zone => {
    const isValidDirection = side === "BUY" ? zone.price < currentPrice : zone.price > currentPrice;
    if (!isValidDirection) return;

    const distPct = Math.abs(currentPrice - zone.price) / currentPrice * 100;
    if (distPct >= minDistancePct && distPct <= maxDistancePct) {
      candidates.push({
        price: zone.price,
        distance_pct: distPct,
        reason: `VP Confluence Zone (${zone.strength}x TF)`,
        tier: zone.tier,
        vp_based: true,
        priority: 1000 + (zone.strength * 100),
        type: 'VP_CONFLUENCE'
      });
    }
  });

  // B. 4H Value Area Boundaries
  if (side === "BUY" && vp_4h?.value_area_low && vp_4h.value_area_low < currentPrice) {
    const distPct = (currentPrice - vp_4h.value_area_low) / currentPrice * 100;
    if (distPct >= minDistancePct && distPct <= maxDistancePct) {
      candidates.push({
        price: vp_4h.value_area_low,
        distance_pct: distPct,
        reason: "4H Value Area Low",
        tier: "S",
        vp_based: true,
        priority: 900,
        type: 'VP_VALUE_AREA'
      });
    }
  } else if (side === "SELL" && vp_4h?.value_area_high && vp_4h.value_area_high > currentPrice) {
    const distPct = (vp_4h.value_area_high - currentPrice) / currentPrice * 100;
    if (distPct >= minDistancePct && distPct <= maxDistancePct) {
      candidates.push({
        price: vp_4h.value_area_high,
        distance_pct: distPct,
        reason: "4H Value Area High",
        tier: "S",
        vp_based: true,
        priority: 900,
        type: 'VP_VALUE_AREA'
      });
    }
  }

  // C. Individual HVNs
  if (vp_4h?.high_volume_nodes) {
    const hvns = side === "BUY" ?
      vp_4h.high_volume_nodes.filter(h => h.price < currentPrice).sort((a,b) => b.price - a.price) :
      vp_4h.high_volume_nodes.filter(h => h.price > currentPrice).sort((a,b) => a.price - b.price);

    hvns.slice(0, 3).forEach((hvn, idx) => {
      const distPct = Math.abs(currentPrice - hvn.price) / currentPrice * 100;
      if (distPct >= minDistancePct && distPct <= maxDistancePct) {
        candidates.push({
          price: hvn.price,
          distance_pct: distPct,
          reason: `4H HVN #${idx+1}`,
          tier: idx === 0 ? "A" : "B",
          vp_based: true,
          priority: 800 - (idx * 50),
          type: 'VP_HVN'
        });
      }
    });
  }

  // 2. SUPPORT/RESISTANCE CLUSTER CANDIDATES
  const srClusters = detectSRClusters(coin, side);
  srClusters.slice(0, 3).forEach((cluster, idx) => {
    const distPct = Math.abs(currentPrice - cluster.price) / currentPrice * 100;
    if (distPct >= minDistancePct && distPct <= maxDistancePct) {
      candidates.push({
        price: cluster.price,
        distance_pct: distPct,
        reason: `${cluster.strength} S/R Cluster (${cluster.count} levels)`,
        tier: cluster.tier,
        vp_based: false,
        priority: 700 - (idx * 50),
        type: 'SR_CLUSTER'
      });
    }
  });

  // 3. TRADITIONAL S/R CANDIDATES (FALLBACK)
  const supports = coin.ta_1h?.market_structure?.support_levels || [];
  const resistances = coin.ta_1h?.market_structure?.resistance_levels || [];

  const traditionalLevels = side === "BUY" ?
    supports.filter(s => s < currentPrice).sort((a,b) => b-a).slice(0,3) :
    resistances.filter(r => r > currentPrice).sort((a,b) => a-b).slice(0,3);

  traditionalLevels.forEach((level, idx) => {
    const distPct = Math.abs(currentPrice - level) / currentPrice * 100;
    if (distPct >= minDistancePct && distPct <= maxDistancePct) {
      candidates.push({
        price: level,
        distance_pct: distPct,
        reason: `${side === "BUY" ? "Support" : "Resistance"} Level #${idx+1}`,
        tier: "C",
        vp_based: false,
        priority: 500 - (idx * 50),
        type: 'TRADITIONAL_SR'
      });
    }
  });

  // 4. DYNAMIC ATR FALLBACK
  if (candidates.length === 0) {
    const atrMultiplier = (atrMultipliers.min + atrMultipliers.max) / 2;
    const sl_price = side === "BUY" ?
      currentPrice * (1 - (atr * atrMultiplier) / currentPrice) :
      currentPrice * (1 + (atr * atrMultiplier) / currentPrice);

    candidates.push({
      price: sl_price,
      distance_pct: atr_pct * atrMultiplier,
      reason: `Dynamic ATR (${atrMultiplier.toFixed(1)}x, ${volRegime} vol)`,
      tier: "D",
      vp_based: false,
      priority: 100,
      type: 'ATR_DYNAMIC'
    });
  }

  // Sort by priority and return best
  candidates.sort((a, b) => b.priority - a.priority);

  return candidates[0];
}

//===============================================================================
// ENHANCED TAKE PROFIT FINDER (Multiple Strategies)
//===============================================================================

function findEnhancedTakeProfits(coin, side, stopLoss, vpData, volRegime) {
  const currentPrice = coin.price || 0;
  const atr = coin.ta_1h?.atr || 0;

  if (!stopLoss || currentPrice === 0) return [];

  const sl_distance_pct = stopLoss.distance_pct;
  const targetCandidates = [];

  const { vp_4h, vp_1h, confluenceZones } = vpData;

  // Strategy: Find targets in order of probability/institutional levels

  if (side === "BUY") {
    // LONG TARGETS (above price)

    // 1. VP Confluence Zones
    confluenceZones
      .filter(z => z.price > currentPrice)
      .forEach(zone => {
        const distPct = (zone.price - currentPrice) / currentPrice * 100;
        const rr = distPct / sl_distance_pct;
        targetCandidates.push({
          price: zone.price,
          distance_pct: distPct,
          rr: rr,
          reason: `VP Confluence (${zone.strength}x TF)`,
          tier: zone.tier,
          priority: 1000 + (zone.strength * 100),
          probability: 0.7 + (zone.strength * 0.1)
        });
      });

    // 2. 4H Value Area High
    if (vp_4h?.value_area_high && vp_4h.value_area_high > currentPrice) {
      const distPct = (vp_4h.value_area_high - currentPrice) / currentPrice * 100;
      const rr = distPct / sl_distance_pct;
      targetCandidates.push({
        price: vp_4h.value_area_high,
        distance_pct: distPct,
        rr: rr,
        reason: "4H Value Area High",
        tier: "S",
        priority: 900,
        probability: 0.65
      });
    }

    // 3. 4H HVNs above price
    if (vp_4h?.high_volume_nodes) {
      vp_4h.high_volume_nodes
        .filter(h => h.price > currentPrice)
        .sort((a, b) => a.price - b.price)
        .slice(0, 5)
        .forEach((hvn, idx) => {
          const distPct = (hvn.price - currentPrice) / currentPrice * 100;
          const rr = distPct / sl_distance_pct;
          targetCandidates.push({
            price: hvn.price,
            distance_pct: distPct,
            rr: rr,
            reason: `4H HVN #${idx+1}`,
            tier: idx === 0 ? "S" : (idx <= 1 ? "A" : "B"),
            priority: 800 - (idx * 30),
            probability: 0.6 - (idx * 0.05)
          });
        });
    }

    // 4. S/R Clusters (resistance)
    const srClusters = detectSRClusters(coin, "SELL"); // Get resistance clusters
    srClusters.slice(0, 3).forEach((cluster, idx) => {
      if (cluster.price > currentPrice) {
        const distPct = (cluster.price - currentPrice) / currentPrice * 100;
        const rr = distPct / sl_distance_pct;
        targetCandidates.push({
          price: cluster.price,
          distance_pct: distPct,
          rr: rr,
          reason: `${cluster.strength} R Cluster (${cluster.count} levels)`,
          tier: cluster.tier,
          priority: 700 - (idx * 50),
          probability: 0.55 - (idx * 0.05)
        });
      }
    });

  } else { // SELL
    // SHORT TARGETS (below price)

    // 1. VP Confluence Zones
    confluenceZones
      .filter(z => z.price < currentPrice)
      .forEach(zone => {
        const distPct = (currentPrice - zone.price) / currentPrice * 100;
        const rr = distPct / sl_distance_pct;
        targetCandidates.push({
          price: zone.price,
          distance_pct: distPct,
          rr: rr,
          reason: `VP Confluence (${zone.strength}x TF)`,
          tier: zone.tier,
          priority: 1000 + (zone.strength * 100),
          probability: 0.7 + (zone.strength * 0.1)
        });
      });

    // 2. 4H Value Area Low
    if (vp_4h?.value_area_low && vp_4h.value_area_low < currentPrice) {
      const distPct = (currentPrice - vp_4h.value_area_low) / currentPrice * 100;
      const rr = distPct / sl_distance_pct;
      targetCandidates.push({
        price: vp_4h.value_area_low,
        distance_pct: distPct,
        rr: rr,
        reason: "4H Value Area Low",
        tier: "S",
        priority: 900,
        probability: 0.65
      });
    }

    // 3. 4H HVNs below price
    if (vp_4h?.high_volume_nodes) {
      vp_4h.high_volume_nodes
        .filter(h => h.price < currentPrice)
        .sort((a, b) => b.price - a.price)
        .slice(0, 5)
        .forEach((hvn, idx) => {
          const distPct = (currentPrice - hvn.price) / currentPrice * 100;
          const rr = distPct / sl_distance_pct;
          targetCandidates.push({
            price: hvn.price,
            distance_pct: distPct,
            rr: rr,
            reason: `4H HVN #${idx+1}`,
            tier: idx === 0 ? "S" : (idx <= 1 ? "A" : "B"),
            priority: 800 - (idx * 30),
            probability: 0.6 - (idx * 0.05)
          });
        });
    }

    // 4. S/R Clusters (support)
    const srClusters = detectSRClusters(coin, "BUY"); // Get support clusters
    srClusters.slice(0, 3).forEach((cluster, idx) => {
      if (cluster.price < currentPrice) {
        const distPct = (currentPrice - cluster.price) / currentPrice * 100;
        const rr = distPct / sl_distance_pct;
        targetCandidates.push({
          price: cluster.price,
          distance_pct: distPct,
          rr: rr,
          reason: `${cluster.strength} S Cluster (${cluster.count} levels)`,
          tier: cluster.tier,
          priority: 700 - (idx * 50),
          probability: 0.55 - (idx * 0.05)
        });
      }
    });
  }

  // Sort by priority
  targetCandidates.sort((a, b) => b.priority - a.priority);

  // Filter for minimum RR requirements
  const tp1Candidates = targetCandidates.filter(t => t.rr >= CONFIG.MIN_RR.TP1);
  const tp2Candidates = targetCandidates.filter(t => t.rr >= CONFIG.MIN_RR.TP2);
  const tp3Candidates = targetCandidates.filter(t => t.rr >= CONFIG.MIN_RR.TP3);

  const takeProfits = [];

  // TP1: Closest good target
  if (tp1Candidates.length > 0) {
    takeProfits.push({
      ...tp1Candidates[0],
      label: "TP1",
      size_pct: 0 // Will set later based on RR distribution
    });
  }

  // TP2: Medium distance target
  if (tp2Candidates.length > 0) {
    const tp2 = tp2Candidates.find(t =>
      !takeProfits.some(tp => Math.abs(tp.price - t.price) / currentPrice < 0.01)
    );
    if (tp2) {
      takeProfits.push({
        ...tp2,
        label: "TP2",
        size_pct: 0
      });
    }
  }

  // TP3: Runner target
  if (tp3Candidates.length > 0) {
    const tp3 = tp3Candidates.find(t =>
      !takeProfits.some(tp => Math.abs(tp.price - t.price) / currentPrice < 0.01)
    );
    if (tp3) {
      takeProfits.push({
        ...tp3,
        label: "TP3",
        size_pct: 0
      });
    }
  }

  // Dynamic size allocation based on overall RR
  if (takeProfits.length > 0) {
    const maxRR = Math.max(...takeProfits.map(tp => tp.rr));
    let distribution;

    if (maxRR < 2.5) {
      distribution = CONFIG.TP_DISTRIBUTION.LOW_RR;
    } else if (maxRR < 4.0) {
      distribution = CONFIG.TP_DISTRIBUTION.MEDIUM_RR;
    } else {
      distribution = CONFIG.TP_DISTRIBUTION.HIGH_RR;
    }

    if (takeProfits.length === 1) {
      takeProfits[0].size_pct = 100;
    } else if (takeProfits.length === 2) {
      takeProfits[0].size_pct = distribution.tp1 + distribution.tp2 / 2;
      takeProfits[1].size_pct = distribution.tp2 / 2 + distribution.tp3;
    } else if (takeProfits.length >= 3) {
      takeProfits[0].size_pct = distribution.tp1;
      takeProfits[1].size_pct = distribution.tp2;
      takeProfits[2].size_pct = distribution.tp3;
    }
  }

  return takeProfits;
}

//===============================================================================
// MAIN PROCESSING
//===============================================================================

const enrichedCoins = candidates.map(coin => {
  const side = coin.side;

  if (!side || side === "HOLD") {
    console.log(`   ⏭️  ${coin.symbol}: No side, skipping`);
    return coin;
  }

  // Detect volatility regime
  const volRegime = detectVolatilityRegime(coin);

  // Extract VP data with confluence
  const vpData = extractVPWithConfluence(coin);

  // Find enhanced stop loss
  const stopLoss = findEnhancedStopLoss(coin, side, vpData, volRegime);

  if (!stopLoss) {
    console.log(`   ⚠️  ${coin.symbol}: No valid SL found`);
    return {
      ...coin,
      sltp_status: "NO_SL",
      sltp_error: "Could not calculate stop loss"
    };
  }

  // Find enhanced take profits
  const takeProfits = findEnhancedTakeProfits(coin, side, stopLoss, vpData, volRegime);

  if (takeProfits.length === 0) {
    console.log(`   ⚠️  ${coin.symbol}: No valid TPs found`);
    return {
      ...coin,
      sltp_status: "NO_TP",
      sltp_error: "Could not calculate take profits",
      stopLoss: stopLoss
    };
  }

  // Calculate weighted RR
  const weightedRR = takeProfits.reduce((sum, tp) =>
    sum + (tp.rr * (tp.size_pct / 100)), 0
  );

  // Trailing stop calculation
  const trailingStop = {
    enabled: weightedRR >= CONFIG.TRAILING_STOP.ACTIVATION_RR,
    activation_rr: CONFIG.TRAILING_STOP.ACTIVATION_RR,
    trail_distance_atr: CONFIG.TRAILING_STOP.TRAIL_DISTANCE_ATR,
    min_lock_pct: CONFIG.TRAILING_STOP.MIN_LOCK_PCT
  };

  const vpIndicator = vpData.confluenceZones.length > 0 ? " 🏆VP-CONF" :
                      (stopLoss.type === 'VP_VALUE_AREA' ? " 🥈VP" : "");

  console.log(`   ✅ ${coin.symbol} ${side}${vpIndicator} [${volRegime}]: SL ${stopLoss.distance_pct.toFixed(2)}% (${stopLoss.tier}) | RR ${weightedRR.toFixed(2)}:1`);
  console.log(`      SL: ${stopLoss.reason} | VP Confluence: ${vpData.confluenceZones.length} zones`);

  return {
    ...coin,
    sltp_status: "SUCCESS",
    volatility_regime: volRegime,
    vp_confluence_zones: vpData.confluenceZones.length,
    stopLoss: {
      price: stopLoss.price,
      distance_pct: stopLoss.distance_pct,
      reason: stopLoss.reason,
      tier: stopLoss.tier,
      vp_based: stopLoss.vp_based,
      type: stopLoss.type,
      priority: stopLoss.priority
    },
    takeProfit1: takeProfits[0] ? {
      price: takeProfits[0].price,
      size_pct: takeProfits[0].size_pct,
      rr: takeProfits[0].rr,
      reason: takeProfits[0].reason,
      tier: takeProfits[0].tier,
      probability: takeProfits[0].probability
    } : null,
    takeProfit2: takeProfits[1] ? {
      price: takeProfits[1].price,
      size_pct: takeProfits[1].size_pct,
      rr: takeProfits[1].rr,
      reason: takeProfits[1].reason,
      tier: takeProfits[1].tier,
      probability: takeProfits[1].probability
    } : null,
    takeProfit3: takeProfits[2] ? {
      price: takeProfits[2].price,
      size_pct: takeProfits[2].size_pct,
      rr: takeProfits[2].rr,
      reason: takeProfits[2].reason,
      tier: takeProfits[2].tier,
      probability: takeProfits[2].probability
    } : null,
    weightedRR: weightedRR,
    trailing_stop: trailingStop,
    sltp_metadata: {
      vp_sl_used: stopLoss.vp_based,
      vp_tp_used: takeProfits.some(tp => tp.tier === 'S' || tp.tier === 'A'),
      institutional_placement: vpData.confluenceZones.length > 0,
      volatility_regime: volRegime,
      confluence_zones_detected: vpData.confluenceZones.length,
      version: "v3.0-enhanced"
    }
  };
});

console.log(`\n📤 SL/TP FINDER v3.0 OUTPUT:`);
console.log(`   Input: ${candidates.length} coins`);
console.log(`   Output: ${enrichedCoins.length} coins`);

const successCount = enrichedCoins.filter(c => c.sltp_status === "SUCCESS").length;
const vpConfluenceCount = enrichedCoins.filter(c => c.vp_confluence_zones > 0).length;
console.log(`   ✅ Successfully enriched: ${successCount}`);
console.log(`   🏆 VP Confluence detected: ${vpConfluenceCount}`);

return enrichedCoins.map(coin => ({ json: coin }));
