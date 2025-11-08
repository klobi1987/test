// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ ADVANCED RISK MANAGEMENT LAYER v1.0
// ═══════════════════════════════════════════════════════════════════════════
//
// PURPOSE: Add this layer AFTER rating to enforce strict risk controls
//
// FEATURES:
// ✅ Portfolio heat (max total exposure)
// ✅ Correlation limits (avoid correlated positions)
// ✅ Drawdown circuit breaker
// ✅ Daily loss limits
// ✅ Position size limits per asset
// ✅ Volatility-adjusted sizing
// ✅ Concentration limits (max % per coin)
// ✅ Time-based limits (max trades per hour/day)
//
// INTEGRATION: Insert between Rating Node and Trade Selector
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Rating Node!");
  return [];
}

const candidates = input.map(item => item.json);

console.log(`\n🛡️ RISK MANAGEMENT LAYER - Processing ${candidates.length} candidates`);

//===============================================================================
// CONFIGURATION (CUSTOMIZE THESE)
//===============================================================================

const RISK_LIMITS = {
  // Portfolio-level limits
  max_portfolio_heat: 0.30,           // Max 30% total capital at risk
  max_single_position_pct: 0.10,      // Max 10% per position
  max_correlated_exposure: 0.20,      // Max 20% in correlated assets

  // Drawdown protection
  max_daily_loss_pct: 0.05,           // Stop if -5% daily loss
  max_consecutive_losses: 5,          // Stop after 5 consecutive losses
  circuit_breaker_loss_pct: 0.10,     // Emergency stop at -10% account

  // Time-based limits
  max_trades_per_hour: 3,
  max_trades_per_day: 10,

  // Volatility limits
  max_volatility_pct: 8.0,            // Skip coins with >8% ATR
  min_volatility_pct: 1.0,            // Skip coins with <1% ATR

  // Liquidity requirements
  min_liquidity_ratio: 0.05,          // Position size < 5% of 24h volume

  // Leverage limits (if using leverage)
  max_leverage: 3,                    // Max 3x leverage

  // Stop loss requirements
  min_stop_distance_pct: 1.0,         // Minimum 1% SL distance
  max_stop_distance_pct: 10.0         // Maximum 10% SL distance
};

//===============================================================================
// PORTFOLIO STATE (Would come from database in production)
//===============================================================================

// In production, fetch from your database/state management
const PORTFOLIO_STATE = {
  total_capital: 10000,              // Total account value in USDT
  available_capital: 10000,          // Available for new trades
  current_positions: [],             // Array of current positions
  daily_pnl: 0,                      // Today's P&L
  consecutive_losses: 0,             // Consecutive losing trades
  trades_today: 0,                   // Trades executed today
  trades_this_hour: 0,               // Trades this hour
  max_drawdown_today: 0              // Max drawdown today
};

//===============================================================================
// HELPER FUNCTIONS
//===============================================================================

/**
 * Calculate portfolio heat (total capital at risk)
 */
function calculatePortfolioHeat(positions, newPosition, state) {
  let total_risk = 0;

  // Existing positions risk
  for (const pos of positions) {
    const risk_amount = pos.size * (pos.stop_distance_pct / 100);
    total_risk += risk_amount;
  }

  // New position risk
  if (newPosition) {
    const risk_amount = newPosition.size * (newPosition.stop_distance_pct / 100);
    total_risk += risk_amount;
  }

  const heat_pct = total_risk / state.total_capital;
  return heat_pct;
}

/**
 * Check correlation with existing positions
 * (Simplified - in production use actual correlation matrix)
 */
function checkCorrelation(symbol, existingPositions) {
  const correlatedPairs = [
    ["ETH", "BNB", "SOL"],           // L1 platforms
    ["DOGE", "SHIB", "PEPE"],        // Meme coins
    ["UNI", "SUSHI", "AAVE"],        // DeFi
    ["MATIC", "ARB", "OP"],          // L2s
    ["LINK", "GRT", "BAND"]          // Oracles
  ];

  for (const group of correlatedPairs) {
    const symBase = symbol.replace("USDT", "").replace("USD", "");
    if (group.includes(symBase)) {
      // Check if we have positions in same group
      for (const pos of existingPositions) {
        const posBase = pos.symbol.replace("USDT", "").replace("USD", "");
        if (group.includes(posBase) && posBase !== symBase) {
          return {
            correlated: true,
            group: group,
            existing_symbol: pos.symbol
          };
        }
      }
    }
  }

  return { correlated: false };
}

/**
 * Calculate volatility-adjusted position size
 */
function calculateVolatilityAdjustedSize(coin, baseSize, targetRisk) {
  const atr_pct = coin.ta_1h_with_vp?.atr_pct || 2.0;
  const volatility_multiplier = coin._market_state?.volatility_multiplier || 1.0;

  // Inverse volatility sizing: higher vol = smaller size
  const vol_adjustment = 2.0 / Math.max(atr_pct, 0.5);

  let adjusted_size = baseSize * vol_adjustment * volatility_multiplier;

  // Cap at limits
  adjusted_size = Math.min(adjusted_size, RISK_LIMITS.max_single_position_pct);

  return adjusted_size;
}

/**
 * Validate stop loss distance
 */
function validateStopLoss(coin, side) {
  const price = coin.price || 0;

  // Check if coin has SL/TP data (from SL/TP Finder node)
  const sl = coin.stop_loss?.price || null;

  if (!sl || price === 0) {
    return {
      valid: false,
      reason: "No valid stop loss"
    };
  }

  const stop_distance_pct = Math.abs((price - sl) / price) * 100;

  if (stop_distance_pct < RISK_LIMITS.min_stop_distance_pct) {
    return {
      valid: false,
      reason: `SL too tight: ${stop_distance_pct.toFixed(2)}%`
    };
  }

  if (stop_distance_pct > RISK_LIMITS.max_stop_distance_pct) {
    return {
      valid: false,
      reason: `SL too wide: ${stop_distance_pct.toFixed(2)}%`
    };
  }

  return {
    valid: true,
    stop_distance_pct: stop_distance_pct
  };
}

/**
 * Check liquidity requirements
 */
function validateLiquidity(coin, positionSize) {
  const volume24h = coin.derived?.volume24h || 0;
  const price = coin.price || 1;

  const position_value = positionSize * PORTFOLIO_STATE.total_capital;
  const position_coins = position_value / price;

  const liquidity_ratio = (position_coins * price) / volume24h;

  if (liquidity_ratio > RISK_LIMITS.min_liquidity_ratio) {
    return {
      valid: false,
      reason: `Position too large vs 24h volume (${(liquidity_ratio * 100).toFixed(2)}%)`
    };
  }

  return { valid: true };
}

//===============================================================================
// MAIN RISK CHECKS
//===============================================================================

function applyRiskManagement(coin, state) {
  const checks = {
    passed: true,
    failures: [],
    warnings: []
  };

  // 1. CIRCUIT BREAKER - Daily loss limit
  if (state.daily_pnl < 0) {
    const daily_loss_pct = Math.abs(state.daily_pnl / state.total_capital);

    if (daily_loss_pct >= RISK_LIMITS.circuit_breaker_loss_pct) {
      checks.passed = false;
      checks.failures.push(`🚨 CIRCUIT BREAKER: -${(daily_loss_pct * 100).toFixed(2)}% daily loss`);
      return checks;
    }

    if (daily_loss_pct >= RISK_LIMITS.max_daily_loss_pct) {
      checks.passed = false;
      checks.failures.push(`Daily loss limit exceeded: -${(daily_loss_pct * 100).toFixed(2)}%`);
      return checks;
    }
  }

  // 2. CONSECUTIVE LOSSES
  if (state.consecutive_losses >= RISK_LIMITS.max_consecutive_losses) {
    checks.passed = false;
    checks.failures.push(`Consecutive losses: ${state.consecutive_losses}`);
    return checks;
  }

  // 3. TIME-BASED LIMITS
  if (state.trades_this_hour >= RISK_LIMITS.max_trades_per_hour) {
    checks.passed = false;
    checks.failures.push(`Hourly trade limit: ${state.trades_this_hour}`);
    return checks;
  }

  if (state.trades_today >= RISK_LIMITS.max_trades_per_day) {
    checks.passed = false;
    checks.failures.push(`Daily trade limit: ${state.trades_today}`);
    return checks;
  }

  // 4. VOLATILITY CHECK
  const atr_pct = coin.ta_1h_with_vp?.atr_pct || 2.0;

  if (atr_pct > RISK_LIMITS.max_volatility_pct) {
    checks.passed = false;
    checks.failures.push(`Volatility too high: ${atr_pct.toFixed(2)}%`);
  }

  if (atr_pct < RISK_LIMITS.min_volatility_pct) {
    checks.passed = false;
    checks.failures.push(`Volatility too low: ${atr_pct.toFixed(2)}%`);
  }

  // 5. CORRELATION CHECK
  const correlation = checkCorrelation(coin.symbol, state.current_positions);
  if (correlation.correlated) {
    // Check if adding this would exceed correlated exposure limit
    const correlated_exposure = state.current_positions
      .filter(p => correlation.group.includes(p.symbol.replace("USDT", "")))
      .reduce((sum, p) => sum + p.size_pct, 0);

    if (correlated_exposure >= RISK_LIMITS.max_correlated_exposure) {
      checks.passed = false;
      checks.failures.push(`Correlated exposure limit (${correlation.existing_symbol})`);
    } else {
      checks.warnings.push(`⚠️  Correlated with ${correlation.existing_symbol}`);
    }
  }

  // 6. STOP LOSS VALIDATION
  const slCheck = validateStopLoss(coin, coin.side);
  if (!slCheck.valid) {
    checks.passed = false;
    checks.failures.push(slCheck.reason);
  } else {
    coin._stop_distance_pct = slCheck.stop_distance_pct;
  }

  // 7. POSITION SIZE CALCULATION
  const base_size = coin.recommended_size_pct / 100 || 0.05;
  const adjusted_size = calculateVolatilityAdjustedSize(coin, base_size, RISK_LIMITS.max_single_position_pct);
  coin._adjusted_size_pct = adjusted_size * 100;

  // 8. LIQUIDITY CHECK
  const liquidityCheck = validateLiquidity(coin, adjusted_size);
  if (!liquidityCheck.valid) {
    checks.passed = false;
    checks.failures.push(liquidityCheck.reason);
  }

  // 9. PORTFOLIO HEAT CHECK
  const newPosition = {
    symbol: coin.symbol,
    size: adjusted_size * state.total_capital,
    size_pct: adjusted_size,
    stop_distance_pct: slCheck.stop_distance_pct || 5.0
  };

  const portfolio_heat = calculatePortfolioHeat(state.current_positions, newPosition, state);

  if (portfolio_heat > RISK_LIMITS.max_portfolio_heat) {
    checks.passed = false;
    checks.failures.push(`Portfolio heat: ${(portfolio_heat * 100).toFixed(1)}% > ${RISK_LIMITS.max_portfolio_heat * 100}%`);
  } else {
    coin._portfolio_heat = portfolio_heat;
  }

  return checks;
}

//===============================================================================
// PROCESS CANDIDATES
//===============================================================================

let stats = {
  input: candidates.length,
  passed: 0,
  failed: 0,
  circuit_breaker: 0,
  volatility_filtered: 0,
  correlation_filtered: 0,
  liquidity_filtered: 0,
  heat_filtered: 0
};

const approvedCandidates = [];

for (const coin of candidates) {
  const riskCheck = applyRiskManagement(coin, PORTFOLIO_STATE);

  if (riskCheck.passed) {
    approvedCandidates.push({
      ...coin,
      risk_approved: true,
      risk_warnings: riskCheck.warnings,
      adjusted_size_pct: coin._adjusted_size_pct,
      portfolio_heat: coin._portfolio_heat,
      stop_distance_pct: coin._stop_distance_pct
    });
    stats.passed++;
  } else {
    stats.failed++;

    // Track failure reasons
    if (riskCheck.failures.some(f => f.includes("CIRCUIT BREAKER"))) {
      stats.circuit_breaker++;
    }
    if (riskCheck.failures.some(f => f.includes("Volatility"))) {
      stats.volatility_filtered++;
    }
    if (riskCheck.failures.some(f => f.includes("Correlated"))) {
      stats.correlation_filtered++;
    }
    if (riskCheck.failures.some(f => f.includes("liquidity") || f.includes("volume"))) {
      stats.liquidity_filtered++;
    }
    if (riskCheck.failures.some(f => f.includes("heat"))) {
      stats.heat_filtered++;
    }

    console.log(`   ❌ ${coin.symbol}: ${riskCheck.failures.join(", ")}`);
  }
}

//===============================================================================
// OUTPUT
//===============================================================================

console.log(`\n📊 RISK MANAGEMENT RESULTS:`);
console.log(`   Input: ${stats.input}`);
console.log(`   ✅ Passed: ${stats.passed}`);
console.log(`   ❌ Failed: ${stats.failed}`);
console.log(`\n🚫 Rejection Reasons:`);
console.log(`   Circuit breaker: ${stats.circuit_breaker}`);
console.log(`   Volatility: ${stats.volatility_filtered}`);
console.log(`   Correlation: ${stats.correlation_filtered}`);
console.log(`   Liquidity: ${stats.liquidity_filtered}`);
console.log(`   Portfolio heat: ${stats.heat_filtered}`);

if (approvedCandidates.length > 0) {
  console.log(`\n✅ APPROVED TRADES:`);
  approvedCandidates.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.symbol} ${c.side} - Size: ${c.adjusted_size_pct.toFixed(2)}%`);
    console.log(`      Heat: ${(c.portfolio_heat * 100).toFixed(1)}% | SL: ${c.stop_distance_pct.toFixed(2)}%`);
    if (c.risk_warnings.length > 0) {
      console.log(`      ${c.risk_warnings.join(", ")}`);
    }
  });
}

console.log(`\n🛡️ Passing ${approvedCandidates.length} risk-approved candidates to Trade Selector\n`);

return approvedCandidates.map(coin => ({ json: coin }));
