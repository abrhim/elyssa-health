"""ETL garmy data -> Supabase (menstrual_cycle, heartrate_daily, stress_daily, daily_summary)."""
import sqlite3, subprocess, json, os, tempfile, csv

GARMY_DB = os.path.expanduser("~/.garmy/health.db")
PG_URL = "postgresql://postgres.vssciljnilrgqcrnandl:elyssaisawesome@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

g = sqlite3.connect(GARMY_DB)
g.row_factory = sqlite3.Row

def psql_exec(sql):
    r = subprocess.run(["psql", PG_URL, "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout

def psql_copy(table, columns, rows):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        w = csv.writer(f)
        for row in rows:
            out = [r'\N' if v is None else v for v in row]
            w.writerow(out)
        path = f.name
    cols = ','.join(columns)
    r = subprocess.run(
        ["psql", PG_URL, "-v", "ON_ERROR_STOP=1",
         "-c", rf"\copy {table} ({cols}) FROM '{path}' WITH (FORMAT csv, NULL '\N')"],
        capture_output=True, text=True
    )
    os.unlink(path)
    if r.returncode != 0:
        raise RuntimeError(f"{table}: {r.stderr}")
    print(f"  copied {len(rows)} → {table}")

# --- Create menstrual_cycle table ---
psql_exec("""
CREATE TABLE IF NOT EXISTS health.menstrual_cycle (
    date DATE PRIMARY KEY,
    cycle_start_date DATE,
    day_in_cycle INTEGER,
    phase INTEGER,
    phase_name TEXT,
    period_length INTEGER,
    predicted_cycle_length INTEGER,
    cycle_type TEXT,
    is_predicted BOOLEAN,
    days_until_next_phase INTEGER,
    fertile_window_start INTEGER,
    symptoms JSONB,
    moods JSONB,
    day_log JSONB
);
""")

cur = g.execute("SELECT date, cycle_start_date, day_in_cycle, phase, phase_name, period_length, predicted_cycle_length, cycle_type, is_predicted, days_until_next_phase, fertile_window_start, day_log FROM menstrual_cycle ORDER BY date")
rows = []
for r in cur:
    dl = r['day_log']
    symptoms = moods = None
    if dl:
        try:
            j = json.loads(dl)
            symptoms = json.dumps(j.get('symptoms')) if j.get('symptoms') else None
            moods = json.dumps(j.get('moods')) if j.get('moods') else None
        except Exception:
            pass
    rows.append((r['date'], r['cycle_start_date'], r['day_in_cycle'], r['phase'], r['phase_name'],
                 r['period_length'], r['predicted_cycle_length'], r['cycle_type'],
                 't' if r['is_predicted'] else 'f', r['days_until_next_phase'], r['fertile_window_start'],
                 symptoms, moods, dl))

psql_exec("TRUNCATE health.menstrual_cycle;")
psql_copy("health.menstrual_cycle",
          ['date','cycle_start_date','day_in_cycle','phase','phase_name','period_length','predicted_cycle_length','cycle_type','is_predicted','days_until_next_phase','fertile_window_start','symptoms','moods','day_log'],
          rows)

# --- Fill heartrate_daily gaps from garmy ---
# Only insert rows for dates Supabase doesn't already have
cur = g.execute("SELECT metric_date, resting_heart_rate, min_heart_rate, max_heart_rate FROM daily_health_metrics WHERE user_id=1 AND resting_heart_rate IS NOT NULL ORDER BY metric_date")
rows = [(r['metric_date'], r['resting_heart_rate'], r['min_heart_rate'], r['max_heart_rate']) for r in cur]
psql_copy("health.heartrate_daily",
          ['date','resting_hr','min_hr','max_hr'],
          rows) if False else None  # skip simple copy since we need upsert

# Use INSERT ... ON CONFLICT for upserts
if rows:
    # Write as CSV and use temp table + upsert
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        w = csv.writer(f)
        for r in rows: w.writerow([r'\N' if v is None else v for v in r])
        path = f.name
    r = subprocess.run(
        ["psql", PG_URL, "-v", "ON_ERROR_STOP=1",
         "-c", "CREATE TEMP TABLE _tmp_hr (date DATE, resting_hr INT, min_hr INT, max_hr INT);",
         "-c", rf"\copy _tmp_hr FROM '{path}' WITH (FORMAT csv, NULL '\N')",
         "-c", """INSERT INTO health.heartrate_daily (date, resting_hr, min_hr, max_hr)
                  SELECT date, resting_hr, min_hr, max_hr FROM _tmp_hr
                  ON CONFLICT (date) DO UPDATE SET
                    resting_hr = COALESCE(health.heartrate_daily.resting_hr, EXCLUDED.resting_hr),
                    min_hr = COALESCE(health.heartrate_daily.min_hr, EXCLUDED.min_hr),
                    max_hr = COALESCE(health.heartrate_daily.max_hr, EXCLUDED.max_hr);"""],
        capture_output=True, text=True
    )
    os.unlink(path)
    if r.returncode != 0: raise RuntimeError(f"heartrate upsert: {r.stderr}")
    print(f"  upserted {len(rows)} → heartrate_daily")

# --- Fill stress_daily gaps ---
cur = g.execute("SELECT metric_date, avg_stress_level FROM daily_health_metrics WHERE user_id=1 AND avg_stress_level IS NOT NULL ORDER BY metric_date")
rows = [(r['metric_date'], r['avg_stress_level']) for r in cur]
if rows:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        w = csv.writer(f)
        for r in rows: w.writerow([r'\N' if v is None else v for v in r])
        path = f.name
    r = subprocess.run(
        ["psql", PG_URL, "-v", "ON_ERROR_STOP=1",
         "-c", "CREATE TEMP TABLE _tmp_stress (date DATE, overall_stress_level INT);",
         "-c", rf"\copy _tmp_stress FROM '{path}' WITH (FORMAT csv, NULL '\N')",
         "-c", """INSERT INTO health.stress_daily (date, overall_stress_level)
                  SELECT date, overall_stress_level FROM _tmp_stress
                  ON CONFLICT (date) DO UPDATE SET
                    overall_stress_level = COALESCE(health.stress_daily.overall_stress_level, EXCLUDED.overall_stress_level);"""],
        capture_output=True, text=True
    )
    os.unlink(path)
    if r.returncode != 0: raise RuntimeError(f"stress upsert: {r.stderr}")
    print(f"  upserted {len(rows)} → stress_daily")

# --- Fill daily_summary gaps ---
cur = g.execute("""SELECT metric_date, total_steps, total_distance_meters, active_calories, bmr_calories, total_calories
                   FROM daily_health_metrics WHERE user_id=1 AND total_steps IS NOT NULL ORDER BY metric_date""")
rows = [(r['metric_date'], r['total_steps'], r['total_distance_meters'], r['active_calories'], r['bmr_calories'], r['total_calories']) for r in cur]
if rows:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        w = csv.writer(f)
        for r in rows: w.writerow([r'\N' if v is None else v for v in r])
        path = f.name
    r = subprocess.run(
        ["psql", PG_URL, "-v", "ON_ERROR_STOP=1",
         "-c", "CREATE TEMP TABLE _tmp_ds (date DATE, total_steps INT, total_distance_meters REAL, active_calories INT, bmr_calories INT, total_calories INT);",
         "-c", rf"\copy _tmp_ds FROM '{path}' WITH (FORMAT csv, NULL '\N')",
         "-c", """INSERT INTO health.daily_summary (date, total_steps, total_distance_meters, active_calories, bmr_calories, total_calories)
                  SELECT date, total_steps, total_distance_meters, active_calories, bmr_calories, total_calories FROM _tmp_ds
                  ON CONFLICT (date) DO UPDATE SET
                    total_steps = COALESCE(health.daily_summary.total_steps, EXCLUDED.total_steps),
                    total_distance_meters = COALESCE(health.daily_summary.total_distance_meters, EXCLUDED.total_distance_meters),
                    active_calories = COALESCE(health.daily_summary.active_calories, EXCLUDED.active_calories),
                    bmr_calories = COALESCE(health.daily_summary.bmr_calories, EXCLUDED.bmr_calories),
                    total_calories = COALESCE(health.daily_summary.total_calories, EXCLUDED.total_calories);"""],
        capture_output=True, text=True
    )
    os.unlink(path)
    if r.returncode != 0: raise RuntimeError(f"daily_summary upsert: {r.stderr}")
    print(f"  upserted {len(rows)} → daily_summary")

# Final grants so agent MCP can read
psql_exec("GRANT SELECT ON health.menstrual_cycle TO anon, authenticated;")
print("\nDone.")
g.close()
