export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const allowed = [
    "/financial/idx/breakout-early-warning",
    "/financial/idx/top-mover",
    "/financial/idx/entry-exit-signal",
  ];

  const path = req.query.path;

  if (!path || !allowed.includes(path)) {
    return res.status(400).json({ error: "Invalid API path" });
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query)) {
    if (key !== "path" && typeof value === "string") {
      params.set(key, value);
    }
  }

  const url =
    `https://api.maelyn.eu/api${path}` +
    (params.toString() ? `?${params.toString()}` : "");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-maelyn-auth": process.env.MAELYN_API_KEY,
        "Accept": "application/json",
      },
    });

    const text = await response.text();

    res.status(response.status);

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (error) {
    return res.status(500).json({
      error: "Maelyn proxy error",
    });
  }
}
