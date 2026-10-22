import { GeoLocation, RouteData, RouteStep, StepManeuver } from '../types/navigation';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Haversine distance in meters between two [lat, lng] points
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates perpendicular/shortest distance in meters from a point P to a line segment AB.
 */
export function pointToSegmentDistance(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dAB = haversineDistance(aLat, aLng, bLat, bLng);
  if (dAB < 1e-6) {
    return haversineDistance(pLat, pLng, aLat, aLng);
  }

  // Equirectangular projection for local segment projection
  const avgLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(avgLatRad);

  const xA = 0;
  const yA = 0;
  const xB = (bLng - aLng) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const yB = (bLat - aLat) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const xP = (pLng - aLng) * (Math.PI / 180) * EARTH_RADIUS_METERS * cosLat;
  const yP = (pLat - aLat) * (Math.PI / 180) * EARTH_RADIUS_METERS;

  const lenSq = xB * xB + yB * yB;
  if (lenSq === 0) return Math.sqrt(xP * xP + yP * yP);

  // Projection parameter t
  let t = (xP * xB + yP * yB) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = t * xB;
  const projY = t * yB;
  const dx = xP - projX;
  const dy = yP - projY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns the shortest distance in meters from a location to any segment of a polyline.
 */
export function distanceToPolyline(
  point: { lat: number; lng: number },
  polyline: [number, number][]
): { minDistance: number; nearestSegmentIndex: number } {
  if (polyline.length === 0) {
    return { minDistance: Infinity, nearestSegmentIndex: -1 };
  }
  if (polyline.length === 1) {
    return {
      minDistance: haversineDistance(point.lat, point.lng, polyline[0][0], polyline[0][1]),
      nearestSegmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let nearestSegmentIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistance(
      point.lat,
      point.lng,
      polyline[i][0],
      polyline[i][1],
      polyline[i + 1][0],
      polyline[i + 1][1]
    );
    if (d < minDistance) {
      minDistance = d;
      nearestSegmentIndex = i;
    }
  }

  return { minDistance, nearestSegmentIndex };
}

/**
 * Checks whether user has gone off-route (> threshold distance from path)
 */
export function isOffRoute(
  point: { lat: number; lng: number },
  polyline: [number, number][],
  thresholdMeters: number = 45
): boolean {
  if (!polyline || polyline.length < 2) return false;
  const { minDistance } = distanceToPolyline(point, polyline);
  return minDistance > thresholdMeters;
}

/**
 * Decodes Google/OSRM encoded polyline string to array of [lat, lng] tuples
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Formats distance for automotive display (e.g., "50 m", "850 m", "1.4 km", "25 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 0 || isNaN(meters)) return '0 m';
  if (meters < 50) return 'NOW';
  if (meters < 1000) {
    // Round to nearest 10 meters for stability
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = meters / 1000;
  if (km < 10) {
    const roundedKm = Math.round(meters / 100) / 10;
    return `${roundedKm.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Formats duration in seconds to human readable automotive format (e.g. "14 min", "1 h 25 min")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) {
    return `${totalMins} min`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

/**
 * Formats clock ETA string (e.g. "14:05" or "02:05")
 */
export function formatEta(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Maps OSRM maneuver type and modifier to a clean icon name
 */
export function getManeuverIconType(
  type: string,
  modifier?: string
): 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'u-turn' | 'roundabout' | 'arrive' | 'depart' {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';

  const mod = (modifier || '').toLowerCase();
  if (mod.includes('uturn') || mod === 'u-turn') return 'u-turn';
  if (mod === 'sharp left') return 'sharp-left';
  if (mod === 'sharp right') return 'sharp-right';
  if (mod === 'slight left') return 'slight-left';
  if (mod === 'slight right') return 'slight-right';
  if (mod === 'left') return 'turn-left';
  if (mod === 'right') return 'turn-right';
  if (mod === 'straight') return 'straight';

  if (type === 'fork') {
    if (mod.includes('left')) return 'slight-left';
    return 'slight-right';
  }

  return 'straight';
}

/**
 * Human friendly turn instruction string
 */
export function getInstructionText(step: RouteStep): string {
  if (step.maneuver.instruction) {
    return step.maneuver.instruction;
  }
  const street = step.name || 'road';
  const mod = step.maneuver.modifier || '';
  const type = step.maneuver.type;

  if (type === 'arrive') {
    return 'You will arrive at your destination';
  }
  if (type === 'depart') {
    return `Head out on ${street}`;
  }
  if (type === 'roundabout') {
    const exit = step.maneuver.exit ? `take exit ${step.maneuver.exit}` : 'take exit';
    return `At the roundabout, ${exit} onto ${street}`;
  }

  if (mod) {
    return `Turn ${mod} onto ${street}`;
  }

  return `Continue onto ${street}`;
}

/**
 * Returns voice announcement text based on remaining distance to the maneuver
 * Milestones: 1000m, 500m, 200m, 50m (Turn now), Arrive
 */
export function getVoiceAnnouncement(
  distanceToTurn: number,
  step: RouteStep,
  lastAnnouncedMilestone: number | null
): { text: string; milestone: number } | null {
  const street = step.name ? `onto ${step.name}` : '';
  const mod = step.maneuver.modifier ? step.maneuver.modifier : '';
  const type = step.maneuver.type;

  if (type === 'arrive') {
    if (distanceToTurn <= 40 && lastAnnouncedMilestone !== 0) {
      return { text: 'You have arrived at your destination.', milestone: 0 };
    }
    if (distanceToTurn <= 300 && lastAnnouncedMilestone !== 200) {
      return { text: 'Destination will be on your path ahead.', milestone: 200 };
    }
    return null;
  }

  // Turn Now: <= 40m
  if (distanceToTurn <= 40 && lastAnnouncedMilestone !== 40) {
    if (type === 'roundabout') {
      const exit = step.maneuver.exit ? `take exit ${step.maneuver.exit}` : 'take your exit';
      return { text: `At the roundabout, ${exit} ${street}`, milestone: 40 };
    }
    const action = mod ? `turn ${mod}` : 'continue';
    return { text: `${action.charAt(0).toUpperCase() + action.slice(1)} now ${street}`, milestone: 40 };
  }

  // Imminent turn: 100m - 200m
  if (distanceToTurn > 40 && distanceToTurn <= 220 && lastAnnouncedMilestone !== 200) {
    if (type === 'roundabout') {
      const exit = step.maneuver.exit ? `take exit ${step.maneuver.exit}` : 'take exit';
      return { text: `In 200 meters at the roundabout, ${exit} ${street}`, milestone: 200 };
    }
    const action = mod ? `turn ${mod}` : 'continue straight';
    return { text: `In 200 meters, ${action} ${street}`, milestone: 200 };
  }

  // Upcoming turn: 400m - 550m
  if (distanceToTurn > 350 && distanceToTurn <= 550 && lastAnnouncedMilestone !== 500) {
    const action = mod ? `turn ${mod}` : 'continue';
    return { text: `In 500 meters, ${action} ${street}`, milestone: 500 };
  }

  // Far advance turn: 900m - 1100m
  if (distanceToTurn > 800 && distanceToTurn <= 1100 && lastAnnouncedMilestone !== 1000) {
    const action = mod ? `turn ${mod}` : 'continue';
    return { text: `In 1 kilometer, ${action} ${street}`, milestone: 1000 };
  }

  return null;
}
