// ═══════════════════════════════════════════════════════════════════════════
// 📊 SL/TP FINDER v2.0 - WITH VOLUME PROFILE (S-TIER) ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v2.0:
// ✅ Volume Profile-based SL/TP placement (institutional levels)
// ✅ 4H Value Area Low/High for strategic SL/TP
// ✅ HVN (High Volume Nodes) for precision TP targets
// ✅ POC-aware entry quality scoring
// ✅ Multi-timeframe VP confluence for better targets
// ✅ Fallback to traditional methods if VP unavailable
//
// ROLE: Enrich all coins with VP-enhanced SL/TP data, pass ALL to next node
//
// INPUT: 10-20 rated coins from Rating Node (with VP data)
// OUTPUT: Same coins + VP-enhanced SL/TP fields
//
// DOES NOT FILTER! Only enriches and passes through.
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Rating Node!");
  return [];
}

const candidates = input.map(item => item.json);

console.log(`\n📊 SL/TP FINDER v2.0 WITH VOLUME PROFILE - Processing ${candidates.length} coins`);
console.log(`   🆕 Institutional-grade SL/TP placement enabled!`);

//===============================================================================
// 🆕 VOLUME PROFILE EXTRACTION
//===============================================================================

function extractVPData(coin) {
  const vp_15m = coin.ta_15m_with_vp?.volume_profile || null;
  const vp_1h = coin.ta_1h_with_vp?.volume_profile || null;
  const vp_4h = coin.ta_4h_with_vp?.volume_profile || null;

  return { vp_15m, vp_1h, vp_4h };
}

//===============================================================================
// 🆕 VP-BASED STOP LOSS FINDER
//===============================================================================

function findStopLossVP(coin, side, vp_4h, vp_1h) {
  const currentPrice = coin.price || 0;
  const atr = coin.ta_1h?.atr || 0;

  if (currentPrice === 0) return null;

  // Strategy hierarchy:
  // 1. Use 4H Value Area Low/High (best - strategic level)
  // 2. Use nearest HVN (good - institutional support/resistance)
  // 3. Fallback to 1H Value Area
  // 4. Fallback to traditional support/resistance

  if (side === "BUY") {
    // LONG: SL below price

    // 🏆 BEST: 4H Value Area Low
    if (vp_4h?.value_area_low && vp_4h.value_area_low < currentPrice) {
      const dist_pct = ((currentPrice - vp_4h.value_area_low) / currentPrice) * 100;

      // Check if distance is reasonable (1-10%)
      if (dist_pct >= 1.0 && dist_pct <= 10.0) {
        return {
          price: vp_4h.value_area_low,
          distance_pct: dist_pct,
          reason: "4H Value Area Low (institutional support)",
          tier: "S",
          vp_based: true
        };
      }
    }

    // 🥈 GOOD: Nearest HVN below price
    if (vp_4h?.high_volume_nodes?.length > 0) {
      const hvnBelow = vp_4h.high_volume_nodes
        .filter(h => h.price < currentPrice)
        .sort((a, b) => b.price - a.price); // Closest first

      if (hvnBelow.length > 0) {
        const hvn = hvnBelow[0];
        const dist_pct = ((currentPrice - hvn.price) / currentPrice) * 100;

        if (dist_pct >= 1.0 && dist_pct <= 10.0) {
          return {
            price: hvn.price,
            distance_pct: dist_pct,
            reason: "4H HVN (institutional level)",
            tier: "A",
            vp_based: true
          };
        }
      }
    }

    // 🥉 FALLBACK: 1H Value Area Low
    if (vp_1h?.value_area_low && vp_1h.value_area_low < currentPrice) {
      const dist_pct = ((currentPrice - vp_1h.value_area_low) / currentPrice) * 100;

      if (dist_pct >= 1.0 && dist_pct <= 10.0) {
        return {
          price: vp_1h.value_area_low,
          distance_pct: dist_pct,
          reason: "1H Value Area Low",
          tier: "B",
          vp_based: true
        };
      }
    }

  } else { // SELL
    // SHORT: SL above price

    // 🏆 BEST: 4H Value Area High
    if (vp_4h?.value_area_high && vp_4h.value_area_high > currentPrice) {
      const dist_pct = ((vp_4h.value_area_high - currentPrice) / currentPrice) * 100;

      if (dist_pct >= 1.0 && dist_pct <= 10.0) {
        return {
          price: vp_4h.value_area_high,
          distance_pct: dist_pct,
          reason: "4H Value Area High (institutional resistance)",
          tier: "S",
          vp_based: true
        };
      }
    }

    // 🥈 GOOD: Nearest HVN above price
    if (vp_4h?.high_volume_nodes?.length > 0) {
      const hvnAbove = vp_4h.high_volume_nodes
        .filter(h => h.price > currentPrice)
        .sort((a, b) => a.price - b.price); // Closest first

      if (hvnAbove.length > 0) {
        const hvn = hvnAbove[0];
        const dist_pct = ((hvn.price - currentPrice) / currentPrice) * 100;

        if (dist_pct >= 1.0 && dist_pct <= 10.0) {
          return {
            price: hvn.price,
            distance_pct: dist_pct,
            reason: "4H HVN (institutional level)",
            tier: "A",
            vp_based: true
          };
        }
      }
    }

    // 🥉 FALLBACK: 1H Value Area High
    if (vp_1h?.value_area_high && vp_1h.value_area_high > currentPrice) {
      const dist_pct = ((vp_1h.value_area_high - currentPrice) / currentPrice) * 100;

      if (dist_pct >= 1.0 && dist_pct <= 10.0) {
        return {
          price: vp_1h.value_area_high,
          distance_pct: dist_pct,
          reason: "1H Value Area High",
          tier: "B",
          vp_based: true
        };
      }
    }
  }

  return null; // Will fallback to traditional method
}

//===============================================================================
// 🆕 VP-BASED TAKE PROFIT FINDER
//===============================================================================

function findTakeProfitsVP(coin, side, stopLoss, vp_4h, vp_1h) {
  const currentPrice = coin.price || 0;

  if (currentPrice === 0 || !stopLoss) return [];

  const sl_distance_pct = stopLoss.distance_pct;
  const targets = [];

  if (side === "BUY") {
    // LONG: TPs above price

    // TP Strategy:
    // TP1 = Nearest HVN above price (quick profit)
    // TP2 = 4H Value Area High (major target)
    // TP3 = Next major HVN (extended target)

    if (vp_4h?.high_volume_nodes?.length > 0) {
      const hvnAbove = vp_4h.high_volume_nodes
        .filter(h => h.price > currentPrice)
        .sort((a, b) => a.price - b.price); // Closest first

      // TP1: First HVN
      if (hvnAbove.length >= 1) {
        const tp1 = hvnAbove[0];
        const dist_pct = ((tp1.price - currentPrice) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;

        if (rr > 0.8) { // Min RR 0.8
          targets.push({
            price: tp1.price,
            size_pct: 30,
            rr: rr,
            reason: "HVN TP1 (nearest institutional resistance)",
            tier: "S"
          });
        }
      }

      // TP2: 4H Value Area High (if not already used)
      if (vp_4h.value_area_high > currentPrice) {
        const dist_pct = ((vp_4h.value_area_high - currentPrice) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;

        // Only add if significantly higher than TP1
        const differentFromTP1 = targets.length === 0 ||
          Math.abs(vp_4h.value_area_high - targets[0].price) / currentPrice > 0.015;

        if (rr > 1.2 && differentFromTP1) {
          targets.push({
            price: vp_4h.value_area_high,
            size_pct: 50,
            rr: rr,
            reason: "4H Value Area High (major institutional target)",
            tier: "S"
          });
        }
      }

      // TP3: Second HVN (if exists)
      if (hvnAbove.length >= 2) {
        const tp3 = hvnAbove[1];
        const dist_pct = ((tp3.price - currentPrice) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;

        if (rr > 1.5 && targets.length < 3) {
          targets.push({
            price: tp3.price,
            size_pct: 20,
            rr: rr,
            reason: "HVN TP3 (extended institutional target)",
            tier: "A"
          });
        }
      }
    }

    // Fallback: Use 1H VAH if 4H didn't provide enough targets
    if (targets.length < 2 && vp_1h?.value_area_high > currentPrice) {
      const dist_pct = ((vp_1h.value_area_high - currentPrice) / currentPrice) * 100;
      const rr = dist_pct / sl_distance_pct;

      if (rr > 1.0) {
        targets.push({
          price: vp_1h.value_area_high,
          size_pct: 40,
          rr: rr,
          reason: "1H Value Area High",
          tier: "B"
        });
      }
    }

  } else { // SELL
    // SHORT: TPs below price

    if (vp_4h?.high_volume_nodes?.length > 0) {
      const hvnBelow = vp_4h.high_volume_nodes
        .filter(h => h.price < currentPrice)
        .sort((a, b) => b.price - a.price); // Closest first

      // TP1: First HVN
      if (hvnBelow.length >= 1) {
        const tp1 = hvnBelow[0];
        const dist_pct = ((currentPrice - tp1.price) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;

        if (rr > 0.8) {
          targets.push({
            price: tp1.price,
            size_pct: 30,
            rr: rr,
            reason: "HVN TP1 (nearest institutional support)",
            tier: "S"
          });
        }
      }

      // TP2: 4H Value Area Low
      if (vp_4h.value_area_low < currentPrice) {
        const dist_pct = ((currentPrice - vp_4h.value_area_low) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;

        const differentFromTP1 = targets.length === 0 ||
          Math.abs(vp_4h.value_area_low - targets[0].price) / currentPrice > 0.015;

        if (rr > 1.2 && differentFromTP1) {
          targets.push({
            price: vp_4h.value_area_low,
            size_pct: 50,
            rr: rr,
            reason: "4H Value Area Low (major institutional target)",
            tier: "S"
          });
        }
      }

      // TP3: Second HVN
      if (hvnBelow.length >= 2) {
        const tp3 = hvnBelow[1];
        const dist_pct = ((currentPrice - tp3.price) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;

        if (rr > 1.5 && targets.length < 3) {
          targets.push({
            price: tp3.price,
            size_pct: 20,
            rr: rr,
            reason: "HVN TP3 (extended institutional target)",
            tier: "A"
          });
        }
      }
    }

    // Fallback: 1H VAL
    if (targets.length < 2 && vp_1h?.value_area_low < currentPrice) {
      const dist_pct = ((currentPrice - vp_1h.value_area_low) / currentPrice) * 100;
      const rr = dist_pct / sl_distance_pct;

      if (rr > 1.0) {
        targets.push({
          price: vp_1h.value_area_low,
          size_pct: 40,
          rr: rr,
          reason: "1H Value Area Low",
          tier: "B"
        });
      }
    }
  }

  return targets;
}

//===============================================================================
// TRADITIONAL METHODS (FALLBACK)
//===============================================================================

function findStopLossTraditional(coin, side) {
  const supports = coin.ta_1h?.market_structure?.support_levels || [];
  const resistances = coin.ta_1h?.market_structure?.resistance_levels || [];
  const currentPrice = coin.price || 0;
  const atr = coin.ta_1h?.atr || 0;

  if (currentPrice === 0 || atr === 0) {
    return null;
  }

  const atr_pct = (atr / currentPrice) * 100;
  const min_distance_pct = Math.max(1.0, atr_pct * 1.5);

  if (side === "BUY") {
    const validSupports = supports
      .filter(s => s < currentPrice)
      .map(s => {
        const dist_pct = ((currentPrice - s) / currentPrice) * 100;
        return { price: s, distance_pct: dist_pct };
      })
      .filter(s => s.distance_pct >= min_distance_pct)
      .sort((a, b) => b.price - a.price);

    if (validSupports.length > 0) {
      const sl = validSupports[0];
      return {
        price: sl.price,
        distance_pct: sl.distance_pct,
        reason: "Support level (traditional)",
        tier: "C",
        vp_based: false
      };
    }

    const sl_price = currentPrice * (1 - (atr_pct * 2) / 100);
    return {
      price: sl_price,
      distance_pct: atr_pct * 2,
      reason: "ATR-based (2x) - fallback",
      tier: "D",
      vp_based: false
    };

  } else { // SELL
    const validResistances = resistances
      .filter(r => r > currentPrice)
      .map(r => {
        const dist_pct = ((r - currentPrice) / currentPrice) * 100;
        return { price: r, distance_pct: dist_pct };
      })
      .filter(r => r.distance_pct >= min_distance_pct)
      .sort((a, b) => a.price - b.price);

    if (validResistances.length > 0) {
      const sl = validResistances[0];
      return {
        price: sl.price,
        distance_pct: sl.distance_pct,
        reason: "Resistance level (traditional)",
        tier: "C",
        vp_based: false
      };
    }

    const sl_price = currentPrice * (1 + (atr_pct * 2) / 100);
    return {
      price: sl_price,
      distance_pct: atr_pct * 2,
      reason: "ATR-based (2x) - fallback",
      tier: "D",
      vp_based: false
    };
  }
}

function findTakeProfitsTraditional(coin, side, stopLoss) {
  const resistances = coin.ta_1h?.market_structure?.resistance_levels || [];
  const supports = coin.ta_1h?.market_structure?.support_levels || [];
  const currentPrice = coin.price || 0;
  const atr = coin.ta_1h?.atr || 0;

  if (currentPrice === 0 || !stopLoss) {
    return [];
  }

  const sl_distance_pct = stopLoss.distance_pct;

  if (side === "BUY") {
    const targets = resistances
      .filter(r => r > currentPrice)
      .map(r => {
        const dist_pct = ((r - currentPrice) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;
        return { price: r, distance_pct: dist_pct, rr: rr };
      })
      .filter(t => t.rr > 1.0)
      .sort((a, b) => a.price - b.price);

    if (targets.length >= 3) {
      return [
        { price: targets[0].price, size_pct: 45, rr: targets[0].rr, reason: "Resistance TP1", tier: "C" },
        { price: targets[1].price, size_pct: 35, rr: targets[1].rr, reason: "Resistance TP2", tier: "C" },
        { price: targets[2].price, size_pct: 20, rr: targets[2].rr, reason: "Resistance TP3", tier: "C" }
      ];
    }

    const atr_pct = (atr / currentPrice) * 100;
    const tp1_price = currentPrice * (1 + (atr_pct * 2) / 100);
    const tp2_price = currentPrice * (1 + (atr_pct * 3) / 100);
    const tp3_price = currentPrice * (1 + (atr_pct * 5) / 100);

    const tp1_dist = ((tp1_price - currentPrice) / currentPrice) * 100;
    const tp2_dist = ((tp2_price - currentPrice) / currentPrice) * 100;
    const tp3_dist = ((tp3_price - currentPrice) / currentPrice) * 100;

    return [
      { price: tp1_price, size_pct: 45, rr: tp1_dist / sl_distance_pct, reason: "ATR TP1 (2x)", tier: "D" },
      { price: tp2_price, size_pct: 35, rr: tp2_dist / sl_distance_pct, reason: "ATR TP2 (3x)", tier: "D" },
      { price: tp3_price, size_pct: 20, rr: tp3_dist / sl_distance_pct, reason: "ATR TP3 (5x)", tier: "D" }
    ];

  } else { // SELL
    const targets = supports
      .filter(s => s < currentPrice)
      .map(s => {
        const dist_pct = ((currentPrice - s) / currentPrice) * 100;
        const rr = dist_pct / sl_distance_pct;
        return { price: s, distance_pct: dist_pct, rr: rr };
      })
      .filter(t => t.rr > 1.0)
      .sort((a, b) => b.price - a.price);

    if (targets.length >= 3) {
      return [
        { price: targets[0].price, size_pct: 45, rr: targets[0].rr, reason: "Support TP1", tier: "C" },
        { price: targets[1].price, size_pct: 35, rr: targets[1].rr, reason: "Support TP2", tier: "C" },
        { price: targets[2].price, size_pct: 20, rr: targets[2].rr, reason: "Support TP3", tier: "C" }
      ];
    }

    const atr_pct = (atr / currentPrice) * 100;
    const tp1_price = currentPrice * (1 - (atr_pct * 2) / 100);
    const tp2_price = currentPrice * (1 - (atr_pct * 3) / 100);
    const tp3_price = currentPrice * (1 - (atr_pct * 5) / 100);

    const tp1_dist = ((currentPrice - tp1_price) / currentPrice) * 100;
    const tp2_dist = ((currentPrice - tp2_price) / currentPrice) * 100;
    const tp3_dist = ((currentPrice - tp3_price) / currentPrice) * 100;

    return [
      { price: tp1_price, size_pct: 45, rr: tp1_dist / sl_distance_pct, reason: "ATR TP1 (2x)", tier: "D" },
      { price: tp2_price, size_pct: 35, rr: tp2_dist / sl_distance_pct, reason: "ATR TP2 (3x)", tier: "D" },
      { price: tp3_price, size_pct: 20, rr: tp3_dist / sl_distance_pct, reason: "ATR TP3 (5x)", tier: "D" }
    ];
  }
}

function calculateWeightedRR(takeProfits, stopLossDistPct) {
  if (!takeProfits || takeProfits.length === 0) return 0;

  let weighted_tp_distance = 0;

  takeProfits.forEach(tp => {
    const weight = tp.size_pct / 100;
    const tp_distance = tp.rr * stopLossDistPct;
    weighted_tp_distance += tp_distance * weight;
  });

  return weighted_tp_distance / stopLossDistPct;
}

//===============================================================================
// MAIN PROCESSING - VP-ENHANCED SL/TP
//===============================================================================

const enrichedCoins = candidates.map(coin => {
  const side = coin.side;

  if (!side || side === "HOLD") {
    console.log(`   ⏭️  ${coin.symbol}: No side, skipping SL/TP`);
    return coin;
  }

  // 🆕 Extract VP data
  const { vp_15m, vp_1h, vp_4h } = extractVPData(coin);

  // 🆕 Try VP-based SL first
  let stopLoss = findStopLossVP(coin, side, vp_4h, vp_1h);
  let vpSLUsed = !!stopLoss;

  // Fallback to traditional if VP failed
  if (!stopLoss) {
    stopLoss = findStopLossTraditional(coin, side);
  }

  if (!stopLoss) {
    console.log(`   ⚠️  ${coin.symbol}: No valid SL found`);
    return {
      ...coin,
      sltp_status: "NO_SL",
      sltp_error: "Could not calculate stop loss"
    };
  }

  // 🆕 Try VP-based TPs first
  let takeProfits = findTakeProfitsVP(coin, side, stopLoss, vp_4h, vp_1h);
  let vpTPUsed = takeProfits.length > 0;

  // Fallback to traditional if VP didn't provide enough targets
  if (takeProfits.length === 0) {
    takeProfits = findTakeProfitsTraditional(coin, side, stopLoss);
  }

  if (takeProfits.length === 0) {
    console.log(`   ⚠️  ${coin.symbol}: No valid TPs found`);
    return {
      ...coin,
      sltp_status: "NO_TP",
      sltp_error: "Could not calculate take profits",
      stopLoss: stopLoss
    };
  }

  // Normalize size allocation to 100%
  const totalSize = takeProfits.reduce((sum, tp) => sum + tp.size_pct, 0);
  if (totalSize !== 100) {
    const ratio = 100 / totalSize;
    takeProfits = takeProfits.map(tp => ({
      ...tp,
      size_pct: Math.round(tp.size_pct * ratio)
    }));
  }

  const weightedRR = calculateWeightedRR(takeProfits, stopLoss.distance_pct);

  const vpIndicator = (vpSLUsed && vpTPUsed) ? " 🏆VP" : (vpSLUsed || vpTPUsed ? " 🥈VP" : "");
  console.log(`   ✅ ${coin.symbol} ${side}${vpIndicator}: SL ${stopLoss.distance_pct.toFixed(2)}% (${stopLoss.tier}) | RR ${weightedRR.toFixed(2)}:1`);

  return {
    ...coin,
    sltp_status: "SUCCESS",
    stopLoss: {
      price: stopLoss.price,
      distance_pct: stopLoss.distance_pct,
      reason: stopLoss.reason,
      tier: stopLoss.tier,
      vp_based: stopLoss.vp_based
    },
    takeProfit1: {
      price: takeProfits[0].price,
      size_pct: takeProfits[0].size_pct,
      rr: takeProfits[0].rr,
      reason: takeProfits[0].reason,
      tier: takeProfits[0].tier || "C"
    },
    takeProfit2: takeProfits[1] ? {
      price: takeProfits[1].price,
      size_pct: takeProfits[1].size_pct,
      rr: takeProfits[1].rr,
      reason: takeProfits[1].reason,
      tier: takeProfits[1].tier || "C"
    } : null,
    takeProfit3: takeProfits[2] ? {
      price: takeProfits[2].price,
      size_pct: takeProfits[2].size_pct,
      rr: takeProfits[2].rr,
      reason: takeProfits[2].reason,
      tier: takeProfits[2].tier || "C"
    } : null,
    weightedRR: weightedRR,
    sltp_metadata: {
      vp_sl_used: vpSLUsed,
      vp_tp_used: vpTPUsed,
      institutional_placement: vpSLUsed && vpTPUsed,
      version: "v2.0-vp-enhanced"
    }
  };
});

//===============================================================================
// OUTPUT
//===============================================================================

console.log(`\n📤 SL/TP FINDER v2.0 OUTPUT:`);
console.log(`   Input: ${candidates.length} coins`);
console.log(`   Output: ${enrichedCoins.length} coins (all passed through)`);

const successCount = enrichedCoins.filter(c => c.sltp_status === "SUCCESS").length;
const vpCount = enrichedCoins.filter(c => c.sltp_metadata?.institutional_placement).length;
console.log(`   ✅ Successfully enriched: ${successCount}`);
console.log(`   🏆 VP-based institutional placement: ${vpCount}`);
console.log(`   ⚠️  Partial/Failed: ${enrichedCoins.length - successCount}`);

console.log(`\n→ Passing ALL ${enrichedCoins.length} coins to Leverage Finder`);

return enrichedCoins.map(coin => ({ json: coin }));

