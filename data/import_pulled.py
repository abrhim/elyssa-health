"""Import pulled.json (browser-fetched Garmin data) into health.db."""
import json, sqlite3, os, sys

DB = os.path.join(os.path.dirname(__file__), 'health.db')
JSON_PATH = os.path.join(os.path.dirname(__file__), 'pulled.json')

data = json.load(open(JSON_PATH))
conn = sqlite3.connect(DB)
cur = conn.cursor()

# Add tables for new metrics not in existing schema
cur.executescript("""
CREATE TABLE IF NOT EXISTS stress_daily (
    date TEXT PRIMARY KEY,
    overall_stress_level INTEGER,
    rest_stress_duration INTEGER,
    low_stress_duration INTEGER,
    medium_stress_duration INTEGER,
    high_stress_duration INTEGER,
    raw_json TEXT
);
CREATE TABLE IF NOT EXISTS heartrate_daily (
    date TEXT PRIMARY KEY,
    resting_hr INTEGER,
    min_hr INTEGER,
    max_hr INTEGER,
    last_7d_avg_resting INTEGER,
    raw_json TEXT
);
CREATE TABLE IF NOT EXISTS daily_summary (
    date TEXT PRIMARY KEY,
    total_steps INTEGER,
    total_distance_meters REAL,
    active_calories INTEGER,
    bmr_calories INTEGER,
    total_calories INTEGER,
    floors_ascended INTEGER,
    moderate_intensity_minutes INTEGER,
    vigorous_intensity_minutes INTEGER,
    average_stress INTEGER,
    body_battery_charged INTEGER,
    body_battery_drained INTEGER,
    raw_json TEXT
);
""")
conn.commit()

imported = {'sleep':0,'respiration':0,'floors':0,'stress':0,'heartrate':0,'summary':0}
skipped = 0
for ds, metrics in data['dates'].items():
    # Skip dates that failed
    sleep = metrics.get('sleep')
    if not (isinstance(sleep, dict) and 'dailySleepDTO' in sleep):
        skipped += 1
        continue

    # --- Sleep ---
    daily = sleep.get('dailySleepDTO') or {}
    scores = daily.get('sleepScores') or {}
    overall = scores.get('overall') if isinstance(scores, dict) else None
    cur.execute(
        "INSERT OR REPLACE INTO sleep_daily VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (ds,
         daily.get('sleepStartTimestampGMT'),
         daily.get('sleepEndTimestampGMT'),
         daily.get('sleepTimeSeconds'),
         daily.get('deepSleepSeconds'),
         daily.get('lightSleepSeconds'),
         daily.get('remSleepSeconds'),
         daily.get('awakeSleepSeconds'),
         (overall or {}).get('value') if isinstance(overall, dict) else None,
         (overall or {}).get('qualifierKey') if isinstance(overall, dict) else None,
         daily.get('averageSpO2Value'),
         daily.get('averageRespirationValue'),
         daily.get('averageStressValue'),
         json.dumps(sleep))
    )
    imported['sleep'] += 1

    # --- Respiration ---
    resp = metrics.get('respiration')
    if isinstance(resp, dict) and '__error' not in resp:
        cur.execute(
            "INSERT OR REPLACE INTO respiration_daily VALUES (?,?,?,?,?,?)",
            (ds,
             resp.get('avgWakingRespirationValue'),
             resp.get('avgSleepRespirationValue'),
             resp.get('highestRespirationValue'),
             resp.get('lowestRespirationValue'),
             json.dumps(resp))
        )
        imported['respiration'] += 1

    # --- Floors ---
    floors = metrics.get('floors')
    if isinstance(floors, dict) and '__error' not in floors:
        cur.execute(
            "INSERT OR REPLACE INTO floors_daily VALUES (?,?,?,?)",
            (ds,
             floors.get('floorsValueArray', [{}])[-1].get('floorsAscended') if floors.get('floorsValueArray') else None,
             floors.get('floorsValueArray', [{}])[-1].get('floorsDescended') if floors.get('floorsValueArray') else None,
             json.dumps(floors))
        )
        imported['floors'] += 1

    # --- Stress ---
    stress = metrics.get('stress')
    if isinstance(stress, dict) and '__error' not in stress:
        cur.execute(
            "INSERT OR REPLACE INTO stress_daily VALUES (?,?,?,?,?,?,?)",
            (ds,
             stress.get('avgStressLevel') or stress.get('overallStressLevel'),
             stress.get('restStressDuration'),
             stress.get('lowStressDuration'),
             stress.get('mediumStressDuration'),
             stress.get('highStressDuration'),
             json.dumps(stress))
        )
        imported['stress'] += 1

    # --- Heart Rate ---
    hr = metrics.get('heartrate')
    if isinstance(hr, dict) and '__error' not in hr:
        cur.execute(
            "INSERT OR REPLACE INTO heartrate_daily VALUES (?,?,?,?,?,?)",
            (ds,
             hr.get('restingHeartRate'),
             hr.get('minHeartRate'),
             hr.get('maxHeartRate'),
             hr.get('lastSevenDaysAvgRestingHeartRate'),
             json.dumps(hr))
        )
        imported['heartrate'] += 1

    # --- Daily summary ---
    summ = metrics.get('summary')
    if isinstance(summ, dict) and '__error' not in summ:
        cur.execute(
            "INSERT OR REPLACE INTO daily_summary VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (ds,
             summ.get('totalSteps'),
             summ.get('totalDistanceMeters'),
             summ.get('activeKilocalories'),
             summ.get('bmrKilocalories'),
             summ.get('totalKilocalories'),
             summ.get('floorsAscendedInMeters') and int(summ.get('floorsAscended') or 0) or None,
             summ.get('moderateIntensityMinutes'),
             summ.get('vigorousIntensityMinutes'),
             summ.get('averageStressLevel'),
             summ.get('bodyBatteryChargedValue'),
             summ.get('bodyBatteryDrainedValue'),
             json.dumps(summ))
        )
        imported['summary'] += 1

conn.commit()
conn.close()
print(f'imported: {imported}, skipped (no sleep): {skipped}')
