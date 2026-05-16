import { formatDuration, formatTime } from "../utils/formatters";

function getEventKey(event) {
  return event.id || event.event_id || `${event.user_id}-${event.event_type}-${event.timestamp}`;
}

function getDomain(event) {
  return event.domain || event.payload?.domain || "-";
}

function getTitle(event) {
  return event.title || event.payload?.title || "-";
}

function getUrl(event) {
  return event.url || event.full_url || event.payload?.full_url || "-";
}

export default function EventTable({
  events,
  emptyTitle = "No events yet",
  emptyText = "Data will appear here after the backend returns events.",
  isLoading = false
}) {
  return (
    <section className="table-panel">
      <div className="table-header">
        <h3>Events</h3>
        <span>{events.length} rows</span>
      </div>

      <div className="table-scroll">
        {isLoading && events.length === 0 ? (
          <div className="table-skeleton" aria-label="Loading events">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <h4>{emptyTitle}</h4>
            <p>{emptyText}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Event</th>
                <th>Domain</th>
                <th>Title</th>
                <th>URL</th>
                <th>Duration</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={getEventKey(event)}>
                  <td>{event.user_id || "-"}</td>
                  <td>
                    <span className="event-pill">{event.event_type || "-"}</span>
                  </td>
                  <td>{getDomain(event)}</td>
                  <td>{getTitle(event)}</td>
                  <td className="url-cell">{getUrl(event)}</td>
                  <td>{formatDuration(event.duration_seconds)}</td>
                  <td>{formatTime(event.timestamp || event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
