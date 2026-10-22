import { SearchResultItem } from '../types/navigation';
import { haversineDistance } from '../utils/navigation';

const PHOTON_API = 'https://photon.komoot.io/api/';
const NIGERIA_BBOX = '2.6,4.2,14.7,13.9';

interface PhotonFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    district?: string;
    county?: string;
    osm_id?: number | string;
  };
}

const NIGERIA_OFFLINE_PLACES = [
  { name: 'Ikeja City Mall, Alausa', lat: 6.6198, lng: 3.3582, sub: 'Ikeja, Lagos State' },
  { name: 'Eko Hotel & Suites', lat: 6.4283, lng: 3.4219, sub: 'Victoria Island, Lagos State' },
  { name: 'Lekki Phase 1 Gate', lat: 6.4389, lng: 3.4735, sub: 'Admiralty Way, Lekki, Lagos' },
  { name: 'Murtala Muhammed Airport (MMA2)', lat: 6.5772, lng: 3.3211, sub: 'Ikeja, Lagos State' },
  { name: 'National Stadium', lat: 6.4957, lng: 3.3644, sub: 'Surulere, Lagos State' },
  { name: 'Marina Terminal & CMS', lat: 6.4528, lng: 3.3892, sub: 'Lagos Island, Lagos' },
  { name: 'Third Mainland Bridge', lat: 6.5055, lng: 3.4022, sub: 'Lagos Lagoon Express' },
  { name: 'Yaba College of Technology', lat: 6.5186, lng: 3.3719, sub: 'Yaba, Lagos State' },
  { name: 'Computer Village', lat: 6.5985, lng: 3.3411, sub: 'Otigba St, Ikeja, Lagos' },
  { name: 'Alaba International Market', lat: 6.4594, lng: 3.1977, sub: 'Ojo, Lagos State' },
  { name: 'Aso Rock Presidential Villa', lat: 9.0765, lng: 7.5312, sub: 'Abuja, Federal Capital Territory' },
  { name: 'Transcorp Hilton Hotel', lat: 9.0782, lng: 7.4983, sub: 'Maitama, Abuja' },
  { name: 'University of Ibadan', lat: 7.4443, lng: 3.9003, sub: 'Ibadan, Oyo State' },
  { name: 'Port Harcourt Pleasure Park', lat: 4.8396, lng: 7.0264, sub: 'Port Harcourt, Rivers State' },
];

function formatFeatures(
  features: PhotonFeature[],
  userLocation?: { lat: number; lng: number } | null
): SearchResultItem[] {
  return features.map((f, idx) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;

    const title =
      p.name ||
      [p.housenumber, p.street].filter(Boolean).join(' ') ||
      p.city ||
      p.state ||
      'Location';

    const parts: string[] = [];
    [p.street, p.district, p.city || p.county, p.state].forEach((x) => {
      if (x && x !== title && !parts.includes(x)) {
        parts.push(x);
      }
    });
    const subtitle = parts.join(', ') || p.country || 'Nigeria';

    let distanceKm: number | undefined;
    if (userLocation) {
      const dMeters = haversineDistance(userLocation.lat, userLocation.lng, lat, lon);
      distanceKm = Math.round((dMeters / 1000) * 10) / 10;
    }

    return {
      id: `${p.osm_id || idx}-${lat}-${lon}`,
      name: title,
      subtitle,
      lat,
      lng: lon,
      distanceKm,
    };
  });
}

export async function searchPlaces(
  query: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const candidates: string[] = [
    `/api/geocode?q=${encodeURIComponent(trimmed)}${userLocation ? `&lat=${userLocation.lat}&lon=${userLocation.lng}` : ''}`,
    `${PHOTON_API}?limit=8&bbox=${NIGERIA_BBOX}&q=${encodeURIComponent(trimmed)}${userLocation ? `&lat=${userLocation.lat}&lon=${userLocation.lng}` : ''}`,
  ];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const features: PhotonFeature[] = data.features || [];
        if (features.length > 0) {
          return formatFeatures(features, userLocation);
        }
      }
    } catch {
      // Try next
    }
  }

  // Local offline search fallback
  const qLower = trimmed.toLowerCase();
  const matched = NIGERIA_OFFLINE_PLACES.filter(
    (p) => p.name.toLowerCase().includes(qLower) || p.sub.toLowerCase().includes(qLower)
  );

  return matched.map((p, idx) => {
    let distanceKm: number | undefined;
    if (userLocation) {
      const d = haversineDistance(userLocation.lat, userLocation.lng, p.lat, p.lng);
      distanceKm = Math.round((d / 1000) * 10) / 10;
    }
    return {
      id: `offline-${idx}-${p.lat}-${p.lng}`,
      name: p.name,
      subtitle: p.sub,
      lat: p.lat,
      lng: p.lng,
      distanceKm,
    };
  });
}
