// ═══════════════════════════════════════════════════════════════════════════
// ⚖️ LEVERAGE FINDER v3.0 - WITH VOLUME PROFILE DYNAMIC ADJUSTMENT ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v3.0:
// ✅ Volume Profile-based dynamic leverage adjustment
// ✅ GOLDEN setup premium leverage (up to +3x boost)
// ✅ Multi-timeframe alignment bonus (+0.5x)
// ✅ @ POC precision entry boost (+1x)
// ✅ HVN support/resistance safety adjustment
// ✅ Risk reduction for coins outside value area
//
// ROLE: Calculate optimal leverage based on VP setup quality + risk management
//
// INPUT: Coins with VP data + SL/TP from previous nodes
// OUTPUT: Same coins + VP-enhanced leverage calculation
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from SL/TP Finder!");
  return [];
}

const candidates = input.map(item => item.json);

console.log(`\n⚖️ LEVERAGE FINDER v3.0 WITH VOLUME PROFILE - Processing ${candidates.length} coins`);
console.log(`   🆕 Dynamic VP-based leverage adjustment enabled!`);

//===============================================================================
// CONFIGURATION - CHOOSE YOUR MODE
//===============================================================================

// Toggle between fixed and compounding allocation
const USE_COMPOUNDING = true;  // Set to false for fixed allocation

// ACCOUNT SETTINGS (for compounding mode)
const ACCOUNT_EQUITY = 500;  // Your total account balance

// COMPOUNDING MODE: % of equity per trade
const PCT_ALLOCATION_BY_CONFIDENCE = {
  HIGH: 0.14,   // 14% of equity (aggressive)
  MED: 0.10,    // 10% of equity (baseline)
  LOW: 0.06     // 6% of equity (conservative)
};

// FIXED MODE: Static USDT per trade
const FIXED_ALLOCATION_BY_CONFIDENCE = {
  HIGH: 70,     // $70 per trade (aggressive)
  MED: 50,      // $50 per trade (baseline)
  LOW: 30       // $30 per trade (conservative)
};

// 🆕 VP-BASED LEVERAGE MULTIPLIERS
const VP_LEVERAGE_CONFIG = {
  // Setup quality bonuses
  GOLDEN: 3.0,      // +3x for GOLDEN setups (all 3 TF aligned @ POC)
  EXCELLENT: 2.0,   // +2x for EXCELLENT setups (all in value area)
  GOOD: 1.0,        // +1x for GOOD setups
  MODERATE: 0.5,    // +0.5x for MODERATE setups

  // Additional bonuses
  AT_POC_4H: 1.0,           // +1x if @ POC on 4H
  AT_POC_1H: 0.5,           // +0.5x if @ POC on 1H
  MULTI_TF_ALIGNED: 0.5,    // +0.5x if multi-TF aligned
  HVN_SUPPORT_STRONG: 0.5,  // +0.5x if 2+ HVN support levels

  // Risk reductions
  OUTSIDE_VALUE_AREA: -1.0,  // -1x if far from value area
  HVN_RISK_HIGH: -0.5,       // -0.5x if high HVN risk
  VP_NOT_AVAILABLE: -0.5,    // -0.5x if no VP data

  // Safety caps
  MAX_LEVERAGE: 6,           // Maximum leverage regardless of setup
  MIN_LEVERAGE: 2            // Minimum leverage for any trade
};

// Bybit tier-based maintenance rates
const MAINTENANCE_TIERS = [
  { max: 50000, rate: 0.004 },
  { max: 250000, rate: 0.005 },
  { max: 1000000, rate: 0.010 },
  { max: Infinity, rate: 0.020 }
];

//===============================================================================
// 🆕 VOLUME PROFILE LEVERAGE ADJUSTMENT
//===============================================================================

function calculateVPLeverageBoost(coin) {
  let vpBoost = 0;
  const reasons = [];

  // Extract VP data
  const vpSetupQuality = coin.vp_setup_quality || "MODERATE";
  const vpMultiTFAligned = coin.vp_multi_tf_aligned || false;
  const vp4hAtPOC = coin.vp_4h_at_poc || false;
  const hvnRisk = coin.hvn_risk || "UNKNOWN";
  const hvnSupportLevels = coin.hvn_support_levels || 0;

  // Check if VP data is available
  const hasVPData = coin.sltp_metadata?.vp_sl_used || coin.sltp_metadata?.vp_tp_used;

  if (!hasVPData) {
    vpBoost += VP_LEVERAGE_CONFIG.VP_NOT_AVAILABLE;
    reasons.push(`No VP data (${VP_LEVERAGE_CONFIG.VP_NOT_AVAILABLE}x)`);
    return { vpBoost, reasons, tier: "D" };
  }

  // 🏆 PRIMARY: Setup Quality
  switch (vpSetupQuality) {
    case "GOLDEN":
      vpBoost += VP_LEVERAGE_CONFIG.GOLDEN;
      reasons.push(`GOLDEN setup (+${VP_LEVERAGE_CONFIG.GOLDEN}x) 🏆`);
      break;
    case "EXCELLENT":
      vpBoost += VP_LEVERAGE_CONFIG.EXCELLENT;
      reasons.push(`EXCELLENT setup (+${VP_LEVERAGE_CONFIG.EXCELLENT}x)`);
      break;
    case "GOOD":
      vpBoost += VP_LEVERAGE_CONFIG.GOOD;
      reasons.push(`GOOD setup (+${VP_LEVERAGE_CONFIG.GOOD}x)`);
      break;
    case "MODERATE":
      vpBoost += VP_LEVERAGE_CONFIG.MODERATE;
      reasons.push(`MODERATE setup (+${VP_LEVERAGE_CONFIG.MODERATE}x)`);
      break;
  }

  // 🔹 BONUS: @ POC on 4H
  if (vp4hAtPOC) {
    vpBoost += VP_LEVERAGE_CONFIG.AT_POC_4H;
    reasons.push(`@ POC 4H (+${VP_LEVERAGE_CONFIG.AT_POC_4H}x)`);
  }

  // 🔹 BONUS: Multi-TF alignment
  if (vpMultiTFAligned) {
    vpBoost += VP_LEVERAGE_CONFIG.MULTI_TF_ALIGNED;
    reasons.push(`Multi-TF aligned (+${VP_LEVERAGE_CONFIG.MULTI_TF_ALIGNED}x)`);
  }

  // 🔹 BONUS: Strong HVN support
  if (hvnSupportLevels >= 2) {
    vpBoost += VP_LEVERAGE_CONFIG.HVN_SUPPORT_STRONG;
    reasons.push(`HVN support strong (+${VP_LEVERAGE_CONFIG.HVN_SUPPORT_STRONG}x)`);
  }

  // ⚠️ RISK REDUCTION: High HVN risk
  if (hvnRisk === "HIGH") {
    vpBoost += VP_LEVERAGE_CONFIG.HVN_RISK_HIGH;
    reasons.push(`HVN risk HIGH (${VP_LEVERAGE_CONFIG.HVN_RISK_HIGH}x)`);
  }

  // ⚠️ RISK REDUCTION: Outside value area (if applicable)
  // This would require checking 4H price_position, but we don't have direct access
  // We can infer from vp_4h_signal
  const vp4hSignal = coin.vp_4h_signal || "NEUTRAL";
  if (vp4hSignal === "NEUTRAL" && !vp4hAtPOC && !vpMultiTFAligned) {
    // Likely outside value area or weak position
    // Only apply if setup quality is not GOLDEN/EXCELLENT
    if (vpSetupQuality !== "GOLDEN" && vpSetupQuality !== "EXCELLENT") {
      vpBoost += VP_LEVERAGE_CONFIG.OUTSIDE_VALUE_AREA * 0.5; // Half penalty
      reasons.push(`Weak VP position (${VP_LEVERAGE_CONFIG.OUTSIDE_VALUE_AREA * 0.5}x)`);
    }
  }

  // Determine tier based on setup quality
  let tier = "C";
  if (vpSetupQuality === "GOLDEN") tier = "S";
  else if (vpSetupQuality === "EXCELLENT") tier = "A";
  else if (vpSetupQuality === "GOOD") tier = "B";

  return { vpBoost, reasons, tier };
}

//===============================================================================
// HELPER FUNCTIONS
//===============================================================================

function getMaintenanceRate(notional_value) {
  for (const tier of MAINTENANCE_TIERS) {
    if (notional_value <= tier.max) {
      return tier.rate;
    }
  }
  return 0.020;
}

function calculateAllocation(confidence) {
  if (USE_COMPOUNDING) {
    const pct = PCT_ALLOCATION_BY_CONFIDENCE[confidence] || 0.10;
    const allocation = ACCOUNT_EQUITY * pct;
    return allocation;
  } else {
    const allocation = FIXED_ALLOCATION_BY_CONFIDENCE[confidence] || 50;
    return allocation;
  }
}

function calculateLeverage(coin, allocation_usdt) {
  const price = coin.price || 0;
  const maxLeverage = coin.data?.maxLeverage || 20;
  const stopLoss = coin.stopLoss;

  if (!stopLoss || price === 0) {
    return null;
  }

  const sl_distance_pct = stopLoss.distance_pct;

  // Calculate SAFE base leverage (unchanged from v2.1)
  const safe_leverage_sl = Math.floor(90 / sl_distance_pct);

  const estimated_notional = allocation_usdt * safe_leverage_sl;
  const maint_rate = getMaintenanceRate(estimated_notional);

  const safe_leverage_liq = Math.floor((1 - maint_rate) / (sl_distance_pct / 100 * 1.2));

  // 🆕 CALCULATE VP BOOST
  const vpAdjustment = calculateVPLeverageBoost(coin);
  const vpBoost = vpAdjustment.vpBoost;
  const vpReasons = vpAdjustment.reasons;
  const vpTier = vpAdjustment.tier;

  // 🆕 APPLY VP BOOST TO BASE LEVERAGE
  let base_leverage = Math.min(safe_leverage_sl, safe_leverage_liq, maxLeverage);
  let vp_adjusted_leverage = base_leverage + vpBoost;

  // 🆕 APPLY VP SAFETY CAPS
  vp_adjusted_leverage = Math.max(vp_adjusted_leverage, VP_LEVERAGE_CONFIG.MIN_LEVERAGE);
  vp_adjusted_leverage = Math.min(vp_adjusted_leverage, VP_LEVERAGE_CONFIG.MAX_LEVERAGE);
  vp_adjusted_leverage = Math.min(vp_adjusted_leverage, maxLeverage); // Exchange limit

  let final_leverage = Math.floor(vp_adjusted_leverage);
  final_leverage = Math.max(1, final_leverage);

  // Position calculations
  const position_value_usdt = allocation_usdt * final_leverage;
  const quantity = position_value_usdt / price;
  const margin_usdt = allocation_usdt;

  // Liquidation calculation
  const side = coin.side;
  let liquidation_price = 0;

  if (side === "BUY") {
    liquidation_price = price * (1 - (1 - maint_rate) / final_leverage);
  } else if (side === "SELL") {
    liquidation_price = price * (1 + (1 - maint_rate) / final_leverage);
  }

  const liq_distance_pct = Math.abs((liquidation_price - price) / price * 100);
  const buffer_pct = liq_distance_pct - sl_distance_pct;

  return {
    leverage: final_leverage,
    allocation_usdt: allocation_usdt,
    margin_usdt: margin_usdt,
    position_value_usdt: position_value_usdt,
    quantity: quantity,
    liquidation_price: liquidation_price,
    liquidation_distance_pct: liq_distance_pct,
    buffer_pct: buffer_pct,
    maintenance_rate: maint_rate,
    safe_leverage_sl: safe_leverage_sl,
    safe_leverage_liq: safe_leverage_liq,
    base_leverage: base_leverage,
    vp_boost: vpBoost,
    vp_reasons: vpReasons,
    vp_tier: vpTier,
    max_leverage: maxLeverage
  };
}

//===============================================================================
// PROCESS ALL COINS
//===============================================================================

console.log(`\n💰 ALLOCATION MODE: ${USE_COMPOUNDING ? 'COMPOUNDING (% based)' : 'FIXED (static USDT)'}`);
if (USE_COMPOUNDING) {
  console.log(`   Account Equity: $${ACCOUNT_EQUITY}`);
  console.log(`   HIGH: ${(PCT_ALLOCATION_BY_CONFIDENCE.HIGH * 100).toFixed(0)}% = $${(ACCOUNT_EQUITY * PCT_ALLOCATION_BY_CONFIDENCE.HIGH).toFixed(2)}`);
  console.log(`   MED: ${(PCT_ALLOCATION_BY_CONFIDENCE.MED * 100).toFixed(0)}% = $${(ACCOUNT_EQUITY * PCT_ALLOCATION_BY_CONFIDENCE.MED).toFixed(2)}`);
  console.log(`   LOW: ${(PCT_ALLOCATION_BY_CONFIDENCE.LOW * 100).toFixed(0)}% = $${(ACCOUNT_EQUITY * PCT_ALLOCATION_BY_CONFIDENCE.LOW).toFixed(2)}`);
}

console.log(`\n🆕 VP LEVERAGE BOOSTS ENABLED:`);
console.log(`   🏆 GOLDEN: +${VP_LEVERAGE_CONFIG.GOLDEN}x`);
console.log(`   🥈 EXCELLENT: +${VP_LEVERAGE_CONFIG.EXCELLENT}x`);
console.log(`   🥉 GOOD: +${VP_LEVERAGE_CONFIG.GOOD}x`);
console.log(`   ⚙️  Max Leverage: ${VP_LEVERAGE_CONFIG.MAX_LEVERAGE}x (safety cap)`);

const enrichedCoins = candidates.map(coin => {
  const regime = coin._regime;

  if (!regime) {
    console.log(`   ⏭️  ${coin.symbol}: No regime data, skipping`);
    return coin;
  }

  const confidence = regime.confidence || "LOW";

  // Calculate allocation
  const allocation_usdt = calculateAllocation(confidence);

  // Calculate VP-enhanced leverage
  const leverageData = calculateLeverage(coin, allocation_usdt);

  if (!leverageData) {
    console.log(`   ⚠️  ${coin.symbol}: Could not calculate leverage`);
    return {
      ...coin,
      leverage_status: "FAILED",
      leverage_error: "Could not calculate leverage"
    };
  }

  const vpIndicator = leverageData.vp_tier === "S" ? " 🏆" :
                      (leverageData.vp_tier === "A" ? " 🥈" :
                      (leverageData.vp_tier === "B" ? " 🥉" : ""));

  console.log(`   ✅ ${coin.symbol} (${confidence})${vpIndicator}: ${leverageData.leverage}x (base ${leverageData.base_leverage}x + VP ${leverageData.vp_boost > 0 ? '+' : ''}${leverageData.vp_boost.toFixed(1)}x)`);
  console.log(`      Margin: $${leverageData.margin_usdt.toFixed(2)} | Position: $${leverageData.position_value_usdt.toFixed(2)} | Buffer: ${leverageData.buffer_pct.toFixed(1)}%`);
  if (leverageData.vp_reasons.length > 0) {
    console.log(`      VP: ${leverageData.vp_reasons.join(', ')}`);
  }

  return {
    ...coin,
    leverage_status: "SUCCESS",
    leverage: leverageData.leverage,
    allocation_usdt: leverageData.allocation_usdt,
    margin_usdt: leverageData.margin_usdt,
    position_value_usdt: leverageData.position_value_usdt,
    quantity: leverageData.quantity,
    liquidation_price: leverageData.liquidation_price,
    liquidation_distance_pct: leverageData.liquidation_distance_pct,
    buffer_pct: leverageData.buffer_pct,
    leverage_metadata: {
      strategy: USE_COMPOUNDING ? "compounding" : "fixed",
      confidence: confidence,
      account_equity: USE_COMPOUNDING ? ACCOUNT_EQUITY : undefined,
      allocation_pct: USE_COMPOUNDING ? PCT_ALLOCATION_BY_CONFIDENCE[confidence] : undefined,
      maintenance_rate: leverageData.maintenance_rate,
      safe_leverage_sl: leverageData.safe_leverage_sl,
      safe_leverage_liq: leverageData.safe_leverage_liq,
      base_leverage: leverageData.base_leverage,
      vp_boost: leverageData.vp_boost,
      vp_reasons: leverageData.vp_reasons,
      vp_tier: leverageData.vp_tier,
      max_leverage: leverageData.max_leverage,
      vp_enhanced: true,
      version: "v3.0-vp-dynamic"
    }
  };
});

//===============================================================================
// OUTPUT
//===============================================================================

console.log(`\n📤 LEVERAGE FINDER v3.0 OUTPUT:`);
console.log(`   Input: ${candidates.length} coins`);
console.log(`   Output: ${enrichedCoins.length} coins`);

const successCount = enrichedCoins.filter(c => c.leverage_status === "SUCCESS").length;
const vpEnhancedCount = enrichedCoins.filter(c =>
  c.leverage_metadata?.vp_tier === "S" || c.leverage_metadata?.vp_tier === "A"
).length;

console.log(`   ✅ Successfully enriched: ${successCount}`);
console.log(`   🏆 VP-enhanced (S/A tier): ${vpEnhancedCount}`);

console.log(`\n→ Passing ALL ${enrichedCoins.length} coins to Trade Selector`);

return enrichedCoins.map(coin => ({ json: coin }));

