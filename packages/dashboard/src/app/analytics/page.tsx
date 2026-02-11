"use client";

import dynamic from "next/dynamic";
import { useAnalytics } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/ui/fade-in";

// Lazy-load recharts (129kB)
const LazyAnalyticsCharts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <SkeletonGrid count={6} />,
});

function hasAnalyticsData(data: any): boolean {
  if (!data) return false;
  
  // Check if there's any meaningful data
  const hasTaskData = data.tasksCompletedByDay?.length > 0 || data.tasksByStatus?.length > 0;
  const hasAgentData = data.agentUtilization?.length > 0;
  const hasTimeData = data.avgCompletionTimeByWeek?.length > 0 || data.blockersByWeek?.length > 0;
  
  return hasTaskData || hasAgentData || hasTimeData;
}

export default function AnalyticsPage() {
  const { data, isLoading, error, refetch } = useAnalytics();

  return (
    <FadeIn>
      <PageHeader
        label="Intelligence"
        title="Analytics"
        description="Task performance, agent utilization, and operational metrics"
      />

      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : error ? (
        <ErrorState
          message="Failed to load analytics"
          detail={error.message}
          onRetry={() => refetch()}
        />
      ) : data && hasAnalyticsData(data) ? (
        <LazyAnalyticsCharts data={data} />
      ) : (
        <EmptyState
          icon="📊"
          title="No analytics data available"
          description="Start creating tasks and projects to see analytics data here. Charts will appear once you have activity to track."
          className="rounded-2xl border border-dashed border-[var(--card-border)] min-h-[400px] flex items-center justify-center"
        />
      )}
    </FadeIn>
  );
}
