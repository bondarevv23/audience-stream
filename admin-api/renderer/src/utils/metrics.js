export function getDashboardMetrics(events) {
  const users = new Set(events.map((event) => event.user_id));
  const domains = events.reduce((acc, event) => {
    const domain = event.domain || event.payload?.domain;

    if (domain) {
      acc[domain] = (acc[domain] || 0) + 1;
    }

    return acc;
  }, {});
  const topDomain = Object.entries(domains).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const totalDuration = events.reduce((sum, event) => {
    return sum + Number(event.duration_seconds || 0);
  }, 0);

  return {
    totalEvents: events.length,
    activeUsers: users.size,
    topDomain,
    totalDuration
  };
}
