// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TRADE SELECTOR ULTIMATE V4.0 - COMPATIBLE WITH V5 LEVERAGE FINDER
// ═══════════════════════════════════════════════════════════════════════════
//
// 🆕 NEW IN V4.0:
// ✅ Fixed field mappings for V5 Leverage Finder output
// ✅ VP Quality scoring (EXCELLENT, GOLDEN, GOOD, MODERATE)
// ✅ Multi-timeframe VP alignment bonus
// ✅ Max 5 positions per direction (long/short)
// ✅ Diversification support (select multiple A+ setups)
// ✅ Proper validation with correct field names
//
// 🎯 FIELD MAPPINGS (V5 compatible):
// - stop_loss, stop_loss_pct (not stopLoss.price)
// - take_profit_1, take_profit_1_pct (not takeProfit1.price)
// - liq_buffer_pct (not buffer_pct)
// - leveraged_rr (not weightedRR)
// - vp_setup_quality (EXCELLENT, GOLDEN, etc.)
// - leverage_status (not sltp_status)
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Leverage Finder!");
  return [{json: {
    message: "NO_TRADE",
    reason: "No input data from previous node",
    _meta: {
      selector_version: "4.0-v5-compatible",
      timestamp: new Date().toISOString()
    }
  }}];
}

const candidates = input.map(item => item.json);

console.log(`\n⚡ TRADE SELECTOR ULTIMATE V4.0 - V5 COMPATIBLE`);
console.log(`   Processing ${candidates.length} candidates`);
console.log(`   Max 5 positions per direction (LONG/SHORT)\n`);

//===============================================================================
// 🔧 CONFIGURATION
//===============================================================================

const CONFIG = {
  // Quality thresholds (aggressive for small account)
  min_alpha: 70,          // Strong momentum
  min_rr: 2.0,            // Minimum risk/reward
  min_buffer: 2.0,        // Safe liquidation margin (lowered from 3%)
  min_score: 65,          // A+ quality

  // Position limits
  max_positions_per_side: 5,   // Max 5 LONG + 5 SHORT

  // Diversification (if multiple A+ setups)
  enable_diversification: true,
  max_selected: 3,              // Select up to 3 best

  // Score weights (must sum to 100)
  weights: {
    alpha: 30,
    rr: 25,
    buffer: 15,
    momentum: 10,
    confidence: 5,
    vp_quality: 15    // Volume Profile quality
  },

  // VP Quality scoring
  vp_scores: {
    "GOLDEN": 15,      // Perfect setup
    "EXCELLENT": 12,   // Great setup
    "GOOD": 8,         // Decent setup
    "MODERATE": 4,     // Weak setup
    "WEAK": 0          // No bonus
  }
};

console.log(`⚡ THRESHOLDS: Alpha ≥${CONFIG.min_alpha}, RR ≥${CONFIG.min_rr}:1, Buffer ≥${CONFIG.min_buffer}%, Score ≥${CONFIG.min_score}`);
console.log(`🔢 MAX POSITIONS: ${CONFIG.max_positions_per_side} per side (LONG/SHORT)`);

//===============================================================================
// 🔍 HELPER FUNCTIONS
//===============================================================================

function validateDataQuality(coin) {
  const errors = [];
  const symbol = coin.symbol || "UNKNOWN";

  // Check leverage calculation status
  if (coin.leverage_status !== "SUCCESS") {
    errors.push(`Leverage calculation failed: ${coin.leverage_error || 'unknown'}`);
    return { valid: false, errors };
  }

  // Check validation field (from SL/TP or Leverage Finder)
  if (coin.validation && !coin.validation.valid) {
    errors.push(`Validation failed: ${coin.validation.issues?.join(', ') || 'unknown'}`);
    return { valid: false, errors };
  }

  // Check leverage validation
  if (coin.leverage_validation && !coin.leverage_validation.safe) {
    errors.push(`Leverage unsafe: ${coin.leverage_validation.issues?.join(', ') || 'unknown'}`);
    return { valid: false, errors };
  }

  // Check required price fields
  if (!coin.entry_price || coin.entry_price <= 0) {
    errors.push("Missing or invalid entry_price");
    return { valid: false, errors };
  }

  if (!coin.stop_loss || coin.stop_loss <= 0) {
    errors.push("Missing or invalid stop_loss");
    return { valid: false, errors };
  }

  if (!coin.take_profit_1 || coin.take_profit_1 <= 0) {
    errors.push("Missing or invalid take_profit_1");
    return { valid: false, errors };
  }

  if (!coin.leverage || coin.leverage < 1) {
    errors.push("Missing or invalid leverage");
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateThresholds(coin) {
  const errors = [];

  // Alpha check
  const alpha = coin.alpha || coin.alphaScore || 0;
  if (alpha < CONFIG.min_alpha) {
    errors.push(`Alpha ${alpha.toFixed(1)} < ${CONFIG.min_alpha}`);
  }

  // Risk/Reward check (use leveraged_rr or risk_reward_ratio)
  const rr = coin.leveraged_rr || coin.risk_reward_ratio || 0;
  if (rr < CONFIG.min_rr) {
    errors.push(`RR ${rr.toFixed(2)} < ${CONFIG.min_rr}`);
  }

  // Buffer check
  const buffer = coin.liq_buffer_pct || 0;
  if (buffer < CONFIG.min_buffer) {
    errors.push(`Buffer ${buffer.toFixed(2)}% < ${CONFIG.min_buffer}%`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function normalizeScore(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

function calculateTradeScore(coin) {
  const scoreComponents = {};

  // 1. ALPHA SCORE (0-30 pts)
  const alpha = coin.alpha || coin.alphaScore || 0;
  const alphaNorm = normalizeScore(alpha, 70, 200);
  scoreComponents.alpha = alphaNorm * CONFIG.weights.alpha;

  // 2. RISK-REWARD SCORE (0-25 pts)
  const rr = coin.leveraged_rr || coin.risk_reward_ratio || 0;
  const rrNorm = normalizeScore(rr, 2.0, 5.0);
  scoreComponents.rr = rrNorm * CONFIG.weights.rr;

  // 3. BUFFER SCORE (0-15 pts)
  const buffer = coin.liq_buffer_pct || 0;
  const bufferNorm = normalizeScore(buffer, 2.0, 10.0);
  scoreComponents.buffer = bufferNorm * CONFIG.weights.buffer;

  // 4. MOMENTUM SCORE (0-10 pts)
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;

  let momentumScore = 0;
  if (altRankJump > 1000 || galaxyJump > 20) momentumScore = 1.0;
  else if (altRankJump > 500 || galaxyJump > 10) momentumScore = 0.7;
  else if (altRankJump > 200 || galaxyJump > 5) momentumScore = 0.4;

  scoreComponents.momentum = momentumScore * CONFIG.weights.momentum;

  // 5. CONFIDENCE SCORE (0-5 pts)
  const conviction = coin.conviction || "MEDIUM";
  let confidenceScore = 0;
  if (conviction === "EXTREME") confidenceScore = 1.0;
  else if (conviction === "HIGH") confidenceScore = 0.7;
  else if (conviction === "MEDIUM") confidenceScore = 0.4;

  scoreComponents.confidence = confidenceScore * CONFIG.weights.confidence;

  // 6. VP QUALITY SCORE (0-15 pts + bonus)
  const vpQuality = coin.vp_setup_quality || "MODERATE";
  let vpScore = CONFIG.vp_scores[vpQuality] || 0;

  // Multi-TF alignment bonus (+2 pts)
  if (coin.vp_multi_tf_aligned && vpScore > 0) {
    vpScore += 2;
  }

  scoreComponents.vp_quality = Math.min(vpScore, CONFIG.weights.vp_quality + 2);

  // TOTAL
  const total = Object.values(scoreComponents).reduce((sum, val) => sum + val, 0);

  return {
    total: Math.round(total * 10) / 10,
    breakdown: {
      alpha: Math.round(scoreComponents.alpha * 10) / 10,
      rr: Math.round(scoreComponents.rr * 10) / 10,
      buffer: Math.round(scoreComponents.buffer * 10) / 10,
      momentum: Math.round(scoreComponents.momentum * 10) / 10,
      confidence: Math.round(scoreComponents.confidence * 10) / 10,
      vp_quality: Math.round(scoreComponents.vp_quality * 10) / 10
    }
  };
}

//===============================================================================
// 📊 PROCESS CANDIDATES
//===============================================================================

console.log(`\n🔍 Processing candidates...\n`);

const stats = {
  total: candidates.length,
  data_quality_failed: 0,
  threshold_failed: 0,
  low_alpha: 0,
  low_rr: 0,
  low_buffer: 0,
  low_score: 0,
  passed: 0,
  vp_golden: 0,
  vp_excellent: 0,
  vp_good: 0
};

const scoredCandidates = [];

for (const coin of candidates) {
  const symbol = coin.symbol || "UNKNOWN";

  // 1. Data quality check
  const qualityCheck = validateDataQuality(coin);
  if (!qualityCheck.valid) {
    console.log(`❌ ${symbol}: Data quality failed`);
    qualityCheck.errors.forEach(err => console.log(`   └─ ${err}`));
    stats.data_quality_failed++;
    continue;
  }

  // 2. Threshold validation
  const thresholdCheck = validateThresholds(coin);
  if (!thresholdCheck.valid) {
    console.log(`⚠️ ${symbol}: Failed thresholds`);
    thresholdCheck.errors.forEach(err => console.log(`   └─ ${err}`));

    stats.threshold_failed++;
    if (thresholdCheck.errors.some(e => e.includes("Alpha"))) stats.low_alpha++;
    if (thresholdCheck.errors.some(e => e.includes("RR"))) stats.low_rr++;
    if (thresholdCheck.errors.some(e => e.includes("Buffer"))) stats.low_buffer++;
    continue;
  }

  // 3. Calculate score
  const scoring = calculateTradeScore(coin);

  // VP indicator
  const vpQuality = coin.vp_setup_quality || "MODERATE";
  const vpIndicator = vpQuality === "GOLDEN" ? " 🏆" :
                      (vpQuality === "EXCELLENT" ? " 💎" :
                      (vpQuality === "GOOD" ? " ✨" : ""));

  // Track VP stats
  if (vpQuality === "GOLDEN") stats.vp_golden++;
  else if (vpQuality === "EXCELLENT") stats.vp_excellent++;
  else if (vpQuality === "GOOD") stats.vp_good++;

  console.log(`📊 ${symbol}${vpIndicator}: Score ${scoring.total}/100`);
  console.log(`   Alpha: ${scoring.breakdown.alpha}/${CONFIG.weights.alpha} | RR: ${scoring.breakdown.rr}/${CONFIG.weights.rr} | Buffer: ${scoring.breakdown.buffer}/${CONFIG.weights.buffer} | VP: ${scoring.breakdown.vp_quality}/${CONFIG.weights.vp_quality + 2}`);

  if (scoring.total < CONFIG.min_score) {
    console.log(`   ⚠️ Score ${scoring.total} < ${CONFIG.min_score} (not A+)`);
    stats.low_score++;
    continue;
  }

  console.log(`   ✅ A+ SETUP PASSED!\n`);

  scoredCandidates.push({
    ...coin,
    _trade_score: scoring.total,
    _score_breakdown: scoring.breakdown
  });

  stats.passed++;
}

// Sort by score (highest first)
scoredCandidates.sort((a, b) => b._trade_score - a._trade_score);

//===============================================================================
// 📊 STATISTICS
//===============================================================================

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`📊 FILTERING RESULTS:`);
console.log(`   Total candidates: ${stats.total}`);
console.log(`   ❌ Data quality failed: ${stats.data_quality_failed}`);
console.log(`   ❌ Threshold failures: ${stats.threshold_failed}`);
console.log(`      └─ Low alpha: ${stats.low_alpha}`);
console.log(`      └─ Low RR: ${stats.low_rr}`);
console.log(`      └─ Low buffer: ${stats.low_buffer}`);
console.log(`   ❌ Low score (<${CONFIG.min_score}): ${stats.low_score}`);
console.log(`   ✅ A+ PASSED: ${stats.passed}`);
console.log(`\n   💎 VP QUALITY:`);
console.log(`      🏆 GOLDEN: ${stats.vp_golden}`);
console.log(`      💎 EXCELLENT: ${stats.vp_excellent}`);
console.log(`      ✨ GOOD: ${stats.vp_good}`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

//===============================================================================
// 🎯 SELECTION LOGIC
//===============================================================================

if (scoredCandidates.length === 0) {
  console.log(`❌ DECISION: NO_TRADE`);
  console.log(`   No A+ setups found\n`);

  return [{json: {
    message: "NO_TRADE",
    reason: `No A+ setups found (Alpha ≥${CONFIG.min_alpha}, RR ≥${CONFIG.min_rr}, Buffer ≥${CONFIG.min_buffer}%, Score ≥${CONFIG.min_score})`,
    stats: stats,
    _meta: {
      selector_version: "4.0-v5-compatible",
      timestamp: new Date().toISOString()
    }
  }}];
}

// Group by side (BUY/SELL)
const longSetups = scoredCandidates.filter(c => c.side === "BUY");
const shortSetups = scoredCandidates.filter(c => c.side === "SELL");

console.log(`📈 LONG setups: ${longSetups.length}`);
console.log(`📉 SHORT setups: ${shortSetups.length}\n`);

// TODO: Check current positions (would need to fetch from exchange)
// For now, assume we can take positions

// Select best from each side
const selectedTrades = [];

if (CONFIG.enable_diversification && scoredCandidates.length > 1) {
  // Diversification: Select top N from each side
  const topLongs = longSetups.slice(0, Math.min(CONFIG.max_selected, CONFIG.max_positions_per_side));
  const topShorts = shortSetups.slice(0, Math.min(CONFIG.max_selected, CONFIG.max_positions_per_side));

  selectedTrades.push(...topLongs, ...topShorts);

  console.log(`🎯 DIVERSIFICATION MODE: Selecting up to ${CONFIG.max_selected} per side`);
} else {
  // Single best trade
  selectedTrades.push(scoredCandidates[0]);

  console.log(`🎯 SINGLE TRADE MODE: Selecting best overall`);
}

console.log(`\n✅ SELECTED ${selectedTrades.length} TRADE(S):\n`);

//===============================================================================
// 📤 FORMAT OUTPUT
//===============================================================================

const outputs = selectedTrades.map((winner, index) => {
  const vpQuality = winner.vp_setup_quality || "MODERATE";
  const vpIndicator = vpQuality === "GOLDEN" ? " 🏆 GOLDEN" :
                      (vpQuality === "EXCELLENT" ? " 💎 EXCELLENT" :
                      (vpQuality === "GOOD" ? " ✨ GOOD" : ""));

  console.log(`${index + 1}. ${winner.symbol} ${winner.side}${vpIndicator}`);
  console.log(`   Score: ${winner._trade_score}/100`);
  console.log(`   Alpha: ${(winner.alpha || 0).toFixed(1)} | RR: ${(winner.leveraged_rr || 0).toFixed(2)}:1 | Buffer: ${(winner.liq_buffer_pct || 0).toFixed(2)}%`);
  console.log(`   Leverage: ${winner.leverage}x | Position: ${winner.position_size_usdt} USDT → ${winner.position_exposure_usdt?.toFixed(0)} USDT exposure\n`);

  // Format take profits
  const takeProfits = [];

  if (winner.take_profit_1) {
    takeProfits.push({
      price: winner.take_profit_1,
      distance_pct: winner.take_profit_1_pct || 0,
      size_pct: 50,  // 50% at TP1
      label: "TP1"
    });
  }

  if (winner.take_profit_2) {
    takeProfits.push({
      price: winner.take_profit_2,
      distance_pct: winner.take_profit_2_pct || 0,
      size_pct: 35,  // 35% at TP2
      label: "TP2"
    });
  }

  if (winner.take_profit_3) {
    takeProfits.push({
      price: winner.take_profit_3,
      distance_pct: winner.take_profit_3_pct || 0,
      size_pct: 15,  // 15% at TP3
      label: "TP3"
    });
  }

  return {
    message: "TRADE_SELECTED",

    // Basic info
    symbol: winner.symbol,
    bybit_symbol: winner.symbol,
    base: winner.symbol.replace("USDT", ""),
    side: winner.side,

    // Prices
    entry_price: winner.entry_price,
    stop_loss: winner.stop_loss,
    stop_loss_pct: winner.stop_loss_pct || 0,
    take_profit_1: winner.take_profit_1,
    take_profit_1_pct: winner.take_profit_1_pct || 0,
    take_profit_2: winner.take_profit_2 || null,
    take_profit_2_pct: winner.take_profit_2_pct || 0,
    take_profit_3: winner.take_profit_3 || null,
    take_profit_3_pct: winner.take_profit_3_pct || 0,
    take_profits: takeProfits,

    // Position sizing
    leverage: winner.leverage,
    position_size_usdt: winner.position_size_usdt,
    position_exposure_usdt: winner.position_exposure_usdt,
    quantity: winner.quantity,

    // Risk metrics
    liquidation_price: winner.liquidation_price,
    liquidation_distance_pct: winner.liquidation_distance_pct || 0,
    liq_buffer_pct: winner.liq_buffer_pct || 0,
    risk_usdt: winner.risk_usdt,
    leveraged_risk_usdt: winner.leveraged_risk_usdt,
    risk_reward_ratio: winner.leveraged_rr || winner.risk_reward_ratio,

    // ROI metrics
    roi_tp1_pct: winner.roi_tp1_pct || 0,
    roi_tp2_pct: winner.roi_tp2_pct || 0,
    roi_tp3_pct: winner.roi_tp3_pct || 0,
    roi_sl_pct: winner.roi_sl_pct || 0,

    // Scoring
    alpha: winner.alpha || winner.alphaScore,
    conviction: winner.conviction,
    trade_score: winner._trade_score,
    score_breakdown: winner._score_breakdown,

    // VP metadata
    vp_setup_quality: vpQuality,
    vp_score: winner.vp_score || 0,
    vp_multi_tf_aligned: winner.vp_multi_tf_aligned || false,

    // SL/TP reasoning
    sl_reasoning: winner.sl_reasoning || [],
    tp_reasoning: winner.tp_reasoning || [],
    leverage_reasoning: winner.leverage_reasoning || [],

    // Exchange data
    tick_size: winner.data?.tickSize || 0.01,
    qty_step: winner.data?.qtyStep || 0.001,
    max_leverage: winner.data?.maxLeverage || 25,

    // Metadata
    _regime: winner._regime,
    _market_scenario: winner._market_scenario,
    _sector_leadership: winner._sector_leadership,
    _leverage_metadata: winner._leverage_metadata,

    _meta: {
      selector_version: "4.0-v5-compatible",
      rank: index + 1,
      selected_from: stats.passed,
      total_candidates: stats.total,
      timestamp: new Date().toISOString()
    }
  };
});

console.log(`\n🚀 READY FOR EXECUTION!\n`);

// Return single output if only 1 trade, otherwise return array
if (outputs.length === 1) {
  return [{ json: outputs[0] }];
} else {
  return outputs.map(output => ({ json: output }));
}
