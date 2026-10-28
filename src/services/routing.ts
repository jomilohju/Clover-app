import { RouteData, RouteStep } from '../types/navigation';
import { decodePolyline } from '../utils/navigation';

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  geometry: string; // polyline
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lon, lat]
    instruction?: string;
    exit?: number;
  };
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: string;
  legs: Array<{
    steps: OsrmStep[];
    distance: number;
    duration: number;
  }>;
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
}

function parseOsrmResponse(
  data: OsrmResponse,
  destLat: number,
  destLng: number,
  destinationName: string
): RouteData {
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || 'No drivable route found');
  }

  const route = data.routes[0];
  const fullCoordinates = decodePolyline(route.geometry);

  const steps: RouteStep[] = [];
  if (route.legs) {
    for (const leg of route.legs) {
      if (leg.steps) {
        for (const s of leg.steps) {
          steps.push({
            distance: s.distance,
            duration: s.duration,
            name: s.name || '',
            ref: s.ref,
            maneuver: {
              type: s.maneuver.type,
              modifier: s.maneuver.modifier,
              location: s.maneuver.location,
              instruction: s.maneuver.instruction,
              exit: s.maneuver.exit,
            },
            geometry: s.geometry ? decodePolyline(s.geometry) : undefined,
          });
        }
      }
    }
  }

  return {
    distance: route.distance,
    duration: route.duration,
    coordinates: fullCoordinates,
    steps,
    destinationName,
    destinationCoords: [destLat, destLng],
  };
}

export async function fetchRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  destinationName: string = 'Destination'
): Promise<RouteData> {
  const queryParams = `startLng=${startLng}&startLat=${startLat}&destLng=${destLng}&destLat=${destLat}`;
  const directPath = `${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true&annotations=false`;

  // 1. Same-origin backend proxy, 2. public OSRM, 3. OSM Germany mirror
  const candidates = [
    `/api/route?${queryParams}`,
    `https://router.project-osrm.org/route/v1/driving/${directPath}`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${directPath}`,
  ];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: OsrmResponse = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          return parseOsrmResponse(data, destLat, destLng, destinationName);
        }
      }
    } catch (err: unknown) {
      console.warn(`Routing attempt via ${url} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Never invent a route: a made-up path with fake turns is worse than an honest error.
  throw new Error('Could not reach the routing service. Check your data connection and try again.');
}
