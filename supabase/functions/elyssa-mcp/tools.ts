export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export const TOOLS: ToolDef[] = [
  // ─── Coaching Mode ─────────────────────────────────────────
  {
    name: "activate_mode",
    description:
      "Activate a coaching mode. Returns a system prompt that teaches Claude how to coach Elyssa. Modes: 'elyssa_coach' (full fitness coaching), 'run_coach' (running-specific), 'admin' (data/system management for Abram). Call at the start of any training/health conversation.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["elyssa_coach", "run_coach", "admin"],
        },
      },
      required: ["mode"],
    },
  },

  // ─── Context & Health Reads ────────────────────────────────
  {
    name: "get_training_context",
    description:
      "The 'start of every coaching interaction' tool. Returns cycle day/phase, today's health metrics, 7-day health trend, recovery flags, this week's completed and planned workouts, and the weekly schedule. One call replaces multiple lookups. **If `today_existing_plan` is non-null, a fully-designed workout plan already exists for today — present it to the user instead of calling `create_workout_plan`. Only create a new plan if the user explicitly requests one.**",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
    },
  },
  {
    name: "get_health_metrics",
    description:
      "Pull detailed health data for a date range. Supports filtering by metric type: heart_rate, sleep, stress, body_battery, respiration, spo2.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        metrics: {
          type: "array",
          items: { type: "string", enum: ["heart_rate", "sleep", "stress", "body_battery", "respiration", "spo2"] },
          description: "Optional filter. Defaults to all.",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_garmin_activities",
    description:
      "Pull Garmin activity data. Covers gym sessions, runs, walks.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        activity_type: {
          type: "string",
          enum: ["all", "running", "walking", "other", "treadmill_running", "hiit", "indoor_cardio"],
          description: "Filter by type. Defaults to all.",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_cycle_history",
    description:
      "Historical menstrual cycle data for predicting future phases and analyzing patterns.",
    inputSchema: {
      type: "object",
      properties: {
        num_cycles: { type: "number", description: "Number of recent cycles. Default 3." },
      },
    },
  },

  // ─── Training Reads ────────────────────────────────────────
  {
    name: "get_working_weights",
    description:
      "Pull current working weights for a session type, muscle group, or specific exercise. Optionally includes last 5 logged performances per exercise.",
    inputSchema: {
      type: "object",
      properties: {
        filter_type: {
          type: "string",
          enum: ["session_type", "muscle_group", "exercise"],
        },
        filter_value: {
          type: "string",
          description: "e.g. 'lower_a', 'quads', 'Leg Extension'",
        },
        include_history: {
          type: "boolean",
          description: "Include last 5 logged performances per exercise. Default false.",
        },
      },
      required: ["filter_type", "filter_value"],
    },
  },
  {
    name: "get_exercise_history",
    description:
      "Deep dive into one exercise's progression over time. Shows cycle-phase correlation and volume trends.",
    inputSchema: {
      type: "object",
      properties: {
        exercise_name: { type: "string" },
        lookback_days: { type: "number", description: "Default 60." },
      },
      required: ["exercise_name"],
    },
  },
  {
    name: "get_exercise_library",
    description:
      "Browse the exercise catalog. Filter by active/dropped status, muscle group, or seated-only (POTS filter).",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["active", "dropped", "all"], description: "Default active." },
        muscle_group: { type: "string" },
        seated_only: { type: "boolean", description: "POTS safety filter. Default false." },
      },
    },
  },
  {
    name: "get_body_scans",
    description:
      "Return body composition scans with computed deltas between consecutive valid scans.",
    inputSchema: {
      type: "object",
      properties: {
        include_invalid: { type: "boolean", description: "Include scans flagged as invalid comparisons. Default false." },
      },
    },
  },

  // ─── Training Writes ───────────────────────────────────────
  {
    name: "create_workout_plan",
    description:
      "Save a complete workout plan designed by Claude. Creates the plan and all planned exercises. The web app reads this to display the workout at the gym. **Will reject with error if an active plan already exists for the same (workout_date, session_type) — returns the existing plan details so you can present it. Pass `replace_existing: true` to supersede the old plan and create a new one. Always confirm with the user before replacing.**",
    inputSchema: {
      type: "object",
      properties: {
        workout_date: { type: "string" },
        session_type: { type: "string", enum: ["lower_a", "lower_b", "upper_a", "upper_b", "run", "rest", "deload"] },
        replace_existing: { type: "boolean", description: "If true, supersede any existing plan for this date+session. Default false." },
        cycle_day: { type: "number" },
        cycle_phase: { type: "string", enum: ["menstrual", "follicular", "ovulatory", "luteal", "period_flu"] },
        training_mode: { type: "string", enum: ["performance", "survival", "ramp_up"] },
        rir_target: { type: "string", description: "e.g. '1-2', '2-3', '3+'" },
        coach_notes: { type: "string" },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              exercise_name: { type: "string" },
              exercise_order: { type: "number" },
              layer: { type: "number", description: "1=essential, 2=bonus" },
              warmup_sets: { type: "array", items: { type: "object", properties: { weight: { type: "number" }, reps: { type: "number" } } } },
              goal_weight: { type: "number" },
              goal_reps: { type: "number" },
              goal_sets: { type: "number" },
              previous_weight: { type: "number" },
              previous_reps: { type: "number" },
              previous_best_note: { type: "string" },
              coaching_note: { type: "string" },
              rest_seconds: { type: "number" },
              is_per_hand: { type: "boolean" },
            },
            required: ["exercise_name", "exercise_order"],
          },
        },
      },
      required: ["workout_date", "session_type", "exercises"],
    },
  },
  {
    name: "log_exercise_result",
    description:
      "Record what Elyssa actually did for an exercise. One call per exercise, with all sets. Called by Claude after she reports results or by the web app.",
    inputSchema: {
      type: "object",
      properties: {
        workout_plan_id: { type: "string", description: "Optional, links to planned workout." },
        workout_date: { type: "string" },
        exercise_name: { type: "string" },
        sets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              set_number: { type: "number" },
              type: { type: "string", enum: ["warmup", "working", "drop_set", "test_set", "burn_set"] },
              weight: { type: "number" },
              reps: { type: "number" },
              rpe: { type: "number" },
              notes: { type: "string" },
            },
            required: ["set_number", "type", "reps"],
          },
        },
        is_per_hand: { type: "boolean" },
        logged_by: { type: "string", enum: ["claude", "web_app"], description: "Default claude." },
      },
      required: ["workout_date", "exercise_name", "sets"],
    },
  },
  {
    name: "update_working_weight",
    description:
      "Update the working weight for an exercise after analyzing results. Called by Claude after reviewing logged sets.",
    inputSchema: {
      type: "object",
      properties: {
        exercise_name: { type: "string" },
        current_weight: { type: "number" },
        current_reps: { type: "number" },
        current_sets: { type: "number" },
        best_weight: { type: "number" },
        best_reps: { type: "number" },
        best_date: { type: "string" },
        best_cycle_day: { type: "number" },
        best_cycle_phase: { type: "string" },
        next_weight_target: { type: "number" },
        progression_note: { type: "string" },
      },
      required: ["exercise_name"],
    },
  },
  {
    name: "complete_workout",
    description:
      "Close out a workout plan with a status and optional notes.",
    inputSchema: {
      type: "object",
      properties: {
        workout_plan_id: { type: "string" },
        status: { type: "string", enum: ["completed", "partial", "skipped"] },
        skip_reason: { type: "string" },
        completion_notes: { type: "string" },
      },
      required: ["workout_plan_id", "status"],
    },
  },
  {
    name: "log_run",
    description:
      "Save structured running data with segment breakdowns. Links to Garmin activities.",
    inputSchema: {
      type: "object",
      properties: {
        run_date: { type: "string" },
        cycle_day: { type: "number" },
        cycle_phase: { type: "string" },
        total_distance_miles: { type: "number" },
        total_running_miles: { type: "number" },
        total_time_minutes: { type: "number" },
        total_elevation_ft: { type: "number" },
        longest_continuous_miles: { type: "number" },
        segments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["run", "walk", "rest"] },
              miles: { type: "number" },
              pace: { type: "string" },
              avg_hr: { type: "number" },
              max_hr: { type: "number" },
              elevation_ft: { type: "number" },
              duration_min: { type: "number" },
              notes: { type: "string" },
            },
          },
        },
        hr_diagnostic: { type: "string", enum: ["normal", "elevated", "flu_inflated"] },
        weather_notes: { type: "string" },
        felt_good: { type: "boolean" },
        wanted_more: { type: "boolean" },
        right_knee_status: { type: "string" },
        notes: { type: "string" },
        garmin_activity_ids: { type: "array", items: { type: "number" } },
      },
      required: ["run_date", "segments"],
    },
  },
  {
    name: "log_body_scan",
    description: "Save a body composition scan with full context and scan conditions.",
    inputSchema: {
      type: "object",
      properties: {
        scan_date: { type: "string" },
        cycle_day: { type: "number" },
        cycle_phase: { type: "string" },
        scanner_type: { type: "string" },
        scanner_location: { type: "string" },
        weight: { type: "number" },
        lean_body_mass: { type: "number" },
        skeletal_muscle_mass: { type: "number" },
        body_fat_mass: { type: "number" },
        body_fat_pct: { type: "number" },
        visceral_fat_level: { type: "number" },
        bmr: { type: "number" },
        total_body_water: { type: "number" },
        bio_age: { type: "number" },
        scan_conditions: { type: "object", description: "{pre_workout, hydrated, fasted, time_of_day, notes}" },
        is_valid_comparison: { type: "boolean" },
        invalid_reason: { type: "string" },
        raw_data: { type: "object" },
      },
      required: ["scan_date", "scanner_type"],
    },
  },
  {
    name: "manage_exercise",
    description:
      "Add, update, drop, or reactivate an exercise in the library.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "update", "drop", "reactivate"] },
        exercise_name: { type: "string" },
        muscle_group: { type: "string" },
        secondary_muscles: { type: "array", items: { type: "string" } },
        equipment: { type: "string" },
        movement_type: { type: "string", enum: ["compound", "isolation", "cardio", "core", "carry"] },
        is_seated: { type: "boolean" },
        form_cues: { type: "array", items: { type: "string" } },
        rating: { type: "number" },
        notes: { type: "string" },
        drop_reason: { type: "string" },
      },
      required: ["action", "exercise_name"],
    },
  },
  {
    name: "update_schedule",
    description: "Modify the weekly schedule template.",
    inputSchema: {
      type: "object",
      properties: {
        day_of_week: { type: "number", description: "1=Monday, 7=Sunday" },
        session_type: { type: "string" },
        notes: { type: "string" },
      },
      required: ["day_of_week", "session_type"],
    },
  },
];
