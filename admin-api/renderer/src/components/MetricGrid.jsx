import MetricCard from "./MetricCard";
import { formatDuration } from "../utils/formatters";

export default function MetricGrid({ metrics }) {
  return (
    <section className="metric-grid" aria-label="Summary metrics">
      <MetricCard label="Total events" value={metrics.totalEvents} />
      <MetricCard label="Active users" value={metrics.activeUsers} />
      <MetricCard label="Top domain" value={metrics.topDomain} />
      <MetricCard label="Tracked time" value={formatDuration(metrics.totalDuration)} />
    </section>
  );
}
