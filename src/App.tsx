/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { haversineDistance, isOffRoute, getVoiceAnnouncement, getInstructionText } from './utils/navigation';
import { prefetchRouteTiles } from './utils/tileCache';
import { loadTripHistory, recordCompletedTrip, deleteTripFromHistory, clearTripHistory } from './utils/tripHistory';
import { CompletedTrip } from './types/navigation';

type Timer = ReturnType<typeof setTimeout>;
const isNightNow = () => { const h = new Date().getHours(); return h >= 18 || h < 6; };
const nearestIdx = (coords: [number, number][], lat: number, lng: number) => {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = (coords[i][0] - lat) ** 2 + (coords[i][1] - lng) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};
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
  const restoredRef = useRef(false);
  const hasDepartedRef = useRef(false);

  const toastTimerRef = useRef<Timer | null>(null);
  const simIndexRef = useRef(0);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offRouteCountRef = useRef(0);
  const isReroutingRef = useRef(false);
  const lastRerouteRef = useRef(0);
  const lastEvalLocRef = useRef<GeoLocation | null>(null);
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

  const updateNavigationProgress = useCallback(
    (loc: GeoLocation, route: RouteData, stepIdx: number) => {
      if (!route.steps || route.steps.length === 0) return;
      const currentStep = route.steps[stepIdx];
      if (!currentStep) return;

      const [turnLon, turnLat] = currentStep.maneuver.location;
      const distToTurn = haversineDistance(loc.lat, loc.lng, turnLat, turnLon);
      setDistanceToTurn(distToTurn);

      // Ground distance to the actual destination coordinates
      const [destLat, destLng] = route.destinationCoords;
      const distToDest = haversineDistance(loc.lat, loc.lng, destLat, destLng);

      // Track departure: car must depart from the starting coordinate
      if (!hasDepartedRef.current && route.coordinates.length > 0) {
        const startPt = route.coordinates[0];
        const distFromStart = haversineDistance(loc.lat, loc.lng, startPt[0], startPt[1]);
        if (distFromStart > 25) {
          hasDepartedRef.current = true;
        }
      }

      // Advance to the next maneuver. No premature announcement here
      if (distToTurn < 35 && stepIdx < route.steps.length - 1) {
        setCurrentStepIndex(stepIdx + 1);
        lastStepIndexRef.current = stepIdx + 1;
        lastMilestoneRef.current = null;
        return;
      }

      // Arrival check: never trigger on step 0 departure location
      const isFinalStep = stepIdx >= route.steps.length - 1;
      const canTriggerArrival =
        route.steps.length > 1
          ? isFinalStep && distToDest <= 35
          : hasDepartedRef.current && distToDest <= 30;

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

      // FIX: start at stepIdx so the leg after the upcoming turn is counted
      let sumDistance = distToTurn;
      let sumDuration = 0;
      for (let i = stepIdx; i < route.steps.length; i++) {
        sumDistance += route.steps[i].distance;
        sumDuration += route.steps[i].duration;
      }
      setRemainingDistance(sumDistance);
      const remainingSeconds = Math.max(30, Math.round(sumDuration));
      setRemainingDuration(remainingSeconds);
      setEta(new Date(Date.now() + remainingSeconds * 1000));

      // FIX: only count new GPS fixes, scale the threshold with accuracy, add a reroute cooldown
      if (route.coordinates.length > 2 && !isReroutingRef.current) {
        const isNewFix = lastEvalLocRef.current !== loc;
        lastEvalLocRef.current = loc;
        const threshold = Math.max(45, (loc.accuracy || 10) * 2);
        if (isOffRoute(loc, route.coordinates, threshold)) {
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
    [hasArrived]
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

  // Save the route so a reloaded browser tab can pick up where it left off
  useEffect(() => {
    if (!isNavigating || !routeData) return;
    try {
      const slim = { ...routeData, steps: routeData.steps.map(({ geometry, ...s }) => s) };
      localStorage.setItem('carnav_route', JSON.stringify(slim));
    } catch { /* storage full or blocked */ }
  }, [isNavigating, routeData]);

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

  const handleEndRoute = () => {
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
  };

  const handleToggleMute = () => setIsMuted(voiceGuidance.toggleMute());
  const handleTestVoice = () => voiceGuidance.testVoice();
  const handleToggleNight = () => {
    setNightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('carnav_theme_mode', next ? 'night' : 'day');
      } catch { /* ignore */ }
      return next;
    });
  };

  // FIX: uses speedRef (current speed), not the speed from when the map was touched
  const handleUserMapInteraction = useCallback(() => {
    setFollowCar(false);
    if (autoRecenterTimerRef.current) clearTimeout(autoRecenterTimerRef.current);
    autoRecenterTimerRef.current = setTimeout(() => {
      if (speedRef.current > 1.5) setFollowCar(true);
    }, 12000);
  }, []);

  const handleRecenter = () => setFollowCar(true);

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
    if (dist < 40) {
      showToast('Please pan the crosshair further from your current vehicle position to drop a pin.');
      return;
    }
    setIsPinMode(false);
    handleStartRoute(pinCenter.lat, pinCenter.lng, 'Dropped Pin');
  };

  const banner = [gpsMessage && !isSimulating ? gpsMessage : null, !online ? 'No data. Guidance continues on your saved route.' : null].filter(Boolean).join('   |   ');
  const currentStep: RouteStep | null = routeData?.steps?.[currentStepIndex] ?? null;
  const upcomingStep: RouteStep | null = routeData?.steps?.[currentStepIndex + 1] ?? null;
  const speedKmh = (currentLocation.speed || 0) * 3.6;

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
          onMapCenterChange={(lat, lng) => setPinCenter({ lat, lng })}
          gpsAccuracy={currentLocation.accuracy}
          speedKmh={speedKmh}
          hideControls={viewMode === 'welcome'}
        />
      </main>

      <PinDropOverlay isActive={isPinMode && viewMode === 'map'} onSetHere={handleSetPinHere} onCancel={() => setIsPinMode(false)} nightMode={nightMode} />

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
          onSearch={() => setSearchSignal((n) => n + 1)}
          onStartPinMode={() => setIsPinMode(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
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
