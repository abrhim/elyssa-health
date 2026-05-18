import { createSupabaseClient, getValidAccessToken } from "./auth.ts";
import {
  getSpo2,
  getSleep,
  getRespiration,
  getFloors,
  getHeartrate,
  getStress,
  getDailySummary,
  getMenstrualCycle,
  getActivities,
} from "./endpoints.ts";
import {
  upsertSpo2,
  upsertSleep,
  upsertRespiration,
  upsertFloors,
  upsertHeartrate,
  upsertStress,
  upsertDailySummary,
  upsertMenstrualCycle,
  upsertActivities,
} from "./upsert.ts";
import type { SyncResult } from "./types.ts";

function dateRange(daysBack: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

async function logResults(
  supabase: ReturnType<typeof createSupabaseClient>,
  results: SyncResult[]
): Promise<void> {
  if (!results.length) return;
  const rows = results.map((r) => ({
    endpoint: r.endpoint,
    target_date: r.target_date,
    status: r.status,
    error_message: r.error_message ?? null,
    rows_affected: r.rows_affected,
  }));
  await supabase.schema("health").from("sync_log").insert(rows);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const daysBack = body.days_back ?? 3;

    const supabase = createSupabaseClient();
    const { accessToken, displayName } = await getValidAccessToken(supabase);
    const dates = dateRange(daysBack);

    console.log(
      `[garmin-sync] Syncing ${dates.length} days: ${dates[0]} → ${dates[dates.length - 1]}`
    );

    const allResults: SyncResult[] = [];

    for (const date of dates) {
      console.log(`[garmin-sync] Pulling ${date}...`);

      const [spo2, sleep, respiration, floors, heartrate, stress, summary, menstrual, activities] =
        await Promise.allSettled([
          getSpo2(accessToken, date),
          getSleep(accessToken, date, displayName),
          getRespiration(accessToken, date),
          getFloors(accessToken, date),
          getHeartrate(accessToken, date),
          getStress(accessToken, date),
          getDailySummary(accessToken, date),
          getMenstrualCycle(accessToken, date),
          getActivities(accessToken, date),
        ]);

      const results = await Promise.all([
        upsertSpo2(
          supabase,
          date,
          spo2.status === "fulfilled" ? spo2.value : null
        ),
        upsertSleep(
          supabase,
          date,
          sleep.status === "fulfilled" ? sleep.value : null
        ),
        upsertRespiration(
          supabase,
          date,
          respiration.status === "fulfilled" ? respiration.value : null
        ),
        upsertFloors(
          supabase,
          date,
          floors.status === "fulfilled" ? floors.value : null
        ),
        upsertHeartrate(
          supabase,
          date,
          heartrate.status === "fulfilled" ? heartrate.value : null
        ),
        upsertStress(
          supabase,
          date,
          stress.status === "fulfilled" ? stress.value : null
        ),
        upsertDailySummary(
          supabase,
          date,
          summary.status === "fulfilled" ? summary.value : null
        ),
        upsertMenstrualCycle(
          supabase,
          date,
          menstrual.status === "fulfilled" ? menstrual.value : null
        ),
        upsertActivities(
          supabase,
          date,
          activities.status === "fulfilled" ? activities.value : null
        ),
      ]);

      // Log fetch errors as results too
      const fetchPairs = [
        ["spo2", spo2],
        ["sleep", sleep],
        ["respiration", respiration],
        ["floors", floors],
        ["heartrate", heartrate],
        ["stress", stress],
        ["daily_summary", summary],
        ["menstrual_cycle", menstrual],
        ["activities", activities],
      ] as const;

      for (const [name, settled] of fetchPairs) {
        if (settled.status === "rejected") {
          results.push({
            endpoint: name,
            target_date: date,
            status: "error",
            error_message: `fetch failed: ${settled.reason}`,
            rows_affected: 0,
          });
        }
      }

      allResults.push(...results);
    }

    await logResults(supabase, allResults);

    const successes = allResults.filter((r) => r.status === "success").length;
    const errors = allResults.filter((r) => r.status === "error" && r.error_message).length;
    const totalRows = allResults.reduce((sum, r) => sum + r.rows_affected, 0);

    console.log(
      `[garmin-sync] Done: ${successes} ok, ${errors} errors, ${totalRows} rows upserted`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        dates,
        successes,
        errors,
        total_rows: totalRows,
        results: allResults,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = (e as Error).message;
    console.error(`[garmin-sync] Fatal error: ${msg}`);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
