-- Consolidate health.* split tables into a single wide health.daily_metrics table.
BEGIN;

-- 1. New wide table (garmy shape + a few extras we've been pulling)
CREATE TABLE IF NOT EXISTS health.daily_metrics (
    date DATE PRIMARY KEY,
    -- Activity / calories / steps
    total_steps INTEGER,
    step_goal INTEGER,
    total_distance_meters REAL,
    total_calories INTEGER,
    active_calories INTEGER,
    bmr_calories INTEGER,
    moderate_intensity_minutes INTEGER,
    vigorous_intensity_minutes INTEGER,
    -- Heart rate
    resting_heart_rate INTEGER,
    min_heart_rate INTEGER,
    max_heart_rate INTEGER,
    average_heart_rate REAL,
    last_7d_avg_resting_hr INTEGER,
    -- Stress
    avg_stress_level INTEGER,
    max_stress_level INTEGER,
    rest_stress_min REAL,
    low_stress_min REAL,
    medium_stress_min REAL,
    high_stress_min REAL,
    -- Body battery
    body_battery_high INTEGER,
    body_battery_low INTEGER,
    body_battery_charged INTEGER,
    body_battery_drained INTEGER,
    body_battery_most_recent INTEGER,
    -- Sleep
    sleep_duration_hours REAL,
    deep_sleep_hours REAL,
    light_sleep_hours REAL,
    rem_sleep_hours REAL,
    awake_hours REAL,
    deep_sleep_pct REAL,
    light_sleep_pct REAL,
    rem_sleep_pct REAL,
    awake_pct REAL,
    sleep_start TIMESTAMPTZ,
    sleep_end TIMESTAMPTZ,
    sleep_score INTEGER,
    sleep_quality TEXT,
    -- SpO2 / respiration
    average_spo2 REAL,
    average_respiration REAL,
    avg_waking_respiration REAL,
    avg_sleep_respiration REAL,
    lowest_respiration REAL,
    highest_respiration REAL,
    -- Training readiness / HRV (Forerunner 55 doesn't emit but column exists for future)
    training_readiness_score INTEGER,
    training_readiness_level TEXT,
    training_readiness_feedback TEXT,
    hrv_weekly_avg REAL,
    hrv_last_night_avg REAL,
    hrv_status TEXT,
    -- Provenance
    sources TEXT[],  -- e.g., ['garmy'], ['browser_pull'], or both
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_metrics_date_idx ON health.daily_metrics(date);

-- 2. Populate from garmy.daily_health_metrics (skip rows that are entirely empty)
INSERT INTO health.daily_metrics (
    date, total_steps, step_goal, total_distance_meters, total_calories, active_calories, bmr_calories,
    resting_heart_rate, min_heart_rate, max_heart_rate, average_heart_rate,
    avg_stress_level, max_stress_level,
    body_battery_high, body_battery_low,
    sleep_duration_hours, deep_sleep_hours, light_sleep_hours, rem_sleep_hours, awake_hours,
    deep_sleep_pct, light_sleep_pct, rem_sleep_pct, awake_pct,
    average_spo2, average_respiration,
    avg_waking_respiration, avg_sleep_respiration, lowest_respiration, highest_respiration,
    training_readiness_score, training_readiness_level, training_readiness_feedback,
    hrv_weekly_avg, hrv_last_night_avg, hrv_status,
    sources
)
SELECT
    metric_date::date, total_steps, step_goal, total_distance_meters, total_calories, active_calories, bmr_calories,
    resting_heart_rate, min_heart_rate, max_heart_rate, average_heart_rate,
    avg_stress_level, max_stress_level,
    body_battery_high, body_battery_low,
    sleep_duration_hours, deep_sleep_hours, light_sleep_hours, rem_sleep_hours, awake_hours,
    deep_sleep_percentage, light_sleep_percentage, rem_sleep_percentage, awake_percentage,
    average_spo2, average_respiration,
    avg_waking_respiration_value, avg_sleep_respiration_value, lowest_respiration_value, highest_respiration_value,
    training_readiness_score, training_readiness_level, training_readiness_feedback,
    hrv_weekly_avg, hrv_last_night_avg, hrv_status,
    ARRAY['garmy']
FROM garmy.daily_health_metrics
WHERE total_steps IS NOT NULL OR sleep_duration_hours IS NOT NULL OR resting_heart_rate IS NOT NULL
ON CONFLICT (date) DO NOTHING;

-- 3. Upsert from browser-pulled data (sleep_daily, heartrate_daily, stress_daily, respiration_daily, daily_summary)
-- For dates garmy didn't have or where we have fresher data, fill in from the split tables
INSERT INTO health.daily_metrics (
    date,
    total_steps, total_distance_meters, active_calories, bmr_calories, total_calories,
    moderate_intensity_minutes, vigorous_intensity_minutes,
    resting_heart_rate, min_heart_rate, max_heart_rate, last_7d_avg_resting_hr,
    avg_stress_level,
    body_battery_high, body_battery_low, body_battery_charged, body_battery_drained,
    sleep_duration_hours, deep_sleep_hours, light_sleep_hours, rem_sleep_hours, awake_hours,
    sleep_start, sleep_end, sleep_score, sleep_quality,
    avg_waking_respiration, avg_sleep_respiration, highest_respiration, lowest_respiration,
    sources
)
SELECT
    COALESCE(sl.date, hr.date, st.date, rd.date, ds.date) AS date,
    ds.total_steps, ds.total_distance_meters, ds.active_calories, ds.bmr_calories, ds.total_calories,
    ds.moderate_intensity_minutes, ds.vigorous_intensity_minutes,
    hr.resting_hr, hr.min_hr, hr.max_hr, hr.last_7d_avg_resting,
    st.overall_stress_level,
    ds.body_battery_high, ds.body_battery_low, ds.body_battery_charged, ds.body_battery_drained,
    sl.duration_seconds / 3600.0, sl.deep_seconds / 3600.0, sl.light_seconds / 3600.0,
    sl.rem_seconds / 3600.0, sl.awake_seconds / 3600.0,
    sl.sleep_start, sl.sleep_end, sl.sleep_score, sl.sleep_quality,
    rd.avg_waking, rd.avg_sleeping, rd.highest, rd.lowest,
    ARRAY['browser_pull']
FROM health.sleep_daily sl
FULL OUTER JOIN health.heartrate_daily hr ON hr.date = sl.date
FULL OUTER JOIN health.stress_daily st ON st.date = COALESCE(sl.date, hr.date)
FULL OUTER JOIN health.respiration_daily rd ON rd.date = COALESCE(sl.date, hr.date, st.date)
FULL OUTER JOIN health.daily_summary ds ON ds.date = COALESCE(sl.date, hr.date, st.date, rd.date)
WHERE COALESCE(sl.date, hr.date, st.date, rd.date, ds.date) IS NOT NULL
ON CONFLICT (date) DO UPDATE SET
    -- Prefer existing non-null values (garmy); fill in NULLs from browser pull
    total_steps = COALESCE(health.daily_metrics.total_steps, EXCLUDED.total_steps),
    total_distance_meters = COALESCE(health.daily_metrics.total_distance_meters, EXCLUDED.total_distance_meters),
    active_calories = COALESCE(health.daily_metrics.active_calories, EXCLUDED.active_calories),
    bmr_calories = COALESCE(health.daily_metrics.bmr_calories, EXCLUDED.bmr_calories),
    total_calories = COALESCE(health.daily_metrics.total_calories, EXCLUDED.total_calories),
    moderate_intensity_minutes = COALESCE(health.daily_metrics.moderate_intensity_minutes, EXCLUDED.moderate_intensity_minutes),
    vigorous_intensity_minutes = COALESCE(health.daily_metrics.vigorous_intensity_minutes, EXCLUDED.vigorous_intensity_minutes),
    resting_heart_rate = COALESCE(health.daily_metrics.resting_heart_rate, EXCLUDED.resting_heart_rate),
    min_heart_rate = COALESCE(health.daily_metrics.min_heart_rate, EXCLUDED.min_heart_rate),
    max_heart_rate = COALESCE(health.daily_metrics.max_heart_rate, EXCLUDED.max_heart_rate),
    last_7d_avg_resting_hr = COALESCE(health.daily_metrics.last_7d_avg_resting_hr, EXCLUDED.last_7d_avg_resting_hr),
    avg_stress_level = COALESCE(health.daily_metrics.avg_stress_level, EXCLUDED.avg_stress_level),
    body_battery_charged = COALESCE(health.daily_metrics.body_battery_charged, EXCLUDED.body_battery_charged),
    body_battery_drained = COALESCE(health.daily_metrics.body_battery_drained, EXCLUDED.body_battery_drained),
    sleep_duration_hours = COALESCE(health.daily_metrics.sleep_duration_hours, EXCLUDED.sleep_duration_hours),
    deep_sleep_hours = COALESCE(health.daily_metrics.deep_sleep_hours, EXCLUDED.deep_sleep_hours),
    light_sleep_hours = COALESCE(health.daily_metrics.light_sleep_hours, EXCLUDED.light_sleep_hours),
    rem_sleep_hours = COALESCE(health.daily_metrics.rem_sleep_hours, EXCLUDED.rem_sleep_hours),
    awake_hours = COALESCE(health.daily_metrics.awake_hours, EXCLUDED.awake_hours),
    sleep_start = COALESCE(health.daily_metrics.sleep_start, EXCLUDED.sleep_start),
    sleep_end = COALESCE(health.daily_metrics.sleep_end, EXCLUDED.sleep_end),
    sleep_score = COALESCE(health.daily_metrics.sleep_score, EXCLUDED.sleep_score),
    avg_waking_respiration = COALESCE(health.daily_metrics.avg_waking_respiration, EXCLUDED.avg_waking_respiration),
    avg_sleep_respiration = COALESCE(health.daily_metrics.avg_sleep_respiration, EXCLUDED.avg_sleep_respiration),
    highest_respiration = COALESCE(health.daily_metrics.highest_respiration, EXCLUDED.highest_respiration),
    lowest_respiration = COALESCE(health.daily_metrics.lowest_respiration, EXCLUDED.lowest_respiration),
    sources = health.daily_metrics.sources || 'browser_pull'::text,
    updated_at = NOW();

-- 4. Rename old split tables to _legacy_* (keep as safety net)
DROP VIEW IF EXISTS health.daily_snapshot CASCADE;
ALTER TABLE health.sleep_daily RENAME TO _legacy_sleep_daily;
ALTER TABLE health.heartrate_daily RENAME TO _legacy_heartrate_daily;
ALTER TABLE health.stress_daily RENAME TO _legacy_stress_daily;
ALTER TABLE health.respiration_daily RENAME TO _legacy_respiration_daily;
ALTER TABLE health.daily_summary RENAME TO _legacy_daily_summary;
DROP TABLE IF EXISTS health.floors_daily;  -- empty, no value

-- 5. Rewrite daily_snapshot view to use daily_metrics + activity rollup
CREATE OR REPLACE VIEW health.daily_snapshot AS
SELECT
    dm.*,
    COALESCE(act.activity_count, 0) AS activity_count,
    act.total_activity_seconds,
    act.total_activity_distance_m,
    act.total_activity_calories,
    act.max_activity_hr,
    mc.phase_name AS cycle_phase,
    mc.day_in_cycle,
    mc.cycle_start_date,
    (mc.phase_name IS NOT NULL) AS has_cycle_data
FROM health.daily_metrics dm
LEFT JOIN (
    SELECT activity_date,
           COUNT(*) AS activity_count,
           SUM(duration_seconds) AS total_activity_seconds,
           SUM(distance_meters) AS total_activity_distance_m,
           SUM(calories) AS total_activity_calories,
           MAX(max_hr) AS max_activity_hr
    FROM health.activities
    GROUP BY activity_date
) act ON act.activity_date = dm.date
LEFT JOIN health.menstrual_cycle mc ON mc.date = dm.date;

COMMENT ON VIEW health.daily_snapshot IS 'One row per day with all metrics + activity rollup + cycle phase. Primary agent interface.';

GRANT SELECT ON health.daily_metrics TO anon, authenticated;
GRANT SELECT ON health.daily_snapshot TO anon, authenticated;

COMMIT;
