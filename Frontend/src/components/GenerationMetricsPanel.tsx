import type { GenerationMetrics } from "@/lib/api/types";

interface GenerationMetricsPanelProps {
  metrics: GenerationMetrics;
  variant?: "full" | "compact";
}

export default function GenerationMetricsPanel({
  metrics,
  variant = "full",
}: GenerationMetricsPanelProps) {
  const rt = metrics.responseTimeMs.toLocaleString();
  const tp = metrics.throughputCharsPerSec.toLocaleString();
  const er = metrics.pipelineErrorRatePercent.toFixed(1);
  const acc = metrics.recommendationAccuracyPercent;

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        <span className="tabular-nums">
          <span className="font-medium text-gray-800 dark:text-gray-200">Response time:</span>{" "}
          {rt} ms
        </span>
        <span className="hidden sm:inline text-gray-300 dark:text-gray-600">·</span>
        <span className="tabular-nums">
          <span className="font-medium text-gray-800 dark:text-gray-200">Throughput:</span>{" "}
          {tp} chars/s
        </span>
        <span className="hidden sm:inline text-gray-300 dark:text-gray-600">·</span>
        <span className="tabular-nums">
          <span className="font-medium text-gray-800 dark:text-gray-200">Error rate:</span>{" "}
          {er}%
        </span>
        <span className="hidden sm:inline text-gray-300 dark:text-gray-600">·</span>
        <span className="tabular-nums">
          <span className="font-medium text-gray-800 dark:text-gray-200">Accuracy:</span>{" "}
          {acc}%
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-800/60 dark:bg-emerald-950/40 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-emerald-950 dark:text-emerald-100 mb-4 flex items-center gap-2">
        <span aria-hidden>📊</span>
        Generation metrics
      </h3>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="rounded-lg bg-white/80 dark:bg-gray-900/60 px-4 py-3 border border-emerald-100 dark:border-emerald-900/50">
          <dt className="text-emerald-700/90 dark:text-emerald-300/90 font-medium">Response time</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50 tabular-nums">
            {rt}{" "}
            <span className="text-sm font-normal text-emerald-800/80 dark:text-emerald-200/80">ms</span>
          </dd>
        </div>
        <div className="rounded-lg bg-white/80 dark:bg-gray-900/60 px-4 py-3 border border-emerald-100 dark:border-emerald-900/50">
          <dt className="text-emerald-700/90 dark:text-emerald-300/90 font-medium">Throughput</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50 tabular-nums">
            {tp}{" "}
            <span className="text-sm font-normal text-emerald-800/80 dark:text-emerald-200/80">
              chars/s
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-white/80 dark:bg-gray-900/60 px-4 py-3 border border-emerald-100 dark:border-emerald-900/50">
          <dt className="text-emerald-700/90 dark:text-emerald-300/90 font-medium">Error rate</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50 tabular-nums">
            {er}
            <span className="text-sm font-normal text-emerald-800/80 dark:text-emerald-200/80">%</span>
          </dd>
        </div>
        <div className="rounded-lg bg-white/80 dark:bg-gray-900/60 px-4 py-3 border border-emerald-100 dark:border-emerald-900/50">
          <dt className="text-emerald-700/90 dark:text-emerald-300/90 font-medium">
            Recommendation accuracy
          </dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50 tabular-nums">
            {acc}
            <span className="text-sm font-normal text-emerald-800/80 dark:text-emerald-200/80">%</span>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-emerald-900/75 dark:text-emerald-200/70 leading-relaxed">
        Throughput estimates how much plan content was produced per second. Error rate reflects optional
        steps that degraded (itinerary detail, weather, highlights or recommendations). Accuracy is a
        heuristic match to your interests and budget.
      </p>
    </div>
  );
}
