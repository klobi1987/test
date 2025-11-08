// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 TRADE CLEANER V9.0 - CLEAN MESSAGE ROUTING
// ═══════════════════════════════════════════════════════════════════════════════
//
// 🆕 Changes from V8.0:
// ✅ Only 2 message types: "TRADE_SELECTED" or "NO_TRADE" (clean IF node routing)
// ✅ Validation failures → NO_TRADE (not VALIDATION_FAILED)
// ✅ Missing input → NO_TRADE (not ERROR)
// ✅ Selector NO_TRADE → pass through as NO_TRADE
// ✅ Valid trade → TRADE_SELECTED with full data
//
// 🎯 IF Node Logic:
// - message === "TRADE_SELECTED" → Execute trade
// - message === "NO_TRADE" → Skip/log
//
// ═══════════════════════════════════════════════════════════════════════════════

const input = $input.all();

console.log('═'.repeat(80));
console.log('🧹 TRADE CLEANER V9.0 - CLEAN MESSAGE ROUTING');
console.log('═'.repeat(80));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CHECK INPUT EXISTS
// ═══════════════════════════════════════════════════════════════════════════════

if (!input || input.length === 0) {
    console.log('[Input] ❌ No input received');
    return [{
        json: {
            message: "NO_TRADE",
            reason: "No input from previous node (Trade Selector)",
            timestamp: new Date().toISOString()
        }
    }];
}

// ⚡ ALWAYS take FIRST item (rank 1 - best score!)
const lastItem = input[0].json;

console.log(`[Input] ✅ Received data from Trade Selector`);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CHECK MESSAGE TYPE FROM SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

if (lastItem.message === "NO_TRADE") {
    console.log('[Message] ⚠️  NO_TRADE signal from Trade Selector');
    console.log(`[Reason] ${lastItem.reason || 'No reason provided'}`);
    return [{
        json: {
            message: "NO_TRADE",
            reason: lastItem.reason || "No trade selected by Trade Selector",
            selector_info: lastItem._meta || {},
            timestamp: new Date().toISOString()
        }
    }];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. EXTRACT & VALIDATE TRADE DATA
// ═══════════════════════════════════════════════════════════════════════════════

console.log('[Input] ✅ Trade object detected');
console.log(`[Symbol] ${lastItem.symbol || 'UNKNOWN'}`);

const symbol = lastItem.symbol || lastItem.bybit_symbol;
const side = lastItem.side;
const entry = lastItem.entry_price;
const stopLoss = lastItem.stop_loss;
const leverage = lastItem.leverage;
const qty = lastItem.quantity;

// Take profits
let takeProfit, takeProfits;

if (lastItem.take_profits && Array.isArray(lastItem.take_profits) && lastItem.take_profits.length > 0) {
    takeProfits = lastItem.take_profits;
    takeProfit = takeProfits[0]?.price;
} else if (lastItem.take_profit_1) {
    takeProfits = [];
    if (lastItem.take_profit_1) {
        takeProfits.push({
            price: lastItem.take_profit_1,
            size_pct: 50,
            label: "TP1"
        });
    }
    if (lastItem.take_profit_2) {
        takeProfits.push({
            price: lastItem.take_profit_2,
            size_pct: 50,  // Will be adjusted to remaining %
            label: "TP2"
        });
    }
    if (lastItem.take_profit_3) {
        takeProfits.push({
            price: lastItem.take_profit_3,
            size_pct: 0,  // Will be adjusted to remaining %
            label: "TP3"
        });
    }
    takeProfit = takeProfits[0]?.price;
} else {
    takeProfit = null;
    takeProfits = [];
}

// Exchange parameters
const tickSize = lastItem.tick_size || 0.01;
const qtyStep = lastItem.qty_step || 0.001;
const maxLeverage = lastItem.max_leverage || 25;

// Regime data
const _regime = lastItem._regime || { regime: 'NEUTRAL', confidence: 'HIGH' };

console.log(`\n[Extract] Symbol: ${symbol}`);
console.log(`[Extract] Side: ${side}`);
console.log(`[Extract] Entry: ${entry}`);
console.log(`[Extract] Stop Loss: ${stopLoss}`);
console.log(`[Extract] Take Profit: ${takeProfit}`);
console.log(`[Extract] Leverage: ${leverage}x`);
console.log(`[Extract] Quantity: ${qty}`);
console.log(`[Extract] Take Profits: ${takeProfits.length} levels`);

// ═══════════════════════════════════════════════════════════════════════════════
// 4. VALIDATION (failures → NO_TRADE!)
// ═══════════════════════════════════════════════════════════════════════════════

const errors = [];

if (!symbol) errors.push('Missing symbol');
if (!side) errors.push('Missing side');
if (!entry || entry <= 0) errors.push('Invalid entry price');
if (!stopLoss || stopLoss <= 0) errors.push('Invalid stop-loss price');
if (!takeProfit || takeProfit <= 0) errors.push('Invalid take-profit price');
if (!leverage || leverage < 1 || leverage > 75) errors.push(`Invalid leverage: ${leverage}`);
if (!qty || qty <= 0) errors.push('Invalid quantity');

// Validate SL/TP logic
if (entry && stopLoss && takeProfit) {
    const normalizedSide = (side === 'BUY' || side === 'LONG') ? 'LONG' : 'SHORT';

    if (normalizedSide === 'LONG') {
        if (stopLoss >= entry) {
            errors.push(`LONG: SL (${stopLoss}) must be < entry (${entry})`);
        }
        if (takeProfit <= entry) {
            errors.push(`LONG: TP (${takeProfit}) must be > entry (${entry})`);
        }
    } else {
        if (stopLoss <= entry) {
            errors.push(`SHORT: SL (${stopLoss}) must be > entry (${entry})`);
        }
        if (takeProfit >= entry) {
            errors.push(`SHORT: TP (${takeProfit}) must be < entry (${entry})`);
        }
    }
}

if (errors.length > 0) {
    console.log('\n[Validation] ❌ Validation failed:');
    errors.forEach(err => console.log(`  - ${err}`));

    return [{
        json: {
            message: "NO_TRADE",
            reason: "Validation failed: " + errors.join(', '),
            errors: errors,
            symbol: symbol,
            timestamp: new Date().toISOString()
        }
    }];
}

console.log('[Validation] ✅ All checks passed');

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ROUNDING & FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

const roundPrice = (price, tick) => {
    if (!price || !tick || tick <= 0) return price;
    return Math.round(price / tick) * tick;
};

const roundQty = (quantity, step) => {
    if (!quantity || !step || step <= 0) return quantity;
    return Math.floor(quantity / step) * step;
};

const formatNumber = (num, decimals = 8) => {
    if (!num) return "0";
    return parseFloat(num.toFixed(decimals)).toString();
};

const roundedEntry = roundPrice(entry, tickSize);
const roundedSL = roundPrice(stopLoss, tickSize);
const roundedTP = roundPrice(takeProfit, tickSize);
const roundedQty = Math.max(qtyStep, roundQty(qty, qtyStep));
const cappedLeverage = Math.min(leverage, maxLeverage);

console.log(`\n[Rounding] Tick size: ${tickSize}, Qty step: ${qtyStep}`);
console.log(`  Entry: ${entry} → ${roundedEntry}`);
console.log(`  SL: ${stopLoss} → ${roundedSL}`);
console.log(`  TP: ${takeProfit} → ${roundedTP}`);
console.log(`  Qty: ${qty} → ${roundedQty}`);
console.log(`  Leverage: ${leverage}x → ${cappedLeverage}x (max: ${maxLeverage}x)`);

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FORMAT TAKE PROFITS (100% allocation!)
// ═══════════════════════════════════════════════════════════════════════════════

const bybitSide = (side === 'LONG' || side === 'BUY') ? 'Buy' : 'Sell';

let formattedTakeProfits = [];

console.log(`\n[TakeProfits] Formatting ${takeProfits.length} TP levels:`);

if (takeProfits.length > 0) {
    let totalPct = 0;

    for (let i = 0; i < takeProfits.length; i++) {
        const tp = takeProfits[i];
        const tpPrice = roundPrice(tp.price, tickSize);
        let sizePct = tp.size_pct || 100;

        // ⚡ Last TP ALWAYS gets remaining % to ensure 100% total
        if (i === takeProfits.length - 1) {
            sizePct = 100 - totalPct;
            console.log(`  ${tp.label || `TP${i + 1}`}: ${formatNumber(tpPrice, 8)} @ ${sizePct}% (remaining to close 100%)`);
        } else {
            totalPct += sizePct;
            console.log(`  ${tp.label || `TP${i + 1}`}: ${formatNumber(tpPrice, 8)} @ ${sizePct}%`);
        }

        formattedTakeProfits.push({
            price: formatNumber(tpPrice, 8),
            size_pct: sizePct
        });
    }

    console.log(`[TakeProfits] ✅ Total allocation: 100%`);
} else {
    console.log(`[TakeProfits] No multiple TPs - using single TP @ 100%`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CREATE TRADE RUNNER REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

const tradeRunnerRequest = {
    // ===== MESSAGE FOR IF NODE =====
    message: "TRADE_SELECTED",

    // ===== REQUIRED FIELDS =====
    symbol: symbol,
    side: bybitSide,
    orderType: "Market",
    qty: formatNumber(roundedQty, 6),
    stopLoss: formatNumber(roundedSL, 8),
    takeProfit: formatNumber(roundedTP, 8),

    // ===== OPTIONAL FIELDS =====
    leverage: String(cappedLeverage),
    positionIdx: (side === 'LONG' || side === 'BUY') ? 1 : 2,
    timeInForce: "IOC",
    category: "linear",

    // Multiple TPs (if available)
    takeProfits: formattedTakeProfits.length > 0 ? formattedTakeProfits : undefined,

    // Regime data (for Position Manager)
    _regime: {
        regime: _regime.regime || "NEUTRAL",
        confidence: _regime.confidence || "HIGH",
        tf_15m: _regime.tf_15m || _regime.regime,
        tf_1h: _regime.tf_1h || _regime.regime,
        tf_4h: _regime.tf_4h || _regime.regime
    },

    // Risk metrics (for logging and Position Manager)
    _meta: {
        position_size_usdt: lastItem.position_size_usdt,
        position_exposure_usdt: lastItem.position_exposure_usdt,
        risk_usdt: lastItem.risk_usdt,
        leveraged_risk_usdt: lastItem.leveraged_risk_usdt,
        risk_reward_ratio: lastItem.risk_reward_ratio,
        trade_score: lastItem.trade_score,
        alpha: lastItem.alpha,
        conviction: lastItem.conviction,
        vp_setup_quality: lastItem.vp_setup_quality,
        liquidation_price: lastItem.liquidation_price,
        liquidation_distance_pct: lastItem.liquidation_distance_pct,
        liq_buffer_pct: lastItem.liq_buffer_pct,
        roi_tp1_pct: lastItem.roi_tp1_pct,
        roi_tp2_pct: lastItem.roi_tp2_pct,
        roi_sl_pct: lastItem.roi_sl_pct
    }
};

console.log('\n[Trade Runner Request] ✅ Created successfully');
console.log(`[Message] TRADE_SELECTED → IF node will execute`);

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SUMMARY OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(80));
console.log('✅ TRADE READY FOR EXECUTION');
console.log('═'.repeat(80));
console.log(`📊 TRADE DETAILS:`);
console.log(`   Symbol: ${symbol} ${bybitSide}`);
console.log(`   Entry: ${formatNumber(roundedEntry, 8)}`);
console.log(`   Leverage: ${cappedLeverage}x`);
console.log(`   Quantity: ${formatNumber(roundedQty, 6)}`);
console.log(`   Exposure: ${lastItem.position_exposure_usdt?.toFixed(0)} USDT`);
console.log(`\n🎯 RISK MANAGEMENT:`);
console.log(`   Stop Loss: ${formatNumber(roundedSL, 8)} (${lastItem.stop_loss_pct?.toFixed(2)}%)`);
console.log(`   Take Profit 1: ${formatNumber(roundedTP, 8)} (${lastItem.take_profit_1_pct?.toFixed(2)}%)`);
if (lastItem.take_profit_2) {
    console.log(`   Take Profit 2: ${formatNumber(roundPrice(lastItem.take_profit_2, tickSize), 8)} (${lastItem.take_profit_2_pct?.toFixed(2)}%)`);
}
console.log(`   Risk/Reward: ${lastItem.risk_reward_ratio?.toFixed(2)}:1`);
console.log(`   Liquidation: ${formatNumber(lastItem.liquidation_price, 8)} (buffer: ${lastItem.liq_buffer_pct?.toFixed(2)}%)`);
console.log(`\n📈 PERFORMANCE METRICS:`);
console.log(`   Trade Score: ${lastItem.trade_score}/100`);
console.log(`   Alpha: ${lastItem.alpha?.toFixed(1)}`);
console.log(`   Conviction: ${lastItem.conviction}`);
console.log(`   VP Quality: ${lastItem.vp_setup_quality}`);
console.log(`   ROI if TP1: +${lastItem.roi_tp1_pct?.toFixed(1)}%`);
console.log(`   ROI if TP2: +${lastItem.roi_tp2_pct?.toFixed(1)}%`);
console.log(`   ROI if SL: ${lastItem.roi_sl_pct?.toFixed(1)}%`);
console.log('\n💡 Next Step: IF node checks message === "TRADE_SELECTED"');
console.log('═'.repeat(80) + '\n');

// ═══════════════════════════════════════════════════════════════════════════════
// 9. RETURN
// ═══════════════════════════════════════════════════════════════════════════════

return [{
    json: tradeRunnerRequest
}];
