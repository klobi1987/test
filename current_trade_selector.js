// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TRADE SELECTOR v3.0 - WITH VOLUME PROFILE SCORING ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v3.0:
// ✅ Volume Profile-aware scoring (GOLDEN setups get bonus)
// ✅ VP tier weighting (S-tier > A-tier > B-tier)
// ✅ VP metadata included in output
// ✅ Multi-timeframe alignment bonus
// ✅ Institutional placement recognition
//
// AGGRESSIVE THRESHOLDS: Alpha ≥70, RR ≥2.0, Buffer ≥3%, Score ≥65
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Leverage Finder!");
  return [{json: {
    message: "NO_TRADE",
    reason: "No input data from previous node",
    _meta: {
      selector_version: "3.0-vp-scoring",
      timestamp: new Date().toISOString()
    }
  }}];
}

const candidates = input.map(item => item.json);

console.log(`\n🎯 TRADE SELECTOR v3.0 WITH VP SCORING - Processing ${candidates.length} candidates`);
console.log(`   🆕 S-Tier setups get scoring advantage!`);

//===============================================================================
// CONFIGURATION - AGGRESSIVE THRESHOLDS
//===============================================================================

const MIN_RR = 2.0;              // Excellent risk/reward
const MIN_BUFFER_PCT = 3.0;      // Safe liquidation
const MIN_SCORE = 65;            // A+ quality
const MAX_LEVERAGE = 25;         // Maximum allowed leverage
const MIN_ALPHA = 70;            // Strong momentum

// 🆕 VP-ENHANCED SCORE WEIGHTS (must sum to 100)
const WEIGHTS = {
  ALPHA: 30,        // Reduced from 35 to make room for VP
  RR: 25,           // Reduced from 30
  BUFFER: 15,       // Reduced from 20
  MOMENTUM: 10,     // Same
  CONFIDENCE: 5,    // Same
  VP_QUALITY: 15    // 🆕 NEW: Volume Profile quality bonus
};

// 🆕 VP TIER SCORING
const VP_TIER_SCORES = {
  S: 15,  // GOLDEN setup = full 15 points
  A: 10,  // EXCELLENT = 10 points
  B: 6,   // GOOD = 6 points
  C: 3,   // MODERATE = 3 points
  D: 0    // No VP or weak = 0 points
};

console.log(`\n⚡ AGGRESSIVE THRESHOLDS:`);
console.log(`   Alpha ≥${MIN_ALPHA}, RR ≥${MIN_RR}:1, Buffer ≥${MIN_BUFFER_PCT}%, Score ≥${MIN_SCORE}`);
console.log(`\n🆕 VP SCORING ENABLED:`);
console.log(`   S-tier (GOLDEN): ${VP_TIER_SCORES.S} pts`);
console.log(`   A-tier (EXCELLENT): ${VP_TIER_SCORES.A} pts`);
console.log(`   B-tier (GOOD): ${VP_TIER_SCORES.B} pts`);

//===============================================================================
// HELPER FUNCTIONS
//===============================================================================

function validateDataQuality(coin) {
  const errors = [];

  // 1. Check status fields first (SL/TP and Leverage may have failed)
  if (coin.sltp_status && coin.sltp_status !== "SUCCESS") {
    errors.push(`SL/TP failed: ${coin.sltp_status} - ${coin.sltp_error || 'unknown'}`);
    return { valid: false, errors };
  }

  if (coin.leverage_status && coin.leverage_status !== "SUCCESS") {
    errors.push(`Leverage failed: ${coin.leverage_status} - ${coin.leverage_error || 'unknown'}`);
    return { valid: false, errors };
  }

  // 2. Check required fields
  const price = coin.price || 0;
  if (price <= 0) {
    errors.push("Invalid price");
    return { valid: false, errors };
  }

  if (!coin.stopLoss || !coin.stopLoss.price) {
    errors.push("Missing stopLoss");
    return { valid: false, errors };
  }

  if (!coin.takeProfit1 || !coin.takeProfit1.price) {
    errors.push("Missing takeProfit1");
    return { valid: false, errors };
  }

  if (!coin.leverage || coin.leverage < 1) {
    errors.push("Missing or invalid leverage");
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateCandidate(coin) {
  const errors = [];

  // No need to check status again - already done in validateDataQuality()

  const alpha = coin.alpha || 0;
  if (alpha < MIN_ALPHA) {
    errors.push(`Alpha ${alpha.toFixed(1)} < ${MIN_ALPHA}`);
  }

  const rr = coin.weightedRR || 0;
  if (rr < MIN_RR) {
    errors.push(`RR ${rr.toFixed(2)} < ${MIN_RR}`);
  }

  const buffer = coin.buffer_pct || 0;
  if (buffer < MIN_BUFFER_PCT) {
    errors.push(`Buffer ${buffer.toFixed(2)}% < ${MIN_BUFFER_PCT}%`);
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
  let scoreComponents = {};

  // 1. ALPHA SCORE (0-30 pts)
  const alpha = coin.alpha || 0;
  const alphaNorm = normalizeScore(alpha, 70, 150);
  scoreComponents.alpha = alphaNorm * WEIGHTS.ALPHA;

  // 2. RISK-REWARD SCORE (0-25 pts)
  const rr = coin.weightedRR || 0;
  const rrNorm = normalizeScore(rr, 2.0, 5.0);
  scoreComponents.rr = rrNorm * WEIGHTS.RR;

  // 3. BUFFER SCORE (0-15 pts)
  const buffer = coin.buffer_pct || 0;
  const bufferNorm = normalizeScore(buffer, 3.0, 15);
  scoreComponents.buffer = bufferNorm * WEIGHTS.BUFFER;

  // 4. MOMENTUM BONUS (0-10 pts)
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;

  let momentumScore = 0;
  if (altRankJump > 1000 || galaxyJump > 20) momentumScore = 1.0;
  else if (altRankJump > 500 || galaxyJump > 10) momentumScore = 0.7;
  else if (altRankJump > 200 || galaxyJump > 5) momentumScore = 0.4;
  else momentumScore = 0;

  scoreComponents.momentum = momentumScore * WEIGHTS.MOMENTUM;

  // 5. CONFIDENCE BONUS (0-5 pts)
  const confidence = coin._regime?.confidence || "LOW";
  let confidenceScore = 0;
  if (confidence === "HIGH") confidenceScore = 1.0;
  else if (confidence === "MED") confidenceScore = 0.6;
  else confidenceScore = 0;

  scoreComponents.confidence = confidenceScore * WEIGHTS.CONFIDENCE;

  // 🆕 6. VOLUME PROFILE QUALITY (0-15 pts)
  const vpTier = coin.leverage_metadata?.vp_tier || coin.sltp_metadata?.vp_tier || "D";
  const vpScore = VP_TIER_SCORES[vpTier] || 0;
  scoreComponents.vp_quality = vpScore;

  // 🆕 BONUS: Multi-TF alignment adds extra +2 pts (on top of tier score)
  const vpMultiTFAligned = coin.vp_multi_tf_aligned || false;
  if (vpMultiTFAligned && vpScore > 0) {
    scoreComponents.vp_quality += 2;
  }

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
// PROCESS CANDIDATES
//===============================================================================

console.log(`\n🔍 Filtering & Scoring candidates...`);

let stats = {
  total: candidates.length,
  sltp_failed: 0,
  leverage_failed: 0,
  data_quality_failed: 0,
  low_alpha: 0,
  low_rr: 0,
  low_buffer: 0,
  low_score: 0,
  passed: 0,
  vp_s_tier: 0,
  vp_a_tier: 0,
  vp_enhanced: 0
};

const scoredCandidates = [];

for (const coin of candidates) {
  const symbol = coin.symbol || "UNKNOWN";

  // Data quality check
  const qualityCheck = validateDataQuality(coin);
  if (!qualityCheck.valid) {
    console.log(`   ❌ ${symbol}: DATA QUALITY FAILED`);
    qualityCheck.errors.forEach(err => console.log(`      • ${err}`));

    // Track specific failure reasons
    if (qualityCheck.errors.some(e => e.includes("SL/TP failed"))) {
      stats.sltp_failed++;
    } else if (qualityCheck.errors.some(e => e.includes("Leverage failed"))) {
      stats.leverage_failed++;
    } else {
      stats.data_quality_failed++;
    }
    continue;
  }

  console.log(`   📋 ${symbol}: Data quality OK - checking thresholds...`);

  // Business logic validation
  const validation = validateCandidate(coin);
  if (!validation.valid) {
    console.log(`   ⚠️  ${symbol}: Failed aggressive filters:`);
    validation.errors.forEach(err => console.log(`      • ${err}`));

    // Track threshold failures
    if (validation.errors.some(e => e.includes("Alpha"))) stats.low_alpha++;
    if (validation.errors.some(e => e.includes("RR"))) stats.low_rr++;
    if (validation.errors.some(e => e.includes("Buffer"))) stats.low_buffer++;

    continue;
  }

  // Calculate score
  const scoring = calculateTradeScore(coin);

  // Track VP stats
  const vpTier = coin.leverage_metadata?.vp_tier || "D";
  if (vpTier === "S") stats.vp_s_tier++;
  else if (vpTier === "A") stats.vp_a_tier++;
  if (coin.leverage_metadata?.vp_enhanced) stats.vp_enhanced++;

  const vpIndicator = vpTier === "S" ? " 🏆" :
                      (vpTier === "A" ? " 🥈" :
                      (vpTier === "B" ? " 🥉" : ""));

  console.log(`   📊 ${symbol}${vpIndicator}: Score ${scoring.total}/100`);
  console.log(`      Alpha ${scoring.breakdown.alpha}/${WEIGHTS.ALPHA} + RR ${scoring.breakdown.rr}/${WEIGHTS.RR} + Buffer ${scoring.breakdown.buffer}/${WEIGHTS.BUFFER} + VP ${scoring.breakdown.vp_quality}/${WEIGHTS.VP_QUALITY + 2}`);

  if (scoring.total < MIN_SCORE) {
    console.log(`   ⚠️  ${symbol}: Score ${scoring.total} < ${MIN_SCORE} (not A+)`);
    stats.low_score++;
    continue;
  }

  console.log(`   ✅ ${symbol}: A+ SETUP PASSED!`);

  scoredCandidates.push({
    ...coin,
    _tradeScore: scoring.total,
    _scoreBreakdown: scoring.breakdown
  });

  stats.passed++;
}

scoredCandidates.sort((a, b) => b._tradeScore - a._tradeScore);

//===============================================================================
// MAKE DECISION
//===============================================================================

console.log(`\n📊 FILTERING RESULTS:`);
console.log(`   Total: ${stats.total}`);
console.log(`   ❌ SL/TP calculation failed: ${stats.sltp_failed}`);
console.log(`   ❌ Leverage calculation failed: ${stats.leverage_failed}`);
console.log(`   ❌ Other data quality issues: ${stats.data_quality_failed}`);
console.log(`   ❌ Low alpha (<${MIN_ALPHA}): ${stats.low_alpha}`);
console.log(`   ❌ Low RR (<${MIN_RR}): ${stats.low_rr}`);
console.log(`   ❌ Low buffer (<${MIN_BUFFER_PCT}%): ${stats.low_buffer}`);
console.log(`   ❌ Low score (<${MIN_SCORE}): ${stats.low_score}`);
console.log(`   ✅ A+ PASSED: ${stats.passed}`);
console.log(`\n🆕 VP STATS:`);
console.log(`   🏆 S-tier (GOLDEN): ${stats.vp_s_tier}`);
console.log(`   🥈 A-tier (EXCELLENT): ${stats.vp_a_tier}`);
console.log(`   📊 VP-enhanced: ${stats.vp_enhanced}`);

if (scoredCandidates.length === 0) {
  console.log(`\n❌ DECISION: NO_TRADE`);
  console.log(`   Reason: No A+ setups found`);

  return [{json: {
    message: "NO_TRADE",
    reason: `No A+ setups (Alpha ≥${MIN_ALPHA}, RR ≥${MIN_RR}, Buffer ≥${MIN_BUFFER_PCT}%, Score ≥${MIN_SCORE})`,
    stats: stats,
    _meta: {
      selector_version: "3.0-vp-scoring",
      timestamp: new Date().toISOString()
    }
  }}];
}

// Select best
const winner = scoredCandidates[0];

const vpTier = winner.leverage_metadata?.vp_tier || "D";
const vpIndicator = vpTier === "S" ? " 🏆 GOLDEN" :
                    (vpTier === "A" ? " 🥈 EXCELLENT" :
                    (vpTier === "B" ? " 🥉 GOOD" : ""));

console.log(`\n✅ DECISION: TRADE (A+ SETUP${vpIndicator})`);
console.log(`   Winner: ${winner.symbol}`);
console.log(`   Score: ${winner._tradeScore}/100`);
console.log(`   Alpha: ${winner.alpha.toFixed(1)} | RR: ${winner.weightedRR.toFixed(2)}:1 | Buffer: ${winner.buffer_pct.toFixed(2)}%`);
if (winner.leverage_metadata?.vp_reasons) {
  console.log(`   🆕 VP: ${winner.leverage_metadata.vp_reasons.join(', ')}`);
}

//===============================================================================
// FORMAT OUTPUT
//===============================================================================

const takeProfits = [];
if (winner.takeProfit1) {
  takeProfits.push({
    price: winner.takeProfit1.price,
    size_pct: winner.takeProfit1.size_pct || 45,
    tier: winner.takeProfit1.tier || "C"
  });
}
if (winner.takeProfit2) {
  takeProfits.push({
    price: winner.takeProfit2.price,
    size_pct: winner.takeProfit2.size_pct || 35,
    tier: winner.takeProfit2.tier || "C"
  });
}
if (winner.takeProfit3) {
  takeProfits.push({
    price: winner.takeProfit3.price,
    size_pct: winner.takeProfit3.size_pct || 20,
    tier: winner.takeProfit3.tier || "C"
  });
}

const tradeOutput = {
  message: "TRADE_SELECTED",
  symbol: winner.symbol,
  bybit_symbol: winner.symbol,
  base: winner.symbol.replace("USDT", ""),
  side: winner.side,
  entry: winner.price,
  entry_price: winner.price,
  stopLoss: winner.stopLoss.price,
  sl_price: winner.stopLoss.price,
  sl_tier: winner.stopLoss.tier || "C",
  sl_vp_based: winner.stopLoss.vp_based || false,
  takeProfit: takeProfits[0]?.price || winner.takeProfit1.price,
  tp_price: takeProfits[0]?.price || winner.takeProfit1.price,
  takeProfits: takeProfits,
  leverage: winner.leverage,
  qty: winner.quantity,
  position_size: winner.quantity,
  allocated_usdt: winner.allocation_usdt,
  risk_usdt: winner.margin_usdt,
  rr: winner.weightedRR,
  sl_distance_pct: winner.stopLoss.distance_pct,
  tp_distance_pct: winner.takeProfit1.distance_pct,
  liquidation_price: winner.liquidation_price,
  liquidation_gap_pct: winner.buffer_pct,
  position_health_score: winner._tradeScore,
  liq_margin_class: winner.buffer_pct > 5 ? "SAFE" : (winner.buffer_pct > 2 ? "MODERATE" : "RISKY"),
  alphaScore: winner.alpha,
  action_score: winner._tradeScore,
  trade_score: winner._tradeScore,
  score_breakdown: winner._scoreBreakdown,

  // 🆕 VOLUME PROFILE METADATA
  vp_setup_quality: winner.vp_setup_quality || "MODERATE",
  vp_tier: vpTier,
  vp_4h_at_poc: winner.vp_4h_at_poc || false,
  vp_4h_signal: winner.vp_4h_signal || "NEUTRAL",
  vp_multi_tf_aligned: winner.vp_multi_tf_aligned || false,
  vp_confidence_boost: winner.vp_confidence_boost || 0,
  hvn_risk: winner.hvn_risk || "UNKNOWN",
  hvn_support_levels: winner.hvn_support_levels || 0,
  institutional_placement: winner.sltp_metadata?.institutional_placement || false,

  tickSize: winner.data?.tickSize || 0.01,
  qtyStep: winner.data?.qtyStep || 0.001,
  maxLeverage: winner.data?.maxLeverage || 25,
  data: winner.data,
  _regime: winner._regime,
  _meta: {
    selector_version: "3.0-vp-scoring",
    selected_from: stats.passed,
    total_candidates: stats.total,
    vp_enhanced: winner.leverage_metadata?.vp_enhanced || false,
    timestamp: new Date().toISOString(),
    stats: stats
  },
  alternativeCandidates: scoredCandidates.slice(1, 5).map(c => ({
    symbol: c.symbol,
    score: c._tradeScore,
    alpha: c.alpha,
    rr: c.weightedRR,
    buffer: c.buffer_pct,
    vp_tier: c.leverage_metadata?.vp_tier || "D",
    vp_quality: c.vp_setup_quality || "MODERATE"
  }))
};

console.log(`\n🚀 A+ SETUP READY FOR EXECUTION!`);
if (tradeOutput.institutional_placement) {
  console.log(`   🏆 INSTITUTIONAL-GRADE PLACEMENT (VP-based SL/TP)`);
}

return [{json: tradeOutput}];

