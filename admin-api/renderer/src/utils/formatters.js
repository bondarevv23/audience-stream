export function formatTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

export function formatDuration(seconds) {
  if (!seconds) {
    return "-";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes === 0) {
    return `${rest}s`;
  }

  return `${minutes}m ${rest}s`;
}
