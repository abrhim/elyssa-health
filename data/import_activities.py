import json, sqlite3, os
DB = os.path.join(os.path.dirname(__file__), 'health.db')
rows = json.load(open(os.path.join(os.path.dirname(__file__), 'activities.json')))
conn = sqlite3.connect(DB)
cur = conn.cursor()
# Columns in existing schema: activity_id, activity_date, activity_name, activity_type, sport_type_id,
# start_time_local, duration_seconds, moving_duration_seconds, distance_meters, calories, avg_hr, max_hr,
# steps, avg_stress, elevation_gain, moderate_intensity_minutes, vigorous_intensity_minutes,
# hr_zone_1..5_seconds, location_name, lap_count
# Input row positions:
# 0 id, 1 name, 2 type, 3 startLocal, 4 startGmt, 5 distance, 6 duration, 7 movingDuration,
# 8 elevGain, 9 avgSpeed, 10 maxSpeed, 11 cals, 12 avgHR, 13 maxHR, 14 steps, 15 vo2,
# 16 lat, 17 lon, 18 location, 19 deviceId, 20 modMin, 21 vigMin
count = 0
for r in rows:
    activity_date = r[3][:10] if r[3] else None
    cur.execute("""
        INSERT OR REPLACE INTO activities
        (activity_id, activity_date, activity_name, activity_type, sport_type_id,
         start_time_local, duration_seconds, moving_duration_seconds, distance_meters,
         calories, avg_hr, max_hr, steps, avg_stress, elevation_gain,
         moderate_intensity_minutes, vigorous_intensity_minutes,
         hr_zone_1_seconds, hr_zone_2_seconds, hr_zone_3_seconds, hr_zone_4_seconds, hr_zone_5_seconds,
         location_name, lap_count)
        VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?)
    """, (
        r[0], activity_date, r[1], r[2], None,
        r[3], r[6], r[7], r[5],
        r[11], r[12], r[13], r[14], None, r[8],
        r[20], r[21],
        None, None, None, None, None,
        r[18], None
    ))
    count += 1
conn.commit()
print(f'imported {count} activities')
cur.execute("SELECT activity_date, activity_name, distance_meters/1000, calories FROM activities WHERE activity_date='2026-04-07'")
print('today:', cur.fetchall())
cur.execute("SELECT COUNT(*), MIN(activity_date), MAX(activity_date) FROM activities")
print('total:', cur.fetchone())
conn.close()
