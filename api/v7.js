// V7 Targeted Live Scanner API
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === "string"
      ? req.query.path
      : "";

    const allowed = [
      "realtime-price",
      "ohlcv",
      "historical-data",
      "fundamental-analysis",
      "candlestick-pattern-scanner",
      "breakout-early-warning"
    ];

    if (!allowed.includes(path)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported V7 endpoint"
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
      `https://api.maelyn.eu/api/financial/idx/${path}` +
      (qs.toString() ? `?${qs.toString()}` : "");

    const options = {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        "x-maelyn-auth": key,
        "Content-Type": "application/json",
        "Accept": "application/json"
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
      error: "V7 proxy error",
      message: err?.message || String(err)
    });
  }
}
