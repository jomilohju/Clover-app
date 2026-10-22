import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoLocation, RouteData, RouteStep } from '../types/navigation';

interface NavigationMapProps {
  currentLocation: GeoLocation | null;
  routeData: RouteData | null;
  currentStep: RouteStep | null;
  nightMode: boolean;
  followCar: boolean;
  isPinMode: boolean;
  onUserMapInteraction: () => void;
  onMapCenterChange?: (lat: number, lng: number) => void;
  gpsAccuracy?: number;
  speedKmh?: number;
}

function createCarIcon(isNight: boolean) {
  const arrowFill = isNight ? '#00e5ff' : '#1d4ed8';
  const shadow = isNight
    ? 'filter: drop-shadow(0 0 8px rgba(0,229,255,0.85));'
    : 'filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55));';

  return L.divIcon({
    className: 'car-marker-container',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    html: `
      <div id="car-arrow-wrap" style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;transition:transform 0.25s linear;">
        <svg width="44" height="44" viewBox="0 0 44 44" style="${shadow}">
          <polygon points="22,2 39,40 22,31 5,40" fill="${arrowFill}" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round" />
        </svg>
      </div>
    `,
  });
}

export const NavigationMap: React.FC<NavigationMapProps> = ({
  currentLocation,
  routeData,
  currentStep,
  nightMode,
  followCar,
  isPinMode,
  onUserMapInteraction,
  onMapCenterChange,
  gpsAccuracy = 10,
  speedKmh = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const carArrowElRef = useRef<HTMLElement | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeOutlineRef = useRef<L.Polyline | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const turnMarkerRef = useRef<L.Marker | null>(null);
  const lastPanTimeRef = useRef<number>(0);
  const initialViewSetRef = useRef<boolean>(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default to Lagos, Nigeria
    const defaultLat = currentLocation ? currentLocation.lat : 6.5244;
    const defaultLng = currentLocation ? currentLocation.lng : 3.3792;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
      attributionControl: false,
    }).setView([defaultLat, defaultLng], 16);

    mapRef.current = map;

    // Listen to user map interactions to unfollow
    map.on('dragstart', () => {
      onUserMapInteraction();
    });

    map.on('move', () => {
      if (isPinMode && onMapCenterChange) {
        const c = map.getCenter();
        onMapCenterChange(c.lat, c.lng);
      }
    });

    const marker = L.marker([defaultLat, defaultLng], {
      interactive: false,
      keyboard: false,
      icon: createCarIcon(nightMode),
      zIndexOffset: 1000,
    }).addTo(map);

    carMarkerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer and Car Marker when night mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newLayer = L.tileLayer(tileUrl, {
      subdomains: 'abc',
      maxZoom: 19,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
      className: nightMode ? 'dark-tiles' : 'light-tiles',
    }).addTo(map);

    tileLayerRef.current = newLayer;

    // Update car icon appearance for dark / light mode
    if (carMarkerRef.current) {
      carMarkerRef.current.setIcon(createCarIcon(nightMode));
      carArrowElRef.current = document.getElementById('car-arrow-wrap');
      if (carArrowElRef.current && currentLocation?.heading !== undefined && currentLocation.heading !== null) {
        carArrowElRef.current.style.transform = `rotate(${Math.round(currentLocation.heading)}deg)`;
      }
    }
  }, [nightMode]);

  // Update vehicle position and heading
  useEffect(() => {
    if (!currentLocation || !mapRef.current || !carMarkerRef.current) return;

    const latLng: [number, number] = [currentLocation.lat, currentLocation.lng];
    carMarkerRef.current.setLatLng(latLng);

    // Grab inner arrow element to rotate
    if (!carArrowElRef.current) {
      carArrowElRef.current = document.getElementById('car-arrow-wrap');
    }
    if (carArrowElRef.current && currentLocation.heading !== undefined && currentLocation.heading !== null) {
      carArrowElRef.current.style.transform = `rotate(${Math.round(currentLocation.heading)}deg)`;
    }

    // First view setup or follow car
    const now = Date.now();
    if (!initialViewSetRef.current) {
      initialViewSetRef.current = true;
      mapRef.current.setView(latLng, 16, { animate: false });
    } else if (followCar && now - lastPanTimeRef.current > 1200) {
      lastPanTimeRef.current = now;
      mapRef.current.panTo(latLng, { animate: false });
    }
  }, [currentLocation, followCar]);

  // Update route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (routeOutlineRef.current) {
      map.removeLayer(routeOutlineRef.current);
      routeOutlineRef.current = null;
    }
    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
    if (turnMarkerRef.current) {
      map.removeLayer(turnMarkerRef.current);
      turnMarkerRef.current = null;
    }

    if (!routeData || routeData.coordinates.length === 0) return;

    // Dark outline casing for contrast
    const outline = L.polyline(routeData.coordinates, {
      color: nightMode ? '#000000' : '#1e3a8a',
      weight: 12,
      opacity: 0.9,
      interactive: false,
    }).addTo(map);
    routeOutlineRef.current = outline;

    // Core bright navigation line
    const polyline = L.polyline(routeData.coordinates, {
      color: nightMode ? '#00e5ff' : '#2563eb',
      weight: 8,
      opacity: 0.95,
      interactive: false,
    }).addTo(map);
    routePolylineRef.current = polyline;

    // Destination Pin
    const [destLat, destLng] = routeData.destinationCoords;
    const destIcon = L.divIcon({
      className: 'dest-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      html: `
        <div style="width:32px;height:32px;border-radius:50%;background:#ef4444;border:4px solid #ffffff;box-shadow:0 0 10px rgba(239,68,68,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;">
          ★
        </div>
      `,
    });

    const destMarker = L.marker([destLat, destLng], {
      interactive: false,
      icon: destIcon,
    }).addTo(map);
    destMarkerRef.current = destMarker;

    // Fit route in view if user just planned route
    if (!followCar) {
      map.fitBounds(polyline.getBounds(), {
        padding: [80, 80],
        animate: false,
      });
    }
  }, [routeData, nightMode]);

  // Update Turn Marker on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (turnMarkerRef.current) {
      map.removeLayer(turnMarkerRef.current);
      turnMarkerRef.current = null;
    }

    if (currentStep && currentStep.maneuver && currentStep.maneuver.location) {
      const [turnLon, turnLat] = currentStep.maneuver.location;
      const turnIcon = L.divIcon({
        className: 'turn-dot',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `
          <div style="width:20px;height:20px;border-radius:50%;background:#10b981;border:3px solid #ffffff;box-shadow:0 0 8px rgba(16,185,129,0.8);"></div>
        `,
      });

      const tm = L.marker([turnLat, turnLon], {
        interactive: false,
        icon: turnIcon,
      }).addTo(map);
      turnMarkerRef.current = tm;
    }
  }, [currentStep]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-950">
      {/* Leaflet map div */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-neutral-900" />

      {/* GPS info badge (top left, below top search bar) */}
      <div
        aria-live="polite"
        className={`absolute top-20 sm:top-22 left-3 z-500 backdrop-blur-md border px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-3 shadow-lg select-none transition-colors ${
          nightMode
            ? 'bg-black/85 border-neutral-700 text-white'
            : 'bg-white/95 border-slate-300 text-slate-800 shadow-md'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold">GPS: {Math.round(gpsAccuracy)}m</span>
        </div>
        <div className={nightMode ? 'text-neutral-400' : 'text-slate-400'}>|</div>
        <div className={`font-bold ${nightMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
          {Math.round(speedKmh)} km/h
        </div>
      </div>

      {/* Side map zoom controls (+, -) reduced by 20% */}
      <div className="absolute right-3 top-20 sm:top-22 z-500 flex flex-col gap-1.5 select-none">
        <button
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className={`w-11 h-11 border-2 rounded-xl font-bold text-xl flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors ${
            nightMode
              ? 'bg-neutral-900/90 active:bg-neutral-800 text-white border-neutral-700 hover:border-neutral-500'
              : 'bg-white/95 active:bg-slate-200 text-slate-800 border-slate-300 hover:border-slate-400 shadow-md'
          }`}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className={`w-11 h-11 border-2 rounded-xl font-bold text-xl flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors ${
            nightMode
              ? 'bg-neutral-900/90 active:bg-neutral-800 text-white border-neutral-700 hover:border-neutral-500'
              : 'bg-white/95 active:bg-slate-200 text-slate-800 border-slate-300 hover:border-slate-400 shadow-md'
          }`}
        >
          −
        </button>
      </div>
    </div>
  );
};
