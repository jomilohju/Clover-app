import { CompletedTrip, RouteData } from '../types/navigation';

const STORAGE_KEY = 'clover_trip_history';
const MAX_HISTORY = 50;

export function loadTripHistory(): CompletedTrip[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTripHistory(trips: CompletedTrip[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips.slice(0, MAX_HISTORY)));
  } catch {
    // Local storage full or private mode
  }
}

export function recordCompletedTrip(route: RouteData): CompletedTrip | null {
  if (!route || !route.destinationName) return null;
  const trips = loadTripHistory();

  // Avoid duplicate rapid saves within 60 seconds
  const now = Date.now();
  if (trips.length > 0 && now - trips[0].completedAt < 60000 && trips[0].destinationName === route.destinationName) {
    return trips[0];
  }

  const newTrip: CompletedTrip = {
    id: `trip_${now}_${Math.random().toString(36).slice(2, 7)}`,
    destinationName: route.destinationName,
    destinationCoords: route.destinationCoords,
    completedAt: now,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };

  const updated = [newTrip, ...trips.filter((t) => t.id !== newTrip.id)].slice(0, MAX_HISTORY);
  saveTripHistory(updated);
  return newTrip;
}

export function deleteTripFromHistory(id: string): CompletedTrip[] {
  const current = loadTripHistory();
  const updated = current.filter((t) => t.id !== id);
  saveTripHistory(updated);
  return updated;
}

export function clearTripHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function formatTripDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}
