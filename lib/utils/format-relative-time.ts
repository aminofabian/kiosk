export function formatRelativeTime(timestamp: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const diff = Math.max(0, nowSec - timestamp);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: nowSec - timestamp > 31536000 ? 'numeric' : undefined,
  });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

export function isWithinLastWeek(timestamp: number, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return timestamp >= nowSec - ONE_WEEK_SECONDS;
}
