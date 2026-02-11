"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface AnalyticsSummary {
  tasksCompletedByDay: { date: string; count: number }[];
  tasksByStatus: { status: string; count: number }[];
  tasksByPriority: { priority: string; count: number }[];
  agentUtilization: {
    agent_name: string;
    work_status: string;
    agent_status: string;
    tasks_completed: number;
    tasks_active: number;
  }[];
  avgCompletionTimeByWeek: { week: string; avg_hours: number }[];
  blockersByWeek: { week: string; count: number }[];
}

// Use CSS variable-aligned chart colors
const STATUS_COLORS: Record<string, string> = {
  pending: "#8b97a7",
  in_progress: "#5eead4",
  review: "#8b5cf6",
  completed: "#34d399",
  blocked: "#f87171",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#34d399",
  medium: "#3b82f6",
  high: "#f6c453",
  urgent: "#f87171",
};

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--card-border)",
  borderRadius: 12,
  color: "var(--foreground)",
};

const TICK_STYLE = { fill: "#8b97a7", fontSize: 11 };
const GRID_STROKE = "rgba(38, 48, 65, 0.6)";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
      <h3 className="text-sm font-medium text-[var(--muted)] mb-4">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function formatDate(label: any) {
  return new Date(String(label)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeek(label: any) {
  return new Date(String(label)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsCharts({ data }: { data: AnalyticsSummary }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Task Completion */}
      <ChartCard title="Task Completion (Last 30 Days)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.tasksCompletedByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} />
            <Line type="monotone" dataKey="count" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Task Status Distribution */}
      <ChartCard title="Task Status Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.tasksByStatus}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              label={({ name, value }: { name?: string; value?: number }) => `${name} (${value})`}
              labelLine={false}
            >
              {data.tasksByStatus.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#8b97a7"} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Agent Utilization */}
      <ChartCard title="Agent Utilization">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.agentUtilization} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis type="number" tick={TICK_STYLE} allowDecimals={false} />
            <YAxis dataKey="agent_name" type="category" tick={TICK_STYLE} width={100} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            <Bar dataKey="tasks_completed" name="Completed" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="tasks_active" name="Active" fill="var(--chart-6)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Priority Distribution */}
      <ChartCard title="Priority Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.tasksByPriority}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="priority" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.tasksByPriority.map((entry) => (
                <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] ?? "#8b97a7"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Avg Completion Time */}
      <ChartCard title="Avg Task Completion Time (Hours/Week)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.avgCompletionTimeByWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="week" tickFormatter={formatWeek} tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={formatWeek}
              formatter={(value) => [`${value}h`, "Avg Time"]}
            />
            <Line type="monotone" dataKey="avg_hours" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Blockers */}
      <ChartCard title="Blockers (Last 90 Days)">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.blockersByWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="week" tickFormatter={formatWeek} tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatWeek} />
            <Area type="monotone" dataKey="count" stroke="var(--chart-4)" fill="rgba(248,113,113,0.15)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
