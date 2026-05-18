import type { WeekSchedule } from "~/lib/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SESSION_LABELS: Record<string, string> = {
  lower_a: "Lower A",
  lower_b: "Lower B",
  upper_a: "Upper A",
  upper_b: "Upper B",
  easy_run: "Easy Run",
  long_run: "Long Run",
  rest: "Rest",
  deload: "Deload",
};

export function EmptyState({ schedule }: { schedule: WeekSchedule[] }) {
  const todayDow = new Date().getDay();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="text-4xl mb-4">🏋️</div>
      <h2 className="text-lg font-semibold text-zinc-300 mb-2">No workout planned</h2>
      <p className="text-sm text-zinc-500 text-center mb-8">Ask Claude to build today's workout</p>

      <div className="w-full max-w-sm">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">This Week</h3>
        <div className="space-y-1">
          {schedule.map((s) => {
            const dow = s.day_of_week % 7;
            const isToday = dow === todayDow;
            return (
              <div
                key={s.day_of_week}
                className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${isToday ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500"}`}
              >
                <span>{DAY_NAMES[dow]}{isToday ? " (today)" : ""}</span>
                <span>{SESSION_LABELS[s.session_type] ?? s.session_type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
