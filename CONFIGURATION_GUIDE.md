# Bybit Leverage System - Configuration Guide

## Quick Reference for System Tuning

This guide provides practical configuration parameters for optimizing the Bybit Leverage Trading System.

---

## 1. Adaptive Engine Configuration

**Location**: ADAPTIVE JS ENGINE v8 node → `CONFIG` object

### Core Parameters

```javascript
CONFIG = {
  TOP_K: 50,                    // Number of candidates to pass through
  INCLUDE_BTC: true,            // Always include BTC for regime analysis

  MIN_REQUIREMENTS: {
    volume24h: 1_000_000,       // Minimum $1M daily volume
    turnover24h: 100_000,       // Minimum $100k turnover
    openInterestValue: 200_000, // Minimum $200k open interest
    social_volume_24h: 80,      // Minimum 80 social mentions
    volatilityMin: 0.012,       // Minimum 1.2% volatility (too stable = no opportunity)
    volatilityMax: 0.25,        // Maximum 25% volatility (too wild = risky)
  },

  WEIGHTS: {
    liquidity: 0.20,            // 20% weight on volume/turnover
    socialMomentum: 0.30,       // 30% weight on social metrics
    rankJumps: 0.28,            // 28% weight on ranking improvements
    marketMomentum: 0.20,       // 20% weight on price action
    categoryBonus: 0.02,        // 2% weight on sector trends
  },

  THRESHOLDS: {
    galaxyJump: 3,              // Galaxy score must jump 3+ points
    altRankJump: 50,            // Alt rank must improve 50+ positions
    socialEfficiencyGood: 50,   // Engagement efficiency threshold
    oiRatioGood: 0.25,          // OI/Turnover ratio threshold
    fundingAbsSmall: 0.0002,    // Neutral funding rate threshold
  },

  CATEGORY_BONUS: {
    'ai': 0.4,                  // AI sector gets 40% bonus
    'defi': 0.2,                // DeFi sector gets 20% bonus
    'gaming': 0.1,              // Gaming gets 10% bonus
    'l2': 0.1,                  // Layer 2 gets 10% bonus
    'real-world-assets': 0.2,   // RWA gets 20% bonus
  }
}
```

### Tuning Guide

#### Conservative Profile (Lower Risk)
```javascript
MIN_REQUIREMENTS: {
  volume24h: 5_000_000,        // Higher liquidity
  volatilityMin: 0.015,
  volatilityMax: 0.15,         // Narrower volatility band
}

THRESHOLDS: {
  galaxyJump: 5,               // Stronger social signals
  altRankJump: 75,             // Bigger rank improvements
  socialEfficiencyGood: 75,    // Higher engagement bar
}
```

#### Aggressive Profile (Higher Risk/Reward)
```javascript
MIN_REQUIREMENTS: {
  volume24h: 500_000,          // Lower liquidity OK
  volatilityMin: 0.02,
  volatilityMax: 0.35,         // Accept wilder coins
}

THRESHOLDS: {
  galaxyJump: 2,               // Earlier signal entry
  altRankJump: 30,             // Catch trends sooner
  socialEfficiencyGood: 30,    // Lower bar for entry
}
```

#### Market Regime Adjustments

**Bull Market**: Increase social momentum weight
```javascript
WEIGHTS: {
  liquidity: 0.15,
  socialMomentum: 0.40,        // Social FOMO drives bull markets
  rankJumps: 0.25,
  marketMomentum: 0.18,
  categoryBonus: 0.02,
}
```

**Bear Market**: Increase liquidity weight
```javascript
WEIGHTS: {
  liquidity: 0.35,             // Safety first in bear markets
  socialMomentum: 0.15,
  rankJumps: 0.20,
  marketMomentum: 0.28,        // Follow price action
  categoryBonus: 0.02,
}
```

**Sideways/Choppy**: Balance all weights
```javascript
WEIGHTS: {
  liquidity: 0.25,
  socialMomentum: 0.25,
  rankJumps: 0.25,
  marketMomentum: 0.23,
  categoryBonus: 0.02,
}
```

---

## 2. Volume Profile Scoring

**Location**: Rating Node v4.0 → `calculateVPScore()` function

### VP Score Allocation

```javascript
VP_SCORING = {
  // 4H timeframe (strategic level)
  vp_4h_at_POC: 30,            // Price at maximum volume
  vp_4h_inside_value: 20,      // Price in 70% volume zone
  vp_4h_near_value: 10,        // Within 3% of value area

  // 1H timeframe (tactical level)
  vp_1h_at_POC: 20,
  vp_1h_inside_value: 12,
  vp_1h_near_value: 6,

  // 15min timeframe (entry timing)
  vp_15m_at_POC: 10,
  vp_15m_inside_value: 6,

  // Multi-timeframe bonuses
  all_at_POC: 30,              // GOLDEN SETUP
  all_in_value: 15,            // EXCELLENT SETUP

  // Institutional zone proximity
  near_HVN: 5,                 // Close to high volume node
}
```

### VP Hard Filters

```javascript
VP_FILTERS = {
  max_distance_from_value: 5,  // Reject if >5% from 4H value area
  min_distance_from_value: 0,  // Must be outside for breakout trades (optional)
}
```

**Conservative**: Lower max_distance to 3% (wait for deeper pullbacks)
**Aggressive**: Raise to 8% (catch trending moves earlier)

---

## 3. Stop Loss & Take Profit Configuration

**Location**: SL TP Finder v2.0 node

### Risk-Reward Targets

```javascript
SL_TP_CONFIG = {
  // Stop loss parameters
  min_sl_atr_multiple: 1.5,    // Minimum 1.5× ATR from entry
  max_sl_atr_multiple: 3.0,    // Maximum 3× ATR from entry
  sl_placement: "BELOW_HVN",   // Below high volume node for longs

  // Take profit targets
  tp1_target_pct: 50,          // Exit 50% at TP1
  tp1_location: "OPPOSITE_VA", // Opposite side of value area

  tp2_target_pct: 30,          // Exit 30% at TP2
  tp2_location: "NEXT_HVN",    // Next high volume resistance

  tp3_target_pct: 20,          // Exit 20% at TP3 (runner)
  tp3_location: "SWING_HIGH",  // Previous swing high/low

  // Risk-reward requirements
  min_risk_reward: 2.5,        // Minimum 2.5:1 R:R ratio
  preferred_risk_reward: 3.5,  // Target 3.5:1 R:R
}
```

### Tuning for Different Markets

**Trending Market**: Wider stops, higher TP targets
```javascript
SL_TP_CONFIG = {
  min_sl_atr_multiple: 2.0,    // Give trades room to breathe
  max_sl_atr_multiple: 4.0,
  min_risk_reward: 3.0,        // Go for bigger wins
}
```

**Range-bound Market**: Tighter stops, quicker exits
```javascript
SL_TP_CONFIG = {
  min_sl_atr_multiple: 1.2,    // Tight stops in ranges
  max_sl_atr_multiple: 2.0,
  min_risk_reward: 2.0,        // Take profits faster
  tp1_target_pct: 70,          // Exit majority at TP1
}
```

---

## 4. Leverage Configuration

**Location**: Leverage Finder node

### Leverage Constraints

```javascript
LEVERAGE_CONFIG = {
  min_leverage: 2,             // Minimum 2x (conservative baseline)
  max_leverage: 10,            // Maximum 10x (aggressive cap)
  default_leverage: 5,         // Default 5x (moderate)

  // Setup-based adjustments
  leverage_by_setup: {
    "GOLDEN": 10,              // Max leverage for golden setups
    "EXCELLENT": 7,            // 7x for excellent setups
    "GOOD": 5,                 // 5x for good setups
    "MODERATE": 3,             // 3x for moderate setups
  },

  // Tier-based adjustments
  leverage_by_tier: {
    "A": 1.0,                  // 100% of calculated leverage
    "B": 0.85,                 // 85% reduction for Tier B
    "C": 0.6,                  // 60% for Tier C (risky)
  },

  // Volatility adjustments
  high_volatility_threshold: 0.15,  // 15% volatility
  high_volatility_reduction: 0.7,   // Reduce leverage to 70%
}
```

### Risk Profiles

#### Ultra-Conservative
```javascript
LEVERAGE_CONFIG = {
  min_leverage: 1,
  max_leverage: 3,
  default_leverage: 2,
}
```

#### Conservative
```javascript
LEVERAGE_CONFIG = {
  min_leverage: 2,
  max_leverage: 5,
  default_leverage: 3,
}
```

#### Moderate (Default)
```javascript
LEVERAGE_CONFIG = {
  min_leverage: 2,
  max_leverage: 10,
  default_leverage: 5,
}
```

#### Aggressive
```javascript
LEVERAGE_CONFIG = {
  min_leverage: 5,
  max_leverage: 20,
  default_leverage: 10,
}
```

#### Degen Mode (NOT RECOMMENDED)
```javascript
LEVERAGE_CONFIG = {
  min_leverage: 10,
  max_leverage: 50,
  default_leverage: 20,
}
```

---

## 5. Trade Selection Criteria

**Location**: Trade Selector node

### Selection Priorities

```javascript
SELECTION_CONFIG = {
  // Minimum requirements for trade execution
  min_alpha_score: 60,         // Don't trade below 60 alpha score
  min_vp_setup: "GOOD",        // Require at least GOOD VP setup

  // Multi-timeframe requirements
  require_15m_confluence: true,  // 15m must align
  require_1h_confluence: true,   // 1h must align
  require_4h_confluence: true,   // 4h must align

  // Order book requirements
  min_order_book_imbalance: 0.55,  // 55% imbalance in direction
  max_spread_bps: 20,              // Max 20 BPS spread

  // BTC regime filter
  require_btc_alignment: true,     // Only long alts if BTC bullish
  btc_bullish_threshold: 0,        // BTC must be >0% on 4H
}
```

### Relaxed Criteria (More Trades)

```javascript
SELECTION_CONFIG = {
  min_alpha_score: 50,           // Lower bar
  min_vp_setup: "MODERATE",      // Accept moderate setups
  require_4h_confluence: false,  // Don't need 4H alignment
  require_btc_alignment: false,  // Ignore BTC regime
}
```

### Strict Criteria (Higher Quality)

```javascript
SELECTION_CONFIG = {
  min_alpha_score: 75,           // Premium only
  min_vp_setup: "EXCELLENT",     // Excellent+ setups only
  require_15m_confluence: true,  // All TF must align
  require_1h_confluence: true,
  require_4h_confluence: true,
  min_order_book_imbalance: 0.65,  // Strong imbalance required
  require_btc_alignment: true,   // Must follow BTC
}
```

---

## 6. Schedule & Execution Timing

**Location**: Smart Schedule Trigger node

### Trigger Frequency

```javascript
SCHEDULE_CONFIG = {
  frequency: "every_4_hours",    // Default: 4 hourly checks

  // Alternative frequencies:
  // "every_1_hour"  - More trades, more noise
  // "every_2_hours" - Balanced
  // "every_4_hours" - Default, good balance
  // "every_6_hours" - Conservative, major moves only
  // "every_12_hours" - Very conservative
}
```

**Recommendation**:
- **Scalpers**: Every 1-2 hours
- **Day traders**: Every 4 hours (default)
- **Swing traders**: Every 6-12 hours

### Execution Hours (Optional Time Filter)

```javascript
EXECUTION_HOURS = {
  enabled: true,
  trading_hours: {
    start: "00:00",   // UTC time
    end: "23:59",     // 24/7 default for crypto
  },

  // Example: Only trade during high volume hours
  high_volume_hours: {
    start: "08:00",   // 8am UTC (Europe open)
    end: "22:00",     // 10pm UTC (US close)
  },

  // Avoid: Low liquidity periods (optional)
  blackout_hours: [
    "04:00-06:00",    // Weekend low volume window
  ]
}
```

---

## 7. Risk Management Settings

### Position Sizing

```javascript
RISK_CONFIG = {
  risk_per_trade_pct: 2,         // 2% of account per trade
  max_single_position_pct: 20,   // Max 20% in one trade
  max_total_exposure_pct: 80,    // Max 80% total deployed

  // Drawdown protection
  max_drawdown_pct: 15,          // Kill switch at 15% DD
  daily_loss_limit_pct: 5,       // Stop trading if -5% on day

  // Consecutive loss protection
  max_consecutive_losses: 3,     // Pause after 3 losses
  cooldown_period_hours: 24,     // Wait 24h after max losses
}
```

### Conservative Risk Profile

```javascript
RISK_CONFIG = {
  risk_per_trade_pct: 1,         // 1% per trade
  max_single_position_pct: 10,   // Max 10% in one trade
  max_total_exposure_pct: 50,    // Max 50% deployed
  max_drawdown_pct: 10,          // 10% kill switch
}
```

### Aggressive Risk Profile

```javascript
RISK_CONFIG = {
  risk_per_trade_pct: 3,         // 3% per trade (risky!)
  max_single_position_pct: 30,   // 30% max position
  max_total_exposure_pct: 100,   // Fully deployed
  max_drawdown_pct: 20,          // 20% kill switch
}
```

---

## 8. API Rate Limits & Performance

### Bybit API Limits

```javascript
API_LIMITS = {
  // Bybit rate limits (per second)
  max_requests_per_second: 10,   // 10 req/s for public endpoints
  max_requests_per_minute: 120,  // 120 req/min for account endpoints

  // Batch processing
  batch_size: 50,                // Process 50 coins per batch
  batch_delay_ms: 200,           // 200ms delay between batches

  // Retry logic
  max_retries: 3,                // Retry failed requests 3 times
  retry_delay_ms: 1000,          // 1 second between retries
}
```

### Performance Optimization

```javascript
PERFORMANCE_CONFIG = {
  // Parallel processing
  enable_parallel_requests: true,  // Use Promise.all()
  max_parallel_requests: 5,        // Max 5 concurrent requests

  // Caching
  enable_cache: true,              // Cache ticker data
  cache_ttl_seconds: 60,           // 1-minute cache

  // Data filtering
  prefilter_min_volume: 100_000,   // Skip coins <$100k volume
}
```

---

## 9. Notification & Monitoring

### Alert Configuration

```javascript
ALERTS_CONFIG = {
  // Trade execution alerts
  notify_on_trade: true,           // Send alert when trade placed
  notify_on_golden_setup: true,    // Alert for GOLDEN VP setups
  notify_on_high_alpha: true,      // Alert for alpha >85
  high_alpha_threshold: 85,

  // Risk alerts
  notify_on_stop_loss: true,       // Alert when stopped out
  notify_on_take_profit: true,     // Alert when TP hit
  notify_on_drawdown: true,        // Alert at 10% drawdown
  drawdown_alert_threshold: 10,

  // System alerts
  notify_on_error: true,           // Alert on workflow errors
  notify_on_api_failure: true,     // Alert on API failures
}
```

### Notification Channels

```javascript
NOTIFICATION_CHANNELS = {
  telegram: {
    enabled: true,
    bot_token: "YOUR_BOT_TOKEN",
    chat_id: "YOUR_CHAT_ID",
  },
  discord: {
    enabled: false,
    webhook_url: "YOUR_WEBHOOK_URL",
  },
  email: {
    enabled: false,
    smtp_config: {},
  },
  webhook: {
    enabled: true,
    url: "https://your-dashboard.com/api/trades",
  }
}
```

---

## 10. Backtesting Parameters

### Historical Data Range

```javascript
BACKTEST_CONFIG = {
  start_date: "2024-01-01",
  end_date: "2024-10-31",
  initial_balance: 10000,          // $10k starting capital

  // Simulation parameters
  slippage_pct: 0.1,               // 0.1% slippage
  commission_pct: 0.055,           // 0.055% taker fee (Bybit)

  // What-if scenarios
  scenarios: [
    { name: "Conservative", leverage_multiplier: 0.5 },
    { name: "Default", leverage_multiplier: 1.0 },
    { name: "Aggressive", leverage_multiplier: 1.5 },
  ]
}
```

---

## 11. Quick Start Recommendations

### Step 1: Choose Your Risk Profile

**New to algo trading?** → Start with **Conservative** settings
**Experienced trader?** → Use **Moderate** (default) settings
**Seasoned quant?** → Experiment with **Aggressive** (carefully!)

### Step 2: Set Your Configuration

1. Copy the relevant config from sections above
2. Update the JavaScript nodes in n8n workflow
3. Test with paper trading first

### Step 3: Monitor & Iterate

- Track first 20 trades manually
- Calculate actual win rate & R:R
- Adjust WEIGHTS and THRESHOLDS based on results
- Optimize for your risk tolerance

---

## 12. Configuration Change Checklist

Before deploying configuration changes:

- [ ] Backtest new parameters on historical data
- [ ] Paper trade for at least 10 trades
- [ ] Verify leverage limits match exchange settings
- [ ] Confirm stop loss placement makes sense
- [ ] Test API rate limits won't be exceeded
- [ ] Set up monitoring alerts
- [ ] Document changes in version control

---

## Environment Variables (Recommended)

Instead of hardcoding values, use n8n environment variables:

```javascript
// In n8n workflow
const CONFIG = {
  TOP_K: parseInt($env.ADAPTIVE_TOP_K) || 50,
  MIN_REQUIREMENTS: {
    volume24h: parseInt($env.MIN_VOLUME) || 1_000_000,
    // ... etc
  }
}
```

**Benefits**:
- Change settings without editing workflow
- A/B test different configs
- Environment-specific settings (dev vs prod)

---

**Last Updated**: 2025-11-07
**Version**: 1.0
**Compatibility**: n8n Bybit Leverage Workflow v7
