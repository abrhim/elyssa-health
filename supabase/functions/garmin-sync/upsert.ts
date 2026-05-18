import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  SyncResult,
  Spo2Response,
  SleepResponse,
  RespirationResponse,
  FloorsResponse,
  HeartrateResponse,
  StressResponse,
  DailySummaryResponse,
  MenstrualCycleResponse,
  ActivityResponse,
} from "./types.ts";

function ok(endpoint: string, date: string, rows: number): SyncResult {
  return { endpoint, target_date: date, status: "success", rows_affected: rows };
}

function err(endpoint: string, date: string, msg: string): SyncResult {
  return {
    endpoint,
    target_date: date,
    status: "error",
    error_message: msg,
    rows_affected: 0,
  };
}

async function upsertRow(
  supabase: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  conflictColumn = "date"
): Promise<void> {
  const { error } = await supabase
    .schema("health")
    .from(table)
    .upsert(row, { onConflict: conflictColumn });
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function upsertSpo2(
  supabase: SupabaseClient,
  date: string,
  data: Spo2Response | null
): Promise<SyncResult> {
  if (!data) return ok("spo2", date, 0);
  try {
    await upsertRow(supabase, "spo2_daily", {
      date,
      avg_spo2: data.averageSpO2 ?? null,
      lowest_spo2: data.lowestSpO2 ?? null,
      latest_spo2: data.latestSpO2 ?? null,
      raw_json: data,
    });
    return ok("spo2", date, 1);
  } catch (e: unknown) {
    return err("spo2", date, (e as Error).message);
  }
}

export async function upsertSleep(
  supabase: SupabaseClient,
  date: string,
  data: SleepResponse | null
): Promise<SyncResult> {
  if (!data?.dailySleepDTO) return ok("sleep", date, 0);
  const s = data.dailySleepDTO;
  try {
    await upsertRow(supabase, "sleep_daily", {
      date,
      sleep_start: s.sleepStartTimestampGMT
        ? new Date(s.sleepStartTimestampGMT).toISOString()
        : null,
      sleep_end: s.sleepEndTimestampGMT
        ? new Date(s.sleepEndTimestampGMT).toISOString()
        : null,
      duration_seconds: s.sleepTimeSeconds ?? null,
      deep_seconds: s.deepSleepSeconds ?? null,
      light_seconds: s.lightSleepSeconds ?? null,
      rem_seconds: s.remSleepSeconds ?? null,
      awake_seconds: s.awakeSleepSeconds ?? null,
      sleep_score: s.sleepScores?.overall?.value ?? null,
      sleep_quality: s.sleepScores?.overall?.qualifierKey ?? null,
      avg_spo2: s.averageSpO2Value ?? null,
      avg_respiration: s.averageRespirationValue ?? null,
      avg_stress: s.averageStressValue ?? null,
      raw_json: data,
    });
    return ok("sleep", date, 1);
  } catch (e: unknown) {
    return err("sleep", date, (e as Error).message);
  }
}

export async function upsertRespiration(
  supabase: SupabaseClient,
  date: string,
  data: RespirationResponse | null
): Promise<SyncResult> {
  if (!data) return ok("respiration", date, 0);
  try {
    await upsertRow(supabase, "respiration_daily", {
      date,
      avg_waking: data.avgWakingRespirationValue ?? null,
      avg_sleeping: data.avgSleepRespirationValue ?? null,
      highest: data.highestRespirationValue ?? null,
      lowest: data.lowestRespirationValue ?? null,
      raw_json: data,
    });
    return ok("respiration", date, 1);
  } catch (e: unknown) {
    return err("respiration", date, (e as Error).message);
  }
}

export async function upsertFloors(
  supabase: SupabaseClient,
  date: string,
  data: FloorsResponse | null
): Promise<SyncResult> {
  if (!data) return ok("floors", date, 0);
  try {
    await upsertRow(supabase, "floors_daily", {
      date,
      floors_ascended: data.floorsAscended ?? null,
      floors_descended: data.floorsDescended ?? null,
      raw_json: data,
    });
    return ok("floors", date, 1);
  } catch (e: unknown) {
    return err("floors", date, (e as Error).message);
  }
}

export async function upsertHeartrate(
  supabase: SupabaseClient,
  date: string,
  data: HeartrateResponse | null
): Promise<SyncResult> {
  if (!data) return ok("heartrate", date, 0);
  try {
    await upsertRow(supabase, "heartrate_daily", {
      date,
      resting_hr: data.restingHeartRate ?? null,
      min_hr: data.minHeartRate ?? null,
      max_hr: data.maxHeartRate ?? null,
      last_7d_avg_resting: data.lastSevenDaysAvgRestingHeartRate ?? null,
      raw_json: data,
    });
    return ok("heartrate", date, 1);
  } catch (e: unknown) {
    return err("heartrate", date, (e as Error).message);
  }
}

export async function upsertStress(
  supabase: SupabaseClient,
  date: string,
  data: StressResponse | null
): Promise<SyncResult> {
  if (!data) return ok("stress", date, 0);
  try {
    await upsertRow(supabase, "stress_daily", {
      date,
      overall_stress_level: data.overallStressLevel ?? null,
      rest_stress_duration: data.restStressDuration ?? null,
      low_stress_duration: data.lowStressDuration ?? null,
      medium_stress_duration: data.mediumStressDuration ?? null,
      high_stress_duration: data.highStressDuration ?? null,
      raw_json: data,
    });
    return ok("stress", date, 1);
  } catch (e: unknown) {
    return err("stress", date, (e as Error).message);
  }
}

export async function upsertDailySummary(
  supabase: SupabaseClient,
  date: string,
  data: DailySummaryResponse | null
): Promise<SyncResult> {
  if (!data) return ok("daily_summary", date, 0);
  try {
    await upsertRow(supabase, "daily_summary", {
      date,
      total_steps: data.totalSteps ?? null,
      total_distance_meters: data.totalDistanceMeters ?? null,
      active_calories: data.activeKilocalories ?? null,
      bmr_calories: data.bmrKilocalories ?? null,
      total_calories: data.totalKilocalories ?? null,
      floors_ascended: data.floorsAscended ?? null,
      moderate_intensity_minutes: data.moderateIntensityMinutes ?? null,
      vigorous_intensity_minutes: data.vigorousIntensityMinutes ?? null,
      average_stress: data.averageStressLevel ?? null,
      body_battery_charged: data.bodyBatteryChargedValue ?? null,
      body_battery_drained: data.bodyBatteryDrainedValue ?? null,
      raw_json: data,
    });
    return ok("daily_summary", date, 1);
  } catch (e: unknown) {
    return err("daily_summary", date, (e as Error).message);
  }
}

export async function upsertMenstrualCycle(
  supabase: SupabaseClient,
  date: string,
  data: MenstrualCycleResponse | null
): Promise<SyncResult> {
  if (!data?.daySummary) return ok("menstrual_cycle", date, 0);
  const s = data.daySummary;
  try {
    await upsertRow(supabase, "menstrual_cycle", {
      date,
      cycle_start_date: s.startDate ?? null,
      day_in_cycle: s.dayInCycle ?? null,
      phase: s.currentPhase ?? null,
      phase_name: phaseLabel(s.currentPhase),
      period_length: s.periodLength ?? null,
      predicted_cycle_length: s.predictedCycleLength ?? null,
      cycle_type: s.cycleType ?? null,
      is_predicted: s.isPredicted ?? null,
      days_until_next_phase: s.daysUntilNextPhase ?? null,
      fertile_window_start: s.fertileWindowStart ?? null,
      day_log: data.dayLog ?? null,
    });
    return ok("menstrual_cycle", date, 1);
  } catch (e: unknown) {
    return err("menstrual_cycle", date, (e as Error).message);
  }
}

function phaseLabel(phase?: number): string | null {
  if (phase == null) return null;
  const labels: Record<number, string> = {
    1: "MENSTRUATION",
    2: "FOLLICULAR",
    3: "OVULATION",
    4: "LUTEAL",
  };
  return labels[phase] ?? null;
}

export async function upsertActivities(
  supabase: SupabaseClient,
  date: string,
  data: ActivityResponse[] | null
): Promise<SyncResult> {
  if (!data?.length) return ok("activities", date, 0);
  let inserted = 0;
  const errors: string[] = [];

  for (const a of data) {
    try {
      const { error } = await supabase
        .schema("health")
        .from("activities")
        .upsert(
          {
            activity_id: a.activityId,
            activity_date: a.startTimeLocal?.split(" ")[0] ?? date,
            name: a.activityName ?? null,
            type: a.activityType?.typeKey ?? null,
            start_time_local: a.startTimeLocal ?? null,
            start_time_gmt: a.startTimeGMT ?? null,
            duration_seconds: a.duration ?? null,
            moving_duration_seconds: a.movingDuration ?? null,
            distance_meters: a.distance ?? null,
            elevation_gain_m: a.elevationGain ?? null,
            avg_speed_mps: a.averageSpeed ?? null,
            max_speed_mps: a.maxSpeed ?? null,
            calories: a.calories ?? null,
            avg_hr: a.averageHR ?? null,
            max_hr: a.maxHR ?? null,
            steps: a.steps ?? null,
            vo2_max: a.vO2MaxValue ?? null,
            start_lat: a.startLatitude ?? null,
            start_lon: a.startLongitude ?? null,
            location: a.locationName ?? null,
            device_id: a.deviceId ?? null,
            moderate_min: a.moderateIntensityMinutes ?? null,
            vigorous_min: a.vigorousIntensityMinutes ?? null,
          },
          { onConflict: "activity_id" }
        );
      if (error) throw new Error(error.message);
      inserted++;
    } catch (e: unknown) {
      errors.push(`activity ${a.activityId}: ${(e as Error).message}`);
    }
  }

  if (errors.length) {
    return {
      endpoint: "activities",
      target_date: date,
      status: inserted > 0 ? "success" : "error",
      error_message: errors.join("; "),
      rows_affected: inserted,
    };
  }
  return ok("activities", date, inserted);
}
