"""Seed Supabase from the local SQLite health.db."""
import sqlite3, os, subprocess, sys, csv, tempfile, json

DB = os.path.join(os.path.dirname(__file__), 'health.db')
PG_URL = "postgresql://postgres.vssciljnilrgqcrnandl:elyssaisawesome@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def psql(sql):
    r = subprocess.run(
        ["psql", PG_URL, "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print("PSQL ERROR:", r.stderr, file=sys.stderr); sys.exit(1)
    return r.stdout

def copy_rows(table, columns, rows, jsonb_cols=()):
    if not rows:
        print(f"  {table}: 0 rows")
        return
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        w = csv.writer(f)
        for row in rows:
            out = []
            for i, v in enumerate(row):
                if v is None:
                    out.append(r'\N')
                elif columns[i] in jsonb_cols and isinstance(v, str):
                    out.append(v)
                else:
                    out.append(v)
            w.writerow(out)
        path = f.name
    # Truncate + copy
    cols = ','.join(columns)
    r = subprocess.run(
        ["psql", PG_URL, "-v", "ON_ERROR_STOP=1",
         "-c", f"TRUNCATE health.{table};",
         "-c", rf"\copy health.{table} ({cols}) FROM '{path}' WITH (FORMAT csv, NULL '\N')"],
        capture_output=True, text=True
    )
    os.unlink(path)
    if r.returncode != 0:
        print(f"COPY ERROR {table}:", r.stderr, file=sys.stderr); sys.exit(1)
    print(f"  {table}: {len(rows)} rows")

# sleep_daily
cur.execute("SELECT date, sleep_start, sleep_end, duration_seconds, deep_seconds, light_seconds, rem_seconds, awake_seconds, sleep_score, sleep_quality, avg_spo2_sleep, avg_respiration, avg_stress, raw_json FROM sleep_daily")
rows = []
for r in cur.fetchall():
    # sleep_start/end are either GMT timestamps (ms) or strings; leave strings as-is, convert ms to ISO
    def ts(v):
        if v is None: return None
        try:
            n = int(v); return None if n == 0 else f"'{__import__('datetime').datetime.utcfromtimestamp(n/1000).isoformat()}+00'"
        except (ValueError, TypeError):
            return v
    # Easiest: skip timestamp parsing, store NULL — dashboard can derive
    rows.append((r['date'], None, None, r['duration_seconds'], r['deep_seconds'], r['light_seconds'], r['rem_seconds'],
                 r['awake_seconds'], r['sleep_score'], r['sleep_quality'], r['avg_spo2_sleep'],
                 r['avg_respiration'], r['avg_stress'], r['raw_json']))
copy_rows('sleep_daily',
          ['date','sleep_start','sleep_end','duration_seconds','deep_seconds','light_seconds','rem_seconds','awake_seconds','sleep_score','sleep_quality','avg_spo2','avg_respiration','avg_stress','raw_json'],
          rows, jsonb_cols=('raw_json',))

# heartrate_daily
cur.execute("SELECT date, resting_hr, min_hr, max_hr, last_7d_avg_resting, raw_json FROM heartrate_daily")
copy_rows('heartrate_daily', ['date','resting_hr','min_hr','max_hr','last_7d_avg_resting','raw_json'],
          [tuple(r) for r in cur.fetchall()], jsonb_cols=('raw_json',))

# stress_daily
cur.execute("SELECT date, overall_stress_level, rest_stress_duration, low_stress_duration, medium_stress_duration, high_stress_duration, raw_json FROM stress_daily")
copy_rows('stress_daily', ['date','overall_stress_level','rest_stress_duration','low_stress_duration','medium_stress_duration','high_stress_duration','raw_json'],
          [tuple(r) for r in cur.fetchall()], jsonb_cols=('raw_json',))

# respiration_daily
cur.execute("SELECT date, avg_waking, avg_sleeping, highest, lowest, raw_json FROM respiration_daily")
copy_rows('respiration_daily', ['date','avg_waking','avg_sleeping','highest','lowest','raw_json'],
          [tuple(r) for r in cur.fetchall()], jsonb_cols=('raw_json',))

# floors_daily
cur.execute("SELECT date, floors_ascended, floors_descended, raw_json FROM floors_daily")
copy_rows('floors_daily', ['date','floors_ascended','floors_descended','raw_json'],
          [tuple(r) for r in cur.fetchall()], jsonb_cols=('raw_json',))

# daily_summary (has extra col floors_ascended at position 7 in SQLite)
cur.execute("SELECT date, total_steps, total_distance_meters, active_calories, bmr_calories, total_calories, floors_ascended, moderate_intensity_minutes, vigorous_intensity_minutes, average_stress, body_battery_charged, body_battery_drained, raw_json FROM daily_summary")
copy_rows('daily_summary',
          ['date','total_steps','total_distance_meters','active_calories','bmr_calories','total_calories','floors_ascended','moderate_intensity_minutes','vigorous_intensity_minutes','average_stress','body_battery_charged','body_battery_drained','raw_json'],
          [tuple(r) for r in cur.fetchall()], jsonb_cols=('raw_json',))

# activities — the SQLite table has a different shape than the Postgres one. Map explicitly.
cur.execute("""SELECT activity_id, activity_date, activity_name, activity_type, start_time_local,
                       duration_seconds, moving_duration_seconds, distance_meters, elevation_gain,
                       NULL AS avg_speed_mps, NULL AS max_speed_mps,
                       calories, avg_hr, max_hr, steps, NULL AS vo2_max,
                       NULL AS start_lat, NULL AS start_lon, location_name, NULL AS device_id,
                       moderate_intensity_minutes, vigorous_intensity_minutes
                FROM activities""")
def to_int(v):
    return int(v) if v is not None else None
rows = []
for r in cur.fetchall():
    r = list(r)
    # calories, avg_hr, max_hr, steps are at indices 11,12,13,14
    for i in (11, 12, 13, 14, 20, 21):
        r[i] = to_int(r[i])
    rows.append(tuple(r))
copy_rows('activities',
          ['activity_id','activity_date','name','type','start_time_local','duration_seconds','moving_duration_seconds','distance_meters','elevation_gain_m','avg_speed_mps','max_speed_mps','calories','avg_hr','max_hr','steps','vo2_max','start_lat','start_lon','location','device_id','moderate_min','vigorous_min'],
          rows)

print("\nDone.")
conn.close()
