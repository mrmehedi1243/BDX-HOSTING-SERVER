import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Server, HardDrive, Cpu, Activity, AlertCircle, StopCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  accent?: string;
  delay?: number;
}

function StatCard({ label, value, icon: Icon, iconColor = "text-zinc-500", accent, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5 flex flex-col gap-3 hover:border-[#2a2a2a] transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium tracking-wide uppercase">{label}</span>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent ?? "bg-white/4"}`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
      </div>
      <div className="text-3xl font-semibold text-white tracking-tight">{value}</div>
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20 bg-white/5" />
        <Skeleton className="h-7 w-7 rounded-md bg-white/5" />
      </div>
      <Skeleton className="h-8 w-14 bg-white/5" />
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">Platform status and resource usage at a glance.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : stats ? (
        <>
          <section>
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Infrastructure</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Users" value={stats.totalUsers} icon={Users} iconColor="text-violet-400" accent="bg-violet-500/10" delay={0} />
              <StatCard label="Total Servers" value={stats.totalServers} icon={Server} iconColor="text-blue-400" accent="bg-blue-500/10" delay={0.05} />
              <StatCard label="Active Plans" value={stats.totalPlans} icon={HardDrive} iconColor="text-zinc-400" accent="bg-white/4" delay={0.1} />
              <StatCard label="Error State" value={stats.errorServers} icon={AlertCircle} iconColor="text-red-400" accent="bg-red-500/10" delay={0.15} />
            </div>
          </section>

          <section>
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Server Health</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Running" value={stats.runningServers} icon={CheckCircle2} iconColor="text-emerald-400" accent="bg-emerald-500/10" delay={0.2} />
              <StatCard label="Stopped" value={stats.stoppedServers} icon={StopCircle} iconColor="text-zinc-400" accent="bg-white/4" delay={0.25} />
              <StatCard label="RAM Used" value={`${(stats.totalRamUsedMB / 1024).toFixed(1)} GB`} icon={Activity} iconColor="text-amber-400" accent="bg-amber-500/10" delay={0.3} />
              <StatCard label="Avg CPU" value={`${stats.avgCpuUsed.toFixed(1)}%`} icon={Cpu} iconColor="text-cyan-400" accent="bg-cyan-500/10" delay={0.35} />
            </div>
          </section>

          {/* Health bar */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-400">Platform Health</span>
              <span className="text-xs text-zinc-600">
                {stats.runningServers} / {stats.totalServers} running
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${stats.totalServers > 0 ? (stats.runningServers / stats.totalServers) * 100 : 0}%` }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-2">
              <span>0%</span>
              <span>100%</span>
            </div>
          </motion.section>
        </>
      ) : null}
    </div>
  );
}
