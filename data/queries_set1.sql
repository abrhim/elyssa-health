-- 1. What does the step data look like?
SELECT * FROM steps_intraday LIMIT 20;

-- 2. Average steps and activity distribution by hour
SELECT
    SUBSTR(interval_start, 1, 2) as hour,
    SUM(steps) * 1.0 / COUNT(DISTINCT date) as avg_steps_per_hour,
    ROUND(SUM(CASE WHEN activity_level = 'sleeping' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_sleeping,
    ROUND(SUM(CASE WHEN activity_level = 'sedentary' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_sedentary,
    ROUND(SUM(CASE WHEN activity_level = 'active' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_active,
    ROUND(SUM(CASE WHEN activity_level = 'highlyActive' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_highly_active,
    COUNT(DISTINCT date) as days
FROM steps_intraday
GROUP BY hour
ORDER BY hour;

-- 3. Overlay steps with BB drain
WITH hourly_bb AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_bb
    FROM timeseries
    WHERE metric_type = 'body_battery' AND value > 0
    GROUP BY local_date, local_hour
)
SELECT
    SUBSTR(s.interval_start, 1, 2) as hour,
    ROUND(AVG(s.steps), 1) as avg_steps,
    s.activity_level,
    ROUND(AVG(bb.avg_bb), 1) as avg_bb
FROM steps_intraday s
LEFT JOIN hourly_bb bb ON bb.dt = s.date AND bb.hour = SUBSTR(s.interval_start, 1, 2)
GROUP BY hour, s.activity_level
ORDER BY hour, s.activity_level;

-- 4. Sedentary intervals: is BB draining even when she's not moving?
WITH hourly_bb AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_bb
    FROM timeseries WHERE metric_type = 'body_battery' AND value > 0
    GROUP BY local_date, local_hour
),
hourly_hr AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_hr
    FROM timeseries WHERE metric_type = 'heart_rate' AND value > 0
    GROUP BY local_date, local_hour
),
hourly_stress AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_stress
    FROM timeseries WHERE metric_type = 'stress' AND value >= 0
    GROUP BY local_date, local_hour
)
SELECT
    SUBSTR(s.interval_start, 1, 2) as hour,
    COUNT(*) as sedentary_intervals,
    ROUND(AVG(s.steps), 1) as avg_steps_when_sedentary,
    ROUND(AVG(bb.avg_bb), 1) as avg_bb_when_sedentary,
    ROUND(AVG(hr.avg_hr), 1) as avg_hr_when_sedentary,
    ROUND(AVG(st.avg_stress), 1) as avg_stress_when_sedentary
FROM steps_intraday s
LEFT JOIN hourly_bb bb ON bb.dt = s.date AND bb.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_hr hr ON hr.dt = s.date AND hr.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_stress st ON st.dt = s.date AND st.hour = SUBSTR(s.interval_start, 1, 2)
WHERE s.activity_level = 'sedentary'
    AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '21'
GROUP BY hour
ORDER BY hour;

-- 5. Active vs sedentary: does her HR/stress differ?
WITH hourly_hr AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_hr
    FROM timeseries WHERE metric_type = 'heart_rate' AND value > 0
    GROUP BY local_date, local_hour
),
hourly_stress AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_stress
    FROM timeseries WHERE metric_type = 'stress' AND value >= 0
    GROUP BY local_date, local_hour
)
SELECT
    s.activity_level,
    COUNT(*) as intervals,
    ROUND(AVG(s.steps), 1) as avg_steps,
    ROUND(AVG(hr.avg_hr), 1) as avg_hr,
    ROUND(AVG(st.avg_stress), 1) as avg_stress
FROM steps_intraday s
LEFT JOIN hourly_hr hr ON hr.dt = s.date AND hr.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_stress st ON st.dt = s.date AND st.hour = SUBSTR(s.interval_start, 1, 2)
WHERE s.activity_level IN ('sedentary', 'active', 'highlyActive')
    AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '21'
GROUP BY s.activity_level;

-- 6. Tuesday vs Friday step patterns
SELECT
    CASE strftime('%w', date) WHEN '2' THEN 'Tuesday' WHEN '5' THEN 'Friday' END as day,
    SUBSTR(interval_start, 1, 2) as hour,
    ROUND(AVG(steps), 1) as avg_steps,
    ROUND(SUM(CASE WHEN activity_level = 'sedentary' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_sedentary,
    ROUND(SUM(CASE WHEN activity_level IN ('active','highlyActive') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_active
FROM steps_intraday
WHERE strftime('%w', date) IN ('2', '5')
    AND SUBSTR(interval_start, 1, 2) BETWEEN '07' AND '21'
GROUP BY day, hour
ORDER BY day, hour;

-- 7. Co-op Tuesdays: step pattern during co-op hours
SELECT
    s.interval_start,
    ROUND(AVG(s.steps), 1) as avg_steps,
    s.activity_level,
    COUNT(*) as occurrences
FROM steps_intraday s
WHERE strftime('%w', s.date) = '2'
    AND s.date >= '2026-01-27'
    AND s.interval_start BETWEEN '07:00' AND '14:00'
GROUP BY s.interval_start, s.activity_level
ORDER BY s.interval_start;

-- 8. Cycle phase + activity level: does she move less during ovulatory?
SELECT
    mc.phase_name,
    s.activity_level,
    COUNT(*) as intervals,
    ROUND(AVG(s.steps), 1) as avg_steps
FROM steps_intraday s
JOIN menstrual_cycle mc ON mc.date = s.date
WHERE s.activity_level IN ('sedentary', 'active', 'highlyActive')
    AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '21'
GROUP BY mc.phase_name, s.activity_level
ORDER BY mc.phase_name, s.activity_level;

-- 9. Smoking gun: during SEDENTARY intervals, does BB drain differ by cycle phase?
WITH hourly_bb AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_bb
    FROM timeseries WHERE metric_type = 'body_battery' AND value > 0
    GROUP BY local_date, local_hour
),
sedentary_bb AS (
    SELECT
        s.date,
        mc.phase_name,
        SUBSTR(s.interval_start, 1, 2) as hour,
        bb.avg_bb as bb_val
    FROM steps_intraday s
    JOIN menstrual_cycle mc ON mc.date = s.date
    JOIN hourly_bb bb ON bb.dt = s.date AND bb.hour = SUBSTR(s.interval_start, 1, 2)
    WHERE s.activity_level = 'sedentary'
        AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '20'
)
SELECT
    phase_name,
    ROUND(AVG(bb_val), 1) as avg_bb_during_sedentary,
    COUNT(DISTINCT date) as days,
    COUNT(*) as intervals
FROM sedentary_bb
GROUP BY phase_name
ORDER BY avg_bb_during_sedentary;
