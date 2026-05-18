-- Elyssa health schema for Supabase. Mirrors SQLite but with proper types + views.
CREATE SCHEMA IF NOT EXISTS health;
SET search_path TO health, public;

-- ============ RAW TABLES ============

CREATE TABLE IF NOT EXISTS sleep_daily (
    date DATE PRIMARY KEY,
    sleep_start TIMESTAMPTZ,
    sleep_end TIMESTAMPTZ,
    duration_seconds INTEGER,
    deep_seconds INTEGER,
    light_seconds INTEGER,
    rem_seconds INTEGER,
    awake_seconds INTEGER,
    sleep_score INTEGER,
    sleep_quality TEXT,
    avg_spo2 REAL,
    avg_respiration REAL,
    avg_stress REAL,
    raw_json JSONB
);

CREATE TABLE IF NOT EXISTS heartrate_daily (
    date DATE PRIMARY KEY,
    resting_hr INTEGER,
    min_hr INTEGER,
    max_hr INTEGER,
    last_7d_avg_resting INTEGER,
    raw_json JSONB
);

CREATE TABLE IF NOT EXISTS stress_daily (
    date DATE PRIMARY KEY,
    overall_stress_level INTEGER,
    rest_stress_duration INTEGER,
    low_stress_duration INTEGER,
    medium_stress_duration INTEGER,
    high_stress_duration INTEGER,
    raw_json JSONB
);

CREATE TABLE IF NOT EXISTS respiration_daily (
    date DATE PRIMARY KEY,
    avg_waking REAL,
    avg_sleeping REAL,
    highest REAL,
    lowest REAL,
    raw_json JSONB
);

CREATE TABLE IF NOT EXISTS floors_daily (
    date DATE PRIMARY KEY,
    floors_ascended INTEGER,
    floors_descended INTEGER,
    raw_json JSONB
);

CREATE TABLE IF NOT EXISTS daily_summary (
    date DATE PRIMARY KEY,
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
    raw_json JSONB
);

CREATE TABLE IF NOT EXISTS activities (
    activity_id BIGINT PRIMARY KEY,
    activity_date DATE,
    name TEXT,
    type TEXT,
    start_time_local TIMESTAMP,
    start_time_gmt TIMESTAMPTZ,
    duration_seconds REAL,
    moving_duration_seconds REAL,
    distance_meters REAL,
    elevation_gain_m REAL,
    avg_speed_mps REAL,
    max_speed_mps REAL,
    calories INTEGER,
    avg_hr INTEGER,
    max_hr INTEGER,
    steps INTEGER,
    vo2_max REAL,
    start_lat REAL,
    start_lon REAL,
    location TEXT,
    device_id BIGINT,
    moderate_min INTEGER,
    vigorous_min INTEGER
);

CREATE INDEX IF NOT EXISTS activities_date_idx ON activities(activity_date);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities(type);

-- ============ VIEWS (the agent-facing API) ============

-- Daily snapshot: one row per day, all metrics joined. Agent's primary table.
CREATE OR REPLACE VIEW daily_snapshot AS
SELECT
    COALESCE(ds.date, sl.date, hr.date, st.date, rd.date) AS date,
    -- Sleep
    sl.duration_seconds / 3600.0 AS sleep_hours,
    sl.deep_seconds / 3600.0 AS deep_hours,
    sl.rem_seconds / 3600.0 AS rem_hours,
    sl.light_seconds / 3600.0 AS light_hours,
    sl.awake_seconds / 3600.0 AS awake_hours,
    (COALESCE(sl.deep_seconds, 0) + COALESCE(sl.rem_seconds, 0)) / 3600.0 AS deep_rem_hours,
    sl.sleep_score,
    sl.avg_respiration AS sleep_avg_respiration,
    sl.avg_stress AS sleep_avg_stress,
    -- Heart rate
    hr.resting_hr,
    hr.min_hr,
    hr.max_hr,
    hr.last_7d_avg_resting,
    -- Stress
    st.overall_stress_level AS daily_stress_avg,
    st.rest_stress_duration / 60.0 AS rest_stress_min,
    st.low_stress_duration / 60.0 AS low_stress_min,
    st.medium_stress_duration / 60.0 AS medium_stress_min,
    st.high_stress_duration / 60.0 AS high_stress_min,
    -- Respiration
    rd.avg_waking AS respiration_waking,
    rd.avg_sleeping AS respiration_sleeping,
    -- Daily summary
    ds.total_steps,
    ds.total_distance_meters,
    ds.active_calories,
    ds.total_calories,
    ds.moderate_intensity_minutes,
    ds.vigorous_intensity_minutes,
    ds.body_battery_charged,
    ds.body_battery_drained,
    -- Activity rollup
    COALESCE(act.activity_count, 0) AS activity_count,
    act.total_activity_seconds,
    act.total_activity_distance_m,
    act.total_activity_calories,
    act.max_activity_hr
FROM daily_summary ds
FULL OUTER JOIN sleep_daily sl ON sl.date = ds.date
FULL OUTER JOIN heartrate_daily hr ON hr.date = COALESCE(ds.date, sl.date)
FULL OUTER JOIN stress_daily st ON st.date = COALESCE(ds.date, sl.date, hr.date)
FULL OUTER JOIN respiration_daily rd ON rd.date = COALESCE(ds.date, sl.date, hr.date, st.date)
LEFT JOIN (
    SELECT activity_date,
           COUNT(*) AS activity_count,
           SUM(duration_seconds) AS total_activity_seconds,
           SUM(distance_meters) AS total_activity_distance_m,
           SUM(calories) AS total_activity_calories,
           MAX(max_hr) AS max_activity_hr
    FROM activities
    GROUP BY activity_date
) act ON act.activity_date = COALESCE(ds.date, sl.date, hr.date, st.date, rd.date);

COMMENT ON VIEW daily_snapshot IS 'One row per day with all metrics flattened. Primary table for daily-level questions. Use this before writing ad-hoc joins.';

-- Weekly training load — activity-only aggregation per ISO week
CREATE OR REPLACE VIEW weekly_training_load AS
SELECT
    date_trunc('week', activity_date)::date AS week_start,
    COUNT(*) AS activity_count,
    COUNT(*) FILTER (WHERE type = 'running') AS running_count,
    COUNT(*) FILTER (WHERE type IN ('hiit', 'indoor_cardio')) AS hiit_cardio_count,
    COUNT(*) FILTER (WHERE type IN ('walking', 'treadmill_running')) AS walking_count,
    SUM(duration_seconds) / 3600.0 AS total_hours,
    SUM(distance_meters) / 1000.0 AS total_km,
    SUM(calories) AS total_calories,
    SUM(moderate_min) AS moderate_min,
    SUM(vigorous_min) AS vigorous_min,
    ROUND(AVG(avg_hr)::numeric, 1) AS avg_hr_across_workouts,
    MAX(max_hr) AS peak_hr
FROM activities
GROUP BY 1;

COMMENT ON VIEW weekly_training_load IS 'Training volume per ISO week. Use for load trends, overtraining detection.';

-- Running baseline — every run compared against a rolling median pace and HR
CREATE OR REPLACE VIEW running_log AS
SELECT
    activity_id,
    activity_date,
    name,
    type,
    start_time_local,
    ROUND((distance_meters / 1000.0)::numeric, 2) AS km,
    ROUND((distance_meters / 1609.344)::numeric, 2) AS miles,
    ROUND((duration_seconds / 60.0)::numeric, 2) AS duration_min,
    -- pace as seconds per km/mile
    ROUND((duration_seconds / NULLIF(distance_meters / 1000.0, 0))::numeric, 1) AS sec_per_km,
    ROUND((duration_seconds / NULLIF(distance_meters / 1609.344, 0))::numeric, 1) AS sec_per_mile,
    avg_hr,
    max_hr,
    calories,
    elevation_gain_m,
    vo2_max,
    location,
    vigorous_min,
    moderate_min
FROM activities
WHERE type IN ('running', 'treadmill_running')
ORDER BY activity_date DESC;

COMMENT ON VIEW running_log IS 'Runs only, with pace in sec/km and sec/mile. Use for run-to-run comparisons.';

-- ============ RLS (off for single-user personal project) ============
ALTER TABLE sleep_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE heartrate_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE stress_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE respiration_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE floors_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- Grant read on the health schema to anon/authenticated (so Supabase MCP sees it)
GRANT USAGE ON SCHEMA health TO anon, authenticated, postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA health TO anon, authenticated;
GRANT SELECT ON daily_snapshot, weekly_training_load, running_log TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA health GRANT SELECT ON TABLES TO anon, authenticated;
