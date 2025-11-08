// ═══════════════════════════════════════════════════════════════════════════
// 📈 PERFORMANCE TRACKING & ANALYTICS SYSTEM v1.0
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE: Track trading performance, identify winning patterns, adapt strategy
//
// FEATURES:
// ✅ Win rate tracking (overall & per setup type)
// ✅ Profit factor calculation
// ✅ Sharpe ratio estimation
// ✅ Best performing setups identification
// ✅ Worst performing setups identification
// ✅ Time-of-day performance analysis
// ✅ Market regime performance analysis
// ✅ Adaptive weight recommendations
//
// INTEGRATION: Run this periodically (daily/weekly) to analyze trades
//
// DATA SOURCE: Trades should be logged to a database/file with fields:
// - entry_time, exit_time, symbol, side, entry_price, exit_price
// - pnl, pnl_pct, setup_type, regime, vp_quality, conviction
//
// ═══════════════════════════════════════════════════════════════════════════

//===============================================================================
// SAMPLE TRADE DATA (Replace with actual database query)
//===============================================================================

const SAMPLE_TRADES = [
  // Example trades - replace with real data
  {
    id: 1,
    timestamp: "2025-01-15T10:30:00Z",
    symbol: "ETHUSDT",
    side: "BUY",
    entry_price: 3400,
    exit_price: 3550,
    pnl: 150,
    pnl_pct: 4.41,
    size_pct: 5,
    setup_type: "GOLDEN",
    regime: "BULL",
    conviction: "HIGH",
    vp_quality: "GOLDEN",
    market_breadth: "STRONG_BULL",
    volatility_regime: "MEDIUM",
    outcome: "WIN"
  },
  {
    id: 2,
    timestamp: "2025-01-15T14:20:00Z",
    symbol: "SOLUSDT",
    side: "BUY",
    entry_price: 160,
    exit_price: 155,
    pnl: -5,
    pnl_pct: -3.13,
    size_pct: 5,
    setup_type: "GOOD",
    regime: "BULL",
    conviction: "MEDIUM",
    vp_quality: "GOOD",
    market_breadth: "BULL",
    volatility_regime: "HIGH",
    outcome: "LOSS"
  }
  // ... more trades
];

//===============================================================================
// HELPER FUNCTIONS
//===============================================================================

/**
 * Calculate win rate
 */
function calculateWinRate(trades) {
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => t.outcome === "WIN").length;
  return (wins / trades.length) * 100;
}

/**
 * Calculate average win and average loss
 */
function calculateAvgWinLoss(trades) {
  const wins = trades.filter(t => t.outcome === "WIN");
  const losses = trades.filter(t => t.outcome === "LOSS");

  const avgWin = wins.length > 0
    ? wins.reduce((sum, t) => sum + t.pnl_pct, 0) / wins.length
    : 0;

  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, t) => sum + t.pnl_pct, 0) / losses.length)
    : 0;

  return { avgWin, avgLoss };
}

/**
 * Calculate profit factor
 * Profit Factor = Gross Profit / Gross Loss
 * > 2.0 = Excellent, > 1.5 = Good, > 1.0 = Profitable
 */
function calculateProfitFactor(trades) {
  const wins = trades.filter(t => t.outcome === "WIN");
  const losses = trades.filter(t => t.outcome === "LOSS");

  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;

  return grossProfit / grossLoss;
}

/**
 * Calculate Sharpe Ratio (simplified)
 * Sharpe = (Avg Return - Risk Free Rate) / Std Dev of Returns
 * > 2.0 = Excellent, > 1.0 = Good
 */
function calculateSharpeRatio(trades) {
  if (trades.length < 2) return 0;

  const returns = trades.map(t => t.pnl_pct);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const riskFreeRate = 0;  // Assume 0% risk-free rate for crypto
  const sharpe = (avgReturn - riskFreeRate) / stdDev;

  return sharpe;
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(trades) {
  if (trades.length === 0) return 0;

  let peak = 0;
  let maxDD = 0;
  let cumulative = 0;

  for (const trade of trades) {
    cumulative += trade.pnl_pct;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDD) {
      maxDD = drawdown;
    }
  }

  return maxDD;
}

/**
 * Group trades by a field and calculate metrics
 */
function analyzeByGroup(trades, groupField) {
  const groups = {};

  for (const trade of trades) {
    const key = trade[groupField] || "UNKNOWN";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(trade);
  }

  const analysis = [];

  for (const [key, groupTrades] of Object.entries(groups)) {
    const winRate = calculateWinRate(groupTrades);
    const { avgWin, avgLoss } = calculateAvgWinLoss(groupTrades);
    const profitFactor = calculateProfitFactor(groupTrades);
    const totalPnl = groupTrades.reduce((sum, t) => sum + t.pnl_pct, 0);

    analysis.push({
      group: key,
      count: groupTrades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      totalPnl,
      score: winRate * avgWin * profitFactor  // Composite score
    });
  }

  // Sort by score descending
  analysis.sort((a, b) => b.score - a.score);

  return analysis;
}

/**
 * Identify best setups
 */
function identifyBestSetups(trades) {
  const setupAnalysis = analyzeByGroup(trades, "setup_type");
  const regimeAnalysis = analyzeByGroup(trades, "regime");
  const convictionAnalysis = analyzeByGroup(trades, "conviction");
  const vpQualityAnalysis = analyzeByGroup(trades, "vp_quality");

  return {
    bySetup: setupAnalysis,
    byRegime: regimeAnalysis,
    byConviction: convictionAnalysis,
    byVpQuality: vpQualityAnalysis
  };
}

/**
 * Generate adaptive weight recommendations
 */
function generateWeightRecommendations(bestSetups, overallMetrics) {
  const recommendations = {
    momentum: 1.0,
    volume_profile: 1.0,
    social: 1.0,
    technical: 1.0,
    liquidity: 1.0,
    funding: 1.0
  };

  // If VP GOLDEN setups perform best, increase VP weight
  const goldenSetup = bestSetups.byVpQuality.find(s => s.group === "GOLDEN");
  if (goldenSetup && goldenSetup.winRate > 70) {
    recommendations.volume_profile = 1.5;
    console.log(`   📈 Recommendation: Increase VP weight (GOLDEN win rate: ${goldenSetup.winRate.toFixed(1)}%)`);
  }

  // If HIGH conviction performs best, increase momentum/social
  const highConviction = bestSetups.byConviction.find(s => s.group === "HIGH");
  if (highConviction && highConviction.winRate > 65) {
    recommendations.momentum = 1.3;
    recommendations.social = 1.2;
    console.log(`   📈 Recommendation: Increase momentum/social (HIGH conviction win rate: ${highConviction.winRate.toFixed(1)}%)`);
  }

  // If profit factor is low, reduce risk across the board
  if (overallMetrics.profitFactor < 1.2) {
    recommendations.momentum = 0.8;
    recommendations.social = 0.8;
    recommendations.volume_profile = 1.2;  // Trust institutional levels more
    console.log(`   ⚠️  Recommendation: Reduce risk (Low profit factor: ${overallMetrics.profitFactor.toFixed(2)})`);
  }

  // If Sharpe ratio is low, increase quality filters
  if (overallMetrics.sharpeRatio < 1.0) {
    recommendations.liquidity = 1.5;
    recommendations.technical = 1.3;
    console.log(`   ⚠️  Recommendation: Increase quality filters (Low Sharpe: ${overallMetrics.sharpeRatio.toFixed(2)})`);
  }

  return recommendations;
}

//===============================================================================
// MAIN PERFORMANCE ANALYSIS
//===============================================================================

function analyzePerformance(trades) {
  console.log(`\n📈 PERFORMANCE TRACKER - Analyzing ${trades.length} trades\n`);

  if (trades.length === 0) {
    console.log("❌ No trades to analyze");
    return;
  }

  //=============================================================================
  // 1. OVERALL METRICS
  //=============================================================================

  const winRate = calculateWinRate(trades);
  const { avgWin, avgLoss } = calculateAvgWinLoss(trades);
  const profitFactor = calculateProfitFactor(trades);
  const sharpeRatio = calculateSharpeRatio(trades);
  const maxDrawdown = calculateMaxDrawdown(trades);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl_pct, 0);

  console.log(`📊 OVERALL METRICS:`);
  console.log(`   Total Trades: ${trades.length}`);
  console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   Avg Win: ${avgWin.toFixed(2)}%`);
  console.log(`   Avg Loss: ${avgLoss.toFixed(2)}%`);
  console.log(`   Profit Factor: ${profitFactor.toFixed(2)} ${profitFactor > 2 ? "🏆" : (profitFactor > 1.5 ? "✅" : "⚠️")}`);
  console.log(`   Sharpe Ratio: ${sharpeRatio.toFixed(2)} ${sharpeRatio > 2 ? "🏆" : (sharpeRatio > 1 ? "✅" : "⚠️")}`);
  console.log(`   Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
  console.log(`   Total P&L: ${totalPnl.toFixed(2)}%\n`);

  //=============================================================================
  // 2. BEST PERFORMING SETUPS
  //=============================================================================

  const bestSetups = identifyBestSetups(trades);

  console.log(`🏆 BEST PERFORMING SETUPS:\n`);

  console.log(`By Setup Type:`);
  bestSetups.bySetup.slice(0, 3).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.group}: ${s.winRate.toFixed(1)}% WR, ${s.profitFactor.toFixed(2)} PF (${s.count} trades)`);
  });

  console.log(`\nBy Market Regime:`);
  bestSetups.byRegime.slice(0, 3).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.group}: ${s.winRate.toFixed(1)}% WR, ${s.profitFactor.toFixed(2)} PF (${s.count} trades)`);
  });

  console.log(`\nBy VP Quality:`);
  bestSetups.byVpQuality.slice(0, 3).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.group}: ${s.winRate.toFixed(1)}% WR, ${s.profitFactor.toFixed(2)} PF (${s.count} trades)`);
  });

  console.log(`\nBy Conviction:`);
  bestSetups.byConviction.slice(0, 3).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.group}: ${s.winRate.toFixed(1)}% WR, ${s.profitFactor.toFixed(2)} PF (${s.count} trades)`);
  });

  //=============================================================================
  // 3. WORST PERFORMING SETUPS
  //=============================================================================

  console.log(`\n⚠️  WORST PERFORMING SETUPS:\n`);

  const worstSetups = bestSetups.bySetup.slice(-3).reverse();
  worstSetups.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.group}: ${s.winRate.toFixed(1)}% WR, ${s.profitFactor.toFixed(2)} PF (${s.count} trades)`);
  });

  //=============================================================================
  // 4. ADAPTIVE RECOMMENDATIONS
  //=============================================================================

  console.log(`\n💡 ADAPTIVE WEIGHT RECOMMENDATIONS:\n`);

  const overallMetrics = { profitFactor, sharpeRatio, winRate, maxDrawdown };
  const recommendations = generateWeightRecommendations(bestSetups, overallMetrics);

  console.log(`\n   Recommended Weights:`);
  console.log(`   - Momentum: ${recommendations.momentum.toFixed(2)}x`);
  console.log(`   - Volume Profile: ${recommendations.volume_profile.toFixed(2)}x`);
  console.log(`   - Social: ${recommendations.social.toFixed(2)}x`);
  console.log(`   - Technical: ${recommendations.technical.toFixed(2)}x`);
  console.log(`   - Liquidity: ${recommendations.liquidity.toFixed(2)}x`);
  console.log(`   - Funding: ${recommendations.funding.toFixed(2)}x`);

  //=============================================================================
  // 5. ACTION ITEMS
  //=============================================================================

  console.log(`\n🎯 ACTION ITEMS:\n`);

  // Action 1: Focus on winners
  const topSetup = bestSetups.bySetup[0];
  if (topSetup) {
    console.log(`   ✅ FOCUS: ${topSetup.group} setups (${topSetup.winRate.toFixed(1)}% win rate)`);
  }

  // Action 2: Avoid losers
  const worstSetup = bestSetups.bySetup[bestSetups.bySetup.length - 1];
  if (worstSetup && worstSetup.profitFactor < 1.0) {
    console.log(`   ❌ AVOID: ${worstSetup.group} setups (${worstSetup.winRate.toFixed(1)}% win rate)`);
  }

  // Action 3: Risk management
  if (maxDrawdown > 15) {
    console.log(`   🛡️  REDUCE RISK: Max DD ${maxDrawdown.toFixed(1)}% > 15% (reduce position sizes)`);
  }

  // Action 4: Regime awareness
  const bestRegime = bestSetups.byRegime[0];
  if (bestRegime) {
    console.log(`   📊 TRADE MORE IN: ${bestRegime.group} regime (${bestRegime.winRate.toFixed(1)}% win rate)`);
  }

  console.log(`\n`);

  return {
    overallMetrics,
    bestSetups,
    recommendations
  };
}

//===============================================================================
// RUN ANALYSIS
//===============================================================================

// In production, fetch trades from database:
// const trades = fetchTradesFromDatabase(startDate, endDate);

const analysis = analyzePerformance(SAMPLE_TRADES);

//===============================================================================
// EXPORT RESULTS (for n8n integration)
//===============================================================================

// Return analysis results for use in subsequent nodes
return [{
  json: {
    timestamp: new Date().toISOString(),
    trade_count: SAMPLE_TRADES.length,
    metrics: analysis?.overallMetrics || {},
    best_setups: analysis?.bestSetups || {},
    recommendations: analysis?.recommendations || {},
    status: "success"
  }
}];
