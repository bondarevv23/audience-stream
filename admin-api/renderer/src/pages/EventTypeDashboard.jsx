import { useCallback, useEffect, useState } from "react";
import DashboardPage from "./DashboardPage";
import { fetchEventsByType, hasElectronBridge } from "../services/adminApiClient";
import { getPageTitle } from "../constants/navigation";

export default function EventTypeDashboard({ eventType }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("Waiting for backend data");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!hasElectronBridge()) {
      setStatus("Open this view in Electron to connect backend data");
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextEvents = await fetchEventsByType(eventType, { limit: 100 });
      setEvents(nextEvents);
      setStatus(`Loaded ${getPageTitle(eventType)} events`);
    } catch (requestError) {
      setError(requestError.message);
      setStatus("Backend unavailable");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventType]);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadEvents();
    }, 0);

    return () => window.clearTimeout(initialLoadId);
  }, [loadEvents]);

  return (
    <DashboardPage
      events={events}
      error={error}
      isLoading={isLoading}
      onRefresh={loadEvents}
      status={status}
      emptyTitle={`No ${getPageTitle(eventType).toLowerCase()} data yet`}
      emptyText="Once the backend returns matching events, this table will fill automatically."
    />
  );
}
