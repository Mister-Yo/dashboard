"use client";

import dynamic from "next/dynamic";
import { useAnalytics } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { FadeIn } from "@/components/ui/fade-in";

// Lazy-load recharts (129kB)
const LazyAnalyticsCharts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <SkeletonGrid count={6} />,
});

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
      ) : data ? (
        <LazyAnalyticsCharts data={data} />
      ) : null}
    </FadeIn>
  );
}
