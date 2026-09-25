// api/_candles.ts
import "dotenv/config";

// src/services/upstoxService.ts
var UpstoxAuthError = class extends Error {
  constructor(message = "Upstox access token expired or invalid (401)") {
    super(message);
    this.name = "UpstoxAuthError";
  }
};
var BASE = "https://api.upstox.com/v2";
function getToken() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error("UPSTOX_ACCESS_TOKEN not configured");
  return token;
}
function dateRange() {
  const to = /* @__PURE__ */ new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1e3);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}
async function fetchCandleData(instrumentKey) {
  const { from, to } = dateRange();
  const url = `${BASE}/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" }
  });
  if (res.status === 401) throw new UpstoxAuthError();
  if (!res.ok) throw new Error(`Upstox ${res.status} for ${instrumentKey}`);
  const json = await res.json();
  const rawCandles = json?.data?.candles ?? [];
  if (rawCandles.length < 50) throw new Error(`Insufficient candles for ${instrumentKey}`);
  const candles = [...rawCandles].reverse();
  const closes = candles.map((c) => Number(c[4]));
  const volumes = candles.map((c) => Number(c[5] ?? 0));
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const nav = [100];
  for (const r of returns) {
    nav.push(Number((nav[nav.length - 1] * (1 + r * 0.7 + 1e-4)).toFixed(2)));
  }
  return {
    prices: closes,
    volumeHistory: volumes,
    sectorNavHistory: nav,
    dataSource: "Upstox"
  };
}

// api/_candles.ts
async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const keysParam = req.query.keys || req.query.instrumentKey || "";
  const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return res.status(400).json({ error: "Missing instrument keys parameter (keys=...)" });
  }
  try {
    const results = {};
    await Promise.all(
      keys.map(async (key) => {
        try {
          const data = await fetchCandleData(key);
          results[key] = data;
        } catch (err) {
          if (err instanceof UpstoxAuthError) {
            throw err;
          }
          results[key] = { error: err instanceof Error ? err.message : "Failed to fetch candles" };
        }
      })
    );
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    return res.json({ results });
  } catch (err) {
    if (err instanceof UpstoxAuthError) {
      return res.status(401).json({ error: "Upstox authentication failed. Token expired or invalid." });
    }
    return res.status(500).json({ error: err?.message || "Failed to fetch candle data" });
  }
}
export {
  handler as default
};
