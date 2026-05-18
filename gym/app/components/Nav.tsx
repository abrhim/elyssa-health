import { NavLink } from "react-router";

export function Nav() {
  const base = "flex-1 flex flex-col items-center gap-1 py-3 text-sm transition-colors min-h-[44px]";
  const active = "text-action";
  const inactive = "text-ink-muted";

  return (
    <nav className="flex border-t border-cream-border bg-cream sticky bottom-0 safe-bottom">
      <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11v11h-11z"/><path d="M3 12h3.5M17.5 12H21M12 3v3.5M12 17.5V21"/></svg>
        Today
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        History
      </NavLink>
    </nav>
  );
}
