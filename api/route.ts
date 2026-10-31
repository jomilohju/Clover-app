// Vercel serverless version of the /api/route proxy (the Express one in server.ts only runs locally).
// Same behaviour: try two OSRM servers, return the first good answer, else 503 so the client falls back.

type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | string[] | undefined) => {
  const n = Number(first(v));
  return Number.isFinite(n) ? n : null;
};

export default async function handler(req: Req, res: Res) {
  const startLng = num(req.query.startLng);
  const startLat = num(req.query.startLat);
  const destLng = num(req.query.destLng);
  const destLat = num(req.query.destLat);

  if (startLng === null || startLat === null || destLng === null || destLat === null) {
    return res.status(400).json({ error: 'Missing or invalid coordinates' });
  }

  const pathParams = `${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true&annotations=false`;
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${pathParams}`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${pathParams}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // two tries must fit inside the function time limit
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CarNav-BrowserApp/1.0', Accept: 'application/json' },
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          res.setHeader('Cache-Control', 'no-store');
          return res.status(200).json(data);
        }
      }
    } catch {
      // try the next server
    }
  }
  return res.status(503).json({ error: 'Remote routing servers unreachable' });
}
