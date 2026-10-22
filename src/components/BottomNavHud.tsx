import React from 'react';
import { Navigation, Moon, Sun, MapPin } from 'lucide-react';
import { formatDistance, formatDuration, formatEta } from '../utils/navigation';

interface BottomNavHudProps {
  isNavigating: boolean;
  speedKmh: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  eta: Date | null;
  nightMode: boolean;
  followCar: boolean;
  destinationName?: string;
  onEndRoute: () => void;
  onStartPinMode: () => void;
  onToggleNight: () => void;
  onRecenter: () => void;
}

export const BottomNavHud: React.FC<BottomNavHudProps> = ({
  isNavigating,
  speedKmh,
  remainingDistanceMeters,
  remainingDurationSeconds,
  eta,
  nightMode,
  followCar,
  destinationName,
  onEndRoute,
  onStartPinMode,
  onToggleNight,
  onRecenter,
}) => {
  const displaySpeed = Math.round(speedKmh);

  if (isNavigating) {
    return (
      <footer
        role="contentinfo"
        className={`fixed bottom-0 left-0 right-0 z-1000 backdrop-blur-md border-t select-none transition-colors ${
          nightMode
            ? 'bg-neutral-950/95 border-neutral-700 text-white shadow-[0_-6px_16px_rgba(0,0,0,0.8)]'
            : 'bg-white/95 border-slate-300 text-slate-900 shadow-[0_-6px_16px_rgba(0,0,0,0.12)]'
        }`}
      >
        <div className="max-w-4xl mx-auto px-3 py-2">
          {/* Top telemetry row: Speedometer & trip summaries */}
          <div
            className={`flex items-center justify-between gap-2 border-b pb-1.5 ${
              nightMode ? 'border-neutral-800/80' : 'border-slate-200'
            }`}
          >
            {/* Speed readout */}
            <div
              className={`flex items-baseline border px-2.5 py-0.5 rounded-lg transition-colors ${
                nightMode
                  ? 'bg-neutral-900 border-neutral-700/80 text-emerald-400'
                  : 'bg-slate-100 border-slate-300 text-emerald-700'
              }`}
            >
              <span className="text-2xl sm:text-3xl font-black font-mono">
                {displaySpeed}
              </span>
              <span
                className={`text-[11px] font-bold ml-1 uppercase ${
                  nightMode ? 'text-neutral-400' : 'text-slate-500'
                }`}
              >
                km/h
              </span>
            </div>

            {/* Trip summary values */}
            <div className="flex items-center space-x-3 sm:space-x-5 text-center">
              <div>
                <div
                  className={`text-[10px] uppercase tracking-wider font-bold ${
                    nightMode ? 'text-neutral-400' : 'text-slate-500'
                  }`}
                >
                  ETA
                </div>
                <div
                  className={`text-lg sm:text-xl font-black font-mono ${
                    nightMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {eta ? formatEta(eta) : '--:--'}
                </div>
              </div>

              <div
                className={`h-6 w-px ${nightMode ? 'bg-neutral-800' : 'bg-slate-200'}`}
              />

              <div>
                <div
                  className={`text-[10px] uppercase tracking-wider font-bold ${
                    nightMode ? 'text-neutral-400' : 'text-slate-500'
                  }`}
                >
                  Remaining
                </div>
                <div
                  className={`text-lg sm:text-xl font-black font-mono ${
                    nightMode ? 'text-blue-400' : 'text-blue-600'
                  }`}
                >
                  {formatDuration(remainingDurationSeconds)}
                </div>
              </div>

              <div
                className={`h-6 w-px ${nightMode ? 'bg-neutral-800' : 'bg-slate-200'}`}
              />

              <div>
                <div
                  className={`text-[10px] uppercase tracking-wider font-bold ${
                    nightMode ? 'text-neutral-400' : 'text-slate-500'
                  }`}
                >
                  Distance
                </div>
                <div
                  className={`text-lg sm:text-xl font-black font-mono ${
                    nightMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formatDistance(remainingDistanceMeters)}
                </div>
              </div>
            </div>

            {/* Re-center navigation icon button */}
            <button
              onClick={onRecenter}
              aria-label="Re-center map on vehicle"
              title="Center map on car"
              className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center border-2 transition-all shadow-sm ${
                followCar
                  ? nightMode
                    ? 'bg-neutral-800 border-neutral-600 text-cyan-400'
                    : 'bg-slate-100 border-slate-300 text-blue-600 hover:bg-slate-200'
                  : 'bg-amber-600 border-amber-400 text-black animate-pulse shadow-md'
              }`}
            >
              <Navigation className="w-5 h-5 fill-current" />
            </button>
          </div>

          {/* Bottom row: End trip & Night/Day toggle */}
          <div className="flex items-center justify-between gap-2 pt-1.5">
            {/* End button */}
            <button
              onClick={onEndRoute}
              aria-label="End navigation trip"
              className="h-10 sm:h-11 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 border border-red-400 rounded-xl font-black text-sm sm:text-base text-white tracking-wider uppercase transition-colors shrink-0 shadow-md"
            >
              END
            </button>

            {destinationName && (
              <div
                className={`text-xs truncate max-w-xs sm:max-w-md ${
                  nightMode ? 'text-neutral-400' : 'text-slate-500'
                }`}
              >
                to{' '}
                <span
                  className={`font-semibold ${
                    nightMode ? 'text-neutral-200' : 'text-slate-800'
                  }`}
                >
                  {destinationName}
                </span>
              </div>
            )}

            {/* D/N Button - Icon Only, reduced by 20% */}
            <button
              onClick={onToggleNight}
              aria-label={nightMode ? 'Switch to light map mode' : 'Switch to dark map mode'}
              title={nightMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                nightMode
                  ? 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border-neutral-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              {nightMode ? (
                <Moon className="w-5 h-5 text-amber-300" />
              ) : (
                <Sun className="w-5 h-5 text-yellow-600" />
              )}
            </button>
          </div>
        </div>
      </footer>
    );
  }

  // Idle state (when not navigating)
  return (
    <footer
      role="contentinfo"
      className={`fixed bottom-0 left-0 right-0 z-1000 backdrop-blur-md border-t select-none transition-colors ${
        nightMode
          ? 'bg-neutral-950/95 border-neutral-700 text-white shadow-xl'
          : 'bg-white/95 border-slate-300 text-slate-900 shadow-lg'
      }`}
    >
      <div className="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between gap-2.5">
        {/* Drop Pin Button (reduced by 20%) */}
        <button
          onClick={onStartPinMode}
          aria-label="Drop a destination pin on the map"
          className={`h-11 sm:h-12 px-4 border rounded-xl font-bold text-sm sm:text-base tracking-wide shrink-0 flex items-center gap-1.5 transition-colors shadow ${
            nightMode
              ? 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border-neutral-600 text-white'
              : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-300 text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4 text-red-500" />
          <span>PIN</span>
        </button>

        {/* Guidance Prompt */}
        <div className="flex-1 min-w-0 px-1 text-left">
          <div
            className={`text-sm sm:text-base font-bold truncate ${
              nightMode ? 'text-neutral-100' : 'text-slate-900'
            }`}
          >
            {destinationName ? `Target: ${destinationName}` : 'Enter destination above to drive'}
          </div>
          <div
            className={`text-[11px] truncate ${
              nightMode ? 'text-neutral-400' : 'text-slate-500'
            }`}
          >
            Origin fixed from car GPS
          </div>
        </div>

        {/* D/N Button - Icon Only (reduced by 20%) */}
        <button
          onClick={onToggleNight}
          aria-label={nightMode ? 'Switch to light map mode' : 'Switch to dark map mode'}
          title={nightMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 transition-colors shadow-sm ${
            nightMode
              ? 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border-neutral-600 text-white'
              : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-300 text-slate-800'
          }`}
        >
          {nightMode ? (
            <Moon className="w-5 h-5 text-amber-300" />
          ) : (
            <Sun className="w-5 h-5 text-yellow-600" />
          )}
        </button>

        {/* Navigation Icon Button (replaces ME button, reduced by 20%) */}
        <button
          onClick={onRecenter}
          aria-label="Re-center map on car position"
          title="Center on car"
          className={`h-11 w-11 rounded-xl flex items-center justify-center border-2 transition-all shrink-0 shadow-sm ${
            followCar
              ? nightMode
                ? 'bg-neutral-800 border-neutral-600 text-cyan-400'
                : 'bg-slate-100 border-slate-300 text-blue-600 hover:bg-slate-200'
              : 'bg-amber-600 border-amber-400 text-black shadow-md'
          }`}
        >
          <Navigation className="w-5 h-5 fill-current" />
        </button>
      </div>
    </footer>
  );
};
