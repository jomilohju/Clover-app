import React from 'react';
import { RouteStep } from '../types/navigation';
import { formatDistance, getInstructionText, getManeuverIconType } from '../utils/navigation';
import { TurnIcon } from './TurnIcon';

interface TopTurnBarProps {
  distanceToTurn: number;
  currentStep: RouteStep | null;
  upcomingStep?: RouteStep | null;
  isOffRoute: boolean;
  isRerouting: boolean;
  hasArrived: boolean;
  onVoiceTest?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  nightMode?: boolean;
}

export const TopTurnBar: React.FC<TopTurnBarProps> = ({
  distanceToTurn,
  currentStep,
  upcomingStep,
  isOffRoute,
  isRerouting,
  hasArrived,
  isMuted,
  onToggleMute,
  nightMode = true,
}) => {
  if (isRerouting || isOffRoute) {
    return (
      <header
        role="banner"
        className="fixed top-0 left-0 right-0 z-1000 bg-amber-600 text-white shadow-2xl border-b-4 border-amber-400 p-4 select-none animate-pulse"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-xl bg-black/40 flex items-center justify-center text-3xl font-black">
              ⚠️
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-wide uppercase">
                {isRerouting ? 'Rerouting...' : 'Off Route'}
              </div>
              <div className="text-sm sm:text-base text-amber-100 font-semibold">
                Finding fastest way back to destination
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-sm bg-black/30 px-3 py-1.5 rounded-lg border border-amber-300">
            AUTO-RECALC
          </div>
        </div>
      </header>
    );
  }

  if (hasArrived) {
    return (
      <header
        role="banner"
        className="fixed top-0 left-0 right-0 z-1000 bg-emerald-700 text-white shadow-2xl border-b-4 border-emerald-400 p-4 select-none"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-xl bg-black/30 flex items-center justify-center">
              <TurnIcon type="arrive" size={40} color="#ffffff" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-wide">
                Destination Reached
              </div>
              <div className="text-sm sm:text-base text-emerald-100 font-medium">
                You have arrived at your destination
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (!currentStep) {
    return null;
  }

  const iconType = getManeuverIconType(currentStep.maneuver.type, currentStep.maneuver.modifier);
  const distanceFormatted = formatDistance(distanceToTurn);
  const instruction = getInstructionText(currentStep);
  const nextRoad = currentStep.name || 'Next Road';

  return (
    <header
      role="banner"
      className={`fixed top-0 left-0 right-0 z-1000 shadow-xl border-b-4 select-none transition-all duration-200 ${
        nightMode
          ? 'bg-neutral-950 text-white'
          : 'bg-white text-slate-900 shadow-md'
      }`}
      style={{ borderBottomColor: '#1A73E8' }}
    >
      <div className="max-w-4xl mx-auto p-2.5 sm:p-3.5">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Large prominent turn arrow */}
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl flex items-center justify-center shadow-inner transition-colors ${
              distanceToTurn <= 50
                ? 'bg-emerald-600 animate-bounce'
                : nightMode
                ? 'bg-neutral-800 border-2 border-neutral-700'
                : 'bg-slate-100 border-2 border-slate-300'
            }`}
          >
            <TurnIcon
              type={iconType}
              size={42}
              color={distanceToTurn <= 50 ? '#ffffff' : nightMode ? '#ffffff' : '#0f172a'}
            />
          </div>

          {/* Distance and Street Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-2">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight font-mono ${
                  nightMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {distanceFormatted}
              </span>
              {distanceToTurn <= 50 && (
                <span className="bg-emerald-500 text-black text-xs font-black px-2 py-0.5 rounded tracking-wider uppercase">
                  TURN
                </span>
              )}
            </div>
            <div
              className={`text-lg sm:text-xl font-bold truncate mt-0.5 ${
                nightMode ? 'text-neutral-100' : 'text-slate-800'
              }`}
            >
              {nextRoad}
            </div>
            <div
              className={`text-xs sm:text-sm truncate ${
                nightMode ? 'text-neutral-400' : 'text-slate-500'
              }`}
            >
              {instruction}
            </div>
          </div>

          {/* Voice Mute Quick Action in Top Bar (reduced by 20%) */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute voice navigation' : 'Mute voice navigation'}
              className={`w-10 h-10 border rounded-xl text-base flex items-center justify-center shrink-0 transition-colors ${
                nightMode
                  ? 'bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 border-neutral-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-300 text-slate-800'
              }`}
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          )}
        </div>

        {/* Secondary upcoming maneuver preview */}
        {upcomingStep && (
          <div
            className={`mt-1.5 pt-1.5 border-t flex items-center space-x-2 text-xs sm:text-sm ${
              nightMode
                ? 'border-neutral-800/80 text-neutral-400'
                : 'border-slate-200 text-slate-500'
            }`}
          >
            <span
              className={`font-semibold ${
                nightMode ? 'text-neutral-300' : 'text-slate-700'
              }`}
            >
              Then:
            </span>
            <TurnIcon
              type={getManeuverIconType(upcomingStep.maneuver.type, upcomingStep.maneuver.modifier)}
              size={16}
              color={nightMode ? '#9ca3af' : '#475569'}
            />
            <span className="truncate">
              {upcomingStep.name ? `${upcomingStep.name}` : getInstructionText(upcomingStep)}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
