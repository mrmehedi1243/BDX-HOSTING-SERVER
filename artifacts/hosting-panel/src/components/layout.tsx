import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Server,
  Box,
  Users,
  HardDrive,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const CURRENT_USER_ID = 2;

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}

function NavItem({ href, icon: Icon, label, active }: NavItemProps) {
  return (
    <Link href={href}>
      <div
        className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 cursor-pointer select-none ${
          active
            ? "bg-white/8 text-white font-medium"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/4 font-normal"
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            active ? "text-violet-400" : "text-zinc-600 group-hover:text-zinc-400"
          }`}
        />
        <span className="flex-1">{label}</span>
        {active && <ChevronRight className="w-3 h-3 text-zinc-600" />}
      </div>
    </Link>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const { data: user, isLoading } = useGetUser(CURRENT_USER_ID, {
    query: {
      enabled: !!CURRENT_USER_ID,
      queryKey: getGetUserQueryKey(CURRENT_USER_ID),
    },
  });

  const isActive = (path: string) => {
    if (path === "/" && location !== "/") return false;
    return location.startsWith(path);
  };

  const slotsUsed = user?.slotsUsed ?? 0;
  const maxSlots = user?.plan?.maxSlots ?? 0;
  const slotPercent = maxSlots > 0 ? (slotsUsed / maxSlots) * 100 : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="w-[220px] shrink-0 flex flex-col border-r border-[#1a1a1a]"
        style={{ background: "hsl(0 0% 5%)" }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-[15px] text-white tracking-tight">BDX Hosting</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          <div>
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5 px-3">
              Platform
            </div>
            <div className="space-y-0.5">
              <NavItem href="/" icon={LayoutDashboard} label="Dashboard" active={isActive("/")} />
              <NavItem href="/servers" icon={Server} label="My Servers" active={isActive("/servers")} />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5 px-3">
              Admin
            </div>
            <div className="space-y-0.5">
              <NavItem href="/admin/plans" icon={Box} label="Plans" active={isActive("/admin/plans")} />
              <NavItem href="/admin/users" icon={Users} label="Users" active={isActive("/admin/users")} />
              <NavItem href="/admin/servers" icon={HardDrive} label="All Servers" active={isActive("/admin/servers")} />
            </div>
          </div>
        </nav>

        {/* Plan widget */}
        <div className="p-3 border-t border-[#1a1a1a]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-3 w-16 bg-white/5" />
              <Skeleton className="h-1.5 w-full bg-white/5" />
              <Skeleton className="h-3 w-10 bg-white/5" />
            </div>
          ) : user ? (
            <div className="rounded-md border border-[#1e1e1e] bg-white/3 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="text-xs font-medium text-white">
                    {user.plan?.name ?? "No Plan"}
                  </span>
                </div>
                {user.plan && (
                  <span className="text-[10px] text-zinc-500">
                    ${user.plan.pricePerMonth}/mo
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>Slots</span>
                  <span className="text-zinc-400">
                    {slotsUsed} / {maxSlots}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${slotPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>{user.username}</span>
                <span className="capitalize text-zinc-500">{user.role}</span>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
