// V7 Secure Zapi API Proxy
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === "string"
      ? req.query.path
      : "";

    const idxAllowed = [
      "stock-summary",
      "foreign-flow",
      "broker-summary",
      "brokers"
    ];

    const pluangAllowed = [
      "broker-summary",
      "brokers",
      "resolve",
      "quote",
      "summary",
      "orderbook",
      "running-trades",
      "tradebook"
    ];

    const isIdx = idxAllowed.includes(path);
    const isPluang = path === "pluang-broker-summary" || path === "pluang-brokers";

    if (!isIdx && !isPluang) {
      return res.status(400).json({
        success: false,
        error: "Unsupported Zapi endpoint"
      });
    }

    const key = process.env.ZAPI_API_KEY;
    if (!key) {
      return res.status(500).json({
        success: false,
        error: "ZAPI_API_KEY is not configured"
      });
    }

    const qs = new URLSearchParams();

    for (const [k, v] of Object.entries(req.query || {})) {
      if (k !== "path" && typeof v === "string") {
        qs.set(k, v);
      }
    }

    let url;

    if (path === "pluang-broker-summary") {
      url =
        `https://api.zpi.web.id/v1/finance:pluang/broker-summary` +
        (qs.toString() ? `?${qs.toString()}` : "");
    } else if (path === "pluang-brokers") {
      url =
        `https://api.zpi.web.id/v1/finance:pluang/brokers` +
        (qs.toString() ? `?${qs.toString()}` : "");
    } else {
      url =
        `https://api.zpi.web.id/v1/finance:idx/${path}` +
        (qs.toString() ? `?${qs.toString()}` : "");
    }

    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": key,
        "Accept": "application/json"
      }
    });

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
      error: "Zapi proxy error",
      message: err?.message || String(err)
    });
  }
}
