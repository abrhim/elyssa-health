-- 1. Zero-step waking intervals: what's her body doing when she's not moving?
WITH hourly_hr AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_hr
    FROM timeseries WHERE metric_type = 'heart_rate' AND value > 0
    GROUP BY local_date, local_hour
),
hourly_stress AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_stress
    FROM timeseries WHERE metric_type = 'stress' AND value >= 0
    GROUP BY local_date, local_hour
),
hourly_bb AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_bb
    FROM timeseries WHERE metric_type = 'body_battery' AND value > 0
    GROUP BY local_date, local_hour
)
SELECT
    SUBSTR(s.interval_start, 1, 2) as hour,
    COUNT(*) as zero_step_intervals,
    ROUND(AVG(hr.avg_hr), 1) as avg_hr,
    ROUND(AVG(st.avg_stress), 1) as avg_stress,
    ROUND(AVG(bb.avg_bb), 1) as avg_bb
FROM steps_intraday s
LEFT JOIN hourly_hr hr ON hr.dt = s.date AND hr.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_stress st ON st.dt = s.date AND st.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_bb bb ON bb.dt = s.date AND bb.hour = SUBSTR(s.interval_start, 1, 2)
WHERE s.steps = 0
    AND s.activity_level != 'sleeping'
    AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '21'
GROUP BY 1
ORDER BY 1;

-- 2. Compare: zero steps vs low steps vs moderate vs high steps
WITH hourly_hr AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_hr, MIN(value) as min_hr, MAX(value) as max_hr
    FROM timeseries WHERE metric_type = 'heart_rate' AND value > 0
    GROUP BY local_date, local_hour
),
hourly_stress AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_stress
    FROM timeseries WHERE metric_type = 'stress' AND value >= 0
    GROUP BY local_date, local_hour
),
hourly_bb AS (
    SELECT local_date as dt, local_hour as hour, AVG(value) as avg_bb
    FROM timeseries WHERE metric_type = 'body_battery' AND value > 0
    GROUP BY local_date, local_hour
)
SELECT
    CASE
        WHEN s.steps = 0 THEN 'a: zero steps'
        WHEN s.steps BETWEEN 1 AND 20 THEN 'b: 1-20 steps'
        WHEN s.steps BETWEEN 21 AND 100 THEN 'c: 21-100 steps'
        WHEN s.steps BETWEEN 101 AND 500 THEN 'd: 101-500 steps'
        ELSE 'e: 500+ steps'
    END as movement_level,
    COUNT(*) as intervals,
    ROUND(AVG(hr.avg_hr), 1) as avg_hr,
    ROUND(AVG(st.avg_stress), 1) as avg_stress,
    ROUND(AVG(bb.avg_bb), 1) as avg_bb,
    ROUND(MIN(hr.min_hr), 1) as min_hr,
    ROUND(MAX(hr.max_hr), 1) as max_hr
FROM steps_intraday s
LEFT JOIN hourly_hr hr ON hr.dt = s.date AND hr.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_stress st ON st.dt = s.date AND st.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_bb bb ON bb.dt = s.date AND bb.hour = SUBSTR(s.interval_start, 1, 2)
WHERE s.activity_level != 'sleeping'
    AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '21'
GROUP BY movement_level
ORDER BY movement_level;

-- 3. Zero-step intervals on co-op Tuesdays vs regular days
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
    CASE
        WHEN strftime('%w', s.date) = '2' AND s.date >= '2026-01-27' THEN 'co-op Tuesday'
        WHEN strftime('%w', s.date) = '5' THEN 'Friday (best day)'
        ELSE 'other days'
    END as day_type,
    COUNT(*) as zero_step_intervals,
    ROUND(AVG(hr.avg_hr), 1) as avg_hr,
    ROUND(AVG(st.avg_stress), 1) as avg_stress
FROM steps_intraday s
LEFT JOIN hourly_hr hr ON hr.dt = s.date AND hr.hour = SUBSTR(s.interval_start, 1, 2)
LEFT JOIN hourly_stress st ON st.dt = s.date AND st.hour = SUBSTR(s.interval_start, 1, 2)
WHERE s.steps = 0
    AND s.activity_level != 'sleeping'
    AND SUBSTR(s.interval_start, 1, 2) BETWEEN '08' AND '14'
GROUP BY day_type;

-- 4. Consecutive zero-step intervals (prolonged stillness)
WITH ranked AS (
    SELECT
        date, interval_start, steps, activity_level,
        ROW_NUMBER() OVER (PARTITION BY date ORDER BY interval_start) as rn,
        ROW_NUMBER() OVER (PARTITION BY date ORDER BY interval_start) -
        ROW_NUMBER() OVER (PARTITION BY date, CASE WHEN steps = 0 THEN 1 END ORDER BY interval_start) as grp
    FROM steps_intraday
    WHERE activity_level != 'sleeping'
        AND SUBSTR(interval_start, 1, 2) BETWEEN '08' AND '21'
        AND steps = 0
)
SELECT
    date,
    MIN(interval_start) as stillness_start,
    MAX(interval_start) as stillness_end,
    COUNT(*) as consecutive_intervals,
    COUNT(*) * 15 as stillness_minutes
FROM ranked
GROUP BY date, grp
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 5. During prolonged stillness periods, what's her HR?
WITH ranked AS (
    SELECT
        date, interval_start, steps,
        ROW_NUMBER() OVER (PARTITION BY date ORDER BY interval_start) -
        ROW_NUMBER() OVER (PARTITION BY date, CASE WHEN steps = 0 THEN 1 END ORDER BY interval_start) as grp
    FROM steps_intraday
    WHERE activity_level != 'sleeping'
        AND SUBSTR(interval_start, 1, 2) BETWEEN '08' AND '21'
        AND steps = 0
),
stillness_periods AS (
    SELECT
        date,
        MIN(interval_start) as start_time,
        MAX(interval_start) as end_time,
        COUNT(*) * 15 as duration_min
    FROM ranked
    GROUP BY date, grp
    HAVING COUNT(*) >= 3
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
),
stillness_with_hours AS (
    -- Expand each stillness period into its constituent hours
    SELECT sp.date, sp.start_time, sp.end_time, sp.duration_min, h.hour
    FROM stillness_periods sp
    JOIN (SELECT DISTINCT SUBSTR(interval_start, 1, 2) as hour FROM steps_intraday) h
        ON h.hour BETWEEN SUBSTR(sp.start_time, 1, 2) AND SUBSTR(sp.end_time, 1, 2)
)
SELECT
    sw.date,
    sw.start_time,
    sw.end_time,
    sw.duration_min,
    ROUND(AVG(hr.avg_hr), 1) as avg_hr_during_stillness,
    ROUND(AVG(st.avg_stress), 1) as avg_stress_during_stillness,
    mc.phase_name,
    mc.day_in_cycle,
    CASE strftime('%w', sw.date)
        WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue'
        WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri'
        WHEN '6' THEN 'Sat'
    END as day_name
FROM stillness_with_hours sw
LEFT JOIN hourly_hr hr ON hr.dt = sw.date AND hr.hour = sw.hour
LEFT JOIN hourly_stress st ON st.dt = sw.date AND st.hour = sw.hour
LEFT JOIN menstrual_cycle mc ON mc.date = sw.date
GROUP BY sw.date, sw.start_time
ORDER BY avg_hr_during_stillness DESC
LIMIT 30;
