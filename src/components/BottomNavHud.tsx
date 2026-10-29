import React, { useState, useEffect } from 'react';

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
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('battery');
      if (param !== null) {
        const val = parseInt(param, 10);
        if (!isNaN(val)) return { level: Math.max(0, Math.min(100, val)), charging: false };
      }
    }
    return null;
  });

  useEffect(() => {
    let isMounted = true;
    let batteryManager: any = null;

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav || typeof nav.getBattery !== 'function') return;

    const updateBattery = () => {
      if (!batteryManager || !isMounted) return;
      setBattery({
        level: Math.round(batteryManager.level * 100),
        charging: Boolean(batteryManager.charging),
      });
    };

    nav.getBattery()
      .then((bm: any) => {
        if (!isMounted) return;
        batteryManager = bm;
        updateBattery();
        bm.addEventListener('levelchange', updateBattery);
        bm.addEventListener('chargingchange', updateBattery);
      })
      .catch(() => {
        /* getBattery blocked or not supported */
      });

    return () => {
      isMounted = false;
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery);
        batteryManager.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  const isLowBattery = battery !== null && battery.level < 20;
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

  const batteryBadge = battery ? (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold shrink-0 select-none transition-colors ${
        isLowBattery ? 'animate-pulse' : ''
      }`}
      style={{
        borderColor: isLowBattery ? '#ef4444' : (nightMode ? '#525252' : '#cbd5e1'),
        color: isLowBattery ? '#ef4444' : (nightMode ? '#ffffff' : '#1e293b'),
        background: isLowBattery
          ? (nightMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(254, 226, 226, 0.85)')
          : (nightMode ? '#1e1e1e' : '#f1f5f9'),
      }}
      title={`Battery: ${battery.level}%${battery.charging ? ' (Charging)' : ''}`}
      aria-label={`Battery level ${battery.level} percent${battery.charging ? ', charging' : ''}`}
    >
      <div className="relative flex items-center">
        <svg className="w-4 h-2.5 shrink-0" viewBox="0 0 24 14" fill="none">
          <rect x="1" y="1" width="19" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
          <path d="M22 4.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect
            x="3"
            y="3"
            width={`${Math.max(1.5, Math.min(15, (battery.level / 100) * 15))}`}
            height="8"
            rx="1"
            fill="currentColor"
          />
        </svg>
        {battery.charging && (
          <span className="text-[10px] leading-none text-amber-500 ml-0.5" role="img" aria-label="Charging">
            ⚡
          </span>
        )}
      </div>
      <span>{battery.level}%</span>
    </div>
  ) : null;

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

            {/* Right: Battery + Mute + Recenter + Day/Night */}
            <div className="flex items-center gap-1.5 shrink-0">
              {batteryBadge}

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

            {/* Right: Battery + Day/Night toggle + Recenter button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {batteryBadge}

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
