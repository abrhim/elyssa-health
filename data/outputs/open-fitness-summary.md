# Open Fitness Dataset - Body Battery Analysis

**Source**: OpenFitnessDataset.General (GitHub)
**Devices**: Garmin vivoactive3 (2020-2021), vivo_move_hr (2022-2023)
**Date range**: 2020-09-21 to 2023-01-31
**Days with BB data**: 796
**Total BB readings**: 82,910
**Total stress readings**: 782,099
**Total HR readings**: 681,096

## Year Coverage

| Year | BB Readings | Avg BB | Device |
|------|-------------|--------|--------|
| 2020 | 7,426 | 47.6 | vivoactive3 |
| 2021 | 29,813 | 35.9 | vivoactive3 |
| 2022 | 41,516 | 37.7 | vivo_move_hr |
| 2023 | 4,155 | 40.1 | vivo_move_hr |

| Year | Status |
|------|--------|
| 2016-2017 | Vivosmart HR - no Body Battery support (feature launched late 2018) |
| 2018-2019 | No WELLNESS files present in dataset |
| 2020-2023 | Body Battery data available |

## Average Body Battery by Hour of Day

| Hour | Avg BB | | Avg Stress | Avg HR |
|------|--------|---|------------|--------|
| 00:00 | 36.9 | ██████████████████ | 35.5 | 74.4 |
| 01:00 | 32.6 | ████████████████ | 32.8 | 72.6 |
| 02:00 | 29.3 | ██████████████ | 31.1 | 71.4 |
| 03:00 | 26.1 | █████████████ | 30.3 | 70.9 |
| 04:00 | 23.1 | ███████████ | 30.5 | 71.1 |
| 05:00 | 21.0 | ██████████ | 32.9 | 72.8 |
| 06:00 | 20.2 | ██████████ | 36.5 | 75.0 |
| 07:00 | 20.9 | ██████████ | 43.7 | 79.1 |
| 08:00 | 22.8 | ███████████ | 50.3 | 82.8 |
| 09:00 | 26.8 | █████████████ | 56.8 | 86.6 |
| 10:00 | 31.1 | ███████████████ | 61.9 | 89.3 |
| 11:00 | 35.3 | █████████████████ | 62.3 | 89.7 |
| 12:00 | 40.1 | ████████████████████ | 62.7 | 90.0 |
| 13:00 | 44.1 | ██████████████████████ | 62.9 | 90.0 |
| 14:00 | 48.5 | ████████████████████████ | 63.8 | 90.4 |
| 15:00 | 53.0 | ██████████████████████████ | 62.5 | 89.7 |
| 16:00 | 56.9 | ████████████████████████████ | 66.8 | 91.9 |
| 17:00 | 58.8 | █████████████████████████████ | 70.7 | 94.1 |
| 18:00 | 60.6 | ██████████████████████████████ | 68.9 | 93.2 |
| 19:00 | 61.6 | ██████████████████████████████ | 65.2 | 90.9 |
| 20:00 | 60.5 | ██████████████████████████████ | 64.2 | 90.7 |
| 21:00 | 55.4 | ███████████████████████████ | 60.6 | 88.5 |
| 22:00 | 48.6 | ████████████████████████ | 50.1 | 82.6 |
| 23:00 | 42.0 | ████████████████████ | 41.3 | 77.6 |

## Key Patterns

- **Daily peak**: 19:00 (avg BB = 61.6)
- **Daily trough**: 6:00 (avg BB = 20.2)
- **Daily swing (max-min)**: avg 70.8 points
- **Overnight change**: avg 20.0 points (evening to next morning)

### Inverted Pattern Note

This dataset shows an **inverted Body Battery pattern**: BB is lowest at ~6am and highest at ~7pm. 
The typical Garmin pattern is the opposite (high after sleep, drains through the day). 
Possible explanations:
- The subject may have poor sleep quality / high nighttime restlessness, causing BB to drain during sleep
- The subject's daytime activities may involve enough rest periods for net BB gains
- The undocumented FIT field 233 encoding may represent a related-but-different metric
- The vivo_move_hr and vivoactive3 may encode BB differently than newer Garmin devices

## Daytime Recharge Bumps (8am-10pm)

- **Total recharge bumps detected**: 11,755
- **Avg recharge per bump**: 5.5 points
- **Bumps per day**: 14.8

Given the inverted pattern, daytime 'recharges' are the dominant trend here, 
suggesting the subject recovers energy during waking hours. 
This could indicate sedentary daytime activity with frequent rest periods.

## Waking-Hour BB Change Rate: High-Stress vs Low-Stress Days

*(Classified by median split on daily average stress level)*

- **High-stress days**: +3.65 BB/hour (393 days)
- **Low-stress days**: +5.35 BB/hour (360 days)
- High-stress days lose 1.69 BB/hour less than low-stress days

## Data Quality Notes

- Body Battery extracted from undocumented FIT message type 233 (field def_num=2)
- Encoding pattern: 4-byte tuple where byte[0]==byte[1], byte[2]==0, byte[3]==16
- Values of 0 excluded (likely invalid/sensor off)
- Stress values of -1 and -2 filtered (Garmin uses these for 'unavailable')
- Heart rate sampled from monitoring messages nearest to stress timestamps
- Multiple overlapping WELLNESS files per day were deduplicated by timestamp
- ~15 readings per day average (BB updates approximately every 5-15 minutes in Garmin)