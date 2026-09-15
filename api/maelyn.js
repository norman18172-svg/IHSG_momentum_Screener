// V6 Secure Maelyn API Proxy
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === "string" ? req.query.path : "";

    const allowed = [
      "/financial/idx/realtime-price",
      "/financial/idx/ohlcv",
      "/financial/idx/historical-data",
      "/financial/idx/breakout-early-warning",
      "/financial/idx/top-mover",
      "/financial/idx/entry-exit-signal",
      "/financial/idx/candlestick-pattern",
      "/financial/idx/fundamental-analysis",
      "/financial/idx/sector-heatmap"
    ];

    if (!allowed.includes(path)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported Maelyn endpoint"
      });
    }

    const key = process.env.MAELYN_API_KEY;

    if (!key) {
      return res.status(500).json({
        success: false,
        error: "MAELYN_API_KEY is not configured"
      });
    }

    const qs = new URLSearchParams();

    for (const [k, v] of Object.entries(req.query || {})) {
      if (k !== "path" && typeof v === "string") {
        qs.set(k, v);
      }
    }

    const url =
      `https://api.maelyn.eu/api${path}` +
      (qs.toString() ? `?${qs.toString()}` : "");

    const options = {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        "x-maelyn-auth": key,
        "Content-Type": "application/json"
      }
    };

    if (options.method === "POST") {
      options.body =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body || {});
    }

    const upstream = await fetch(url, options);
    const text = await upstream.text();

    res.status(upstream.status);

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Proxy error",
      message: err?.message || String(err)
    });
  }
}
