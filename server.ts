import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Proxy endpoint for OSRM routing
// Avoids client-side CORS issues, network timeouts, and adblocker blocks
app.get('/api/route', async (req, res) => {
  const { startLng, startLat, destLng, destLat } = req.query;

  if (!startLng || !startLat || !destLng || !destLat) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  const pathParams = `${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true&annotations=false`;
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${pathParams}`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${pathParams}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CarNav-BrowserApp/1.0',
          Accept: 'application/json',
        },
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          return res.json(data);
        }
      }
    } catch (err: unknown) {
      console.warn(`Routing endpoint failed: ${url}`, err instanceof Error ? err.message : err);
    }
  }

  // If remote servers fail, return 503 so client falls back gracefully
  return res.status(503).json({ error: 'Remote routing servers unreachable' });
});

// Proxy endpoint for Photon geocoding
app.get('/api/geocode', async (req, res) => {
  const { q, lat, lon } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  const NIGERIA_BBOX = '2.6,4.2,14.7,13.9';
  let url = `https://photon.komoot.io/api/?limit=8&bbox=${NIGERIA_BBOX}&q=${encodeURIComponent(q)}`;
  if (lat && lon) {
    url += `&lat=${lat}&lon=${lon}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CarNav-BrowserApp/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    return res.status(response.status).json({ error: 'Geocoding service error' });
  } catch (err: unknown) {
    console.warn('Geocoding endpoint failed:', err instanceof Error ? err.message : err);
    return res.status(503).json({ error: 'Geocoding service unreachable' });
  }
});

// Mount Vite middleware in development or serve static in production
async function startServer() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CarNav server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
