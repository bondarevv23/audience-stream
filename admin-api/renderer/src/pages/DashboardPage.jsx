import { useMemo } from "react";
import EventTable from "../components/EventTable";
import MetricGrid from "../components/MetricGrid";
import Notice from "../components/Notice";
import { getDashboardMetrics } from "../utils/metrics";

export default function DashboardPage({ events, error, isLoading, onRefresh, status, emptyTitle, emptyText }) {
  const metrics = useMemo(() => getDashboardMetrics(events), [events]);

  return (
    <>
      <div className="dashboard-actions">
        <p>{status}</p>
        <button className="secondary-button" type="button" onClick={onRefresh}>
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <Notice>
        {error ? (
          <span>
            Backend request failed: {error}
            <button className="notice-action" type="button" onClick={onRefresh}>
              Retry
            </button>
          </span>
        ) : (
          ""
        )}
      </Notice>
      <MetricGrid metrics={metrics} />
      <EventTable
        events={events}
        emptyTitle={emptyTitle}
        emptyText={emptyText}
        isLoading={isLoading}
      />
    </>
  );
}
