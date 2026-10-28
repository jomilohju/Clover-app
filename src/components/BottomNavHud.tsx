import React from 'react';

interface BottomNavHudProps {
  isNavigating: boolean;
  speedKmh: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  eta: Date | null;
  nightMode: boolean;
  followCar: boolean;
  isMuted: boolean;
  destinationName?: string;
  onSearch: () => void;
  onStartPinMode?: () => void;
  onOpenHistory?: () => void;
  onToggleNight?: () => void;
  onToggleMute: () => void;
  onEndRoute: () => void;
  onRecenter: () => void;
}

const two = (n: number) => (n < 10 ? '0' + n : '' + n);
const fmtDist = (m: number) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km');

export const BottomNavHud: React.FC<BottomNavHudProps> = ({
  isNavigating,
  speedKmh,
  remainingDistanceMeters,
  remainingDurationSeconds,
  eta,
  nightMode,
  followCar,
  isMuted,
  destinationName,
  onSearch,
  onStartPinMode,
  onOpenHistory,
  onToggleNight,
  onToggleMute,
  onEndRoute,
  onRecenter,
}) => {
  const mins = Math.max(1, Math.round(remainingDurationSeconds / 60));

  const cardStyle: React.CSSProperties = {
    background: nightMode ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    color: nightMode ? '#ffffff' : '#0f172a',
    borderColor: nightMode ? '#404040' : '#cbd5e1',
  };

  const iconBtnStyle: React.CSSProperties = {
    background: nightMode ? '#1e1e1e' : '#f1f5f9',
    borderColor: nightMode ? '#525252' : '#cbd5e1',
    color: nightMode ? '#ffffff' : '#1e293b',
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-6 max-w-2xl mx-auto z-1000 select-none">
      <div
        className="border-2 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2.5 shadow-xl transition-colors"
        style={cardStyle}
      >
        {isNavigating ? (
          <>
            {/* Left: Speed readout + END button */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="border px-2 py-1 rounded-xl text-center min-w-[58px]"
                style={{
                  background: nightMode ? '#171717' : '#f8fafc',
                  borderColor: nightMode ? '#404040' : '#e2e8f0',
                }}
              >
                <span className="font-bold font-mono text-lg block leading-tight text-emerald-500">
                  {Math.round(speedKmh)}
                </span>
                <span className="text-[9px] block uppercase font-mono tracking-wider opacity-60">
                  KM/H
                </span>
              </div>
              <button
                onClick={onEndRoute}
                aria-label="End route"
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold h-11 px-4 rounded-xl text-sm tracking-wider uppercase shadow-md flex items-center justify-center shrink-0"
              >
                END
              </button>
            </div>

            {/* Center: ETA / Remaining / Distance & Destination */}
            <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-2 text-center">
              <div className="flex items-center justify-center gap-2.5 sm:gap-3.5">
                <div>
                  <div className="text-[9px] uppercase font-bold tracking-wider opacity-60">ETA</div>
                  <div className="font-bold font-mono text-sm sm:text-base leading-tight">
                    {eta ? `${two(eta.getHours())}:${two(eta.getMinutes())}` : '--:--'}
                  </div>
                </div>
                <div className="h-5 w-px opacity-20 bg-current" />
                <div>
                  <div className="text-[9px] uppercase font-bold tracking-wider opacity-60">REMAINING</div>
                  <div className="font-bold font-mono text-sm sm:text-base leading-tight" style={{ color: '#1A73E8' }}>
                    {mins} min
                  </div>
                </div>
                <div className="h-5 w-px opacity-20 bg-current" />
                <div>
                  <div className="text-[9px] uppercase font-bold tracking-wider opacity-60">DISTANCE</div>
                  <div className="font-bold font-mono text-sm sm:text-base leading-tight">
                    {fmtDist(remainingDistanceMeters)}
                  </div>
                </div>
              </div>
              <div className="text-xs font-medium truncate max-w-full opacity-75 mt-0.5">
                to {destinationName || 'Destination'}
              </div>
            </div>

            {/* Right: Mute + Recenter + Day/Night */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onToggleMute}
                aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
                className="w-11 h-11 border rounded-xl flex items-center justify-center text-lg shadow-sm"
                style={{
                  ...iconBtnStyle,
                  background: isMuted ? (nightMode ? '#78350f' : '#fef3c7') : iconBtnStyle.background,
                }}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>

              <button
                onClick={onRecenter}
                aria-label="Re-center map on car"
                className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-sm transition-transform active:scale-95"
                style={{
                  background: followCar ? '#1A73E8' : '#d97706',
                }}
              >
                🧭
              </button>

              {onToggleNight && (
                <button
                  onClick={onToggleNight}
                  aria-label={nightMode ? 'Switch to daylight' : 'Switch to night mode'}
                  className="w-11 h-11 border rounded-xl flex items-center justify-center text-lg shadow-sm"
                  style={iconBtnStyle}
                >
                  {nightMode ? '🌙' : '☀️'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Idle state: Left buttons (PIN + HISTORY) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onStartPinMode && (
                <button
                  onClick={onStartPinMode}
                  aria-label="Drop pin on map"
                  className="flex items-center gap-1.5 h-11 px-3 sm:px-3.5 rounded-xl font-bold text-xs sm:text-sm border shadow-sm shrink-0 active:scale-95 transition-transform"
                  style={iconBtnStyle}
                >
                  <span>📍</span>
                  <span>PIN</span>
                </button>
              )}
              {onOpenHistory && (
                <button
                  onClick={onOpenHistory}
                  aria-label="Trip history"
                  className="flex items-center gap-1.5 h-11 px-3 sm:px-3.5 rounded-xl font-bold text-xs sm:text-sm border shadow-sm shrink-0 active:scale-95 transition-transform"
                  style={iconBtnStyle}
                >
                  <span>🕒</span>
                  <span className="hidden xs:inline sm:inline">HISTORY</span>
                </button>
              )}
            </div>

            {/* Center: Tap to search prompt */}
            <button
              onClick={onSearch}
              className="flex-1 min-w-0 px-2 py-1 text-center cursor-pointer rounded-lg hover:opacity-90 active:scale-[0.99] transition"
            >
              <div className="font-bold text-sm sm:text-base truncate">
                Enter destination above to drive
              </div>
              <div className="text-[11px] sm:text-xs opacity-60 truncate">
                Origin fixed from car GPS · Tap here or top search bar
              </div>
            </button>

            {/* Right: Day/Night toggle + Recenter button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleNight && (
                <button
                  onClick={onToggleNight}
                  aria-label={nightMode ? 'Switch to daylight' : 'Switch to night mode'}
                  className="w-11 h-11 border rounded-xl flex items-center justify-center text-lg shadow-sm"
                  style={iconBtnStyle}
                >
                  {nightMode ? '🌙' : '☀️'}
                </button>
              )}

              <button
                onClick={onRecenter}
                aria-label="Re-center map on car"
                className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-sm transition-transform active:scale-95"
                style={{
                  background: followCar ? '#2563eb' : '#d97706',
                }}
              >
                🧭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
