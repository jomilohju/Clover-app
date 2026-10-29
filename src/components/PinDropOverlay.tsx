import React from 'react';

interface PinDropOverlayProps {
  isActive: boolean;
  onSetHere: () => void;
  onCancel: () => void;
  nightMode?: boolean;
  distanceMeters?: number;
}

export const PinDropOverlay: React.FC<PinDropOverlayProps> = ({
  isActive,
  onSetHere,
  onCancel,
  nightMode = true,
  distanceMeters,
}) => {
  if (!isActive) return null;

  return (
    <>
      {/* Center crosshair */}
      <div
        className="fixed inset-0 pointer-events-none z-1000 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-red-500 bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" />
          <div className="absolute w-2 h-2 rounded-full bg-red-600" />
          <div className="absolute w-8 h-0.5 bg-red-500" />
          <div className="absolute h-8 w-0.5 bg-red-500" />
        </div>
      </div>

      {/* Floating prompt & action bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-1000 border-t p-3 flex items-center justify-between gap-3 shadow-2xl transition-colors ${
          nightMode
            ? 'bg-neutral-950 border-neutral-700 text-white'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        <div className="text-left px-2">
          <div className="text-base sm:text-lg font-bold flex items-center gap-2">
            <span>Move map or tap target</span>
            {distanceMeters !== undefined && distanceMeters >= 15 && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`}
              </span>
            )}
          </div>
          <div className={`text-xs ${nightMode ? 'text-neutral-400' : 'text-slate-500'}`}>
            Tap map or drag crosshair to destination, then tap SET HERE
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            aria-label="Cancel pin dropping"
            className={`h-11 px-4 border rounded-xl font-bold text-sm sm:text-base transition-colors ${
              nightMode
                ? 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border-neutral-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-300 text-slate-800'
            }`}
          >
            CANCEL
          </button>
          <button
            onClick={onSetHere}
            aria-label="Set destination at map center crosshair"
            className="h-11 px-5 bg-red-600 hover:bg-red-500 active:bg-red-700 border border-red-400 rounded-xl font-black text-sm sm:text-base text-white uppercase tracking-wider shadow-lg"
          >
            SET HERE
          </button>
        </div>
      </div>
    </>
  );
};
