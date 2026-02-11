# ⚡ LEVERAGE FINDER ULTIMATE - Documentation

## 🎯 Finalna Verzija: V5.0 - Maximum Safe Leverage

**Fajl:** `LEVERAGE_FINDER_ULTIMATE_V5.js`

---

## 📖 Filozofija

**NEMA univerzalnog optimala** - svaki trade dobiva svoj MAKSIMALNI safe leverage!

- **Uži SL (4-6%)** → Veći leverage (12-18x) ✅
- **Srednji SL (7-10%)** → Srednji leverage (7-11x) ✅
- **Širi SL (11-15%)** → Manji leverage (4-7x) ✅

### Princip rada:

```
1. Uzmi stop loss poziciju
2. Dodaj dinamički buffer (2-6%) ovisno o kvaliteti setupа
3. Nađi MAKSIMALNI safe leverage gdje je liq izvan SL zone
4. Koristi 93% tog max safe (mali safety margin)
```

---

## 🔧 Konfiguracija

### System Limits
```javascript
system_max_leverage: 20    // Povećano - pustimo matematiku da odluči!
safety_factor: 0.93        // Koristi 93% od max safe leverage
```

### Dynamic Buffer System

**Base buffer:** 2.5%

**Adjustments (poboljšavaju/pogoršavaju):**

| Faktor | EXTREME/GOLDEN | HIGH/EXCELLENT | MEDIUM/GOOD | LOW/MODERATE |
|--------|----------------|----------------|-------------|--------------|
| Conviction | -0.5% (tighter) | -0.25% | 0% | +0.75% (safer) |
| VP Quality | -0.5% (tighter) | -0.25% | 0% | +0.5% (safer) |
| Volatility | LOW: -0.25% | MEDIUM: 0% | HIGH: +0.5% | EXTREME: +1.0% |

**Rezultat:**
- **Najbolji setup**: 1.25-1.75% buffer → MAX leverage!
- **Prosječan setup**: 2.5-3.0% buffer → Balansirano
- **Slabiji setup**: 3.75-4.25% buffer → Sigurnije, manji leverage

---

## 📊 Primjeri

### Primjer 1: EXTREME conviction, GOLDEN VP, SL @ -5%

```javascript
Buffer calculation:
  Base: 2.5%
  - EXTREME: -0.5%
  - GOLDEN VP: -0.5%
  - LOW vol: -0.25%
  = 1.25% buffer

Leverage calculation:
  SL distance: 5%
  Target liq: 5% + 1.25% = 6.25%
  Max safe leverage: ~16x
  Final leverage: 16 × 0.93 = 14x ✅
```

**Output:**
```
Entry: 0.10000
SL: 0.09500 (-5.00%)
Liq: 0.09368 (-6.32%)
Leverage: 14x
Buffer: 1.32% ✅
Exposure: 1260 USDT (90 × 14x)
```

---

### Primjer 2: MEDIUM conviction, GOOD VP, SL @ -10%

```javascript
Buffer calculation:
  Base: 2.5%
  Adjustments: 0%
  = 2.5% buffer

Leverage calculation:
  SL distance: 10%
  Target liq: 10% + 2.5% = 12.5%
  Max safe leverage: ~8x
  Final leverage: 8 × 0.93 = 7x ✅
```

**Output:**
```
Entry: 0.10000
SL: 0.09000 (-10.00%)
Liq: 0.08732 (-12.68%)
Buffer: 2.68% ✅
Leverage: 7x
Exposure: 630 USDT (90 × 7x)
```

---

### Primjer 3: LOW conviction, MODERATE VP, SL @ -12%

```javascript
Buffer calculation:
  Base: 2.5%
  + LOW: +0.75%
  + MODERATE VP: +0.5%
  + HIGH vol: +0.5%
  = 4.25% buffer

Leverage calculation:
  SL distance: 12%
  Target liq: 12% + 4.25% = 16.25%
  Max safe leverage: ~6x
  Final leverage: 6 × 0.93 = 5x ✅
```

**Output:**
```
Entry: 0.10000
SL: 0.08800 (-12.00%)
Liq: 0.08357 (-16.43%)
Buffer: 4.43% ✅
Leverage: 5x
Exposure: 450 USDT (90 × 5x)
```

---

## ✅ Safety Validations

V5 provjerava:

1. **Buffer >= 2.0%** (apsolutni minimum)
2. **Liq izvan SL zone:**
   - LONG: `liq < stop_loss` ✅
   - SHORT: `liq > stop_loss` ✅
3. **Leverage efficiency:** Koliko % max safe leveragea koristimo

---

## 📈 Output Fields

Svaki coin dobiva:

```javascript
{
  leverage: 7,                          // Finalni leverage
  liquidation_price: 0.08732,           // Liq price
  liquidation_distance_pct: 12.68,      // % od entry do liq
  liq_buffer_pct: 2.68,                 // Dodatna udaljenost od SL
  max_safe_leverage: 8,                 // Maksimalni safe
  leverage_efficiency_pct: 87.5,        // 7/8 = 87.5%
  buffer_used_pct: 2.5,                 // Koji buffer je korišten

  // Position metrics
  position_exposure_usdt: 630,
  leveraged_risk_usdt: 63,
  roi_tp2_pct: 217.0,
  roi_sl_pct: -70.0,

  // Validation
  leverage_validation: {
    safe: true,
    issues: [],
    warnings: []
  }
}
```

---

## 🚀 Kako koristiti u n8n

1. **Rating Node** → outputs conviction, alpha, scenarios
2. **SL/TP Finder** → outputs stop_loss, stop_loss_pct, vp_setup_quality
3. **Leverage Finder V5** → inputs sve gore, outputs leverage
4. **Trade Selector** → filters best setups

---

## 📊 Očekivani Rezultati

| SL Range | Tipični Leverage | Use Case |
|----------|------------------|----------|
| 3-5% | 12-18x | Kratki scalps, uski SL na jakim VP nivoima |
| 6-8% | 9-12x | Quality day trades, dobri VP nivoi |
| 9-11% | 7-9x | Swing trades, standardni setups |
| 12-15% | 5-7x | Širi swing, loša VP quality, veća vol |

---

## 🔄 Verzije - Povijest Razvoja

### V1-V2 (deprecated)
- Binary search pristup
- Davao 20-30x leverage (preopasno!)
- Failing na nekim coinima

### V3.0 (deprecated)
- Analytical solution
- **BUG:** Krivo računao buffer (liq bio bliži entry nego SL!)

### V3.1 (fixed buffer, ali...)
- Fixed buffer calculation
- Ali koristio arbitrary 30% base + boostove
- Nije maksimizirao leverage potencijal

### V4.0 (sweet spot approach)
- Target 6-10x "sweet spot"
- Konzervativni boostovi
- Ali OPET arbitrary limitiranje!

### ✅ V5.0 - FINAL (Maximum Safe)
- **NEMA arbitrary limita!**
- Svaki trade dobije svoj optimalni leverage
- Dinamički buffer ovisno o kvaliteti
- 93% safety factor od max safe
- **MAKSIMIZIRAMO leverage uz sigurnost!**

---

## 💡 Pro Tips

1. **Vjeruj matematici** - V5 računa precizno, ne arbitrary
2. **Uži SL = veći leverage** - Quality VP placement se nagrađuje!
3. **Buffer se prilagođava** - Bolji setup = tighter buffer = više leveragea
4. **Safety factor 93%** - Mali margin za nepredviđeno, ali blizu max
5. **Trade-specific** - Nemoj uspoređivati leverage između tradeova, svaki je unique!

---

## ⚠️ Warnings

- Leverage >15x: Jako uski SL, provjeri VP quality!
- Efficiency <80%: System limitira, možda exchange max ili safety cap
- Buffer <2%: OPASNO! V5 će force recalculation

---

## 📞 Pitanja?

V5 logika je jednostavna:
1. Koliko daleko je tvoj SL?
2. Dodaj minimalni buffer
3. Nađi max leverage gdje je liq na toj poziciji
4. Koristi ga (sa 93% safety factor)

**Gotovo!** 🚀

---

_Created: 2025-11-08_
_Version: V5.0 - Maximum Safe Leverage Edition_
