import { NavLink, Outlet } from "react-router-dom";
import { Home, BookOpen, BarChart3, Settings } from "lucide-react";

const tabs = [
  { to: "/", label: "Today", Icon: Home },
  { to: "/entries", label: "Entries", Icon: BookOpen },
  { to: "/stats", label: "Stats", Icon: BarChart3 },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function Shell() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  isActive ? "text-accent-strong" : "text-muted"
                }`
              }
            >
              <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
