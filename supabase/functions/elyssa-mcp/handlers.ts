import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODES } from "./modes.ts";
import { today, daysAgo } from "./tools.ts";

type Content = { type: "text"; text: string };
type Args = Record<string, unknown>;

function text(data: unknown): Content[] {
  return [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }];
}
function err(msg: string): Content[] {
  return [{ type: "text", text: `Error: ${msg}` }];
}

function sb(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function h(s: SupabaseClient) { return s.schema("health"); }
function t(s: SupabaseClient) { return s.schema("training"); }

// Session type → muscle group mapping
const SESSION_MUSCLES: Record<string, string[]> = {
  lower_a: ["quads", "calves", "core"],
  lower_b: ["hamstrings", "glutes", "core"],
  upper_a: ["chest", "shoulders_lateral", "shoulders_front", "triceps"],
  upper_b: ["back", "shoulders_rear", "biceps"],
};

// ─── Router ──────────────────────────────────────────────────

export async function handleToolCall(name: string, args: Args): Promise<Content[]> {
  const s = sb();
  switch (name) {
    case "activate_mode": return activateMode(args);
    case "get_training_context": return getTrainingContext(s, args);
    case "get_health_metrics": return getHealthMetrics(s, args);
    case "get_garmin_activities": return getGarminActivities(s, args);
    case "get_cycle_history": return getCycleHistory(s, args);
    case "get_working_weights": return getWorkingWeights(s, args);
    case "get_exercise_history": return getExerciseHistory(s, args);
    case "get_exercise_library": return getExerciseLibrary(s, args);
    case "get_body_scans": return getBodyScans(s, args);
    case "create_workout_plan": return createWorkoutPlan(s, args);
    case "log_exercise_result": return logExerciseResult(s, args);
    case "update_working_weight": return updateWorkingWeight(s, args);
    case "complete_workout": return completeWorkout(s, args);
    case "log_run": return logRun(s, args);
    case "log_body_scan": return logBodyScan(s, args);
    case "manage_exercise": return manageExercise(s, args);
    case "update_schedule": return updateSchedule(s, args);
    default: return err(`Unknown tool: ${name}`);
  }
}

// ─── activate_mode ───────────────────────────────────────────

function activateMode(args: Args): Content[] {
  const mode = args.mode as string;
  const m = MODES[mode];
  if (!m) return err(`Unknown mode: ${mode}. Available: ${Object.keys(MODES).join(", ")}`);
  return text({ mode: m.name, display_name: m.display_name, description: m.description, system_prompt: m.system_prompt });
}

// ─── get_training_context ────────────────────────────────────

async function getTrainingContext(s: SupabaseClient, args: Args): Promise<Content[]> {
  const date = (args.date as string) || today();
  const weekStart = getWeekStart(date);
  const weekEnd = getWeekEnd(date);

  const [cycle, hrToday, summaryToday, sleepToday, stress7d, summary7d, hr7d, sleep7d, workoutsThisWeek, schedule] =
    await Promise.all([
      h(s).from("menstrual_cycle").select("date,cycle_start_date,day_in_cycle,phase,phase_name,days_until_next_phase,predicted_cycle_length,is_predicted").eq("date", date).maybeSingle(),
      h(s).from("heartrate_daily").select("date,resting_hr,min_hr,max_hr").eq("date", date).maybeSingle(),
      h(s).from("daily_summary").select("date,total_steps,body_battery_charged,body_battery_drained,average_stress,moderate_intensity_minutes,vigorous_intensity_minutes").eq("date", date).maybeSingle(),
      h(s).from("sleep_daily").select("date,duration_seconds,sleep_score,sleep_quality").eq("date", date).maybeSingle(),
      h(s).from("stress_daily").select("date,overall_stress_level,high_stress_duration").gte("date", daysAgo(7)).lte("date", date).order("date", { ascending: false }),
      h(s).from("daily_summary").select("date,body_battery_charged,body_battery_drained,average_stress").gte("date", daysAgo(7)).lte("date", date).order("date", { ascending: false }),
      h(s).from("heartrate_daily").select("date,resting_hr").gte("date", daysAgo(7)).lte("date", date).order("date", { ascending: false }),
      h(s).from("sleep_daily").select("date,duration_seconds,sleep_score").gte("date", daysAgo(7)).lte("date", date).order("date", { ascending: false }),
      t(s).from("workout_plans").select("id,workout_date,session_type,status,skip_reason,coach_notes,cycle_phase,training_mode,rir_target").gte("workout_date", weekStart).lte("workout_date", weekEnd).order("workout_date"),
      t(s).from("week_schedule").select("day_of_week,session_type,notes").order("day_of_week"),
    ]);

  const cycleData = cycle.data;
  const summaryData = summaryToday.data;
  const sleepHours = sleepToday.data?.duration_seconds ? +(sleepToday.data.duration_seconds / 3600).toFixed(1) : null;

  const trainingMode = cycleData?.phase_name === "MENSTRUATION" ? "survival"
    : cycleData?.phase_name === "FOLLICULAR" || cycleData?.phase_name === "OVULATION" ? "performance"
    : "ramp_up";

  const bbNet = (summary7d.data ?? []).map((d: Record<string, unknown>) =>
    (d.body_battery_charged as number ?? 0) - (d.body_battery_drained as number ?? 0));
  const drainStreak = bbNet.reduce((streak: number, net: number) => net < 0 ? streak + 1 : 0, 0);

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const scheduleMap: Record<string, string> = {};
  for (const row of schedule.data ?? []) {
    const dow = (row as Record<string, unknown>).day_of_week as number;
    scheduleMap[dayNames[dow % 7]] = (row as Record<string, unknown>).session_type as string;
  }

  const completed = (workoutsThisWeek.data ?? []).filter((w: Record<string, unknown>) => w.status === "completed" || w.status === "partial");
  const planned = (workoutsThisWeek.data ?? []).filter((w: Record<string, unknown>) => w.status === "planned");

  const todayDow = new Date(date).getDay();
  const todayScheduled = (schedule.data ?? []).find((r: Record<string, unknown>) => (r.day_of_week as number) % 7 === todayDow);

  // RC1: Surface existing plan for today so the operator sees it at the decision point
  let todayExistingPlan: Record<string, unknown> | null = null;
  const todayPlan = (workoutsThisWeek.data ?? []).find(
    (w: Record<string, unknown>) => w.workout_date === date && (w.status === "planned" || w.status === "partial"),
  );
  if (todayPlan) {
    const { data: planExercises } = await t(s)
      .from("planned_exercises")
      .select("exercise_order, layer, goal_weight, goal_reps, goal_sets, coaching_note, is_per_hand, exercise:exercise_id(name, muscle_group, equipment, is_seated)")
      .eq("workout_plan_id", (todayPlan as Record<string, unknown>).id)
      .order("exercise_order");

    todayExistingPlan = {
      id: (todayPlan as Record<string, unknown>).id,
      session_type: (todayPlan as Record<string, unknown>).session_type,
      status: (todayPlan as Record<string, unknown>).status,
      coach_notes: (todayPlan as Record<string, unknown>).coach_notes,
      cycle_phase: (todayPlan as Record<string, unknown>).cycle_phase,
      training_mode: (todayPlan as Record<string, unknown>).training_mode,
      rir_target: (todayPlan as Record<string, unknown>).rir_target,
      exercises: (planExercises ?? []).map((pe: Record<string, unknown>) => ({
        name: (pe.exercise as Record<string, unknown>)?.name,
        muscle_group: (pe.exercise as Record<string, unknown>)?.muscle_group,
        order: pe.exercise_order,
        layer: pe.layer,
        goal_weight: pe.goal_weight,
        goal_reps: pe.goal_reps,
        goal_sets: pe.goal_sets,
        coaching_note: pe.coaching_note,
        is_per_hand: pe.is_per_hand,
        is_seated: (pe.exercise as Record<string, unknown>)?.is_seated,
      })),
    };
  }

  return text({
    date,
    cycle: cycleData ? {
      day: cycleData.day_in_cycle,
      phase: cycleData.phase_name,
      training_mode: trainingMode,
      cycle_start_date: cycleData.cycle_start_date,
      predicted_cycle_length: cycleData.predicted_cycle_length,
      days_until_next_phase: cycleData.days_until_next_phase,
    } : null,
    health_today: {
      resting_hr: hrToday.data?.resting_hr ?? null,
      body_battery_charged: summaryData?.body_battery_charged ?? null,
      body_battery_drained: summaryData?.body_battery_drained ?? null,
      stress_avg: summaryData?.average_stress ?? null,
      sleep_hours: sleepHours,
      sleep_score: sleepToday.data?.sleep_score ?? null,
      steps: summaryData?.total_steps ?? null,
    },
    health_trend_7d: (summary7d.data ?? []).map((d: Record<string, unknown>, i: number) => ({
      date: d.date,
      body_battery_net: bbNet[i],
      stress_avg: d.average_stress,
      resting_hr: (hr7d.data ?? [])[i]?.resting_hr ?? null,
      sleep_hours: (sleep7d.data ?? [])[i]?.duration_seconds ? +((sleep7d.data ?? [])[i].duration_seconds / 3600).toFixed(1) : null,
    })),
    flags: {
      period_flu_active: cycleData?.phase_name === "MENSTRUATION" && (cycleData?.day_in_cycle ?? 0) <= 3,
      high_stress: (summaryData?.average_stress ?? 0) > 70,
      poor_sleep: sleepHours !== null && sleepHours < 6,
      rest_day_recommended: drainStreak >= 3,
      consecutive_drain_days: drainStreak,
    },
    today_existing_plan: todayExistingPlan,
    training_this_week: {
      completed: completed.map((w: Record<string, unknown>) => ({ date: w.workout_date, type: w.session_type, status: w.status })),
      planned: planned.map((w: Record<string, unknown>) => ({ date: w.workout_date, type: w.session_type, status: w.status })),
      today_scheduled: todayScheduled ? (todayScheduled as Record<string, unknown>).session_type : null,
    },
    schedule: scheduleMap,
  });
}

// ─── get_health_metrics ──────────────────────────────────────

async function getHealthMetrics(s: SupabaseClient, args: Args): Promise<Content[]> {
  const start = args.start_date as string;
  const end = args.end_date as string;
  const metrics = (args.metrics as string[]) ?? ["heart_rate", "sleep", "stress", "body_battery", "respiration", "spo2"];

  const result: Record<string, unknown> = { range: { start, end } };
  const queries: Promise<void>[] = [];

  if (metrics.includes("heart_rate")) queries.push((async () => {
    const { data } = await h(s).from("heartrate_daily").select("date,resting_hr,min_hr,max_hr,last_7d_avg_resting").gte("date", start).lte("date", end).order("date");
    result.heart_rate = data;
  })());
  if (metrics.includes("sleep")) queries.push((async () => {
    const { data } = await h(s).from("sleep_daily").select("date,sleep_start,sleep_end,duration_seconds,deep_seconds,light_seconds,rem_seconds,awake_seconds,sleep_score,sleep_quality,avg_spo2,avg_respiration,avg_stress").gte("date", start).lte("date", end).order("date");
    result.sleep = (data ?? []).map((d) => ({ ...d, duration_hours: d.duration_seconds ? +(d.duration_seconds / 3600).toFixed(1) : null }));
  })());
  if (metrics.includes("stress")) queries.push((async () => {
    const { data } = await h(s).from("stress_daily").select("date,overall_stress_level,rest_stress_duration,low_stress_duration,medium_stress_duration,high_stress_duration").gte("date", start).lte("date", end).order("date");
    result.stress = data;
  })());
  if (metrics.includes("body_battery")) queries.push((async () => {
    const { data } = await h(s).from("daily_summary").select("date,body_battery_charged,body_battery_drained,average_stress,total_steps").gte("date", start).lte("date", end).order("date");
    result.body_battery = (data ?? []).map((d) => ({ ...d, net: (d.body_battery_charged ?? 0) - (d.body_battery_drained ?? 0) }));
  })());
  if (metrics.includes("respiration")) queries.push((async () => {
    const { data } = await h(s).from("respiration_daily").select("date,avg_waking,avg_sleeping,highest,lowest").gte("date", start).lte("date", end).order("date");
    result.respiration = data;
  })());
  if (metrics.includes("spo2")) queries.push((async () => {
    const { data } = await h(s).from("spo2_daily").select("date,avg_spo2,lowest_spo2,latest_spo2").gte("date", start).lte("date", end).order("date");
    result.spo2 = data;
  })());

  await Promise.all(queries);
  return text(result);
}

// ─── get_garmin_activities ───────────────────────────────────

async function getGarminActivities(s: SupabaseClient, args: Args): Promise<Content[]> {
  const start = args.start_date as string;
  const end = args.end_date as string;
  const actType = args.activity_type as string ?? "all";

  let q = h(s).from("activities").select("*").gte("activity_date", start).lte("activity_date", end).order("start_time_local", { ascending: false });
  if (actType !== "all") q = q.eq("type", actType);

  const { data, error } = await q;
  if (error) return err(error.message);
  return text({ range: { start, end }, total: data?.length ?? 0, activities: data });
}

// ─── get_cycle_history ───────────────────────────────────────

async function getCycleHistory(s: SupabaseClient, args: Args): Promise<Content[]> {
  const numCycles = (args.num_cycles as number) ?? 3;
  const { data } = await h(s).from("menstrual_cycle").select("date,phase,phase_name,day_in_cycle,cycle_start_date,predicted_cycle_length,is_predicted").order("date", { ascending: false }).limit(numCycles * 35);

  if (!data?.length) return text({ message: "No cycle data found" });

  const cycles = new Map<string, unknown[]>();
  for (const row of data) {
    const key = row.cycle_start_date ?? "unknown";
    if (!cycles.has(key)) cycles.set(key, []);
    cycles.get(key)!.push(row);
  }

  const cycleList = [...cycles.entries()].slice(0, numCycles).map(([startDate, days]) => ({
    cycle_start_date: startDate,
    days_tracked: days.length,
    predicted_length: (days[0] as Record<string, unknown>).predicted_cycle_length,
    phases: [...new Set(days.map((d: Record<string, unknown>) => d.phase_name))],
  }));

  return text({ num_cycles: cycleList.length, cycles: cycleList });
}

// ─── get_working_weights ─────────────────────────────────────

async function getWorkingWeights(s: SupabaseClient, args: Args): Promise<Content[]> {
  const filterType = args.filter_type as string;
  const filterValue = args.filter_value as string;
  const includeHistory = args.include_history === true;

  let exerciseIds: string[] = [];

  if (filterType === "session_type") {
    const muscles = SESSION_MUSCLES[filterValue];
    if (!muscles) return err(`Unknown session type: ${filterValue}. Valid: ${Object.keys(SESSION_MUSCLES).join(", ")}`);
    const { data: exs } = await t(s).from("exercise_library").select("id,name,muscle_group,secondary_muscles,equipment,is_seated,form_cues,notes").eq("is_active", true);
    const matching = (exs ?? []).filter((e) => {
      if (muscles.includes(e.muscle_group)) return true;
      if (e.secondary_muscles?.some((m: string) => muscles.includes(m))) return true;
      return false;
    });
    exerciseIds = matching.map((e) => e.id);
    if (!exerciseIds.length) return text({ message: `No exercises found for ${filterValue}` });
  } else if (filterType === "muscle_group") {
    const { data: exs } = await t(s).from("exercise_library").select("id").eq("is_active", true).eq("muscle_group", filterValue);
    exerciseIds = (exs ?? []).map((e) => e.id);
  } else if (filterType === "exercise") {
    const { data: ex } = await t(s).from("exercise_library").select("id").eq("name", filterValue).maybeSingle();
    if (!ex) return err(`Exercise not found: ${filterValue}`);
    exerciseIds = [ex.id];
  }

  const { data: weights } = await t(s).from("working_weights").select("*, exercise:exercise_id(id,name,muscle_group,equipment,is_seated,form_cues,notes,rating)").in("exercise_id", exerciseIds);

  const exercises = (weights ?? []).map((w) => {
    const ex = w.exercise as Record<string, unknown>;
    return {
      exercise_id: w.exercise_id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      equipment: ex.equipment,
      is_seated: ex.is_seated,
      form_cues: ex.form_cues,
      current_weight: w.current_weight,
      current_reps: w.current_reps,
      current_sets: w.current_sets,
      best_weight: w.best_weight,
      best_reps: w.best_reps,
      best_date: w.best_date,
      best_cycle_phase: w.best_cycle_phase,
      next_weight_target: w.next_weight_target,
      progression_note: w.progression_note,
      is_per_hand: w.is_per_hand,
    };
  });

  if (includeHistory) {
    for (const ex of exercises) {
      const { data: results } = await t(s).from("exercise_results").select("workout_date,set_number,set_type,weight,reps,rpe,notes").eq("exercise_id", ex.exercise_id).order("workout_date", { ascending: false }).order("set_number").limit(25);

      const grouped = new Map<string, unknown[]>();
      for (const r of results ?? []) {
        const key = r.workout_date;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push({ set: r.set_number, type: r.set_type, weight: r.weight, reps: r.reps, rpe: r.rpe, notes: r.notes });
      }
      (ex as Record<string, unknown>).recent_history = [...grouped.entries()].slice(0, 5).map(([date, sets]) => ({ date, sets }));
    }
  }

  return text({ filter: { type: filterType, value: filterValue }, exercises });
}

// ─── get_exercise_history ────────────────────────────────────

async function getExerciseHistory(s: SupabaseClient, args: Args): Promise<Content[]> {
  const name = args.exercise_name as string;
  const lookback = (args.lookback_days as number) ?? 60;
  const start = daysAgo(lookback);

  const { data: ex } = await t(s).from("exercise_library").select("*").eq("name", name).maybeSingle();
  if (!ex) return err(`Exercise not found: ${name}`);

  const { data: ww } = await t(s).from("working_weights").select("*").eq("exercise_id", ex.id).maybeSingle();
  const { data: results } = await t(s).from("exercise_results").select("workout_date,set_number,set_type,weight,reps,rpe,notes").eq("exercise_id", ex.id).gte("workout_date", start).order("workout_date").order("set_number");

  const grouped = new Map<string, unknown[]>();
  for (const r of results ?? []) {
    if (!grouped.has(r.workout_date)) grouped.set(r.workout_date, []);
    grouped.get(r.workout_date)!.push(r);
  }

  const sessions = [...grouped.entries()].map(([date, sets]) => {
    const workingSets = sets.filter((s: Record<string, unknown>) => s.set_type === "working" || s.set_type === "test_set");
    const bestSet = workingSets.reduce((best: Record<string, unknown> | null, s: Record<string, unknown>) => {
      if (!best || (s.weight as number ?? 0) > (best.weight as number ?? 0)) return s;
      if ((s.weight as number) === (best.weight as number) && (s.reps as number ?? 0) > (best.reps as number ?? 0)) return s;
      return best;
    }, null);
    const volume = workingSets.reduce((sum: number, s: Record<string, unknown>) => sum + (s.weight as number ?? 0) * (s.reps as number ?? 0), 0);
    return { date, sets, best_set: bestSet, total_volume: Math.round(volume) };
  });

  return text({
    exercise: { name: ex.name, muscle_group: ex.muscle_group, equipment: ex.equipment, discovered_date: ex.discovered_date, current_weight: ww?.current_weight, starting_weight: ww?.previous_weight },
    sessions,
  });
}

// ─── get_exercise_library ────────────────────────────────────

async function getExerciseLibrary(s: SupabaseClient, args: Args): Promise<Content[]> {
  const filter = (args.filter as string) ?? "active";
  const muscleGroup = args.muscle_group as string | undefined;
  const seatedOnly = args.seated_only === true;

  let q = t(s).from("exercise_library").select("id,name,muscle_group,secondary_muscles,equipment,movement_type,is_seated,is_active,drop_reason,form_cues,notes,rating").order("muscle_group").order("name");

  if (filter === "active") q = q.eq("is_active", true);
  else if (filter === "dropped") q = q.eq("is_active", false);
  if (muscleGroup) q = q.eq("muscle_group", muscleGroup);
  if (seatedOnly) q = q.eq("is_seated", true);

  const { data, error } = await q;
  if (error) return err(error.message);
  return text({ filter, total: data?.length ?? 0, exercises: data });
}

// ─── get_body_scans ──────────────────────────────────────────

async function getBodyScans(s: SupabaseClient, args: Args): Promise<Content[]> {
  const includeInvalid = args.include_invalid === true;
  let q = t(s).from("body_scans").select("*").order("scan_date");
  if (!includeInvalid) q = q.eq("is_valid_comparison", true);

  const { data, error } = await q;
  if (error) return err(error.message);
  if (!data?.length) return text({ message: "No body scans found" });

  const scans = data.map((scan, i) => {
    const result: Record<string, unknown> = { ...scan };
    if (i > 0) {
      const prev = data[i - 1];
      result.deltas = {
        weight: delta(scan.weight, prev.weight),
        lean_body_mass: delta(scan.lean_body_mass, prev.lean_body_mass),
        skeletal_muscle_mass: delta(scan.skeletal_muscle_mass, prev.skeletal_muscle_mass),
        body_fat_mass: delta(scan.body_fat_mass, prev.body_fat_mass),
        body_fat_pct: delta(scan.body_fat_pct, prev.body_fat_pct),
      };
    }
    return result;
  });

  return text({ total: scans.length, scans });
}

function delta(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null) return null;
  return +(curr - prev).toFixed(2);
}

// ─── create_workout_plan ─────────────────────────────────────

async function createWorkoutPlan(s: SupabaseClient, args: Args): Promise<Content[]> {
  const replaceExisting = args.replace_existing === true;

  // RC2: Check for existing active plan
  const { data: existing } = await t(s)
    .from("workout_plans")
    .select("id, session_type, status, coach_notes, created_at, planned_exercises(exercise_order, exercise:exercise_id(name))")
    .eq("workout_date", args.workout_date)
    .eq("session_type", args.session_type)
    .in("status", ["planned", "partial"])
    .maybeSingle();

  if (existing && !replaceExisting) {
    const exerciseNames = ((existing.planned_exercises ?? []) as Record<string, unknown>[])
      .sort((a, b) => (a.exercise_order as number) - (b.exercise_order as number))
      .map((pe) => (pe.exercise as Record<string, unknown>)?.name);
    return text({
      error: "plan_exists",
      message: `An active ${args.session_type} plan already exists for ${args.workout_date}. Pass replace_existing: true to supersede it (confirm with user first).`,
      existing_plan_id: existing.id,
      existing_plan_status: existing.status,
      existing_plan_created_at: existing.created_at,
      existing_coach_notes_preview: existing.coach_notes?.substring(0, 200) ?? null,
      existing_exercises: exerciseNames,
    });
  }

  if (existing && replaceExisting) {
    await t(s).from("workout_plans").update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  }

  const { data: plan, error: planErr } = await t(s).from("workout_plans").insert({
    workout_date: args.workout_date,
    session_type: args.session_type,
    cycle_day: args.cycle_day ?? null,
    cycle_phase: args.cycle_phase ?? null,
    training_mode: args.training_mode ?? null,
    rir_target: args.rir_target ?? null,
    coach_notes: args.coach_notes ?? null,
    status: "planned",
  }).select("id").single();

  if (planErr) return err(`Failed to create plan: ${planErr.message}`);

  const exercises = args.exercises as Record<string, unknown>[];
  const planId = plan.id;
  let created = 0;

  for (const ex of exercises) {
    let { data: lib } = await t(s).from("exercise_library").select("id").eq("name", ex.exercise_name).maybeSingle();
    if (!lib) {
      const { data: newEx } = await t(s).from("exercise_library").insert({
        name: ex.exercise_name, muscle_group: "uncategorized", equipment: "unknown", movement_type: "isolation",
      }).select("id").single();
      lib = newEx;
    }

    const { error: exErr } = await t(s).from("planned_exercises").insert({
      workout_plan_id: planId,
      exercise_id: lib!.id,
      exercise_order: ex.exercise_order ?? created + 1,
      layer: ex.layer ?? 1,
      warmup_sets: ex.warmup_sets ?? null,
      goal_weight: ex.goal_weight ?? null,
      goal_reps: ex.goal_reps ?? null,
      goal_sets: ex.goal_sets ?? null,
      previous_weight: ex.previous_weight ?? null,
      previous_reps: ex.previous_reps ?? null,
      previous_best_note: ex.previous_best_note ?? null,
      coaching_note: ex.coaching_note ?? null,
      rest_seconds: ex.rest_seconds ?? null,
      is_per_hand: ex.is_per_hand ?? false,
    });
    if (!exErr) created++;
  }

  return text({ workout_plan_id: planId, exercises_created: created, workout_date: args.workout_date, session_type: args.session_type });
}

// ─── log_exercise_result ─────────────────────────────────────

async function logExerciseResult(s: SupabaseClient, args: Args): Promise<Content[]> {
  const exerciseName = args.exercise_name as string;
  const { data: ex } = await t(s).from("exercise_library").select("id").eq("name", exerciseName).maybeSingle();
  if (!ex) return err(`Exercise not found: ${exerciseName}`);

  const sets = args.sets as Record<string, unknown>[];
  const planId = args.workout_plan_id as string | undefined;
  const workoutDate = args.workout_date as string;
  const loggedBy = (args.logged_by as string) ?? "claude";
  const isPerHand = args.is_per_hand === true;

  let plannedExId: string | null = null;
  if (planId) {
    const { data: pe } = await t(s).from("planned_exercises").select("id").eq("workout_plan_id", planId).eq("exercise_id", ex.id).maybeSingle();
    plannedExId = pe?.id ?? null;
  }

  const rows = sets.map((set) => ({
    planned_exercise_id: plannedExId,
    exercise_id: ex.id,
    workout_plan_id: planId ?? null,
    workout_date: workoutDate,
    set_number: set.set_number,
    set_type: set.type ?? "working",
    weight: set.weight ?? null,
    reps: set.reps,
    rpe: set.rpe ?? null,
    is_per_hand: isPerHand,
    notes: set.notes ?? null,
    logged_by: loggedBy,
  }));

  const { error } = await t(s).from("exercise_results").insert(rows);
  if (error) return err(`Failed to log results: ${error.message}`);

  const workingSets = sets.filter((set) => set.type === "working" || set.type === "test_set");
  const bestSet = workingSets.reduce((best: Record<string, unknown> | null, set: Record<string, unknown>) => {
    if (!best) return set;
    if ((set.weight as number ?? 0) > (best.weight as number ?? 0)) return set;
    if ((set.weight as number) === (best.weight as number) && (set.reps as number ?? 0) > (best.reps as number ?? 0)) return set;
    return best;
  }, null);

  const totalVolume = workingSets.reduce((sum, set) => sum + (set.weight as number ?? 0) * (set.reps as number ?? 0), 0);

  const { data: ww } = await t(s).from("working_weights").select("best_weight,best_reps").eq("exercise_id", ex.id).maybeSingle();
  const isPR = bestSet && ww && (bestSet.weight as number ?? 0) > (ww.best_weight ?? 0);

  return text({
    exercise: exerciseName,
    sets_logged: rows.length,
    best_set: bestSet,
    total_volume: Math.round(totalVolume),
    is_pr: isPR ?? false,
  });
}

// ─── update_working_weight ───────────────────────────────────

async function updateWorkingWeight(s: SupabaseClient, args: Args): Promise<Content[]> {
  const name = args.exercise_name as string;
  const { data: ex } = await t(s).from("exercise_library").select("id").eq("name", name).maybeSingle();
  if (!ex) return err(`Exercise not found: ${name}`);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (args.current_weight !== undefined) update.current_weight = args.current_weight;
  if (args.current_reps !== undefined) update.current_reps = args.current_reps;
  if (args.current_sets !== undefined) update.current_sets = args.current_sets;
  if (args.best_weight !== undefined) update.best_weight = args.best_weight;
  if (args.best_reps !== undefined) update.best_reps = args.best_reps;
  if (args.best_date !== undefined) update.best_date = args.best_date;
  if (args.best_cycle_day !== undefined) update.best_cycle_day = args.best_cycle_day;
  if (args.best_cycle_phase !== undefined) update.best_cycle_phase = args.best_cycle_phase;
  if (args.next_weight_target !== undefined) update.next_weight_target = args.next_weight_target;
  if (args.progression_note !== undefined) update.progression_note = args.progression_note;

  const { error } = await t(s).from("working_weights").update(update).eq("exercise_id", ex.id);
  if (error) return err(`Failed to update: ${error.message}`);

  return text({ exercise: name, updated_fields: Object.keys(update).filter((k) => k !== "updated_at") });
}

// ─── complete_workout ────────────────────────────────────────

async function completeWorkout(s: SupabaseClient, args: Args): Promise<Content[]> {
  const planId = args.workout_plan_id as string;
  const status = args.status as string;

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "completed" || status === "partial") update.completed_at = new Date().toISOString();
  if (args.skip_reason) update.skip_reason = args.skip_reason;
  if (args.completion_notes) update.completion_notes = args.completion_notes;

  const { error } = await t(s).from("workout_plans").update(update).eq("id", planId);
  if (error) return err(`Failed to complete workout: ${error.message}`);

  return text({ workout_plan_id: planId, status });
}

// ─── log_run ─────────────────────────────────────────────────

async function logRun(s: SupabaseClient, args: Args): Promise<Content[]> {
  const { data, error } = await t(s).from("running_log").insert({
    run_date: args.run_date,
    cycle_day: args.cycle_day ?? null,
    cycle_phase: args.cycle_phase ?? null,
    total_distance_miles: args.total_distance_miles ?? null,
    total_running_miles: args.total_running_miles ?? null,
    total_time_minutes: args.total_time_minutes ?? null,
    total_elevation_ft: args.total_elevation_ft ?? null,
    longest_continuous_miles: args.longest_continuous_miles ?? null,
    segments: args.segments ?? [],
    hr_diagnostic: args.hr_diagnostic ?? null,
    weather_notes: args.weather_notes ?? null,
    felt_good: args.felt_good ?? null,
    wanted_more: args.wanted_more ?? null,
    right_knee_status: args.right_knee_status ?? null,
    notes: args.notes ?? null,
    garmin_activity_ids: args.garmin_activity_ids ?? null,
  }).select("id").single();

  if (error) return err(`Failed to log run: ${error.message}`);
  return text({ run_id: data.id, run_date: args.run_date, distance_miles: args.total_distance_miles });
}

// ─── log_body_scan ───────────────────────────────────────────

async function logBodyScan(s: SupabaseClient, args: Args): Promise<Content[]> {
  const row: Record<string, unknown> = { scan_date: args.scan_date, scanner_type: args.scanner_type };
  const fields = ["cycle_day", "cycle_phase", "scanner_location", "weight", "height_inches", "lean_body_mass",
    "skeletal_muscle_mass", "body_fat_mass", "body_fat_pct", "visceral_fat_level", "visceral_fat_area",
    "bmr", "total_body_water", "protein", "mineral", "icf", "ecf", "bio_age",
    "left_arm_lean", "right_arm_lean", "left_leg_lean", "right_leg_lean", "torso_lean",
    "left_arm_fat", "right_arm_fat", "left_leg_fat", "right_leg_fat", "torso_fat",
    "scan_conditions", "is_valid_comparison", "invalid_reason", "raw_data"];
  for (const f of fields) if (args[f] !== undefined) row[f] = args[f];

  const { data, error } = await t(s).from("body_scans").insert(row).select("id").single();
  if (error) return err(`Failed to log scan: ${error.message}`);
  return text({ scan_id: data.id, scan_date: args.scan_date });
}

// ─── manage_exercise ─────────────────────────────────────────

async function manageExercise(s: SupabaseClient, args: Args): Promise<Content[]> {
  const action = args.action as string;
  const name = args.exercise_name as string;

  if (action === "add") {
    if (!args.muscle_group || !args.equipment) return err("muscle_group and equipment required for add");
    const { data, error } = await t(s).from("exercise_library").insert({
      name, muscle_group: args.muscle_group, secondary_muscles: args.secondary_muscles ?? null,
      equipment: args.equipment, movement_type: args.movement_type ?? "isolation",
      is_seated: args.is_seated ?? false, form_cues: args.form_cues ?? null,
      rating: args.rating ?? null, notes: args.notes ?? null, discovered_date: today(),
    }).select("id").single();
    if (error) return err(`Failed to add: ${error.message}`);
    return text({ action: "added", exercise: name, id: data.id });
  }

  const { data: ex } = await t(s).from("exercise_library").select("id").eq("name", name).maybeSingle();
  if (!ex) return err(`Exercise not found: ${name}`);

  if (action === "drop") {
    const { error } = await t(s).from("exercise_library").update({
      is_active: false, drop_reason: args.drop_reason ?? null, drop_date: today(), updated_at: new Date().toISOString(),
    }).eq("id", ex.id);
    if (error) return err(error.message);
    return text({ action: "dropped", exercise: name, reason: args.drop_reason });
  }

  if (action === "reactivate") {
    const { error } = await t(s).from("exercise_library").update({
      is_active: true, drop_reason: null, drop_date: null, updated_at: new Date().toISOString(),
    }).eq("id", ex.id);
    if (error) return err(error.message);
    return text({ action: "reactivated", exercise: name });
  }

  if (action === "update") {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields = ["muscle_group", "secondary_muscles", "equipment", "movement_type", "is_seated", "form_cues", "rating", "notes"];
    for (const f of fields) if (args[f] !== undefined) update[f] = args[f];
    const { error } = await t(s).from("exercise_library").update(update).eq("id", ex.id);
    if (error) return err(error.message);
    return text({ action: "updated", exercise: name, fields: Object.keys(update).filter((k) => k !== "updated_at") });
  }

  return err(`Unknown action: ${action}`);
}

// ─── update_schedule ─────────────────────────────────────────

async function updateSchedule(s: SupabaseClient, args: Args): Promise<Content[]> {
  const dow = args.day_of_week as number;
  const sessionType = args.session_type as string;

  const { error } = await t(s).from("week_schedule").upsert({
    day_of_week: dow, session_type: sessionType, notes: args.notes ?? null,
  }, { onConflict: "day_of_week" });

  if (error) return err(`Failed to update schedule: ${error.message}`);
  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return text({ day: dayNames[dow] ?? dow, session_type: sessionType });
}

// ─── Helpers ─────────────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split("T")[0];
}

function getWeekEnd(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay() + 7);
  return d.toISOString().split("T")[0];
}
