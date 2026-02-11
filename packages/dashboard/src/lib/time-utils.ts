export function formatTimeAgo(value: string | null): string {
  if (!value) return "—";
  
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const now = Date.now();
  const seconds = Math.floor((now - date.getTime()) / 1000);
  
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h ago`;
    return `${hours}h ${remainingMinutes}m ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d ago`;
    return `${days}d ${remainingHours}h ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    const remainingDays = days % 7;
    if (remainingDays === 0) return `${weeks}w ago`;
    return `${weeks}w ${remainingDays}d ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    const remainingDays = days % 30;
    if (remainingDays === 0) return `${months}mo ago`;
    return `${months}mo ${Math.floor(remainingDays / 7)}w ago`;
  }

  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  if (remainingMonths === 0) return `${years}y ago`;
  return `${years}y ${remainingMonths}mo ago`;
}

export function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatAbsoluteTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}