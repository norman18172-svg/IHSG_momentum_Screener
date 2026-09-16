// NOR.Finance V7.19 — ZPI production proxy (quota-aware)
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === "string" ? req.query.path : "";
    const key = process.env.ZAPI_API_KEY;
    if (!key) return res.status(500).json({ success:false, error:"ZAPI_API_KEY is not configured" });

    const qs = new URLSearchParams();
    for (const [k,v] of Object.entries(req.query || {})) {
      if (k !== "path" && typeof v === "string") qs.set(k,v);
    }

    const call = async (url) => {
      const r = await fetch(url,{headers:{"x-api-key":key,"Accept":"application/json"}});
      const text = await r.text(); let body;
      try { body=JSON.parse(text); } catch { body={raw:text}; }
      if (!r.ok) throw new Error(body?.message || body?.error || `ZPI HTTP ${r.status}`);
      return body;
    };
    const idx = p => `https://api.zpi.web.id/v1/finance:idx/${p}`;
    const pluang = p => `https://api.zpi.web.id/v1/finance:pluang/${p}`;
    const addQs = base => base + (qs.toString()?`?${qs.toString()}`:"");

    // Shared market snapshot. One call can carry the whole IDX stock table.
    if (path === "stock-summary") {
      if (!qs.has("length")) qs.set("length","5000");
      const body=await call(addQs(idx("stock-summary")));
      res.setHeader("Cache-Control","s-maxage=240, stale-while-revalidate=60");
      return res.status(200).json(body);
    }

    // Normalize COMPOSITE from the real index-summary schema: IndexCode, Previous, Highest, Lowest, Close, Change...
    if (path === "ihsg") {
      const body=await call(idx("index-summary"));
      const candidates = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.data) ? body.data.data : Array.isArray(body?.data?.items) ? body.data.items : Array.isArray(body?.items) ? body.items : [];
      const row=candidates.find(x=>String(x?.IndexCode||"").toUpperCase()==="COMPOSITE") || candidates.find(x=>/COMPOSITE|IHSG/i.test(String(x?.IndexCode||x?.IndexName||"")));
      if(!row) return res.status(502).json({success:false,error:"COMPOSITE not found in index-summary"});
      res.setHeader("Cache-Control","s-maxage=240, stale-while-revalidate=60");
      return res.status(200).json({success:true,row,close:row.Close,previous:row.Previous,high:row.Highest,low:row.Lowest,date:row.Date,change:row.Change,changePercent:row.Previous?((Number(row.Close)/Number(row.Previous)-1)*100):null});
    }

    if (path === "foreign-flow") {
      const body=await call(addQs(idx("foreign-flow")));
      res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=120");
      return res.status(200).json(body);
    }
    if (path === "stock-history") {
      const body=await call(addQs(idx("stock-history")));
      res.setHeader("Cache-Control","s-maxage=21600, stale-while-revalidate=3600");
      return res.status(200).json(body);
    }
    if (path === "stock-broker") {
      const body=await call(addQs(pluang("broker-summary")));
      const root=body?.data??body;
      return res.status(200).json({success:true,source:"pluang",stockId:root?.stockId??body?.stockId,code:root?.code??req.query?.code,startDate:root?.startDate,endDate:root?.endDate,buyers:root?.buyers??[],sellers:root?.sellers??[]});
    }
    if (path === "pluang-running-trades") {
      const body=await call(addQs(pluang("running-trades")));
      const root=body?.data??body;
      return res.status(200).json({success:true,source:"pluang",code:root?.code??req.query?.code,items:root?.items??[],count:root?.count,fetched:root?.fetched,nextCursor:root?.nextCursor});
    }

    return res.status(400).json({success:false,error:"Unsupported ZPI endpoint"});
  } catch (err) {
    return res.status(500).json({success:false,error:"Zapi proxy error",message:err?.message||String(err)});
  }
}
