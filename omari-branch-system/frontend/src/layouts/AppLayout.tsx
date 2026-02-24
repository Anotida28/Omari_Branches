import {
  Bell,
  Building2,
  ChartColumn,
  DollarSign,
  LayoutDashboard,
  LineChart,
  LogOut,
  Shield,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { cn } from "../components/ui/cn";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/metrics", label: "Metrics", icon: ChartColumn },
  { to: "/trends", label: "Trends", icon: LineChart },
  { to: "/expenses", label: "Expenses", icon: DollarSign },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

function SidebarLinks() {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-5 md:block">
          <div className="mb-8 flex items-center gap-2">
            <div className="rounded-md bg-slate-900 p-2 text-white">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                HQ Finance
              </p>
              <h1 className="text-sm font-semibold text-slate-900">Omari Branch System</h1>
            </div>
          </div>

          <SidebarLinks />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Shield className="h-4 w-4" />
                <span className="font-medium text-slate-800">{user?.username ?? "Unknown"}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {user?.role === "FULL_ACCESS" ? "Full Access" : "Viewer"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>

            <div className="mt-3 md:hidden">
              <SidebarLinks />
            </div>
          </header>

          <main className="min-h-0 flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
