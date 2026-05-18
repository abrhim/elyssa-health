-- Token storage for Garmin OAuth (singleton row)
CREATE TABLE IF NOT EXISTS health.garmin_tokens (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    oauth1_token JSONB NOT NULL,
    oauth2_token JSONB NOT NULL,
    consumer_credentials JSONB NOT NULL,
    display_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE health.garmin_tokens ENABLE ROW LEVEL SECURITY;

-- SpO2 daily (missing from original schema)
CREATE TABLE IF NOT EXISTS health.spo2_daily (
    date DATE PRIMARY KEY,
    avg_spo2 REAL,
    lowest_spo2 REAL,
    latest_spo2 REAL,
    raw_json JSONB
);
ALTER TABLE health.spo2_daily DISABLE ROW LEVEL SECURITY;

-- Sync log for observability
CREATE TABLE IF NOT EXISTS health.sync_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    endpoint TEXT NOT NULL,
    target_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    rows_affected INT
);
CREATE INDEX IF NOT EXISTS sync_log_date_idx ON health.sync_log (target_date, endpoint);
ALTER TABLE health.sync_log DISABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT ON health.spo2_daily TO anon, authenticated;
GRANT SELECT ON health.sync_log TO anon, authenticated;
GRANT ALL ON health.garmin_tokens TO service_role;
GRANT ALL ON health.sync_log TO service_role;
GRANT ALL ON health.spo2_daily TO service_role;
GRANT ALL ON health.sleep_daily TO service_role;
GRANT ALL ON health.heartrate_daily TO service_role;
GRANT ALL ON health.stress_daily TO service_role;
GRANT ALL ON health.respiration_daily TO service_role;
GRANT ALL ON health.floors_daily TO service_role;
GRANT ALL ON health.daily_summary TO service_role;
GRANT ALL ON health.activities TO service_role;

-- pg_cron schedule (run after deploying the edge function)
-- Uncomment and run manually:
--
-- SELECT cron.schedule(
--   'garmin-daily-sync',
--   '0 4 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://vssciljnilrgqcrnandl.supabase.co/functions/v1/garmin-sync',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body := '{"days_back": 3}'::jsonb
--   );
--   $$
-- );
