const getCartoKey = (): string => {
  if (typeof window !== 'undefined') {
    const s = localStorage.getItem('carto_key') || localStorage.getItem('carto_api_key');
    if (s) return s;
    const p = new URLSearchParams(window.location.search);
    const u = p.get('key') || p.get('carto_key');
    if (u) return u;
  }
  return (import.meta as any).env?.VITE_CARTO_KEY || '';
};

// Add ?lite=1 to the link for the lighter grey day map (smaller tiles) instead of colourful Voyager
const LITE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lite') === '1';

// CARTO basemap tiles (Voyager for colorful day mode, dark_all for night mode, light_all for lite mode)
export const tileTemplate = (night: boolean) => {
  const key = getCartoKey();
  const style = night ? 'dark_all' : LITE ? 'light_all' : 'voyager';
  return `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png${
    key ? `?key=${key}` : ''
  }`;
};

function toTile(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

const MAX_PREFETCH = 40; // small on purpose: slow data must stay free for the live map

// Ask the service worker to save the tiles around the first part of the route (zoom 16, capped)
export function prefetchRouteTiles(coords: [number, number][], night: boolean) {
  if (!('serviceWorker' in navigator) || !navigator.onLine || coords.length === 0) return;
  if ((navigator as any).connection?.saveData) return;
  const conn = (navigator as any).connection;
  if (conn && (conn.effectiveType !== '4g' || (conn.downlink && conn.downlink < 2))) return; // only on a fast connection

  const tpl = tileTemplate(night).replace('{s}', 'a');
  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (z: number, x: number, y: number) => {
    const k = z + '/' + x + '/' + y;
    if (seen.has(k) || urls.length >= MAX_PREFETCH) return;
    seen.add(k);
    urls.push(tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
  };
  const step = Math.max(1, Math.floor(coords.length / 400));
  for (let i = 0; i < coords.length && urls.length < MAX_PREFETCH; i += step) {
    for (const z of [16]) {
      const t = toTile(coords[i][0], coords[i][1], z);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) add(z, t.x + dx, t.y + dy);
    }
  }

  // Wait so the route and the visible map tiles load first
  setTimeout(() => {
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'PREFETCH', urls })).catch(() => {});
  }, 10000);
}
