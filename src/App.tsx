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
import { fetchRoute } from './services/routing';
import { voiceGuidance } from './services/voiceGuidance';
import {
  haversineDistance,
  isOffRoute,
  getVoiceAnnouncement,
  getInstructionText,
} from './utils/navigation';

export default function App() {
  // Navigation & GPS State
  const [currentLocation, setCurrentLocation] = useState<GeoLocation>({
    lat: 6.5244,
    lng: 3.3792,
    heading: 0,
    speed: 0,
    accuracy: 8,
  });
  const [gpsLocked, setGpsLocked] = useState(false);
  const [followCar, setFollowCar] = useState(true);
  const [nightMode, setNightMode] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('carnav_night');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });

  // Route State
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

  // Overlays & UI Modes
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinCenter, setPinCenter] = useState<{ lat: number; lng: number }>({
    lat: 6.5244,
    lng: 3.3792,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Simulation / Test Drive state
  const [isSimulating, setIsSimulating] = useState(false);
  const simIndexRef = useRef<number>(0);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  // References to track consecutive off-route fixes
  const offRouteCountRef = useRef<number>(0);
  const isReroutingRef = useRef<boolean>(false);
  const lastMilestoneRef = useRef<number | null>(null);
  const lastStepIndexRef = useRef<number>(0);
  const autoRecenterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Watch real Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // If simulation is active, ignore real GPS updates during test
        if (isSimulating) return;

        const coords = pos.coords;
        setGpsLocked(true);

        setCurrentLocation((prev) => {
          let heading = coords.heading;
          // Calculate heading from consecutive coordinates if GPS heading is null
          if ((heading === null || isNaN(heading)) && prev) {
            const dLat = coords.latitude - prev.lat;
            const dLng = coords.longitude - prev.lng;
            if (Math.hypot(dLat, dLng) > 0.00005) {
              const rad = Math.atan2(dLng, dLat);
              heading = ((rad * 180) / Math.PI + 360) % 360;
            } else {
              heading = prev.heading ?? null;
            }
          }

          return {
            lat: coords.latitude,
            lng: coords.longitude,
            heading: heading !== undefined ? heading : null,
            speed: coords.speed !== null && !isNaN(coords.speed) ? coords.speed : 0,
            accuracy: coords.accuracy || 10,
          };
        });
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isSimulating]);

  // Turn-by-turn guidance and off-route evaluation on location update
  const updateNavigationProgress = useCallback(
    (loc: GeoLocation, route: RouteData, stepIdx: number) => {
      if (!route.steps || route.steps.length === 0) return;

      const currentStep = route.steps[stepIdx];
      if (!currentStep) return;

      // Distance to next turn maneuver
      const [turnLon, turnLat] = currentStep.maneuver.location;
      const distToTurn = haversineDistance(loc.lat, loc.lng, turnLat, turnLon);
      setDistanceToTurn(distToTurn);

      // Check step advance condition (within 35 meters of maneuver point)
      if (distToTurn < 35 && stepIdx < route.steps.length - 1) {
        const nextIdx = stepIdx + 1;
        setCurrentStepIndex(nextIdx);
        lastStepIndexRef.current = nextIdx;
        lastMilestoneRef.current = null; // reset voice milestone for next step

        // Speak instruction for next step
        const nextStep = route.steps[nextIdx];
        if (nextStep) {
          const instruction = getInstructionText(nextStep);
          voiceGuidance.speak(instruction);
        }
        return;
      }

      // Check arrival
      if (stepIdx === route.steps.length - 1 && distToTurn < 40) {
        if (!hasArrived) {
          setHasArrived(true);
          voiceGuidance.speak('You have arrived at your destination.');
        }
        return;
      }

      // Voice Guidance announcement milestone check
      if (lastStepIndexRef.current !== stepIdx) {
        lastStepIndexRef.current = stepIdx;
        lastMilestoneRef.current = null;
      }

      const voiceAlert = getVoiceAnnouncement(distToTurn, currentStep, lastMilestoneRef.current);
      if (voiceAlert) {
        lastMilestoneRef.current = voiceAlert.milestone;
        voiceGuidance.speak(voiceAlert.text);
      }

      // Calculate total remaining distance and duration
      let sumDistance = distToTurn;
      let sumDuration = 0;
      for (let i = stepIdx + 1; i < route.steps.length; i++) {
        sumDistance += route.steps[i].distance;
        sumDuration += route.steps[i].duration;
      }
      setRemainingDistance(sumDistance);

      // Remaining duration: adjust if moving or based on distance
      const remainingSeconds = Math.max(30, Math.round(sumDuration));
      setRemainingDuration(remainingSeconds);
      setEta(new Date(Date.now() + remainingSeconds * 1000));

      // Off-route check
      if (route.coordinates.length > 2 && !isReroutingRef.current) {
        const off = isOffRoute(loc, route.coordinates, 45); // 45m threshold
        if (off) {
          offRouteCountRef.current += 1;
          if (offRouteCountRef.current >= 2) {
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

  // Trigger Automatic Reroute
  const triggerReroute = async (loc: GeoLocation, currentRoute: RouteData) => {
    if (isReroutingRef.current) return;
    isReroutingRef.current = true;
    setIsRerouting(true);
    voiceGuidance.speak('Off route. Recalculating route.');

    try {
      const [destLat, destLng] = currentRoute.destinationCoords;
      const newRoute = await fetchRoute(
        loc.lat,
        loc.lng,
        destLat,
        destLng,
        currentRoute.destinationName
      );

      setRouteData(newRoute);
      setCurrentStepIndex(0);
      lastStepIndexRef.current = 0;
      lastMilestoneRef.current = null;
      offRouteCountRef.current = 0;
      setIsOffRouteState(false);

      if (newRoute.steps && newRoute.steps.length > 0) {
        const firstStep = newRoute.steps[0];
        voiceGuidance.speak(`New route calculated. ${getInstructionText(firstStep)}`);
      }
    } catch (err) {
      console.error('Auto-reroute failed:', err);
    } finally {
      setIsRerouting(false);
      isReroutingRef.current = false;
    }
  };

  // Run progress evaluation whenever current location changes while navigating
  useEffect(() => {
    if (isNavigating && routeData) {
      updateNavigationProgress(currentLocation, routeData, currentStepIndex);
    }
  }, [currentLocation, isNavigating, routeData, currentStepIndex, updateNavigationProgress]);

  // Handle plan & start navigation
  const handleStartRoute = async (destLat: number, destLng: number, destName: string) => {
    try {
      setIsPinMode(false);
      setIsNavigating(false);
      setHasArrived(false);
      setIsOffRouteState(false);

      const route = await fetchRoute(
        currentLocation.lat,
        currentLocation.lng,
        destLat,
        destLng,
        destName
      );

      setRouteData(route);
      setCurrentStepIndex(0);
      lastStepIndexRef.current = 0;
      lastMilestoneRef.current = null;
      offRouteCountRef.current = 0;
      setIsNavigating(true);
      setFollowCar(true);

      // Initial voice announcement
      if (route.steps && route.steps.length > 0) {
        const startStep = route.steps[0];
        voiceGuidance.speak(`Starting route to ${destName}. ${getInstructionText(startStep)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Routing error';
      showToast(`Notice: ${msg}`);
    }
  };

  // End navigation
  const handleEndRoute = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsSimulating(false);
    setIsNavigating(false);
    setRouteData(null);
    setHasArrived(false);
    setIsOffRouteState(false);
    setIsRerouting(false);
    setFollowCar(true);
    voiceGuidance.speak('Route ended.');
  };

  // Toggle Day/Night theme
  const handleToggleNight = () => {
    setNightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('carnav_night', next ? 'true' : 'false');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const muted = voiceGuidance.toggleMute();
    setIsMuted(muted);
  };

  // Test Voice
  const handleTestVoice = () => {
    voiceGuidance.testVoice();
  };

  // User dragged or moved map
  const handleUserMapInteraction = () => {
    setFollowCar(false);

    // Auto recenter after 12 seconds when moving (from Phase 1 spec)
    if (autoRecenterTimerRef.current) {
      clearTimeout(autoRecenterTimerRef.current);
    }
    autoRecenterTimerRef.current = setTimeout(() => {
      if (currentLocation.speed && currentLocation.speed > 1.5) {
        setFollowCar(true);
      }
    }, 12000);
  };

  // Re-center on car
  const handleRecenter = () => {
    setFollowCar(true);
  };

  // Simulation / Bench-test driver loop
  const handleToggleSimulation = () => {
    if (isSimulating) {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      setIsSimulating(false);
      return;
    }

    if (!routeData || routeData.coordinates.length < 2) {
      // Default to planning a quick Lagos route to simulate if no route active
      handleStartRoute(6.4283, 3.4219, 'Eko Hotel, Victoria Island');
      return;
    }

    setIsSimulating(true);
    simIndexRef.current = 0;

    const coords = routeData.coordinates;
    const intervalMs = 650;

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

      // Calculate heading between coordinates
      const dLat = p2[0] - p1[0];
      const dLng = p2[1] - p1[1];
      const rad = Math.atan2(dLng, dLat);
      const heading = ((rad * 180) / Math.PI + 360) % 360;

      // Simulated speed ~ 48 km/h (13.3 m/s)
      setCurrentLocation({
        lat: p2[0],
        lng: p2[1],
        heading,
        speed: 13.5,
        accuracy: 4,
      });

      simIndexRef.current = idx + 1;
    }, intervalMs);
  };

  // Simulate off-route deviation for testing rerouting
  const handleTriggerOffRouteTest = () => {
    if (!currentLocation) return;
    // Shift current position ~150 meters away
    const deviatedLoc: GeoLocation = {
      ...currentLocation,
      lat: currentLocation.lat + 0.0014, // ~150m north
      lng: currentLocation.lng + 0.0014,
    };
    setCurrentLocation(deviatedLoc);
  };

  // Pin mode actions
  const handleSetPinHere = () => {
    setIsPinMode(false);
    handleStartRoute(pinCenter.lat, pinCenter.lng, 'Dropped Pin');
  };

  const handleCancelPin = () => {
    setIsPinMode(false);
  };

  const currentStep: RouteStep | null =
    routeData && routeData.steps && routeData.steps[currentStepIndex]
      ? routeData.steps[currentStepIndex]
      : null;

  const upcomingStep: RouteStep | null =
    routeData && routeData.steps && routeData.steps[currentStepIndex + 1]
      ? routeData.steps[currentStepIndex + 1]
      : null;

  const speedKmh = (currentLocation.speed || 0) * 3.6;

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden select-none font-sans transition-colors ${
        nightMode ? 'bg-black text-white' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Destination Search Bar on Top (Fixed GPS origin, destination input) */}
      {!isNavigating && (
        <TopSearchBar
          userLocation={currentLocation}
          onSelectDestination={(lat, lng, name) => handleStartRoute(lat, lng, name)}
          isPinMode={isPinMode}
          nightMode={nightMode}
        />
      )}

      {/* Turn-by-turn Top Bar HUD */}
      {isNavigating && (
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

      {/* Main Map Canvas */}
      <main className="w-full h-full">
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
        />
      </main>

      {/* Pin Drop Crosshair Overlay */}
      <PinDropOverlay
        isActive={isPinMode}
        onSetHere={handleSetPinHere}
        onCancel={handleCancelPin}
        nightMode={nightMode}
      />

      {/* Bottom Dashboard Bar HUD */}
      {!isPinMode && (
        <BottomNavHud
          isNavigating={isNavigating}
          speedKmh={speedKmh}
          remainingDistanceMeters={remainingDistance}
          remainingDurationSeconds={remainingDuration}
          eta={eta}
          nightMode={nightMode}
          followCar={followCar}
          destinationName={routeData?.destinationName}
          onEndRoute={handleEndRoute}
          onStartPinMode={() => setIsPinMode(true)}
          onToggleNight={handleToggleNight}
          onRecenter={handleRecenter}
        />
      )}

      {/* Non-intrusive status toast notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-2000 bg-neutral-900 text-white border-2 border-neutral-600 px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm sm:text-base flex items-center gap-3 animate-fade-in"
        >
          <span className="text-amber-400">ℹ️</span>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-neutral-400 hover:text-white"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
