# Kaggle Garmin Body Battery Dataset Investigation

**Date:** 2026-03-13
**Status:** Downloaded and parsed. No native Body Battery data (device too old), but extracted 694K stress records and generated simulated BB.

---

## 1. Primary Dataset: Garmin General Dataset (Kent Madsen)

**URL:** https://www.kaggle.com/datasets/kentvejrupmadsen/garmin-dataset-general
**GitHub:** https://github.com/CHI-Garmin-Data/data.private.garmin.general

| Field | Value |
|-------|-------|
| Size | ~118 MB (compressed ZIP ~98 MB) |
| Format | FIT files only (Garmin binary format) |
| Date Range | 2016-07 to 2022-11 |
| License | CC BY 4.0 |
| Downloads | 274 |
| Version | 4 (last updated 2022-11-02) |

### What's in the FIT Files
- **61,313 FIT files** total
- **16,921 WELLNESS files** (stress, HR, steps, activity)
- **SLEEP_DATA files** (sleep stages, duration)
- **METRICS files** (daily summary metrics)
- **Device:** Garmin Vivomove HR (all files, single device)
- File types by suffix: `_WELLNESS.fit`, `_SLEEP_DATA.fit`, `_METRICS.fit`

### FIT Message Types Found (via fitdecode parsing)
- `stress_level` — **per-minute stress scores (0-99)** — 694,497 valid records extracted
- `monitoring` — steps, distance, calories, active time
- `monitoring_hr_data` — resting heart rate, current-day resting HR
- `monitoring_info` — metabolic rate, activity type
- `ohr_settings` — optical heart rate sensor on/off
- `event` — auto-activity detection events
- `unknown_24`, `unknown_233` — undocumented fields (no body battery found here)

### Body Battery Assessment
- **No Body Battery data** — The Vivomove HR does not support Body Battery
- Body Battery requires Firstbeat's Body Resources algorithm, which was introduced on newer devices (Vivosmart 4, Fenix 5 Plus, etc.)
- The `unknown_24` and `unknown_233` message types were checked — they contain device-specific metadata, not BB values

### What We Did Extract
- **694,497 stress records** from Sep 2020 to Nov 2022 (minute-level resolution)
- Date range of stress data: `2020-09-20` to `2022-11-01` (~25 months)
- Stress range: 0–99, mean: 46.6
- This is a **high-stress individual** — average hourly stress ~50, many hours in the 80-90 range

---

## 2. Extracted Data Files

### `/outputs/kaggle-stress-data.csv`
Raw per-minute stress data from the dataset.

| Column | Description |
|--------|-------------|
| timestamp | UTC timestamp (YYYY-MM-DD HH:MM:SS+00:00) |
| stress_level | Garmin stress score (0-99, higher = more stressed) |

- **694,497 rows**
- 1-minute intervals (with gaps)
- Values -1 and -2 filtered out (invalid/no-measurement markers)

### `/outputs/kaggle-body-battery.csv`
Hourly aggregated stress + simulated Body Battery.

| Column | Description |
|--------|-------------|
| timestamp | Hourly timestamp |
| date | Date only |
| hour | Hour (0-23) |
| stress_avg | Mean stress for that hour |
| stress_min | Min stress in hour |
| stress_max | Max stress in hour |
| stress_count | Number of stress readings in hour |
| simulated_body_battery | Simulated BB based on stress (see model below) |

- **16,950 hourly rows**
- Simulated BB shows realistic diurnal pattern: charges overnight, drains during day

### Simulated Body Battery Model
Since real BB isn't available, we approximated it from stress:
- **Sleep hours (00-05):** Recharge +1 to +8/hour (less recharge if stress high during sleep)
- **Wake hour (06):** +2 boost
- **Daytime (07-23):** Drain proportional to stress level
  - Stress <25: +1/hour (light recovery)
  - Stress 25-50: -1 to -3/hour
  - Stress 50-75: -3 to -5/hour
  - Stress 75-100: -5 to -8/hour
- Clamped to 5-100 range

**Caveat:** This is an approximation. Real Garmin Body Battery uses Firstbeat's proprietary algorithm incorporating HRV, not just stress scores.

### Sample Day (2022-06-15) — High Stress Day
```
Hour  Stress  SimBB
00:00  40.8   11.4   Overnight recharge begins
01:00  33.0   18.0
02:00  33.1   24.7
03:00  30.8   31.5
04:00  42.4   37.8
05:00  51.0   43.8   Peak morning BB
06:00  84.6   45.8   Wake — high stress immediately
07:00  83.3   39.8   Rapid drain
...
15:00  81.4    7.6   Depleted by afternoon
16:00  87.6    5.0   Floor
```

---

## 3. Other Datasets Investigated

### My Cleaned 2024 Garmin Data (Elissa Esterlein)
- URL: https://www.kaggle.com/datasets/elissaesterlein/my-cleaned-2024-garmin-data
- 2.7 KB, monthly aggregates only. No Body Battery. Not useful.

### Wearable Health Device Performance Data 2025
- URL: https://www.kaggle.com/datasets/pratyushpuri/wearable-health-devices-performance-analysis
- Synthetic device specs data. Not useful.

### Non-Garmin Datasets
| Dataset | Relevance |
|---------|-----------|
| WESAD | Lab stress detection, Empatica E4, NOT Garmin |
| SWELL HRV | Keyboard/mouse + HR, NOT Garmin |
| Nurse Stress Prediction | Wearable sensors, NOT Garmin |
| AI-READI | Uses Garmin Vivosmart 5, research-only access |

---

## 4. Key Findings

### Why No Body Battery on Kaggle
1. **Garmin removed CSV export** of Body Battery from Garmin Connect Web
2. **FIT files needed** — Body Battery is only in daily summary FIT exports
3. **Undocumented fields** — BB stored in proprietary FIT message types
4. **Device matters** — Many Garmin watches (like the Vivomove HR in this dataset) don't support BB
5. **Privacy** — Few people publish personal health data publicly

### What Would Need to Happen
To get real Body Battery data from Kaggle, someone would need to:
- Own a BB-capable device (Vivosmart 4+, Fenix 5 Plus+, Venu series, etc.)
- Export daily summary FIT files from Garmin Connect
- Parse with fitdecode looking for `stress_level` messages with `unknown_2` field (which on BB-capable devices contains the BB value)
- Publish the parsed data

### Comparison to Our Patient Data
- Our garmy MCP tool provides **real Body Battery data** — this is far more reliable
- The Kaggle stress data can serve as a **population comparison baseline** for stress patterns
- This subject's mean stress of 46.6 is notably high; Garmin's 2024 global average was ~30

---

## 5. Recommendations

1. **Use garmy MCP** for our patient's actual Body Battery — it's the gold standard
2. **Use the extracted stress data** as a comparison baseline for typical Garmin user stress patterns
3. **The simulated BB** can provide directional comparison but should not be treated as ground truth
4. For research-grade BB comparison data, consider the **Garmin Health API** (requires institutional partnership)
