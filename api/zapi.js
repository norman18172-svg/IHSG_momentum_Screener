// NOR.Finance V7.10 — Secure ZPI proxy
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === "string" ? req.query.path : "";
    const idxAllowed = [
      "stock-summary", "foreign-flow", "broker-summary", "brokers",
      "index-summary", "index-constituent", "stock-history", "trading-info-daily"
    ];
    const pluangMap = {
      "pluang-broker-summary": "broker-summary",
      "pluang-brokers": "brokers"
    };
    const isIdx = idxAllowed.includes(path);
    const pluangPath = pluangMap[path];
    if (!isIdx && !pluangPath) return res.status(400).json({success:false,error:"Unsupported Zapi endpoint"});
    const key = process.env.ZAPI_API_KEY;
    if (!key) return res.status(500).json({success:false,error:"ZAPI_API_KEY is not configured"});
    const qs = new URLSearchParams();
    for (const [k,v] of Object.entries(req.query || {})) if (k !== "path" && typeof v === "string") qs.set(k,v);
    const base = pluangPath ? `https://api.zpi.web.id/v1/finance:pluang/${pluangPath}` : `https://api.zpi.web.id/v1/finance:idx/${path}`;
    const upstream = await fetch(base + (qs.toString()?`?${qs}`:""), {headers:{"x-api-key":key,"Accept":"application/json"}});
    const text = await upstream.text();
    res.status(upstream.status);
    try { return res.json(JSON.parse(text)); } catch { return res.send(text); }
  } catch (err) {
    return res.status(500).json({success:false,error:"Zapi proxy error",message:err?.message||String(err)});
  }
}
