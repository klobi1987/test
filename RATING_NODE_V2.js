// ═══════════════════════════════════════════════════════════════════════════
// 🚀 RATING NODE V2 - SCORE-BASED POSITION SIZING
// ═══════════════════════════════════════════════════════════════════════════
//
// 🆕 V2 Changes from ULTIMATE:
// ✅ Position sizing based on CONVICTION + VP QUALITY (simplified)
// ✅ No more flat USDT boosts that skew sizing
// ✅ Proportional scaling: Better setup = Bigger size (but capped properly)
// ✅ Range: 30-90 USDT based on quality tiers
//
// 🔴 PROBLEM V1: Scenario boost added flat +15-20 USDT regardless of conviction
//    Result: HIGH conviction (60) + scenario (15) = 75 USDT (too aggressive!)
//
// ✅ SOLUTION V2: Tiered system based on conviction + VP quality combo
//    Result: Only ELITE setups (EXTREME + EXCELLENT/GOLDEN) get 85-90 USDT
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input data!");
  return [{json: {error: "No input", candidates: []}}];
}

let candidates = input.map(item => item.json);

//===============================================================================
// 🔧 POSITION SIZING V2 - TIERED SYSTEM
//===============================================================================

const POSITION_SIZING_V2 = {
  min_trade_size_usdt: 30,
  max_trade_size_usdt: 90,

  // 🆕 Conviction-based BASE tiers
  conviction_base: {
    "EXTREME": 75,     // Elite setups start at 75
    "HIGH": 60,        // Strong setups start at 60
    "MEDIUM": 45,      // Decent setups start at 45
    "LOW": 30          // Marginal setups minimum
  },

  // 🆕 VP Quality MULTIPLIERS (not flat bonus!)
  vp_quality_multiplier: {
    "GOLDEN": 1.20,        // 75 × 1.20 = 90 (max!)
    "EXCELLENT": 1.13,     // 75 × 1.13 = 84.75 ≈ 85
    "GOOD": 1.0,           // 75 × 1.0 = 75
    "MODERATE": 0.87       // 75 × 0.87 = 65.25 ≈ 65
  },

  // Volatility adjustments (keep from V1)
  volatility_multiplier: {
    "EXTREME": 0.75,       // Reduce 25% in extreme vol
    "HIGH": 0.90,          // Reduce 10%
    "MEDIUM": 1.0,         // Normal
    "LOW": 1.10            // Increase 10%
  },

  // 🆕 Market scenario MULTIPLIERS (not flat USDT!)
  scenario_multiplier: {
    "PEAK_ALT_SEASON": 1.10,     // +10% max (90 stays 90, 75 → 82.5)
    "ALT_DECOUPLING": 1.08,      // +8%
    "COIN_DECOUPLING": 1.05,     // +5%
    "SECTOR_LEADER": 1.03,       // +3%
    "FUNDING_DIVERGENCE": 1.02,  // +2%
    "BTC_ONLY_RALLY": 0.85,      // -15% (reduce ALT exposure)
    "CAPITULATION": 0.70,        // -30% (defensive)
    "NEUTRAL": 1.0
  }
};

console.log(`\n🚀 RATING NODE V2 - SCORE-BASED POSITION SIZING`);
console.log(`   Processing ${candidates.length} candidates`);
console.log(`   💵 Position Range: ${POSITION_SIZING_V2.min_trade_size_usdt}-${POSITION_SIZING_V2.max_trade_size_usdt} USDT (TIERED)`);
console.log(`   🎯 Only ELITE setups get MAX capital`);

// ... (Keep all existing functions from ULTIMATE: BTC regime, dominance, market scenario, etc.)
// I'm showing ONLY the changed position sizing function below:

//===============================================================================
// 🆕 V2 POSITION SIZING - TIERED & PROPORTIONAL
//===============================================================================

function calculatePositionSizeV2(conviction, vpQuality, marketState, marketScenario, sectorLeadership) {
  // 1️⃣ Get conviction base tier
  let size_usdt = POSITION_SIZING_V2.conviction_base[conviction] || 45;

  console.log(`   💰 Base (${conviction}): ${size_usdt} USDT`);

  // 2️⃣ Apply VP quality MULTIPLIER (not flat bonus!)
  const vpMult = POSITION_SIZING_V2.vp_quality_multiplier[vpQuality] || 1.0;
  size_usdt *= vpMult;

  console.log(`      × ${vpMult.toFixed(2)} (${vpQuality} VP) = ${size_usdt.toFixed(1)} USDT`);

  // 3️⃣ Apply volatility multiplier
  const volMult = POSITION_SIZING_V2.volatility_multiplier[marketState.volatility_regime] || 1.0;
  size_usdt *= volMult;

  console.log(`      × ${volMult.toFixed(2)} (${marketState.volatility_regime} vol) = ${size_usdt.toFixed(1)} USDT`);

  // 4️⃣ Apply scenario MULTIPLIER (not flat USDT!)
  const scenario = marketScenario?.scenario || "NEUTRAL";
  const scenarioMult = POSITION_SIZING_V2.scenario_multiplier[scenario] || 1.0;
  size_usdt *= scenarioMult;

  console.log(`      × ${scenarioMult.toFixed(2)} (${scenario}) = ${size_usdt.toFixed(1)} USDT`);

  // 5️⃣ Sector leader small boost (optional, keep it small)
  if (sectorLeadership && sectorLeadership.is_leader) {
    size_usdt *= 1.03;  // +3% for sector leaders
    console.log(`      × 1.03 (SECTOR LEADER) = ${size_usdt.toFixed(1)} USDT`);
  }

  // 6️⃣ Round and cap
  size_usdt = Math.round(size_usdt);
  size_usdt = Math.max(POSITION_SIZING_V2.min_trade_size_usdt, size_usdt);
  size_usdt = Math.min(POSITION_SIZING_V2.max_trade_size_usdt, size_usdt);

  console.log(`      → FINAL: ${size_usdt} USDT (capped ${POSITION_SIZING_V2.min_trade_size_usdt}-${POSITION_SIZING_V2.max_trade_size_usdt})`);

  return size_usdt;
}

//===============================================================================
// 📊 POSITION SIZING EXAMPLES (for documentation)
//===============================================================================

/*
EXAMPLES V2:

1. ELITE Setup (EXTREME + EXCELLENT + ALT_DECOUPLING):
   75 (EXTREME) × 1.13 (EXCELLENT) × 1.0 (MEDIUM vol) × 1.08 (ALT_DECOUPLING) × 1.0
   = 75 × 1.13 × 1.08
   = 91.5 → capped at 90 USDT ✅

2. ELITE Setup (EXTREME + GOLDEN + PEAK_ALT_SEASON):
   75 (EXTREME) × 1.20 (GOLDEN) × 1.0 (vol) × 1.10 (PEAK_ALT_SEASON)
   = 75 × 1.20 × 1.10
   = 99 → capped at 90 USDT ✅

3. Strong Setup (HIGH + GOOD + NEUTRAL):
   60 (HIGH) × 1.0 (GOOD) × 1.0 (vol) × 1.0 (NEUTRAL)
   = 60 USDT ✅ (Not 75!)

4. Strong Setup (HIGH + EXCELLENT + ALT_DECOUPLING):
   60 (HIGH) × 1.13 (EXCELLENT) × 1.0 × 1.08 (ALT_DECOUPLING)
   = 60 × 1.13 × 1.08
   = 73.2 ≈ 73 USDT ✅ (Reasonable!)

5. Decent Setup (MEDIUM + GOOD + NEUTRAL):
   45 (MEDIUM) × 1.0 (GOOD) × 1.0 × 1.0
   = 45 USDT ✅

6. Marginal Setup (HIGH + MODERATE + BTC_ONLY_RALLY):
   60 (HIGH) × 0.87 (MODERATE) × 1.0 × 0.85 (BTC_ONLY_RALLY)
   = 60 × 0.87 × 0.85
   = 44.4 ≈ 44 USDT ✅ (Penalized properly!)

7. Defensive (EXTREME + EXCELLENT + CAPITULATION):
   75 (EXTREME) × 1.13 (EXCELLENT) × 1.0 × 0.70 (CAPITULATION)
   = 75 × 1.13 × 0.70
   = 59.3 ≈ 59 USDT ✅ (Risk-off mode!)

COMPARISON V1 vs V2:
┌────────────────────────────────────┬─────────┬─────────┐
│ Setup                              │ V1      │ V2      │
├────────────────────────────────────┼─────────┼─────────┤
│ EXTREME + EXCELLENT + ALT_DECOUP   │ 90      │ 90      │ ✅ Same
│ HIGH + GOOD + ALT_DECOUP           │ 75      │ 73      │ ✅ V2 more conservative
│ HIGH + GOOD + NEUTRAL              │ 60      │ 60      │ ✅ Same
│ MEDIUM + MODERATE + NEUTRAL        │ 40      │ 39      │ ✅ V2 slightly lower
│ EXTREME + GOLDEN + PEAK_ALT        │ 90 (cap)│ 90 (cap)│ ✅ Same (both maxed)
└────────────────────────────────────┴─────────┴─────────┘

KEY INSIGHT:
V1: Scenario boost pushed EVERYTHING up by flat +15-20 USDT
V2: Scenario multiplier scales proportionally (elite setups benefit more)
*/

// Export for use in main code
module.exports = {
  POSITION_SIZING_V2,
  calculatePositionSizeV2
};
