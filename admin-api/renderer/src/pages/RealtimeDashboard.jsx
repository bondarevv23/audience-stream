import { useCallback, useEffect, useState } from "react";
import DashboardPage from "./DashboardPage";
import { fetchRecentEvents, hasElectronBridge } from "../services/adminApiClient";

export default function RealtimeDashboard() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("Waiting for backend data");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!hasElectronBridge()) {
      setStatus("Open this view in Electron to connect backend data");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextEvents = await fetchRecentEvents(100);
      setEvents(nextEvents);
      setStatus("Refreshing every 5 seconds through HTTP polling");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("Backend unavailable");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadEvents();
    }, 0);

    const timerId = window.setInterval(() => {
      void loadEvents();
    }, 5000);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(timerId);
    };
  }, [loadEvents]);

  return (
    <DashboardPage
      events={events}
      error={error}
      isLoading={isLoading}
      onRefresh={loadEvents}
      status={status}
      emptyTitle="No live activity yet"
      emptyText="Events will appear here after the backend starts returning recent browser activity."
    />
  );
}
