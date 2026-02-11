// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ RISK MANAGEMENT LAYER v1.1 - FIXED USDT SIZING
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔧 FIXED IN v1.1:
// ✅ Works with FIXED USDT amounts (30-70 USDT per trade)
// ✅ No need to know account balance
// ✅ Simplified risk checks for fixed sizing
// ✅ Removed portfolio heat calculation (requires account balance)
// ✅ Focus on: correlation, volatility, time limits, consecutive losses
//
// ROLE: Enforce risk controls WITHOUT needing account balance data
//
// ═══════════════════════════════════════════════════════════════════════════

const input = $input.all();

if (!input || input.length === 0) {
  console.error("❌ ERROR: No input from Rating Node!");
  return [];
}

const candidates = input.map(item => item.json);

console.log(`\n🛡️ RISK MANAGEMENT LAYER v1.1 - Processing ${candidates.length} candidates`);

//===============================================================================
// CONFIGURATION (CUSTOMIZE THESE)
//===============================================================================

const RISK_LIMITS = {
  // Drawdown protection (track in database/external state)
  max_daily_loss_usdt: 150,           // Stop if -150 USDT daily loss
  max_consecutive_losses: 5,          // Stop after 5 consecutive losses
  circuit_breaker_loss_usdt: 300,     // Emergency stop at -300 USDT

  // Time-based limits
  max_trades_per_hour: 3,
  max_trades_per_day: 10,

  // Volatility limits
  max_volatility_pct: 8.0,            // Skip coins with >8% ATR
  min_volatility_pct: 1.0,            // Skip coins with <1% ATR

  // Liquidity requirements
  min_volume_24h: 10000,              // Minimum 24h volume
  max_spread_pct: 0.2,                // Maximum 20% spread

  // Position size limits (USDT)
  min_position_size_usdt: 30,
  max_position_size_usdt: 70,

  // Correlation limits (max USDT exposure in correlated group)
  max_correlated_exposure_usdt: 150   // Max 150 USDT total in same sector
};

//===============================================================================
// PORTFOLIO STATE (Would come from database in production)
//===============================================================================

// 🔧 SIMPLIFIED: Only track what we need for fixed USDT sizing
const PORTFOLIO_STATE = {
  current_positions: [],             // Array of current positions with {symbol, size_usdt, side}
  daily_pnl_usdt: 0,                 // Today's P&L in USDT
  consecutive_losses: 0,             // Consecutive losing trades
  trades_today: 0,                   // Trades executed today
  trades_this_hour: 0,               // Trades this hour
  last_trade_time: null              // Timestamp of last trade
};

// 🔧 In production, fetch this from your database:
// const PORTFOLIO_STATE = await fetchPortfolioState();

//===============================================================================
// HELPER FUNCTIONS
//===============================================================================

/**
 * Check correlation with existing positions (simplified)
 */
function checkCorrelation(symbol, existingPositions) {
  const correlatedGroups = [
    ["ETH", "BNB", "SOL", "AVAX", "NEAR"],        // L1 platforms
    ["DOGE", "SHIB", "PEPE", "FLOKI", "WIF"],     // Meme coins
    ["UNI", "SUSHI", "AAVE", "CRV", "COMP"],      // DeFi
    ["MATIC", "ARB", "OP", "IMX", "METIS"],       // L2s/Scaling
    ["LINK", "GRT", "BAND", "API3", "TRB"],       // Oracles
    ["AXS", "SAND", "MANA", "GALA", "ENJ"],       // Gaming/Metaverse
    ["FIL", "AR", "STORJ", "BTT"],                // Storage
    ["ATOM", "DOT", "KSM", "OSMO"]                // Interoperability
  ];

  const symBase = symbol.replace("USDT", "").replace("USD", "").replace("PERP", "");

  for (const group of correlatedGroups) {
    if (group.includes(symBase)) {
      // Find existing positions in same group
      const correlatedPositions = existingPositions.filter(pos => {
        const posBase = pos.symbol.replace("USDT", "").replace("USD", "").replace("PERP", "");
        return group.includes(posBase) && posBase !== symBase;
      });

      if (correlatedPositions.length > 0) {
        const totalExposure = correlatedPositions.reduce((sum, p) => sum + (p.size_usdt || 0), 0);
        return {
          correlated: true,
          group: group,
          existing_positions: correlatedPositions,
          total_exposure_usdt: totalExposure
        };
      }
    }
  }

  return { correlated: false, total_exposure_usdt: 0 };
}

/**
 * Validate stop loss distance
 */
function validateStopLoss(coin) {
  const price = coin.price || 0;
  const sl = coin.stop_loss?.price || null;

  if (!sl || price === 0) {
    // If no SL data, just warn but don't block
    return {
      valid: true,
      warning: "No stop loss data available"
    };
  }

  const stop_distance_pct = Math.abs((price - sl) / price) * 100;

  if (stop_distance_pct < 1.0) {
    return {
      valid: false,
      reason: `SL too tight: ${stop_distance_pct.toFixed(2)}%`
    };
  }

  if (stop_distance_pct > 15.0) {
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
 * Validate position size is within limits
 */
function validatePositionSize(coin) {
  const size = coin.position_size_usdt || 0;

  if (size < RISK_LIMITS.min_position_size_usdt) {
    return {
      valid: false,
      reason: `Position too small: ${size} USDT < ${RISK_LIMITS.min_position_size_usdt} USDT`
    };
  }

  if (size > RISK_LIMITS.max_position_size_usdt) {
    return {
      valid: false,
      reason: `Position too large: ${size} USDT > ${RISK_LIMITS.max_position_size_usdt} USDT`
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
  if (state.daily_pnl_usdt < 0) {
    const daily_loss = Math.abs(state.daily_pnl_usdt);

    if (daily_loss >= RISK_LIMITS.circuit_breaker_loss_usdt) {
      checks.passed = false;
      checks.failures.push(`🚨 CIRCUIT BREAKER: -${daily_loss} USDT daily loss`);
      return checks;
    }

    if (daily_loss >= RISK_LIMITS.max_daily_loss_usdt) {
      checks.passed = false;
      checks.failures.push(`Daily loss limit: -${daily_loss} USDT`);
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
  const atr_pct = coin.ta_1h_with_vp?.atr_pct || coin.ta_1h?.atr_pct || 2.0;

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
    const newPositionSize = coin.position_size_usdt || 0;
    const totalExposure = correlation.total_exposure_usdt + newPositionSize;

    if (totalExposure > RISK_LIMITS.max_correlated_exposure_usdt) {
      checks.passed = false;
      checks.failures.push(
        `Correlated exposure: ${totalExposure} USDT > ${RISK_LIMITS.max_correlated_exposure_usdt} USDT ` +
        `(existing: ${correlation.existing_positions.map(p => p.symbol).join(", ")})`
      );
    } else {
      checks.warnings.push(
        `⚠️  Correlated with ${correlation.existing_positions.map(p => p.symbol).join(", ")} ` +
        `(${totalExposure} USDT total exposure)`
      );
    }
  }

  // 6. POSITION SIZE VALIDATION
  const sizeCheck = validatePositionSize(coin);
  if (!sizeCheck.valid) {
    checks.passed = false;
    checks.failures.push(sizeCheck.reason);
  }

  // 7. STOP LOSS VALIDATION
  const slCheck = validateStopLoss(coin);
  if (!slCheck.valid) {
    checks.passed = false;
    checks.failures.push(slCheck.reason);
  } else if (slCheck.warning) {
    checks.warnings.push(slCheck.warning);
  }

  // 8. LIQUIDITY/SAFETY CHECKS
  const volume_24h = coin.derived?.volume24h || 0;
  if (volume_24h < RISK_LIMITS.min_volume_24h) {
    checks.passed = false;
    checks.failures.push(`Volume too low: ${volume_24h.toFixed(0)}`);
  }

  const spread = coin.data?.spread_pct || 0;
  if (spread > RISK_LIMITS.max_spread_pct) {
    checks.passed = false;
    checks.failures.push(`Spread too wide: ${(spread * 100).toFixed(2)}%`);
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
  time_limit_filtered: 0,
  consecutive_loss_filtered: 0,
  total_approved_usdt: 0
};

const approvedCandidates = [];

for (const coin of candidates) {
  const riskCheck = applyRiskManagement(coin, PORTFOLIO_STATE);

  if (riskCheck.passed) {
    approvedCandidates.push({
      ...coin,
      risk_approved: true,
      risk_warnings: riskCheck.warnings
    });
    stats.passed++;
    stats.total_approved_usdt += (coin.position_size_usdt || 0);
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
    if (riskCheck.failures.some(f => f.includes("limit"))) {
      stats.time_limit_filtered++;
    }
    if (riskCheck.failures.some(f => f.includes("Consecutive"))) {
      stats.consecutive_loss_filtered++;
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
console.log(`   💵 Total Approved: ${stats.total_approved_usdt.toFixed(0)} USDT`);
console.log(`\n🚫 Rejection Reasons:`);
console.log(`   Circuit breaker: ${stats.circuit_breaker}`);
console.log(`   Volatility: ${stats.volatility_filtered}`);
console.log(`   Correlation: ${stats.correlation_filtered}`);
console.log(`   Time limits: ${stats.time_limit_filtered}`);
console.log(`   Consecutive losses: ${stats.consecutive_loss_filtered}`);

if (approvedCandidates.length > 0) {
  console.log(`\n✅ APPROVED TRADES:`);
  approvedCandidates.slice(0, 10).forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.symbol} ${c.side} - ${c.position_size_usdt} USDT`);
    console.log(`      Conviction: ${c.conviction} | VP: ${c.vp_setup_quality}`);
    if (c.risk_warnings.length > 0) {
      console.log(`      ${c.risk_warnings.join(", ")}`);
    }
  });
}

console.log(`\n🛡️ Passing ${approvedCandidates.length} risk-approved candidates to Trade Selector\n`);

return approvedCandidates.map(coin => ({ json: coin }));
