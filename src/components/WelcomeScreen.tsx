import React, { useState, useEffect, useRef } from 'react';
import { SearchResultItem, CompletedTrip, GeoLocation } from '../types/navigation';
import { searchPlaces } from '../services/geocoding';
import { formatTripDate } from '../utils/tripHistory';
import { formatDistance } from '../utils/navigation';

interface WelcomeScreenProps {
  onOpenMap: () => void;
  onSelectDestination: (lat: number, lng: number, name: string) => void;
  onStartPinMode: () => void;
  onOpenHistory: () => void;
  currentLocation: GeoLocation;
  recentTrips: CompletedTrip[];
  nightMode: boolean;
  onToggleNight: () => void;
  gpsLocked: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onOpenMap,
  onSelectDestination,
  onStartPinMode,
  onOpenHistory,
  currentLocation,
  recentTrips,
  nightMode,
  onToggleNight,
  gpsLocked,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query, currentLocation);
        setResults(places);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentLocation]);

  const bgCanvas = nightMode ? '#0a0f1d' : '#f8fafc';
  const textPrimary = nightMode ? '#f8fafc' : '#0f172a';
  const cardBg = nightMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)';
  const borderCol = nightMode ? '#1e293b' : '#e2e8f0';
  const inputBg = nightMode ? '#1e293b' : '#ffffff';

  return (
    <div
      className="fixed inset-0 z-9999 flex flex-col justify-between overflow-y-auto select-none"
      style={{
        background: bgCanvas,
        color: textPrimary,
        zIndex: 9999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Top Bar with Branding */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between px-6 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl leading-none" role="img" aria-label="four leaf clover">🍀</span>
          <span className="text-2xl font-black tracking-tight" style={{ color: textPrimary }}>
            Clover app
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold border"
            style={{
              borderColor: borderCol,
              background: nightMode ? '#1e293b' : '#f1f5f9',
              color: gpsLocked ? '#10b981' : '#f59e0b',
            }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: gpsLocked ? '#10b981' : '#f59e0b' }}
            />
            <span>{gpsLocked ? 'GPS Ready' : 'Searching GPS'}</span>
          </div>

          <button
            onClick={onToggleNight}
            aria-label={nightMode ? 'Switch to daylight' : 'Switch to night mode'}
            className="w-10 h-10 rounded-xl border flex items-center justify-center text-lg transition-transform active:scale-95"
            style={{ borderColor: borderCol, background: inputBg }}
          >
            {nightMode ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Hero Welcome & Search Container */}
      <main className="w-full max-w-2xl mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2.5">
            Welcome
          </h1>
          <p className="text-base sm:text-lg opacity-70">
            Where would you like to drive today?
          </p>
        </div>

        {/* Search Bar Input */}
        <div className="relative mb-6">
          <div
            className="flex items-center rounded-2xl border-2 px-4 py-3.5 shadow-xl transition-all"
            style={{
              background: inputBg,
              borderColor: query.length > 0 ? '#10b981' : borderCol,
            }}
          >
            <span className="text-xl mr-3 opacity-60">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, landmark, or street..."
              className="w-full bg-transparent outline-none text-base sm:text-lg font-medium placeholder:opacity-40"
              style={{ color: textPrimary }}
              autoFocus
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                className="w-7 h-7 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 text-sm font-bold ml-2"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {(isSearching || results.length > 0) && (
            <div
              className="absolute left-0 right-0 top-full mt-2 rounded-2xl border shadow-2xl overflow-hidden z-10 max-h-72 overflow-y-auto"
              style={{ background: cardBg, borderColor: borderCol }}
            >
              {isSearching && results.length === 0 && (
                <div className="p-4 text-center text-sm opacity-60">
                  Searching locations...
                </div>
              )}
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectDestination(item.lat, item.lng, item.name)}
                  className="w-full px-4 py-3 text-left border-b last:border-b-0 hover:bg-emerald-500/10 flex items-center justify-between gap-3 transition-colors"
                  style={{ borderColor: borderCol }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base truncate">{item.name}</div>
                    <div className="text-xs opacity-60 truncate">{item.subtitle}</div>
                  </div>
                  {item.distanceKm !== undefined && (
                    <span className="text-xs font-mono font-semibold opacity-60 shrink-0">
                      {item.distanceKm} km
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
          <button
            onClick={onOpenMap}
            className="flex items-center justify-center gap-2.5 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base tracking-wide shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
          >
            <span className="text-xl">🗺️</span>
            <span>Open Live Map</span>
          </button>

          <button
            onClick={onStartPinMode}
            className="flex items-center justify-center gap-2.5 h-14 rounded-2xl border-2 font-extrabold text-base tracking-wide hover:opacity-90 active:scale-[0.98] transition-all"
            style={{
              borderColor: borderCol,
              background: cardBg,
            }}
          >
            <span className="text-xl">📍</span>
            <span>Drop Pin on Map</span>
          </button>
        </div>

        {/* Recent Completed Trips Preview */}
        {recentTrips.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                Recent Trips
              </span>
              <button
                onClick={onOpenHistory}
                className="text-xs font-bold text-emerald-500 hover:underline"
              >
                View all ({recentTrips.length})
              </button>
            </div>

            <div className="space-y-2">
              {recentTrips.slice(0, 3).map((trip) => (
                <div
                  key={trip.id}
                  className="p-3 rounded-xl border flex items-center justify-between gap-3 hover:bg-emerald-500/5 transition-colors"
                  style={{ background: cardBg, borderColor: borderCol }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{trip.destinationName}</div>
                    <div className="text-[11px] opacity-60">
                      {formatTripDate(trip.completedAt)} · {formatDistance(trip.distanceMeters)}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onSelectDestination(
                        trip.destinationCoords[0],
                        trip.destinationCoords[1],
                        trip.destinationName
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shrink-0 shadow-sm"
                  >
                    Drive ➤
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-xs opacity-50 shrink-0">
        <span>🍀 Clover Navigation System</span>
        <button
          onClick={onOpenHistory}
          className="hover:opacity-100 underline font-medium"
        >
          Trip History
        </button>
      </footer>
    </div>
  );
};
