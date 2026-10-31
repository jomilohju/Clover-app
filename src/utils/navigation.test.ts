import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistance,
  pointToSegmentDistance,
  distanceToPolyline,
  isOffRoute,
  decodePolyline,
  formatDistance,
  formatDuration,
  formatEta,
  getManeuverIconType,
  getVoiceAnnouncement,
  buildRouteIndex,
  locateOnRoute,
} from './navigation';
import { formatTripDate } from './tripHistory';
import { RouteStep } from '../types/navigation';

test('haversineDistance computes accurate ground distance in meters', () => {
  // Lagos Marina to Victoria Island (~3.5km)
  const d = haversineDistance(6.4531, 3.3958, 6.4281, 3.4219);
  assert.ok(d > 3500 && d < 4500, `Expected ~4km, got ${d}`);
});

test('pointToSegmentDistance calculates perpendicular distance to road segment', () => {
  // Segment along equator from (0,0) to (0, 0.01)
  // Point offset by 0.001 deg lat (~111 meters north)
  const dist = pointToSegmentDistance(0.001, 0.005, 0, 0, 0, 0.01);
  assert.ok(dist > 105 && dist < 120, `Expected ~111m, got ${dist}`);
});

test('distanceToPolyline and isOffRoute detects deviation from route', () => {
  const polyline: [number, number][] = [
    [6.5000, 3.3500],
    [6.5050, 3.3500],
    [6.5100, 3.3500],
  ];

  // Point on or very close to route (< 10m)
  const onRoutePoint = { lat: 6.5025, lng: 3.35005 };
  const resOn = distanceToPolyline(onRoutePoint, polyline);
  assert.ok(resOn.minDistance < 15, `Expected close distance, got ${resOn.minDistance}`);
  assert.equal(isOffRoute(onRoutePoint, polyline, 45), false);

  // Point far off route (~150m west)
  const offRoutePoint = { lat: 6.5025, lng: 3.3485 };
  const resOff = distanceToPolyline(offRoutePoint, polyline);
  assert.ok(resOff.minDistance > 100, `Expected off route > 100m, got ${resOff.minDistance}`);
  assert.equal(isOffRoute(offRoutePoint, polyline, 45), true);
});

test('decodePolyline accurately unpacks standard polyline', () => {
  // Encoded polyline for points: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
  const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const points = decodePolyline(encoded);
  assert.equal(points.length, 3);
  assert.ok(Math.abs(points[0][0] - 38.5) < 0.001);
  assert.ok(Math.abs(points[0][1] - (-120.2)) < 0.001);
});

test('formatDistance formats meters appropriately for car dashboard', () => {
  assert.equal(formatDistance(25), 'NOW');
  assert.equal(formatDistance(45), 'NOW');
  assert.equal(formatDistance(230), '230 m');
  assert.equal(formatDistance(950), '950 m');
  assert.equal(formatDistance(1450), '1.5 km');
  assert.equal(formatDistance(12800), '13 km');
});

test('formatDuration formats minutes and hours cleanly', () => {
  assert.equal(formatDuration(40), '< 1 min');
  assert.equal(formatDuration(180), '3 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(5400), '1 h 30 min');
});

test('formatEta produces HH:MM format', () => {
  const d = new Date(2026, 9, 22, 14, 5);
  assert.equal(formatEta(d), '14:05');
});

test('getManeuverIconType correctly categorizes OSRM turns', () => {
  assert.equal(getManeuverIconType('turn', 'left'), 'turn-left');
  assert.equal(getManeuverIconType('turn', 'sharp right'), 'sharp-right');
  assert.equal(getManeuverIconType('turn', 'slight left'), 'slight-left');
  assert.equal(getManeuverIconType('roundabout', 'right'), 'roundabout');
  assert.equal(getManeuverIconType('arrive'), 'arrive');
});

test('getVoiceAnnouncement returns timely alerts at proper milestones', () => {
  const mockStep: RouteStep = {
    distance: 600,
    duration: 50,
    name: 'Ikorodu Road',
    maneuver: {
      type: 'turn',
      modifier: 'left',
      location: [3.37, 6.52],
    },
  };

  // At 500m
  const announce500 = getVoiceAnnouncement(490, mockStep, null);
  assert.ok(announce500 !== null);
  assert.equal(announce500?.milestone, 500);
  assert.ok(announce500?.text.includes('500 meters'));
  assert.ok(announce500?.text.includes('turn left onto Ikorodu Road'));

  // Once 500 milestone was announced, do not re-announce at 480m
  assert.equal(getVoiceAnnouncement(480, mockStep, 500), null);

  // At 180m, announce 200m milestone
  const announce200 = getVoiceAnnouncement(180, mockStep, 500);
  assert.ok(announce200 !== null);
  assert.equal(announce200?.milestone, 200);

  // At 35m, announce Turn Now
  const announceNow = getVoiceAnnouncement(35, mockStep, 200);
  assert.ok(announceNow !== null);
  assert.equal(announceNow?.milestone, 40);
  assert.ok(announceNow?.text.includes('Turn left now'));
});

test('formatTripDate accurately labels today and recent timestamps', () => {
  const now = Date.now();
  assert.ok(formatTripDate(now).startsWith('Today,'));
  
  const yesterday = now - 24 * 60 * 60 * 1000;
  assert.ok(formatTripDate(yesterday).startsWith('Yesterday,'));
});




// ---- along-route tracking -------------------------------------------------

function makeStraightRoute() {
  // ~2.2 km due north along one meridian, a vertex every 0.001 degrees
  const coords: [number, number][] = [];
  for (let i = 0; i <= 20; i++) coords.push([6.5 + i * 0.001, 3.35]);
  const mk = (idx: number, type: string): RouteStep => ({
    distance: 0,
    duration: 0,
    name: 'Test Rd',
    maneuver: { type, location: [3.35, coords[idx][0]] },
  });
  const steps = [mk(0, 'depart'), mk(10, 'turn'), mk(20, 'arrive')];
  return { coords, steps };
}

test('buildRouteIndex maps maneuvers to coordinate indexes and pins arrival to the end', () => {
  const { coords, steps } = makeStraightRoute();
  const idx = buildRouteIndex(coords, steps);
  assert.deepEqual(idx.stepCoordIdx, [0, 10, 20]);
  assert.ok(Math.abs(idx.total - 2224) < 20, `Expected ~2.2 km, got ${idx.total}`);
});

test('locateOnRoute returns metres along the route and distance from it', () => {
  const { coords, steps } = makeStraightRoute();
  const idx = buildRouteIndex(coords, steps);
  const r = locateOnRoute(coords, idx, { lat: 6.505, lng: 3.35 }, 0)!;
  assert.ok(Math.abs(r.along - idx.cum[5]) < 2, `along ${r.along} vs ${idx.cum[5]}`);
  assert.ok(r.dist < 1);
  const off = locateOnRoute(coords, idx, { lat: 6.505, lng: 3.3515 }, 0)!; // ~165 m east
  assert.ok(off.dist > 150 && off.dist < 180, `Expected ~165 m, got ${off.dist}`);
});

test('locateOnRoute falls back to a full scan when the hint window is wrong', () => {
  const { coords, steps } = makeStraightRoute();
  const idx = buildRouteIndex(coords, steps);
  // Hint says segment 0, but the car is near the far end: window misses it, full scan must find it
  const r = locateOnRoute(coords, idx, { lat: 6.5195, lng: 3.35 }, 0)!;
  assert.ok(r.dist < 1, `Expected to find the real position, dist ${r.dist}`);
  assert.equal(r.seg, 19);
});

test('a fast car that jumps past a maneuver is detected by along-route position', () => {
  const { coords, steps } = makeStraightRoute();
  const idx = buildRouteIndex(coords, steps);
  // Maneuver 1 is at coord 10. Car jumps from 60 m before it to 60 m after it between two fixes:
  const before = locateOnRoute(coords, idx, { lat: 6.5095, lng: 3.35 }, 0)!;
  const after = locateOnRoute(coords, idx, { lat: 6.5105, lng: 3.35 }, before.seg)!;
  const turnAlong = idx.cum[idx.stepCoordIdx[1]];
  assert.ok(turnAlong - before.along > 25, 'before: not yet within the 25 m trigger');
  assert.ok(turnAlong - after.along < 0, 'after: maneuver is behind the car, step must advance');
});
