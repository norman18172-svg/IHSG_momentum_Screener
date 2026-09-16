// NOR.Finance V7.18D — diagnostic ZPI data layer
export default async function handler(req, res) {
  try {
    const path = typeof req.query?.path === "string" ? req.query.path : "";
    const key = process.env.ZAPI_API_KEY;
    if (!key) return res.status(500).json({success:false,error:"ZAPI_API_KEY is not configured"});

    const call = async (family, endpoint, params={}) => {
      const qs = new URLSearchParams();
      for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k,String(v));
      const url=`https://api.zpi.web.id/v1/finance:${family}/${endpoint}${qs.toString()?`?${qs}`:""}`;
      const r=await fetch(url,{headers:{"x-api-key":key,"Accept":"application/json"}});
      const text=await r.text(); let body; try{body=JSON.parse(text)}catch{body={raw:text}}
      if(!r.ok) throw new Error(body?.message||body?.error||`ZPI ${r.status}`);
      return body;
    };

    // Temporary diagnostic endpoint: returns upstream shapes/statuses, never the API key.
    if(path === "diagnostic"){
      const code=String(req.query?.code||"AMMN").toUpperCase();
      const probe=async(family,endpoint,params={})=>{
        try{const body=await call(family,endpoint,params);return {ok:true,keys:Object.keys(body||{}),body};}
        catch(e){return {ok:false,error:e?.message||String(e)}}
      };
      const [idx,stock,resolve,broker,running]=await Promise.all([
        probe("idx","index-summary",{length:50,start:0}),
        probe("idx","stock-summary",{length:20,start:0,code}),
        probe("pluang","resolve",{code}),
        probe("pluang","broker-summary",{code,net:"true"}),
        probe("pluang","running-trades",{code,minLot:100})
      ]);
      return res.json({success:true,diagnostic:"V7.18D",code,idx,stock,resolve,broker,running});
    }

    // Normalized IHSG endpoint: use official IDX index-summary, default latest trading day.
    if(path === "ihsg"){
      const r=await call("idx","index-summary",{length:50,start:0});
      const rows=Array.isArray(r?.data)?r.data:Array.isArray(r?.items)?r.items:[];
      const x=rows.find(v=>String(v?.IndexCode??v?.code??"").toUpperCase()==="COMPOSITE");
      if(!x) return res.status(502).json({success:false,error:"COMPOSITE not returned by upstream"});
      const close=Number(x.Close??x.last), previous=Number(x.Previous??x.previous);
      return res.json({success:true,code:"COMPOSITE",date:x.Date??x.date,close,previous,change:Number(x.Change??x.change),changePercent:previous?((close/previous)-1)*100:null,high:Number(x.Highest??x.high),low:Number(x.Lowest??x.low),value:Number(x.Value??x.value),volume:Number(x.Volume??x.volume),source:"idx/index-summary"});
    }

    // Normalized per-stock broker summary. First use endpoint defaults; if empty,
    // anchor the range to the latest IDX trading date instead of the device date.
    if(path === "stock-broker"){
      const code=String(req.query?.code||"").toUpperCase();
      if(!code) return res.status(400).json({success:false,error:"code required"});
      const usable=f=>(Array.isArray(f?.buyers)&&f.buyers.length)||(Array.isArray(f?.sellers)&&f.sellers.length);
      let f=null;
      try{f=await call("pluang","broker-summary",{code,net:"true"})}catch{}
      if(!usable(f)){
        const h=await call("idx","stock-history",{code,length:1});
        const end=h?.to??h?.items?.[0]?.date;
        if(end){const d=new Date(end+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-30);const start=d.toISOString().slice(0,10);f=await call("pluang","broker-summary",{code,startDate:start,endDate:end,net:"true"})}
      }
      if(!usable(f)) return res.status(404).json({success:false,error:"Broker summary unavailable",code});
      return res.json({success:true,code,stockId:f.stockId,startDate:f.startDate,endDate:f.endDate,buyers:f.buyers||[],sellers:f.sellers||[],count:f.count,capped:f.capped,source:"pluang/broker-summary"});
    }

    const idxAllowed=["stock-summary","foreign-flow","broker-summary","brokers","index-summary","index-constituent","stock-history","trading-info-daily"];
    const pluangMap={"pluang-broker-summary":"broker-summary","pluang-brokers":"brokers","pluang-running-trades":"running-trades","pluang-resolve":"resolve","pluang-summary":"summary"};
    const family=idxAllowed.includes(path)?"idx":pluangMap[path]?"pluang":null;
    const endpoint=family==="idx"?path:pluangMap[path];
    if(!family) return res.status(400).json({success:false,error:"Unsupported Zapi endpoint"});
    const params={...req.query}; delete params.path;
    const body=await call(family,endpoint,params);
    return res.json(body);
  } catch (err) {
    return res.status(502).json({success:false,error:"Zapi proxy error",message:err?.message||String(err)});
  }
}
