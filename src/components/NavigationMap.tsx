import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoLocation, RouteData, RouteStep } from '../types/navigation';
import { tileTemplate } from '../utils/tileCache';

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
  hideControls?: boolean;
}

// No CSS transitions, filters or shadows: they are slow on head-unit GPUs
function createCarIcon(isNight: boolean) {
  // Post-2023 Google Maps Active Navigation Blue: #1A73E8
  const fill = isNight ? '#00e5ff' : '#1A73E8';
  return L.divIcon({
    className: 'car-marker-container',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    html: `<div id="car-arrow-wrap" style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;"><svg width="44" height="44" viewBox="0 0 44 44"><polygon points="22,2 39,40 22,31 5,40" fill="${fill}" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/></svg></div>`,
  });
}

function dotIcon(className: string, size: number, bg: string) {
  return L.divIcon({
    className,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:4px solid #ffffff;box-sizing:border-box;"></div>`,
  });
}

function applyHeading(h: number | null | undefined) {
  const el = document.getElementById('car-arrow-wrap');
  if (el && h !== null && h !== undefined) el.style.transform = `rotate(${Math.round(h)}deg)`;
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
  hideControls = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const routeLayersRef = useRef<L.Layer[]>([]);
  const turnMarkerRef = useRef<L.Marker | null>(null);
  const lastPanTimeRef = useRef(0);
  const initialViewSetRef = useRef(false);

  // FIX: the map's event handlers are created once, so they must read the latest props from a ref.
  // Before, isPinMode was frozen as false, so "Set here" always used the default Lagos centre.
  const live = useRef({ isPinMode, onMapCenterChange, onUserMapInteraction });
  live.current = { isPinMode, onMapCenterChange, onUserMapInteraction };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const lat = currentLocation ? currentLocation.lat : 6.5244;
    const lng = currentLocation ? currentLocation.lng : 3.3792;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
    }).setView([lat, lng], 16);
    map.attributionControl.setPrefix(false); // keep the map-data credit visible (licence requirement)
    mapRef.current = map;

    map.on('dragstart', () => live.current.onUserMapInteraction());
    map.on('move', () => {
      if (live.current.isPinMode) {
        const c = map.getCenter();
        live.current.onMapCenterChange?.(c.lat, c.lng);
      }
    });

    carMarkerRef.current = L.marker([lat, lng], {
      interactive: false,
      keyboard: false,
      icon: createCarIcon(nightMode),
      zIndexOffset: 1000,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tiles: CARTO tiles (Voyager for day, Dark Matter for night)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(
      tileTemplate(nightMode),
      {
        subdomains: 'abcd',
        maxZoom: 18,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 2,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(map);
    if (carMarkerRef.current) {
      carMarkerRef.current.setIcon(createCarIcon(nightMode));
      applyHeading(currentLocation?.heading);
    }
  }, [nightMode]);

  // FIX: entering pin mode reports the current crosshair position straight away
  useEffect(() => {
    const map = mapRef.current;
    if (isPinMode && map) {
      const c = map.getCenter();
      onMapCenterChange?.(c.lat, c.lng);
    }
  }, [isPinMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!currentLocation || !map || !carMarkerRef.current) return;
    const ll: [number, number] = [currentLocation.lat, currentLocation.lng];
    carMarkerRef.current.setLatLng(ll);
    applyHeading(currentLocation.heading);
    const now = Date.now();
    if (!initialViewSetRef.current) {
      initialViewSetRef.current = true;
      map.setView(ll, 16, { animate: false });
    } else if (followCar && now - lastPanTimeRef.current > 1200) {
      lastPanTimeRef.current = now;
      map.panTo(ll, { animate: false });
    }
  }, [currentLocation, followCar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayersRef.current.forEach((l) => map.removeLayer(l));
    routeLayersRef.current = [];
    if (!routeData || routeData.coordinates.length === 0) return;

    // Route outline casing for contrast
    const outline = L.polyline(routeData.coordinates, {
      color: nightMode ? '#000000' : '#1557b0',
      weight: 12,
      opacity: 0.9,
      smoothFactor: 2,
      interactive: false,
    }).addTo(map);

    // Active Navigation: #1A73E8 (High-saturation blue route line from post-2023 palette)
    const line = L.polyline(routeData.coordinates, {
      color: nightMode ? '#00e5ff' : '#1A73E8',
      weight: 8,
      opacity: 0.98,
      smoothFactor: 2,
      interactive: false,
    }).addTo(map);

    const [destLat, destLng] = routeData.destinationCoords;
    const dest = L.marker([destLat, destLng], {
      interactive: false,
      icon: dotIcon('dest-marker', 32, '#EA4335'), // Google red
    }).addTo(map);
    routeLayersRef.current = [outline, line, dest];

    if (!followCar) map.fitBounds(line.getBounds(), { padding: [80, 80], animate: false });
  }, [routeData, nightMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (turnMarkerRef.current) {
      map.removeLayer(turnMarkerRef.current);
      turnMarkerRef.current = null;
    }
    if (currentStep && currentStep.maneuver && currentStep.maneuver.location) {
      const [lon, lat] = currentStep.maneuver.location;
      turnMarkerRef.current = L.marker([lat, lon], {
        interactive: false,
        icon: dotIcon('turn-dot', 24, '#1E8E3E'), // Google green
      }).addTo(map);
    }
  }, [currentStep]);

  // Colours are inline styles so they still work if Tailwind's colour utilities fail on an old browser
  const panel: React.CSSProperties = nightMode
    ? { background: 'rgba(0,0,0,0.85)', borderColor: '#404040', color: '#ffffff' }
    : { background: 'rgba(255,255,255,0.95)', borderColor: '#cbd5e1', color: '#1e293b' };
  const zoomBtn: React.CSSProperties = {
    ...panel,
    background: nightMode ? '#171717' : '#ffffff',
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ background: '#171717' }} />

      {!hideControls && (
        <>
          <div aria-live="polite" className="absolute top-20 left-3 z-500 border px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-3 select-none" style={panel}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#10b981', display: 'inline-block' }} />
            <span className="font-bold">GPS: {Math.round(gpsAccuracy)}m</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span className="font-bold" style={{ color: nightMode ? '#34d399' : '#047857' }}>{Math.round(speedKmh)} km/h</span>
          </div>

          <div className="absolute right-3 top-20 z-500 flex flex-col gap-1.5 select-none">
            <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className="w-13 h-13 border-2 rounded-xl font-bold text-2xl flex items-center justify-center shadow-md active:scale-95 transition-transform" style={zoomBtn}>+</button>
            <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className="w-13 h-13 border-2 rounded-xl font-bold text-2xl flex items-center justify-center shadow-md active:scale-95 transition-transform" style={zoomBtn}>−</button>
          </div>
        </>
      )}
    </div>
  );
};
