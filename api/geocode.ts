// Vercel serverless version of the /api/geocode proxy (the Express one in server.ts only runs locally).

type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const NIGERIA_BBOX = '2.6,4.2,14.7,13.9';

export default async function handler(req: Req, res: Res) {
  const q = first(req.query.q);
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  const lat = Number(first(req.query.lat));
  const lon = Number(first(req.query.lon));
  let url = `https://photon.komoot.io/api/?limit=8&bbox=${NIGERIA_BBOX}&q=${encodeURIComponent(q)}`;
  if (Number.isFinite(lat) && Number.isFinite(lon) && first(req.query.lat) && first(req.query.lon)) {
    url += `&lat=${lat}&lon=${lon}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CarNav-BrowserApp/1.0', Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (response.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).json(await response.json());
    }
    return res.status(response.status).json({ error: 'Geocoding service error' });
  } catch {
    return res.status(503).json({ error: 'Geocoding service unreachable' });
  }
}
