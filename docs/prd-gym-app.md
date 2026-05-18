# Elyssa Gym Companion — Product Requirements Document

## Problem

Claude designs Elyssa's workouts via MCP and stores them in `training.workout_plans` + `training.planned_exercises`. She needs a way to **see the plan at the gym** and **log what she actually did** without talking to Claude mid-workout.

## User

Elyssa Himmer. Phone at the gym, between sets, sometimes dizzy (POTS). Dead simple, big tap targets, one-hand operable.

## Core Loop

```
Claude creates workout plan (MCP)
  → Elyssa opens bookmark, sees today's workout
  → She taps in actual weight/reps/RPE per set
  → App writes results to training.exercise_results
  → Claude reads results next session, adjusts programming
```

## Architecture: React Router 7 SPA → Supabase Storage

A standalone React Router 7 app in SPA mode (`ssr: false`). Builds to static files via Vite. Uploaded to a Supabase Storage public bucket. No server, no SSR, no edge functions involved.

### Build & Deploy

```bash
cd gym
npm install
npm run build          # → gym/build/client/ (static HTML + JS + CSS)
# Upload build/client/* to Supabase storage bucket "gym-app"
```

**URL**: `https://vssciljnilrgqcrnandl.supabase.co/storage/v1/object/public/gym-app/index.html`

Elyssa bookmarks this or adds to home screen. Updates = rebuild + re-upload.

### Why RR7 SPA

- TypeScript throughout — typed Supabase queries, no runtime surprises
- File-based routing if we ever add screens
- Same React 19 / Supabase JS versions as the existing app
- Builds to static files — same deploy story as a single HTML file
- Component model makes the exercise card → logging sheet flow clean

### Why Not the Existing App (`app/`)

The existing app is SSR with auth, dashboards, interviews, Garmin settings — a different product for a different user (Abram/admin). The gym companion is a single-purpose phone tool for Elyssa. Separate app, separate concerns.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Router 7 (SPA mode, `ssr: false`) |
| Build | Vite (comes with RR7) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Data | `@supabase/supabase-js` (browser client, anon key) |
| Hosting | Supabase Storage (public bucket) |

No state management library. Supabase client + React state + a few custom hooks is enough for this scope.

## Screens

### 1. Today's Workout (Index Route `/`)

Default view when she opens the app.

**Header**:
- Session type badge (e.g., "Lower A")
- Cycle phase pill with color (e.g., green "Follicular Day 9")
- Training mode label (e.g., "Performance")
- Coach notes from Claude if present

**Exercise list** — ordered cards, one per planned exercise:

| Field | Source | Display |
|---|---|---|
| Exercise name | `exercise_library.name` | Bold title |
| Muscle group | `exercise_library.muscle_group` | Small tag |
| Layer | `planned_exercises.layer` | L1 blue / L2 gray badge |
| Goal | `planned_exercises.goal_weight / goal_reps / goal_sets` | "170 lbs × 12 × 3" |
| Previous | `planned_exercises.previous_weight / previous_reps` | "160 × 12 — May 14" |
| Warmup sets | `planned_exercises.warmup_sets` | Collapsible list |
| Coaching note | `planned_exercises.coaching_note` | Italic text |
| Form cues | `exercise_library.form_cues` | Expandable |
| Per-hand | `planned_exercises.is_per_hand` | "/hand" suffix on weight |
| Status | Derived from logged results | Gray → Yellow → Green |

**Tap a card** → navigate to log view for that exercise.

**No plan state**: If no `workout_plans` row exists for today with status `planned` or `partial`:
- Show weekly schedule with today highlighted
- Message: "No workout planned yet — ask Claude to build one"

**Complete button**: Appears at bottom when at least one exercise has logged results. Navigates to completion screen.

### 2. Log Exercise (`/log/:exerciseId`)

Full-screen view for logging one exercise. Optimized for fast input between sets.

**Layout**:
- Exercise name + goal at top
- Pre-populated set rows (one per `goal_sets`)
- Each row:
  - Set number + type pill (working / warmup / drop_set / burn_set)
  - **Weight** — large numeric input, pre-filled with `goal_weight`, step buttons (±5 or ±2.5)
  - **Reps** — large numeric input, supports decimals (11.5)
  - **RPE** — smaller input, optional, supports decimals (7.8)
- **+ Add Set** button below rows
- **Save** button — writes all sets to `training.exercise_results`

**Input design**:
- Min 48px height on all inputs
- Numeric keyboard (`inputmode="decimal"`)
- Pre-fill weight from goal, reps blank (she enters actual)
- Weight step buttons: ±5 for machines, ±2.5 for dumbbells (based on equipment type)

**After save**: Navigate back to today's workout. Card shows green status with actual numbers.

### 3. Complete Workout (`/complete`)

Summary + close-out screen:
- List of exercises with actual vs. goal (condensed)
- Total volume (sum of weight × reps across all working sets)
- PR flags if any set exceeded `working_weights.best_weight`
- **Status selector**: Completed / Partial / Skipped
- **Notes** text area (optional)
- **Done** button → updates `workout_plans.status`, `completed_at`, `completion_notes`

After done: return to index showing the completed workout in read-only state.

### 4. History (`/history`)

Simple list of past workouts (last 14 days):
- Date, session type, status badge, exercise count
- Tap to expand: exercises with logged sets (read-only)
- No editing, no deep analytics — that's Claude's job

## Data Access

### Supabase Client Setup

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vssciljnilrgqcrnandl.supabase.co',
  'ANON_KEY_HERE'  // stored in env at build time, embedded in bundle
)
```

The anon key is public by design — RLS policies control access.

### Queries

**Today's workout**:
```
training.workout_plans
  .select('*, planned_exercises(*, exercise:exercise_id(*))')
  .eq('workout_date', today)
  .in('status', ['planned', 'partial'])
  .single()
```

**Already-logged sets** (to show progress):
```
training.exercise_results
  .select('*')
  .eq('workout_plan_id', planId)
```

**Weekly schedule**:
```
training.week_schedule
  .select('*')
  .order('day_of_week')
```

**Recent workouts**:
```
training.workout_plans
  .select('*, planned_exercises(count)')
  .gte('workout_date', fourteenDaysAgo)
  .order('workout_date', { ascending: false })
```

### Mutations

**Log exercise sets**:
```
training.exercise_results.insert([
  { exercise_id, workout_plan_id, workout_date, set_number, set_type, weight, reps, rpe, logged_by: 'web_app' },
  ...
])
```

**Complete workout**:
```
training.workout_plans
  .update({ status, completed_at: now(), completion_notes })
  .eq('id', planId)
```

## Auth & RLS

Single-user personal app. Workout log data is not sensitive.

### Required RLS Policies

```sql
-- Allow anon to read training tables the app needs
ALTER TABLE training.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON training.workout_plans FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update" ON training.workout_plans FOR UPDATE TO anon USING (true);

ALTER TABLE training.planned_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON training.planned_exercises FOR SELECT TO anon USING (true);

ALTER TABLE training.exercise_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON training.exercise_results FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON training.exercise_results FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE training.exercise_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON training.exercise_library FOR SELECT TO anon USING (true);

ALTER TABLE training.week_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON training.week_schedule FOR SELECT TO anon USING (true);
```

### PIN Gate (Optional Fumble Guard)

Simple 4-digit PIN check on app load. PIN hardcoded or in localStorage. Not a security boundary — just prevents a random visitor from accidentally submitting garbage data. The RLS policies are the real access control.

## Visual Design

- **Mobile-only**: max-width ~480px, centered
- **Dark mode**: default, gym-friendly, OLED-friendly
- **Large inputs**: 48px+ tap targets, 18px+ font on numeric inputs
- **Color coding**:
  - Cycle phase: red (menstrual), green (follicular), orange (ovulatory), purple (luteal)
  - Layer: blue (L1 essential), muted (L2 optional)
  - Exercise status: muted (not started), amber (in progress), green (done)
- **System font stack**: no web fonts, no load delay
- **Transitions**: minimal. Gym WiFi is unreliable, don't waste bandwidth on animations

## PWA

Add to the static build:
- `manifest.json` with app name, icons, `display: standalone`, theme color
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- Simple service worker for app shell caching (Vite plugin or hand-written)

This lets Elyssa add-to-homescreen and get full-screen (no Safari chrome). The app shell loads from cache; data still requires network.

## File Structure

```
gym/
  package.json
  tsconfig.json
  vite.config.ts
  react-router.config.ts     -- ssr: false
  tailwind.config.ts
  public/
    manifest.json
    icon-192.png
    icon-512.png
  app/
    root.tsx                  -- html shell, dark mode, system font
    routes.ts                 -- route config
    routes/
      _index.tsx              -- today's workout (loader + view)
      log.$exerciseId.tsx     -- log sets for one exercise
      complete.tsx            -- workout completion
      history.tsx             -- past 14 days
    components/
      ExerciseCard.tsx        -- single exercise in the list
      SetInput.tsx            -- weight/reps/RPE row
      PhaseBadge.tsx          -- cycle phase color pill
      StatusBadge.tsx         -- exercise/workout status
      EmptyState.tsx          -- no plan today
    lib/
      supabase.ts             -- client init
      queries.ts              -- typed query functions
      types.ts                -- shared types
    app.css                   -- tailwind imports
```

## Deploy Script

```bash
#!/bin/bash
cd gym
npm run build
# Uses Supabase CLI or storage API to upload build/client/* to gym-app bucket
supabase storage cp -r build/client/* sb://gym-app/ --project-ref vssciljnilrgqcrnandl
```

Or a simple Node script using the Supabase JS client to upload files to storage.

## Non-Goals (v1)

- Running log UI
- Body scan entry
- Health metrics / dashboards
- Exercise library management
- Rest timer
- Workout plan creation
- Offline set logging (network required)
- Desktop layout
- User accounts / multi-user

## Open Questions

1. **Warmup logging**: Should warmup sets be loggable or display-only?
2. **Weight step buttons**: ±5 for machines, ±2.5 for dumbbells — worth the UX investment, or just numeric input?
3. **Haptic feedback**: `navigator.vibrate(50)` on save to confirm in loud gym?
4. **Partial re-logging**: If she logs 2 of 4 exercises, closes the app, comes back — should it resume where she left off? (Yes if we query existing results for the plan, which the data model supports.)
