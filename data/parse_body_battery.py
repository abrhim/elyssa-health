#!/usr/bin/env python3
"""Parse Garmin FIT files from OpenFitnessDataset for Body Battery, stress, and HR data."""

import fitdecode
import glob
import csv
import os
import sys
from datetime import datetime, timezone

BASE = "/tmp/open-fitness-dataset/dataset"
OUTPUT_CSV = "/Users/abram/elyssa-health/outputs/open-fitness-body-battery.csv"

def parse_wellness_file(filepath):
    """Extract body battery, stress, and heart rate from a WELLNESS FIT file."""
    records = []

    try:
        with fitdecode.FitReader(filepath) as fit:
            # Track timestamps from stress_level messages to associate with BB
            last_stress_ts = None
            last_stress_val = None

            # Collect all data points with their timestamps
            stress_data = {}  # ts -> stress_value
            hr_data = {}      # ts -> heart_rate (nearest minute)
            bb_data = {}      # ts -> body_battery

            current_ts = None

            for frame in fit:
                if not isinstance(frame, fitdecode.FitDataMessage):
                    continue

                if frame.name == 'stress_level':
                    ts = None
                    stress_val = None
                    for f in frame.fields:
                        if f.name == 'stress_level_time':
                            ts = f.value
                        elif f.name == 'stress_level_value':
                            stress_val = f.value
                    if ts is not None:
                        current_ts = ts
                        if stress_val is not None and stress_val > 0:  # -1 and -2 are invalid
                            stress_data[ts] = stress_val

                elif frame.name == 'monitoring':
                    for f in frame.fields:
                        if f.name == 'heart_rate' and f.value is not None:
                            if current_ts is not None:
                                hr_data[current_ts] = f.value

                elif frame.name == 'unknown_233':
                    val = frame.fields[0].value
                    if isinstance(val, tuple) and len(val) == 4:
                        if val[0] == val[1] and val[2] == 0 and val[3] == 16:
                            bb_value = val[0]
                            if current_ts is not None and 0 < bb_value <= 100:
                                bb_data[current_ts] = bb_value

            # Merge all timestamps
            all_ts = sorted(set(list(stress_data.keys()) + list(hr_data.keys()) + list(bb_data.keys())))

            # For each timestamp where we have body battery, create a record
            # Also interpolate: find nearest stress and HR within 2 minutes
            for ts in all_ts:
                bb = bb_data.get(ts)
                stress = stress_data.get(ts)
                hr = hr_data.get(ts)

                # Only include rows where we have at least body battery
                if bb is not None:
                    records.append({
                        'timestamp': ts.isoformat() if hasattr(ts, 'isoformat') else str(ts),
                        'body_battery': bb,
                        'stress': stress if stress else '',
                        'heart_rate': hr if hr else '',
                    })
                elif stress is not None:
                    # Also include stress-only rows for completeness
                    records.append({
                        'timestamp': ts.isoformat() if hasattr(ts, 'isoformat') else str(ts),
                        'body_battery': '',
                        'stress': stress,
                        'heart_rate': hr if hr else '',
                    })

    except Exception as e:
        print(f"  Error parsing {os.path.basename(filepath)}: {e}", file=sys.stderr)

    return records


def main():
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

    all_records = []
    years_with_bb = []
    years_without_bb = []

    for year in ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023']:
        year_dir = os.path.join(BASE, year)
        if not os.path.isdir(year_dir):
            years_without_bb.append(f"{year} (no data)")
            continue

        fits = sorted(glob.glob(f"{year_dir}/**/*WELLNESS*.fit", recursive=True))
        if not fits:
            years_without_bb.append(f"{year} (no WELLNESS files)")
            continue

        print(f"Processing {year}: {len(fits)} WELLNESS files...")
        year_bb_count = 0

        for i, fp in enumerate(fits):
            if i % 500 == 0 and i > 0:
                print(f"  {i}/{len(fits)} files processed...")
            records = parse_wellness_file(fp)
            bb_records = [r for r in records if r['body_battery'] != '']
            year_bb_count += len(bb_records)
            all_records.extend(records)

        if year_bb_count > 0:
            years_with_bb.append(f"{year} ({year_bb_count} BB readings)")
        else:
            years_without_bb.append(f"{year} (no Body Battery)")

        print(f"  {year}: {year_bb_count} BB readings, {len([r for r in all_records if r['body_battery'] != ''])} total BB so far")

    # Sort by timestamp
    all_records.sort(key=lambda r: r['timestamp'])

    # Deduplicate by timestamp (multiple WELLNESS files can overlap)
    seen = set()
    deduped = []
    for r in all_records:
        key = (r['timestamp'], r['body_battery'], r['stress'])
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    # Write CSV
    with open(OUTPUT_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['timestamp', 'body_battery', 'stress', 'heart_rate'])
        writer.writeheader()
        writer.writerows(deduped)

    bb_only = [r for r in deduped if r['body_battery'] != '']
    print(f"\nTotal records: {len(deduped)}")
    print(f"Records with Body Battery: {len(bb_only)}")
    print(f"Years with BB: {years_with_bb}")
    print(f"Years without BB: {years_without_bb}")
    print(f"CSV written to: {OUTPUT_CSV}")


if __name__ == '__main__':
    main()
