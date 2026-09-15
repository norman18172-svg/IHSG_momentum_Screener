// Vercel Serverless Function: secure Maelyn API proxy
// The secret is read server-side from MAELYN_API_KEY and is never sent to the browser.
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === 'string' ? req.query.path : '';
    const allowed = [
      '/financial/idx/breakout-early-warning',
      '/financial/idx/top-mover',
      '/financial/idx/entry-exit-signal',
      '/financial/idx/realtime-price'
    ];
    if (!allowed.includes(path)) {
      return res.status(400).json({ error: 'Unsupported Maelyn endpoint' });
    }

    const key = process.env.MAELYN_API_KEY;
    if (!key) return res.status(500).json({ error: 'MAELYN_API_KEY is not configured' });

    const isPost = req.method === 'POST';
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query || {})) {
      if (k !== 'path' && typeof v === 'string') qs.set(k, v);
    }
    const url = `https://api.maelyn.eu/api${path}${qs.toString() ? '?' + qs.toString() : ''}`;
    const headers = { 'x-maelyn-auth': key, 'accept': 'application/json' };
    const init = { method: isPost ? 'POST' : 'GET', headers };
    if (isPost) {
      headers['content-type'] = 'application/json';
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }
    const upstream = await fetch(url, init);

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', message: err?.message || 'Unknown error' });
  }
}
