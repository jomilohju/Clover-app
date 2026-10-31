/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GeoLocation, RouteData, RouteStep } from './types/navigation';
import { NavigationMap } from './components/NavigationMap';
import { TopTurnBar } from './components/TopTurnBar';
import { TopSearchBar } from './components/TopSearchBar';
import { BottomNavHud } from './components/BottomNavHud';
import { PinDropOverlay } from './components/PinDropOverlay';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HistoryModal } from './components/HistoryModal';
import { fetchRoute } from './services/routing';
import { voiceGuidance } from './services/voiceGuidance';
import { haversineDistance, isOffRoute, getVoiceAnnouncement, getInstructionText, buildRouteIndex, locateOnRoute } from './utils/navigation';
import { prefetchRouteTiles } from './utils/tileCache';
import { loadTripHistory, recordCompletedTrip, deleteTripFromHistory, clearTripHistory } from './utils/tripHistory';
import { CompletedTrip } from './types/navigation';

type Timer = ReturnType<typeof setTimeout>;
const isNightNow = () => { const h = new Date().getHours(); return h >= 18 || h < 6; };
// Open the app with ?debug=1 to show the bench-test buttons
const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
const dbgBtn: React.CSSProperties = { background: '#c026d3', color: '#fff', fontWeight: 700, padding: '10px 14px', borderRadius: 10 };

export default function App() {
  const [currentLocation, setCurrentLocation] = useState<GeoLocation>({ lat: 6.5244, lng: 3.3792, heading: 0, speed: 0, accuracy: 8 });
  const [gpsLocked, setGpsLocked] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>('Searching for GPS...');
  const [followCar, setFollowCar] = useState(true);
  // Default to daylight (Google Maps palette) or respect saved user preference
  const [nightMode, setNightMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carnav_theme_mode');
      if (saved === 'night') return true;
      if (saved === 'day') return false;
    }
    return false;
  });
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(0);
  const [eta, setEta] = useState<Date | null>(null);
  const [isOffRouteState, setIsOffRouteState] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [isMuted, setIsMuted] = useState(() => voiceGuidance.getMuted());
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinCenter, setPinCenter] = useState({ lat: 6.5244, lng: 3.3792 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [searchSignal, setSearchSignal] = useState(0);
  const [viewMode, setViewMode] = useState<'welcome' | 'map'>('welcome');
  const [tripHistory, setTripHistory] = useState<CompletedTrip[]>(() => loadTripHistory());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const needsRerouteRef = useRef(false);
  const hasDepartedRef = useRef(false);

  const toastTimerRef = useRef<Timer | null>(null);
  const simIndexRef = useRef(0);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offRouteCountRef = useRef(0);
  const isReroutingRef = useRef(false);
  const lastRerouteRef = useRef(0);
  const lastEvalLocRef = useRef<GeoLocation | null>(null);
  const hintSegRef = useRef(0);
  const lastMilestoneRef = useRef<number | null>(null);
  const lastStepIndexRef = useRef(0);
  const autoRecenterTimerRef = useRef<Timer | null>(null);
  const lastFixRef = useRef(0);
  const speedRef = useRef(0);
  speedRef.current = currentLocation.speed || 0;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4500);
  }, []);

  // Real GPS. FIX: errors and lost signal are now shown on screen.
  useEffect(() => {
    if (!navigator.geolocation) { setGpsMessage('This browser has no GPS support.'); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (isSimulating) return;
        const c = pos.coords;
        lastFixRef.current = Date.now();
        setGpsLocked(true);
        setGpsMessage(null);
        setCurrentLocation((prev) => {
          let heading = c.heading;
          if ((heading === null || isNaN(heading)) && prev) {
            const dLat = c.latitude - prev.lat;
            const dLng = c.longitude - prev.lng;
            if (Math.hypot(dLat, dLng) > 0.00005) {
              heading = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
            } else {
              heading = prev.heading ?? null;
            }
          }
          return {
            lat: c.latitude,
            lng: c.longitude,
            heading: heading !== undefined ? heading : null,
            speed: c.speed !== null && !isNaN(c.speed) ? c.speed : 0,
            accuracy: c.accuracy || 10,
          };
        });
      },
      (err) => {
        setGpsMessage(
          err.code === 1
            ? 'Location is blocked. Allow location for this site in Chrome settings.'
            : err.code === 2
              ? 'GPS signal unavailable.'
              : 'Searching for GPS...'
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [isSimulating]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!isSimulating && lastFixRef.current && Date.now() - lastFixRef.current > 10000) {
        setGpsMessage('GPS lost. Searching...');
      }
    }, 3000);
    return () => clearInterval(t);
  }, [isSimulating]);


  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const triggerReroute = async (loc: GeoLocation, currentRoute: RouteData) => {
    if (isReroutingRef.current) return;
    if (!navigator.onLine) {
      needsRerouteRef.current = true;
      lastRerouteRef.current = Date.now();
      showToast('Off route, but there is no data to recalculate. Will retry when signal returns.');
      return;
    }
    isReroutingRef.current = true;
    lastRerouteRef.current = Date.now(); // FIX: cooldown starts even if the reroute fails
    setIsRerouting(true);
    voiceGuidance.speak('Off route. Recalculating route.');
    try {
      const [destLat, destLng] = currentRoute.destinationCoords;
      const newRoute = await fetchRoute(loc.lat, loc.lng, destLat, destLng, currentRoute.destinationName);
      setRouteData(newRoute);
      setCurrentStepIndex(0);
      lastStepIndexRef.current = 0;
      lastMilestoneRef.current = null;
      offRouteCountRef.current = 0;
      setIsOffRouteState(false);
      if (newRoute.steps && newRoute.steps.length > 0) {
        voiceGuidance.speak(`New route calculated. ${getInstructionText(newRoute.steps[0])}`);
      }
    } catch (err) {
      console.error('Auto-reroute failed:', err);
      showToast('Could not recalculate the route. Check your data connection.');
    } finally {
      setIsRerouting(false);
      isReroutingRef.current = false;
    }
  };

  // Cumulative distances and maneuver positions are computed once per route, not on every GPS fix
  const routeIndex = useMemo(
    () =>
      routeData && routeData.coordinates.length > 1
        ? buildRouteIndex(routeData.coordinates, routeData.steps || [])
        : null,
    [routeData]
  );
  useEffect(() => {
    hintSegRef.current = 0;
  }, [routeData]);

  const updateNavigationProgress = useCallback(
    (loc: GeoLocation, route: RouteData, stepIdx: number) => {
      if (!route.steps || route.steps.length === 0) return;
      const currentStep = route.steps[stepIdx];
      if (!currentStep) return;

      const lastIdx = route.steps.length - 1;
      const [destLat, destLng] = route.destinationCoords;
      const distToDest = haversineDistance(loc.lat, loc.lng, destLat, destLng);

      // Where is the car on the route line? (short local search, full scan only when far from it)
      const here = routeIndex ? locateOnRoute(route.coordinates, routeIndex, loc, hintSegRef.current) : null;
      if (here) hintSegRef.current = here.seg;
      const along = routeIndex && here && here.dist <= 60 ? here.along : null; // null = off the line, use straight-line fallbacks

      // Distance to the upcoming maneuver (the next step's start, or the destination on the final step)
      const nextStep = route.steps[stepIdx + 1];
      let distToTurn: number;
      if (routeIndex && along !== null) {
        distToTurn = Math.max(0, routeIndex.cum[routeIndex.stepCoordIdx[Math.min(stepIdx + 1, lastIdx)]] - along);
      } else {
        let targetLat = destLat;
        let targetLng = destLng;
        if (nextStep && nextStep.maneuver && nextStep.maneuver.location) {
          targetLng = nextStep.maneuver.location[0];
          targetLat = nextStep.maneuver.location[1];
        }
        distToTurn = haversineDistance(loc.lat, loc.lng, targetLat, targetLng);
      }
      setDistanceToTurn(Math.round(distToTurn / 5) * 5); // rounded so the HUD only redraws when the shown value can change

      // Track departure: car must depart from the starting coordinate
      if (!hasDepartedRef.current && route.coordinates.length > 0) {
        const startPt = route.coordinates[0];
        const distFromStart = haversineDistance(loc.lat, loc.lng, startPt[0], startPt[1]);
        if (distFromStart > 20) {
          hasDepartedRef.current = true;
        }
      }

      // Advance when the upcoming maneuver is reached OR already passed along the route line.
      // Position along the line cannot be skipped by a fast car between two GPS fixes.
      if (stepIdx < lastIdx) {
        let next = stepIdx;
        if (routeIndex && along !== null) {
          while (next < lastIdx) {
            const remaining = routeIndex.cum[routeIndex.stepCoordIdx[next + 1]] - along;
            if (remaining < (next === stepIdx ? 25 : 0)) next++; // extra steps only once truly passed
            else break;
          }
        } else if (distToTurn < 30) {
          next = stepIdx + 1;
        }
        if (next !== stepIdx) {
          setCurrentStepIndex(next);
          lastStepIndexRef.current = next;
          lastMilestoneRef.current = null;
          return;
        }
      }

      // Arrival check: NEVER trigger arrival until the vehicle has actually departed the start point
      const isFinalStep = stepIdx >= lastIdx;
      const canTriggerArrival = hasDepartedRef.current && isFinalStep && distToDest <= 30;

      if (canTriggerArrival) {
        if (!hasArrived) {
          setHasArrived(true);
          voiceGuidance.speak('You have arrived at your destination.');
          recordCompletedTrip(route);
          setTripHistory(loadTripHistory());
        }
        return;
      }

      if (lastStepIndexRef.current !== stepIdx) {
        lastStepIndexRef.current = stepIdx;
        lastMilestoneRef.current = null;
      }
      const voiceAlert = getVoiceAnnouncement(distToTurn, currentStep, lastMilestoneRef.current);
      if (voiceAlert) {
        lastMilestoneRef.current = voiceAlert.milestone;
        voiceGuidance.speak(voiceAlert.text);
      }

      // Remaining distance and time
      let remDist: number;
      let remDur: number;
      if (routeIndex && along !== null && routeIndex.total > 0) {
        remDist = Math.max(0, routeIndex.total - along);
        remDur = route.duration * (remDist / routeIndex.total);
      } else {
        // The current step is already covered by distToTurn, so sum only the steps AFTER it
        remDist = distToTurn;
        remDur = 0;
        for (let i = stepIdx + 1; i < route.steps.length; i++) {
          remDist += route.steps[i].distance;
          remDur += route.steps[i].duration;
        }
      }
      const remSeconds = Math.max(30, Math.round(remDur / 10) * 10);
      setRemainingDistance(Math.round(remDist / 10) * 10);
      setRemainingDuration(remSeconds);
      const etaNow = new Date(Date.now() + remSeconds * 1000);
      setEta((prev) => (prev && Math.abs(prev.getTime() - etaNow.getTime()) < 30000 ? prev : etaNow)); // keep the same Date unless it moved by 30 s+

      // Off-route: only count new GPS fixes, scale the threshold with accuracy, add a reroute cooldown
      if (route.coordinates.length > 2 && !isReroutingRef.current) {
        const isNewFix = lastEvalLocRef.current !== loc;
        lastEvalLocRef.current = loc;
        const threshold = Math.max(45, (loc.accuracy || 10) * 2);
        const off = here ? here.dist > threshold : isOffRoute(loc, route.coordinates, threshold);
        if (off) {
          if (isNewFix) offRouteCountRef.current += 1;
          if (offRouteCountRef.current >= 3 && Date.now() - lastRerouteRef.current > 15000) {
            setIsOffRouteState(true);
            triggerReroute(loc, route);
          }
        } else {
          offRouteCountRef.current = 0;
          setIsOffRouteState(false);
        }
      }
    },
    [hasArrived, routeIndex]
  );

  useEffect(() => {
    if (isNavigating && routeData) updateNavigationProgress(currentLocation, routeData, currentStepIndex);
  }, [currentLocation, isNavigating, routeData, currentStepIndex, updateNavigationProgress]);

  // When data returns after an off-route moment, recalculate straight away
  useEffect(() => {
    if (online && needsRerouteRef.current && routeData && isNavigating) {
      needsRerouteRef.current = false;
      triggerReroute(currentLocation, routeData);
    }
  }, [online]);

  // On fresh app launch, clear any leftover partial route from earlier sessions
  // so the Welcome Screen is always displayed cleanly on entry
  useEffect(() => {
    try {
      localStorage.removeItem('carnav_route');
    } catch {
      /* ignore */
    }
  }, []);

  // Save the map tiles along each new route
  useEffect(() => {
    if (routeData) prefetchRouteTiles(routeData.coordinates, nightMode);
  }, [routeData]);

  // FIX: refuses to start from the placeholder Lagos position before the first real GPS fix
  const handleStartRoute = async (destLat: number, destLng: number, destName: string, force = false) => {
    if (!gpsLocked && !force) {
      showToast('Waiting for GPS signal. Try again in a moment.');
      return;
    }
    try {
      setIsPinMode(false);
      setIsNavigating(false);
      setHasArrived(false);
      setIsOffRouteState(false);
      hasDepartedRef.current = false;
      setViewMode('map');
      const route = await fetchRoute(currentLocation.lat, currentLocation.lng, destLat, destLng, destName);
      setRouteData(route);
      setCurrentStepIndex(0);
      lastStepIndexRef.current = 0;
      lastMilestoneRef.current = null;
      offRouteCountRef.current = 0;
      lastRerouteRef.current = Date.now();
      setIsNavigating(true);
      setFollowCar(true);
      if (route.steps && route.steps.length > 0) {
        voiceGuidance.speak(`Starting route to ${destName}. ${getInstructionText(route.steps[0])}`);
      }
    } catch (err: unknown) {
      showToast(`Notice: ${err instanceof Error ? err.message : 'Routing error'}`);
    }
  };

  const handleEndRoute = useCallback(() => {
    if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = null; }
    setIsSimulating(false);
    setIsNavigating(false);
    setRouteData(null);
    setHasArrived(false);
    setIsOffRouteState(false);
    setIsRerouting(false);
    setFollowCar(true);
    try { localStorage.removeItem('carnav_route'); } catch { /* ignore */ }
    voiceGuidance.speak('Route ended.');
  }, []);

  const handleToggleMute = useCallback(() => setIsMuted(voiceGuidance.toggleMute()), []);
  const handleTestVoice = useCallback(() => voiceGuidance.testVoice(), []);
  const handleToggleNight = useCallback(() => {
    setNightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('carnav_theme_mode', next ? 'night' : 'day');
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // FIX: uses speedRef (current speed), not the speed from when the map was touched
  const handleUserMapInteraction = useCallback(() => {
    setFollowCar(false);
    if (autoRecenterTimerRef.current) clearTimeout(autoRecenterTimerRef.current);
    autoRecenterTimerRef.current = setTimeout(() => {
      if (speedRef.current > 1.5) setFollowCar(true);
    }, 12000);
  }, []);

  const handleRecenter = useCallback(() => setFollowCar(true), []);
  const handleSearchOpen = useCallback(() => setSearchSignal((n) => n + 1), []);
  const handleStartPin = useCallback(() => setIsPinMode(true), []);
  const handleOpenHistory = useCallback(() => setIsHistoryOpen(true), []);
  const handlePinCenterChange = useCallback((lat: number, lng: number) => setPinCenter({ lat, lng }), []);

  // Bench-test drive (shown with ?debug=1)
  const handleToggleSimulation = () => {
    if (isSimulating) {
      if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = null; }
      setIsSimulating(false);
      return;
    }
    if (!routeData || routeData.coordinates.length < 2) {
      handleStartRoute(6.4283, 3.4219, 'Eko Hotel, Victoria Island', true);
      return;
    }
    setIsSimulating(true);
    simIndexRef.current = 0;
    const coords = routeData.coordinates;
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = setInterval(() => {
      const idx = simIndexRef.current;
      if (idx >= coords.length - 1) {
        clearInterval(simTimerRef.current!);
        simTimerRef.current = null;
        setIsSimulating(false);
        return;
      }
      const p1 = coords[idx];
      const p2 = coords[idx + 1];
      const heading = ((Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI + 360) % 360;
      setCurrentLocation({ lat: p2[0], lng: p2[1], heading, speed: 13.5, accuracy: 4 });
      simIndexRef.current = idx + 1;
    }, 650);
  };

  const handleTriggerOffRouteTest = () => {
    setCurrentLocation({ ...currentLocation, lat: currentLocation.lat + 0.0014, lng: currentLocation.lng + 0.0014 });
  };

  const handleSetPinHere = () => {
    const dist = haversineDistance(currentLocation.lat, currentLocation.lng, pinCenter.lat, pinCenter.lng);
    if (dist < 15) {
      showToast('Please pan crosshair or tap the map further from your vehicle to drop a pin.');
      return;
    }
    setIsPinMode(false);
    handleStartRoute(pinCenter.lat, pinCenter.lng, 'Dropped Pin', true);
  };

  const banner = [gpsMessage && !isSimulating ? gpsMessage : null, !online ? 'No data. Guidance continues on your saved route.' : null].filter(Boolean).join('   |   ');
  const currentStep: RouteStep | null = routeData?.steps?.[currentStepIndex] ?? null;
  const upcomingStep: RouteStep | null = routeData?.steps?.[currentStepIndex + 1] ?? null;
  const speedKmh = Math.round((currentLocation.speed || 0) * 3.6); // whole km/h: it is shown rounded anyway, and stable props let the HUD skip redraws

  return (
    <div className={`relative w-screen h-screen overflow-hidden select-none font-sans ${nightMode ? 'bg-black text-white' : 'bg-slate-100 text-slate-900'}`}>
      {!isNavigating && viewMode === 'map' && (
        <>
          <button
            onClick={() => setViewMode('welcome')}
            aria-label="Return to Welcome screen"
            className="fixed top-3 left-3 sm:left-6 z-1100 flex items-center gap-2 h-16 px-3.5 sm:px-4 rounded-2xl border-2 shadow-lg backdrop-blur-md transition-all active:scale-95"
            style={{
              background: nightMode ? 'rgba(10, 15, 29, 0.95)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: nightMode ? '#374151' : '#cbd5e1',
              color: nightMode ? '#f8fafc' : '#0f172a',
            }}
          >
            <span className="text-2xl leading-none" role="img" aria-label="four leaf clover">🍀</span>
            <span className="font-black text-sm sm:text-base tracking-tight hidden sm:inline">Clover app</span>
          </button>

          <TopSearchBar
            userLocation={currentLocation}
            gpsLocked={gpsLocked}
            openSignal={searchSignal}
            onStartPinMode={() => setIsPinMode(true)}
            onSelectDestination={(lat, lng, name) => handleStartRoute(lat, lng, name)}
            isPinMode={isPinMode}
            nightMode={nightMode}
          />
        </>
      )}

      {isNavigating && viewMode === 'map' && (
        <TopTurnBar
          distanceToTurn={distanceToTurn}
          currentStep={currentStep}
          upcomingStep={upcomingStep}
          isOffRoute={isOffRouteState}
          isRerouting={isRerouting}
          hasArrived={hasArrived}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onVoiceTest={handleTestVoice}
          nightMode={nightMode}
        />
      )}

      <main
        className="w-full h-full"
        style={{
          visibility: viewMode === 'welcome' ? 'hidden' : 'visible',
          pointerEvents: viewMode === 'welcome' ? 'none' : 'auto',
        }}
      >
        <NavigationMap
          currentLocation={currentLocation}
          routeData={routeData}
          currentStep={currentStep}
          nightMode={nightMode}
          followCar={followCar}
          isPinMode={isPinMode}
          onUserMapInteraction={handleUserMapInteraction}
          onMapCenterChange={handlePinCenterChange}
          gpsAccuracy={Math.round(currentLocation.accuracy ?? 10)}
          speedKmh={speedKmh}
          hideControls={viewMode === 'welcome'}
        />
      </main>

      <PinDropOverlay
        isActive={isPinMode && viewMode === 'map'}
        onSetHere={handleSetPinHere}
        onCancel={() => setIsPinMode(false)}
        nightMode={nightMode}
        distanceMeters={haversineDistance(currentLocation.lat, currentLocation.lng, pinCenter.lat, pinCenter.lng)}
      />

      {!isPinMode && viewMode === 'map' && (
        <BottomNavHud
          isNavigating={isNavigating}
          speedKmh={speedKmh}
          remainingDistanceMeters={remainingDistance}
          remainingDurationSeconds={remainingDuration}
          eta={eta}
          nightMode={nightMode}
          followCar={followCar}
          isMuted={isMuted}
          destinationName={routeData?.destinationName}
          onSearch={handleSearchOpen}
          onStartPinMode={handleStartPin}
          onOpenHistory={handleOpenHistory}
          onToggleNight={handleToggleNight}
          onToggleMute={handleToggleMute}
          onEndRoute={handleEndRoute}
          onRecenter={handleRecenter}
        />
      )}

      {/* Welcome Home Screen */}
      {viewMode === 'welcome' && (
        <WelcomeScreen
          onOpenMap={() => setViewMode('map')}
          onSelectDestination={(lat, lng, name) => {
            setViewMode('map');
            handleStartRoute(lat, lng, name);
          }}
          onStartPinMode={() => {
            setViewMode('map');
            setIsPinMode(true);
          }}
          onOpenHistory={() => setIsHistoryOpen(true)}
          currentLocation={currentLocation}
          recentTrips={tripHistory}
          nightMode={nightMode}
          onToggleNight={handleToggleNight}
          gpsLocked={gpsLocked}
        />
      )}

      {/* Completed Trip History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        trips={tripHistory}
        onSelectTrip={(trip) => {
          setViewMode('map');
          handleStartRoute(trip.destinationCoords[0], trip.destinationCoords[1], trip.destinationName, true);
        }}
        onDeleteTrip={(id) => setTripHistory(deleteTripFromHistory(id))}
        onClearAll={() => {
          clearTripHistory();
          setTripHistory([]);
        }}
        nightMode={nightMode}
      />

      {banner && viewMode === 'map' && (
        <div role="alert" className="fixed left-0 right-0 bottom-28 z-2000 text-center font-bold text-lg py-2" style={{ background: '#f59e0b', color: '#000' }}>
          {banner}
        </div>
      )}

      {DEBUG && viewMode === 'map' && (
        <div className="fixed right-3 top-40 z-2000 flex flex-col gap-2">
          <button style={dbgBtn} onClick={handleToggleSimulation}>{isSimulating ? 'STOP SIM' : 'SIM DRIVE'}</button>
          <button style={dbgBtn} onClick={handleTriggerOffRouteTest}>OFF ROUTE</button>
          <button style={dbgBtn} onClick={handleTestVoice}>VOICE</button>
        </div>
      )}

      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-2000 border-2 px-5 py-3 rounded-2xl font-bold flex items-center gap-3" style={{ background: '#171717', borderColor: '#525252', color: '#fff' }}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
    </div>
  );
}
