import React from 'react';
import { CompletedTrip } from '../types/navigation';
import { formatDistance, formatDuration } from '../utils/navigation';
import { formatTripDate } from '../utils/tripHistory';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: CompletedTrip[];
  onSelectTrip: (trip: CompletedTrip) => void;
  onDeleteTrip: (id: string) => void;
  onClearAll: () => void;
  nightMode: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  trips,
  onSelectTrip,
  onDeleteTrip,
  onClearAll,
  nightMode,
}) => {
  if (!isOpen) return null;

  const bgModal = nightMode ? '#111827' : '#ffffff';
  const textColor = nightMode ? '#f9fafb' : '#0f172a';
  const borderColor = nightMode ? '#374151' : '#e2e8f0';
  const rowBg = nightMode ? '#1f2937' : '#f8fafc';
  const rowBorder = nightMode ? '#374151' : '#e2e8f0';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="fixed inset-0 z-2000 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl border transition-all"
        style={{ background: bgModal, color: textColor, borderColor }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor }}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="history">🕒</span>
            <div>
              <h2 id="history-modal-title" className="text-lg font-bold leading-tight">
                Trip History
              </h2>
              <p className="text-xs opacity-60">Completed navigation routes</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trips.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close history"
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {trips.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="text-4xl mb-3 opacity-40">🗺️</div>
              <p className="font-semibold text-base mb-1">No completed trips yet</p>
              <p className="text-xs opacity-60 max-w-xs mx-auto">
                Completed drives and pinned routes will be logged here with timestamps and distance metrics.
              </p>
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors"
                style={{ background: rowBg, borderColor: rowBorder }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm sm:text-base truncate mb-1">
                    {trip.destinationName}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs opacity-70">
                    <span className="font-medium text-emerald-500">{formatTripDate(trip.completedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatDistance(trip.distanceMeters)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatDuration(trip.durationSeconds)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onSelectTrip(trip);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-transform"
                    aria-label={`Drive again to ${trip.destinationName}`}
                  >
                    <span>Drive</span>
                    <span>➤</span>
                  </button>
                  <button
                    onClick={() => onDeleteTrip(trip.id)}
                    aria-label={`Delete trip to ${trip.destinationName}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 transition-all text-xs"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        {trips.length > 0 && (
          <div className="px-5 py-3 border-t text-center text-[11px] opacity-50 shrink-0" style={{ borderColor }}>
            {trips.length} {trips.length === 1 ? 'completed trip' : 'completed trips'} stored on this device
          </div>
        )}
      </div>
    </div>
  );
};
