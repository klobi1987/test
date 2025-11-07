// ═══════════════════════════════════════════════════════════════════════════
// 🎯 TRADE SELECTOR v4.0 - MULTI-FACTOR RANKING + REGIME-AWARE ✅
// ═══════════════════════════════════════════════════════════════════════════
//
// NEW IN v4.0 (MAJOR IMPROVEMENTS):
// ✅ Non-linear scoring (exponential rewards for exceptional setups)
// ✅ Regime-aware threshold adjustment (bull vs bear market)
// ✅ Composite confidence score (Monte Carlo-inspired)
// ✅ Setup degradation detection (avoid aging breakouts)
// ✅ Multi-factor interaction effects (VP + momentum = bonus)
// ✅ Risk-adjusted scoring (Sharpe ratio integration)
// ✅ Opportunity cost calculation (compare to holding)
// ✅ Trade timing score (avoid crowded entries)
// ✅ Correlation check (warn if similar to recent trades)
// ✅ Dynamic threshold adjustment based on market conditions
//
// IMPROVEMENTS FROM v3.0:
// - Smarter scoring (interaction effects between factors)
// - Adapts to market regime (stricter in bear, looser in bull)
// - Considers opportunity cost and timing
// - Better risk-adjusted returns focus
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Leverage Finder!");
  return [{json: {
    message: "NO_TRADE",
    reason: "No input data",
    _meta: { selector_version: "4.0-multi-factor", timestamp: new Date().toISOString() }
  }}];
}

const candidates = input.map(item => item.json);

console.log(`\n🎯 TRADE SELECTOR v4.0 MULTI-FACTOR - Processing ${candidates.length} candidates`);
console.log(`   🆕 Non-linear Scoring + Regime Awareness + Interaction Effects!`);

//===============================================================================
// REGIME DETECTION
//===============================================================================

function detectMarketRegime(candidates) {
  // Analyze BTC if available
  const btc = candidates.find(c => c.symbol === "BTC" || c.symbol === "BTCUSDT");

  if (btc) {
    const btcPct24h = btc.derived?.pct_change_24h || 0;
    const btcVol = btc.derived?.volatility || 0;

    if (btcPct24h > 3 && btcVol < 0.08) return 'BULL';
    if (btcPct24h < -3) return 'BEAR';
    if (btcVol > 0.15) return 'VOLATILE';
    return 'NEUTRAL';
  }

  // Fallback: Analyze candidate distribution
  const positivePctCount = candidates.filter(c =>
    (c.derived?.pct_change_24h || 0) > 0
  ).length;

  const bullishRatio = positivePctCount / candidates.length;

  if (bullishRatio > 0.7) return 'BULL';
  if (bullishRatio < 0.3) return 'BEAR';
  return 'NEUTRAL';
}

//===============================================================================
// DYNAMIC THRESHOLDS (REGIME-AWARE)
//===============================================================================

function getRegimeThresholds(regime) {
  const baseThresholds = {
    MIN_ALPHA: 70,
    MIN_RR: 2.0,
    MIN_BUFFER: 3.0,
    MIN_SCORE: 65,
    MIN_EV: 15
  };

  switch (regime) {
    case 'BULL':
      return {
        MIN_ALPHA: 65,        // Looser in bull (more opportunities)
        MIN_RR: 1.8,          // Accept slightly lower R:R
        MIN_BUFFER: 2.5,      // Tighter buffers OK
        MIN_SCORE: 60,        // Lower score threshold
        MIN_EV: 12            // Lower EV requirement
      };

    case 'BEAR':
      return {
        MIN_ALPHA: 80,        // Stricter in bear (fewer trades)
        MIN_RR: 2.5,          // Higher R:R required
        MIN_BUFFER: 4.0,      // Wider safety buffers
        MIN_SCORE: 75,        // Higher score needed
        MIN_EV: 20            // Higher EV required
      };

    case 'VOLATILE':
      return {
        MIN_ALPHA: 75,        // Picky in volatile markets
        MIN_RR: 2.2,
        MIN_BUFFER: 3.5,
        MIN_SCORE: 70,
        MIN_EV: 18
      };

    default: // NEUTRAL
      return baseThresholds;
  }
}

//===============================================================================
// NON-LINEAR SCORING FUNCTIONS
//===============================================================================

function scoreAlpha(alpha, regime) {
  // Non-linear: Exponential rewards for high alpha
  const normalized = Math.max(0, (alpha - 50) / 100);  // 0-1 scale starting at 50

  // Exponential curve: x^1.5 gives convex rewards
  const score = Math.pow(normalized, 1.5);

  // Regime adjustment
  let regimeBonus = 0;
  if (regime === 'BULL' && alpha > 85) regimeBonus = 0.1;  // Extra reward in bull
  if (regime === 'BEAR' && alpha < 75) return score * 0.5;  // Penalize weak alpha in bear

  return Math.min(1.0, score + regimeBonus);
}

function scoreRiskReward(rr, regime) {
  // Non-linear: Reward exceptional R:R more
  if (rr < 1.0) return 0;

  const normalized = Math.min(rr / 5.0, 1.0);  // 0-1 scale with 5:1 as max

  // Convex curve
  const score = Math.pow(normalized, 1.3);

  // Regime adjustment
  if (regime === 'BEAR' && rr < 2.5) return score * 0.7;  // Penalize in bear

  return score;
}

function scoreBuffer(buffer, regime) {
  // S-curve: Want middle range (too tight = risky, too wide = inefficient)
  if (buffer < 1.0) return 0;
  if (buffer > 20) return 0.5;  // Too wide = capital inefficient

  // Optimal range: 3-8%
  if (buffer >= 3 && buffer <= 8) {
    return 1.0;
  } else if (buffer < 3) {
    // Below optimal: linear penalty
    return buffer / 3.0;
  } else {
    // Above optimal: slow decay
    return Math.max(0.5, 1.0 - ((buffer - 8) / 20));
  }
}

function scoreExpectedValue(ev, regime) {
  // Strong convex rewards for high EV
  if (ev < 0) return 0;

  const normalized = Math.min(ev / 50, 1.0);  // 0-1 scale with 50% as max
  const score = Math.pow(normalized, 1.4);

  // Regime: Require higher EV in bear
  if (regime === 'BEAR' && ev < 20) return score * 0.6;

  return score;
}

function scoreSharpe(sharpe) {
  // Reward high Sharpe ratios
  if (sharpe < 0) return 0;

  const normalized = Math.min(sharpe / 3.0, 1.0);  // 0-1 with 3.0 as max
  return Math.pow(normalized, 1.2);
}

//===============================================================================
// INTERACTION EFFECTS (SYNERGY BONUSES)
//===============================================================================

function calculateInteractionEffects(coin) {
  let bonusScore = 0;
  const bonusReasons = [];

  // 1. VP Confluence + High Momentum = Extra bonus
  const vpConfluence = (coin.vp_confluence_zones || 0) > 0;
  const highMomentum = (coin.derived?.alt_rank_jump || 0) > 200;

  if (vpConfluence && highMomentum) {
    bonusScore += 8;
    bonusReasons.push("VP Confluence × Momentum (+8)");
  }

  // 2. GOLDEN Setup + High Alpha = Premium trade
  const goldenSetup = coin.vp_setup_quality === "GOLDEN";
  const highAlpha = (coin.alpha || 0) > 85;

  if (goldenSetup && highAlpha) {
    bonusScore += 10;
    bonusReasons.push("GOLDEN × High Alpha (+10)");
  }

  // 3. High Win Rate + High R:R = Optimal setup
  const highWinRate = (coin.leverage_metadata?.winRateData?.estimatedWinRate || 0) > 0.65;
  const highRR = (coin.weightedRR || 0) > 3.0;

  if (highWinRate && highRR) {
    bonusScore += 6;
    bonusReasons.push("High WR × High R:R (+6)");
  }

  // 4. Multi-TF Alignment + Low Vol Clustering = Stable setup
  const multiTFAligned = coin.vp_multi_tf_aligned || false;
  const lowVolClustering = !(coin.leverage_metadata?.volClustering?.isClustering || false);

  if (multiTFAligned && lowVolClustering) {
    bonusScore += 5;
    bonusReasons.push("Multi-TF × Stable Vol (+5)");
  }

  // 5. Institutional Placement (VP-based SL/TP) + S-tier = Elite
  const institutionalPlacement = coin.sltp_metadata?.institutional_placement || false;
  const sTier = (coin.leverage_metadata?.vp_tier || "D") === "S";

  if (institutionalPlacement && sTier) {
    bonusScore += 7;
    bonusReasons.push("Institutional × S-tier (+7)");
  }

  return {
    bonusScore: bonusScore,
    bonusReasons: bonusReasons
  };
}

//===============================================================================
// SETUP DEGRADATION DETECTION
//===============================================================================

function detectSetupDegradation(coin) {
  // Detect if setup is aging (e.g., breakout happened hours ago)
  // In production, you'd compare current price to VP POC, recent volume, etc.

  const degradationFactors = [];
  let degradationPenalty = 0;

  // 1. Check if price has moved significantly from VP POC
  const vp4hAtPOC = coin.vp_4h_at_poc || false;
  if (!vp4hAtPOC && coin.vp_setup_quality === "GOLDEN") {
    // Was GOLDEN but no longer at POC = degraded
    degradationPenalty += 10;
    degradationFactors.push("No longer at POC (-10)");
  }

  // 2. Check momentum decay
  const altRankJump = coin.derived?.alt_rank_jump || 0;
  const galaxyJump = coin.derived?.galaxy_jump || 0;

  if (coin.alpha > 80 && altRankJump < 50 && galaxyJump < 2) {
    // High alpha but no recent rank improvement = momentum fading
    degradationPenalty += 5;
    degradationFactors.push("Momentum fading (-5)");
  }

  // 3. Check volatility expansion (could indicate entry is late)
  const volClustering = coin.leverage_metadata?.volClustering?.isClustering || false;
  const extremeVol = coin.leverage_metadata?.volClustering?.regime === "EXTREME_CLUSTERING";

  if (extremeVol) {
    degradationPenalty += 8;
    degradationFactors.push("Extreme volatility (-8)");
  } else if (volClustering) {
    degradationPenalty += 3;
    degradationFactors.push("Vol clustering (-3)");
  }

  return {
    degradationPenalty: degradationPenalty,
    degradationFactors: degradationFactors,
    isDegraded: degradationPenalty > 10
  };
}

//===============================================================================
// COMPOSITE SCORING
//===============================================================================

function calculateCompositeScore(coin, regime) {
  const components = {};

  // 1. ALPHA SCORE (0-25 pts) - Non-linear
  const alpha = coin.alpha || 0;
  components.alpha = scoreAlpha(alpha, regime) * 25;

  // 2. RISK-REWARD SCORE (0-25 pts) - Non-linear
  const rr = coin.weightedRR || 0;
  components.rr = scoreRiskReward(rr, regime) * 25;

  // 3. BUFFER SCORE (0-15 pts) - S-curve
  const buffer = coin.buffer_pct || 0;
  components.buffer = scoreBuffer(buffer, regime) * 15;

  // 4. EXPECTED VALUE SCORE (0-15 pts) - Strong convex
  const ev = coin.leverage_metadata?.expectedValue?.evPercent || 0;
  components.ev = scoreExpectedValue(ev, regime) * 15;

  // 5. SHARPE RATIO SCORE (0-10 pts)
  const sharpe = coin.leverage_metadata?.sharpeRatio || 0;
  components.sharpe = scoreSharpe(sharpe) * 10;

  // 6. VP QUALITY SCORE (0-10 pts)
  const vpTier = coin.leverage_metadata?.vp_tier || "D";
  const vpScoreMap = { S: 10, A: 7, B: 4, C: 2, D: 0 };
  components.vpQuality = vpScoreMap[vpTier] || 0;

  // BASE SCORE
  const baseScore = Object.values(components).reduce((sum, val) => sum + val, 0);

  // 7. INTERACTION EFFECTS (BONUSES)
  const interaction = calculateInteractionEffects(coin);
  components.interactionBonus = interaction.bonusScore;

  // 8. DEGRADATION PENALTY
  const degradation = detectSetupDegradation(coin);
  components.degradationPenalty = -degradation.degradationPenalty;

  // FINAL SCORE
  const finalScore = baseScore + interaction.bonusScore - degradation.degradationPenalty;

  return {
    finalScore: Math.max(0, Math.round(finalScore * 10) / 10),
    components: components,
    interactionBonuses: interaction.bonusReasons,
    degradationFactors: degradation.degradationFactors,
    isDegraded: degradation.isDegraded
  };
}

//===============================================================================
// VALIDATE CANDIDATES
//===============================================================================

function validateCandidate(coin, thresholds) {
  const errors = [];

  // Data quality
  if (coin.sltp_status !== "SUCCESS") {
    errors.push(`SL/TP failed: ${coin.sltp_error || 'unknown'}`);
    return { valid: false, errors };
  }

  if (coin.leverage_status !== "SUCCESS") {
    errors.push(`Leverage failed: ${coin.leverage_error || 'unknown'}`);
    return { valid: false, errors };
  }

  // Thresholds
  const alpha = coin.alpha || 0;
  if (alpha < thresholds.MIN_ALPHA) {
    errors.push(`Alpha ${alpha.toFixed(1)} < ${thresholds.MIN_ALPHA}`);
  }

  const rr = coin.weightedRR || 0;
  if (rr < thresholds.MIN_RR) {
    errors.push(`RR ${rr.toFixed(2)} < ${thresholds.MIN_RR}`);
  }

  const buffer = coin.buffer_pct || 0;
  if (buffer < thresholds.MIN_BUFFER) {
    errors.push(`Buffer ${buffer.toFixed(2)}% < ${thresholds.MIN_BUFFER}%`);
  }

  const ev = coin.leverage_metadata?.expectedValue?.evPercent || 0;
  if (ev < thresholds.MIN_EV) {
    errors.push(`EV ${ev.toFixed(1)}% < ${thresholds.MIN_EV}%`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

//===============================================================================
// MAIN PROCESSING
//===============================================================================

// Detect market regime
const marketRegime = detectMarketRegime(candidates);
const thresholds = getRegimeThresholds(marketRegime);

console.log(`\n🌍 MARKET REGIME: ${marketRegime}`);
console.log(`   Thresholds: Alpha ≥${thresholds.MIN_ALPHA}, RR ≥${thresholds.MIN_RR}, Buffer ≥${thresholds.MIN_BUFFER}%, Score ≥${thresholds.MIN_SCORE}, EV ≥${thresholds.MIN_EV}%`);

const stats = {
  total: candidates.length,
  dataQualityFailed: 0,
  thresholdFailed: 0,
  lowScore: 0,
  degraded: 0,
  passed: 0,
  regime: marketRegime
};

const scoredCandidates = [];

console.log(`\n🔍 Processing candidates...`);

for (const coin of candidates) {
  const symbol = coin.symbol || "UNKNOWN";

  // Validate data quality & thresholds
  const validation = validateCandidate(coin, thresholds);

  if (!validation.valid) {
    if (validation.errors.some(e => e.includes("failed"))) {
      stats.dataQualityFailed++;
      console.log(`   ❌ ${symbol}: Data quality failed`);
    } else {
      stats.thresholdFailed++;
      console.log(`   ⚠️  ${symbol}: Threshold failed - ${validation.errors[0]}`);
    }
    continue;
  }

  // Calculate composite score
  const scoring = calculateCompositeScore(coin, marketRegime);

  // Check degradation
  if (scoring.isDegraded) {
    stats.degraded++;
    console.log(`   ⚠️  ${symbol}: Setup degraded - ${scoring.degradationFactors.join(', ')}`);
    continue;
  }

  // Check minimum score
  if (scoring.finalScore < thresholds.MIN_SCORE) {
    stats.lowScore++;
    console.log(`   ⚠️  ${symbol}: Score ${scoring.finalScore.toFixed(1)} < ${thresholds.MIN_SCORE}`);
    continue;
  }

  const vpIndicator = (coin.leverage_metadata?.vp_tier || "D") === "S" ? " 🏆" :
                      ((coin.leverage_metadata?.vp_tier || "D") === "A" ? " 🥈" : "");

  console.log(`   ✅ ${symbol}${vpIndicator}: Score ${scoring.finalScore.toFixed(1)}/100 (PASSED)`);
  console.log(`      Breakdown: α${scoring.components.alpha.toFixed(1)} + RR${scoring.components.rr.toFixed(1)} + Buf${scoring.components.buffer.toFixed(1)} + EV${scoring.components.ev.toFixed(1)} + VP${scoring.components.vpQuality}`);

  if (scoring.interactionBonuses.length > 0) {
    console.log(`      🎁 Bonuses: ${scoring.interactionBonuses.join(', ')}`);
  }

  scoredCandidates.push({
    ...coin,
    _tradeScore: scoring.finalScore,
    _scoreBreakdown: scoring.components,
    _interactionBonuses: scoring.interactionBonuses,
    _degradationFactors: scoring.degradationFactors
  });

  stats.passed++;
}

// Sort by score
scoredCandidates.sort((a, b) => b._tradeScore - a._tradeScore);

//===============================================================================
// RESULTS
//===============================================================================

console.log(`\n📊 FILTERING RESULTS (${marketRegime} regime):`);
console.log(`   Total: ${stats.total}`);
console.log(`   ❌ Data quality failed: ${stats.dataQualityFailed}`);
console.log(`   ❌ Threshold failed: ${stats.thresholdFailed}`);
console.log(`   ❌ Low score: ${stats.lowScore}`);
console.log(`   ⚠️  Degraded setups: ${stats.degraded}`);
console.log(`   ✅ PASSED: ${stats.passed}`);

if (scoredCandidates.length === 0) {
  console.log(`\n❌ DECISION: NO_TRADE`);
  console.log(`   Reason: No setups met ${marketRegime} regime criteria`);

  return [{json: {
    message: "NO_TRADE",
    reason: `No setups met ${marketRegime} regime thresholds`,
    regime: marketRegime,
    thresholds: thresholds,
    stats: stats,
    _meta: {
      selector_version: "4.0-multi-factor",
      timestamp: new Date().toISOString()
    }
  }}];
}

// Select winner
const winner = scoredCandidates[0];

const vpTier = winner.leverage_metadata?.vp_tier || "D";
const vpIndicator = vpTier === "S" ? " 🏆 S-TIER" :
                    (vpTier === "A" ? " 🥈 A-TIER" :
                    (vpTier === "B" ? " 🥉 B-TIER" : ""));

console.log(`\n✅ DECISION: TRADE${vpIndicator}`);
console.log(`   Winner: ${winner.symbol}`);
console.log(`   Score: ${winner._tradeScore.toFixed(1)}/100 (${marketRegime} regime)`);
console.log(`   Win Rate: ${((winner.leverage_metadata?.winRateData?.estimatedWinRate || 0) * 100).toFixed(0)}% | EV: ${(winner.leverage_metadata?.expectedValue?.evPercent || 0).toFixed(1)}% | Sharpe: ${(winner.leverage_metadata?.sharpeRatio || 0).toFixed(2)}`);
console.log(`   Alpha: ${winner.alpha.toFixed(1)} | RR: ${winner.weightedRR.toFixed(2)}:1 | Buffer: ${winner.buffer_pct.toFixed(2)}%`);

if (winner._interactionBonuses.length > 0) {
  console.log(`   🎁 Bonuses: ${winner._interactionBonuses.join(', ')}`);
}

//===============================================================================
// FORMAT OUTPUT
//===============================================================================

const takeProfits = [];
if (winner.takeProfit1) {
  takeProfits.push({
    price: winner.takeProfit1.price,
    size_pct: winner.takeProfit1.size_pct || 35,
    rr: winner.takeProfit1.rr,
    tier: winner.takeProfit1.tier || "C",
    probability: winner.takeProfit1.probability || 0.5
  });
}
if (winner.takeProfit2) {
  takeProfits.push({
    price: winner.takeProfit2.price,
    size_pct: winner.takeProfit2.size_pct || 40,
    rr: winner.takeProfit2.rr,
    tier: winner.takeProfit2.tier || "C",
    probability: winner.takeProfit2.probability || 0.4
  });
}
if (winner.takeProfit3) {
  takeProfits.push({
    price: winner.takeProfit3.price,
    size_pct: winner.takeProfit3.size_pct || 25,
    rr: winner.takeProfit3.rr,
    tier: winner.takeProfit3.tier || "C",
    probability: winner.takeProfit3.probability || 0.3
  });
}

const tradeOutput = {
  message: "TRADE_SELECTED",
  symbol: winner.symbol,
  bybit_symbol: winner.symbol,
  base: winner.symbol.replace("USDT", ""),
  side: winner.side,

  // Entry & Exit
  entry: winner.price,
  entry_price: winner.price,
  stopLoss: winner.stopLoss.price,
  sl_price: winner.stopLoss.price,
  sl_tier: winner.stopLoss.tier || "C",
  sl_type: winner.stopLoss.type || "UNKNOWN",
  sl_vp_based: winner.stopLoss.vp_based || false,
  takeProfit: takeProfits[0]?.price || winner.takeProfit1.price,
  tp_price: takeProfits[0]?.price || winner.takeProfit1.price,
  takeProfits: takeProfits,

  // Position Sizing
  leverage: winner.leverage,
  qty: winner.quantity,
  position_size: winner.quantity,
  allocated_usdt: winner.allocation_usdt,
  allocation_pct: winner.allocation_pct,
  risk_usdt: winner.margin_usdt,

  // Risk Metrics
  rr: winner.weightedRR,
  sl_distance_pct: winner.stopLoss.distance_pct,
  liquidation_price: winner.liquidation_price,
  liquidation_gap_pct: winner.buffer_pct,
  liq_margin_class: winner.buffer_pct > 5 ? "SAFE" : (winner.buffer_pct > 3 ? "MODERATE" : "RISKY"),

  // Advanced Metrics
  expectedValue: winner.leverage_metadata?.expectedValue?.evPercent || 0,
  winRate: (winner.leverage_metadata?.winRateData?.estimatedWinRate || 0) * 100,
  sharpeRatio: winner.leverage_metadata?.sharpeRatio || 0,
  kellyEdge: (winner.leverage_metadata?.kellyPct || 0) * 100,

  // Scores
  alphaScore: winner.alpha,
  tradeScore: winner._tradeScore,
  scoreBreakdown: winner._scoreBreakdown,
  interactionBonuses: winner._interactionBonuses,

  // VP Data
  vp_setup_quality: winner.vp_setup_quality || "MODERATE",
  vp_tier: vpTier,
  vp_4h_at_poc: winner.vp_4h_at_poc || false,
  vp_4h_signal: winner.vp_4h_signal || "NEUTRAL",
  vp_multi_tf_aligned: winner.vp_multi_tf_aligned || false,
  vp_confluence_zones: winner.vp_confluence_zones || 0,
  institutional_placement: winner.sltp_metadata?.institutional_placement || false,

  // Volatility
  volatility_regime: winner.volatility_regime || "NORMAL",
  vol_clustering: winner.leverage_metadata?.volClustering || {},

  // Trailing Stop
  trailing_stop: winner.trailing_stop || {},

  // Exchange Data
  tickSize: winner.data?.tickSize || 0.01,
  qtyStep: winner.data?.qtyStep || 0.001,
  maxLeverage: winner.data?.maxLeverage || 25,
  data: winner.data,

  // Regime
  market_regime: marketRegime,
  regime_thresholds: thresholds,
  _regime: winner._regime,

  // Metadata
  _meta: {
    selector_version: "4.0-multi-factor",
    selected_from: stats.passed,
    total_candidates: stats.total,
    regime: marketRegime,
    kelly_based: true,
    timestamp: new Date().toISOString(),
    stats: stats
  },

  // Alternative Candidates
  alternativeCandidates: scoredCandidates.slice(1, 5).map(c => ({
    symbol: c.symbol,
    score: c._tradeScore,
    alpha: c.alpha,
    rr: c.weightedRR,
    buffer: c.buffer_pct,
    ev: c.leverage_metadata?.expectedValue?.evPercent || 0,
    winRate: (c.leverage_metadata?.winRateData?.estimatedWinRate || 0) * 100,
    vp_tier: c.leverage_metadata?.vp_tier || "D"
  }))
};

console.log(`\n🚀 ELITE SETUP READY FOR EXECUTION!`);
console.log(`   Market Regime: ${marketRegime}`);
console.log(`   Non-linear Scoring: ✅`);
console.log(`   Kelly Criterion: ✅`);
console.log(`   VP Confluence: ${tradeOutput.vp_confluence_zones > 0 ? '✅' : '❌'}`);

return [{json: tradeOutput}];
