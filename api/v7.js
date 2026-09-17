// V7 Targeted Live Scanner API
export default async function handler(req, res) {
  try {
    const path =
      typeof req.query?.path === "string"
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
        error: "Unsupported V7 endpoint",
        path
      });
    }

    const key = process.env.MAELYN_API_KEY;

    if (!key) {
      return res.status(500).json({
        success: false,
        error: "MAELYN_API_KEY is not configured"
      });
    }

    // Endpoint Maelyn yang WAJIB POST
    const postEndpoints = [
      "realtime-price",
      "ohlcv",
      "historical-data"
    ];

    const usePost = postEndpoints.includes(path);

    const baseUrl =
      `https://api.maelyn.eu/api/financial/idx/${path}`;

    let url = baseUrl;

    const options = {
      method: usePost ? "POST" : "GET",
      headers: {
        "x-maelyn-auth": key,
        "Accept": "application/json"
      }
    };

    // =========================
    // POST ENDPOINT
    // =========================
    if (usePost) {
      options.headers["Content-Type"] = "application/json";

      let body = {};

      // Kalau frontend memang mengirim POST body,
      // pertahankan body tersebut.
      if (
        req.method === "POST" &&
        req.body &&
        typeof req.body === "object"
      ) {
        body = { ...req.body };
      }

      // Support frontend lama yang masih mengirim query parameter.
      for (const [k, v] of Object.entries(req.query || {})) {
        if (k === "path") continue;

        if (k === "symbols") {
          if (Array.isArray(v)) {
            body.symbols = v;
          } else if (typeof v === "string") {
            body.symbols = v
              .split(",")
              .map(s => s.trim())
              .filter(Boolean);
          }

          continue;
        }

        if (typeof v === "string") {
          body[k] = v;
        }
      }

      options.body = JSON.stringify(body);
    }

    // =========================
    // GET ENDPOINT
    // =========================
    else {
      const qs = new URLSearchParams();

      for (const [k, v] of Object.entries(req.query || {})) {
        if (k === "path") continue;

        if (Array.isArray(v)) {
          for (const item of v) {
            qs.append(k, item);
          }
        } else if (typeof v === "string") {
          qs.set(k, v);
        }
      }

      if (qs.toString()) {
        url += `?${qs.toString()}`;
      }
    }

    const upstream = await fetch(url, options);

    const text = await upstream.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: false,
        raw: text
      };
    }

    // Debug information tanpa expose API key
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: "Maelyn upstream error",
        endpoint: path,
        method: options.method,
        upstreamStatus: upstream.status,
        upstream: data
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "V7 proxy error",
      message: err?.message || String(err)
    });
  }
}
