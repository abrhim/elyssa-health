"""Pull additional Garmin Connect data for Elyssa using garminconnect library."""

import json
import sqlite3
import os
from datetime import date, timedelta
from garminconnect import Garmin

# --- Config ---
EMAIL = os.environ.get("GARMIN_EMAIL", "elyssahimmer@gmail.com")
PASSWORD = os.environ.get("GARMIN_PASSWORD", "Doggie101!")
DB_PATH = os.path.join(os.path.dirname(__file__), "health.db")
START_DATE = date(2024, 10, 1)  # Roughly when data collection started
END_DATE = date.today()

# --- Auth ---
TOKENSTORE = os.path.expanduser("~/.garminconnect")
client = Garmin(EMAIL, PASSWORD)
try:
    print(f"Trying cached tokens at {TOKENSTORE}...")
    client.login(TOKENSTORE)
except Exception as e:
    print(f"Cached login failed ({e}); doing fresh SSO...")
    client = Garmin(EMAIL, PASSWORD)
    client.login()
    client.garth.dump(TOKENSTORE)
    print(f"Saved tokens to {TOKENSTORE}")
print(f"Logged in as: {client.get_full_name()}")

# --- DB setup ---
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Create tables for new data
cur.executescript("""
CREATE TABLE IF NOT EXISTS spo2_daily (
    date TEXT PRIMARY KEY,
    avg_spo2 REAL,
    lowest_spo2 REAL,
    latest_spo2 REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS hrv_daily (
    date TEXT PRIMARY KEY,
    weekly_avg INTEGER,
    last_night INTEGER,
    last_night_avg INTEGER,
    last_night_5min_high INTEGER,
    baseline_low INTEGER,
    baseline_upper INTEGER,
    status TEXT,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS sleep_daily (
    date TEXT PRIMARY KEY,
    sleep_start TEXT,
    sleep_end TEXT,
    duration_seconds INTEGER,
    deep_seconds INTEGER,
    light_seconds INTEGER,
    rem_seconds INTEGER,
    awake_seconds INTEGER,
    sleep_score INTEGER,
    sleep_quality TEXT,
    avg_spo2_sleep REAL,
    avg_respiration REAL,
    avg_stress REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS body_composition (
    date TEXT PRIMARY KEY,
    weight REAL,
    bmi REAL,
    body_fat_pct REAL,
    muscle_mass REAL,
    bone_mass REAL,
    body_water REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS floors_daily (
    date TEXT PRIMARY KEY,
    floors_ascended INTEGER,
    floors_descended INTEGER,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS respiration_daily (
    date TEXT PRIMARY KEY,
    avg_waking REAL,
    avg_sleeping REAL,
    highest REAL,
    lowest REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS training_status (
    date TEXT PRIMARY KEY,
    training_status TEXT,
    training_load REAL,
    vo2_max_running REAL,
    vo2_max_cycling REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS endurance_score (
    date TEXT PRIMARY KEY,
    overall_score REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS timeseries_spo2 (
    timestamp TEXT PRIMARY KEY,
    spo2 INTEGER,
    date TEXT
);

CREATE TABLE IF NOT EXISTS timeseries_respiration (
    timestamp TEXT PRIMARY KEY,
    respiration REAL,
    date TEXT
);
""")
conn.commit()


def safe_get(fn, label, *args, **kwargs):
    """Call a garmin API function, return None on error."""
    try:
        result = fn(*args, **kwargs)
        return result
    except Exception as e:
        print(f"  [{label}] skipped: {e}")
        return None


def date_range(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


total_days = (END_DATE - START_DATE).days + 1
print(f"\nPulling data from {START_DATE} to {END_DATE} ({total_days} days)")

for i, d in enumerate(date_range(START_DATE, END_DATE)):
    ds = d.isoformat()
    if i % 30 == 0:
        print(f"\n--- {ds} ({i}/{total_days}) ---")

    # SpO2
    data = safe_get(client.get_spo2_data, "spo2", ds)
    if data:
        cur.execute(
            "INSERT OR REPLACE INTO spo2_daily VALUES (?,?,?,?,?)",
            (ds,
             data.get("averageSpO2"),
             data.get("lowestSpO2"),
             data.get("latestSpO2"),
             json.dumps(data))
        )
        # SpO2 timeseries entries
        for entry in (data.get("spO2HourlyAverages") or data.get("timelineEntries") or []):
            ts = entry.get("startTimestampGMT") or entry.get("timestamp")
            val = entry.get("spO2") or entry.get("spo2Value")
            if ts and val:
                cur.execute(
                    "INSERT OR REPLACE INTO timeseries_spo2 VALUES (?,?,?)",
                    (str(ts), val, ds)
                )

    # HRV
    data = safe_get(client.get_hrv_data, "hrv", ds)
    if data:
        summary = data.get("hrvSummary", data)
        cur.execute(
            "INSERT OR REPLACE INTO hrv_daily VALUES (?,?,?,?,?,?,?,?,?)",
            (ds,
             summary.get("weeklyAvg"),
             summary.get("lastNight"),
             summary.get("lastNightAvg"),
             summary.get("lastNight5MinHigh"),
             summary.get("baselineLowUpper"),
             summary.get("baselineBalancedUpper"),
             summary.get("status"),
             json.dumps(data))
        )

    # Sleep
    data = safe_get(client.get_sleep_data, "sleep", ds)
    if data:
        daily = data.get("dailySleepDTO", data)
        cur.execute(
            "INSERT OR REPLACE INTO sleep_daily VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (ds,
             daily.get("sleepStartTimestampGMT"),
             daily.get("sleepEndTimestampGMT"),
             daily.get("sleepTimeSeconds"),
             daily.get("deepSleepSeconds"),
             daily.get("lightSleepSeconds"),
             daily.get("remSleepSeconds"),
             daily.get("awakeSleepSeconds"),
             daily.get("sleepScores", {}).get("overall", {}).get("value") if isinstance(daily.get("sleepScores"), dict) else None,
             daily.get("sleepScores", {}).get("overall", {}).get("qualifierKey") if isinstance(daily.get("sleepScores"), dict) else None,
             daily.get("averageSpO2Value"),
             daily.get("averageRespirationValue"),
             daily.get("averageStressValue"),
             json.dumps(data))
        )

    # Respiration
    data = safe_get(client.get_respiration_data, "respiration", ds)
    if data:
        cur.execute(
            "INSERT OR REPLACE INTO respiration_daily VALUES (?,?,?,?,?,?)",
            (ds,
             data.get("avgWakingRespirationValue"),
             data.get("avgSleepRespirationValue"),
             data.get("highestRespirationValue"),
             data.get("lowestRespirationValue"),
             json.dumps(data))
        )
        # Respiration timeseries
        for entry in (data.get("respirationValuesArray") or []):
            if entry and len(entry) >= 2 and entry[1] is not None:
                cur.execute(
                    "INSERT OR REPLACE INTO timeseries_respiration VALUES (?,?,?)",
                    (str(entry[0]), entry[1], ds)
                )

    # Floors
    data = safe_get(client.get_floors, "floors", ds)
    if data:
        cur.execute(
            "INSERT OR REPLACE INTO floors_daily VALUES (?,?,?,?)",
            (ds,
             data.get("floorsAscended"),
             data.get("floorsDescended"),
             json.dumps(data))
        )

    # Commit every 7 days
    if i % 7 == 0:
        conn.commit()

conn.commit()

# --- Non-daily data (pull once) ---
print("\n--- Pulling non-daily data ---")

# Body composition (date range query)
data = safe_get(client.get_body_composition, "body_composition",
                START_DATE.isoformat(), END_DATE.isoformat())
if data:
    for entry in (data.get("dateWeightList") or []):
        d_val = entry.get("calendarDate")
        if d_val:
            cur.execute(
                "INSERT OR REPLACE INTO body_composition VALUES (?,?,?,?,?,?,?,?)",
                (d_val,
                 entry.get("weight"),
                 entry.get("bmi"),
                 entry.get("bodyFat"),
                 entry.get("muscleMass"),
                 entry.get("boneMass"),
                 entry.get("bodyWater"),
                 json.dumps(entry))
            )

# Training status
data = safe_get(client.get_training_status, "training_status", END_DATE.isoformat())
if data:
    ts = data.get("mostRecentTrainingStatus") or {}
    cur.execute(
        "INSERT OR REPLACE INTO training_status VALUES (?,?,?,?,?,?)",
        (END_DATE.isoformat(),
         ts.get("trainingStatus"),
         ts.get("trainingLoad7Day"),
         data.get("mostRecentVO2Max"),
         None,
         json.dumps(data))
    )

# Endurance score
data = safe_get(client.get_endurance_score, "endurance_score", END_DATE.isoformat())
if data:
    cur.execute(
        "INSERT OR REPLACE INTO endurance_score VALUES (?,?,?)",
        (END_DATE.isoformat(),
         data.get("overallScore"),
         json.dumps(data))
    )

conn.commit()

# Summary
print("\n=== Summary ===")
for table in ["spo2_daily", "hrv_daily", "sleep_daily", "body_composition",
              "floors_daily", "respiration_daily", "training_status",
              "endurance_score", "timeseries_spo2", "timeseries_respiration"]:
    cur.execute(f"SELECT COUNT(*) FROM [{table}]")
    print(f"  {table}: {cur.fetchone()[0]} rows")

conn.close()
print("\nDone!")
