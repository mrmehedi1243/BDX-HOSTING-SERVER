import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Server,
  TerminalSquare,
  Box,
  Users,
  HardDrive,
} from "lucide-react";
import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const CURRENT_USER_ID = 2; // Hardcoded user context

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border bg-sidebar/50 backdrop-blur-xl">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
              B
            </div>
            <span className="font-semibold text-lg tracking-tight">BDX Hosting</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-2">
              Platform
            </div>
            <div className="space-y-1">
              <Link
                href="/"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href="/servers"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/servers")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Server className="w-4 h-4" />
                My Servers
              </Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-2">
              Administration
            </div>
            <div className="space-y-1">
              <Link
                href="/admin/plans"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/plans")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Box className="w-4 h-4" />
                Plans
              </Link>
              <Link
                href="/admin/users"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/users")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Users className="w-4 h-4" />
                Users
              </Link>
              <Link
                href="/admin/servers"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/admin/servers")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <HardDrive className="w-4 h-4" />
                All Servers
              </Link>
            </div>
          </div>
        </nav>

        {/* User Plan Widget */}
        <div className="p-4 border-t border-border">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          ) : user ? (
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {user.plan ? user.plan.name : "No Plan"}
                </span>
                {user.plan && (
                  <span className="text-xs text-muted-foreground">
                    ${user.plan.pricePerMonth}/mo
                  </span>
                )}
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Slots Used</span>
                  <span>{user.slotsUsed} / {user.plan ? user.plan.maxSlots : 0}</span>
                </div>
                <Progress 
                  value={(user.slotsUsed / (user.plan ? user.plan.maxSlots : 1)) * 100} 
                  className="h-1.5"
                />
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background/50">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
