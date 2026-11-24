import { CYCLONE_PERIODS, DEFAULTS, FEEDS, MODES, TORNADO_PERIODS } from "./config.js";

/**
 * App settings <-> URL hash, e.g.
 *   #mode=cyclones&cdays=60&plates=1&spin=0&view=-140.2,-35.0,2.5
 * Only values that differ from the defaults are written, so links stay short.
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (lo, hi) => ({
  parse: (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? clamp(n, lo, hi) : undefined;
  },
  format: String,
});
const oneOf = (values) => ({
  parse: (v) => (values.map(String).includes(v) ? (typeof values[0] === "number" ? Number(v) : v) : undefined),
  format: String,
});
const bool = { parse: (v) => v === "1", format: (b) => (b ? "1" : "0") };

// setting name -> [url key, codec]
const SCHEMA = {
  mode: ["mode", oneOf(MODES.map((m) => m.value))],
  plates: ["plates", bool],
  spin: ["spin", bool],
  feed: ["feed", oneOf(FEEDS.map((f) => f.value))],
  minMag: ["mag", num(0, 9)],
  alertMag: ["alert", num(0, 9)],
  cycloneDays: ["cdays", oneOf(CYCLONE_PERIODS)],
  activeOnly: ["active", bool],
  tornadoDays: ["tdays", oneOf(TORNADO_PERIODS)],
  warnings: ["warn", bool],
};

export function readUrlState() {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const s = { ...DEFAULTS };
  for (const [name, [key, codec]] of Object.entries(SCHEMA)) {
    if (!p.has(key)) continue;
    const v = codec.parse(p.get(key));
    if (v !== undefined) s[name] = v;
  }
  if (p.has("depth")) {
    const [a, b] = p.get("depth").split("-").map(parseFloat);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      s.minDepth = clamp(a, 0, 700);
      s.maxDepth = clamp(b, s.minDepth, 700);
    }
  }
  let view = null;
  if (p.has("view")) {
    const [lon, lat, zoom] = p.get("view").split(",").map(Number);
    if ([lon, lat, zoom].every(Number.isFinite)) {
      view = { lon, lat: clamp(lat, -90, 90), zoom: clamp(zoom, 0.6, 8) };
    }
  }
  return { settings: s, view };
}

export function buildHash(s, view) {
  const p = new URLSearchParams();
  for (const [name, [key, codec]] of Object.entries(SCHEMA)) {
    if (s[name] !== DEFAULTS[name]) p.set(key, codec.format(s[name]));
  }
  if (s.minDepth !== DEFAULTS.minDepth || s.maxDepth !== DEFAULTS.maxDepth) p.set("depth", `${s.minDepth}-${s.maxDepth}`);
  if (view) p.set("view", `${view.lon.toFixed(1)},${view.lat.toFixed(1)},${view.zoom.toFixed(2)}`);
  const str = p.toString().replace(/%2C/g, ",");
  return str ? "#" + str : "";
}

export function writeUrlState(s) {
  const url = window.location.pathname + window.location.search + buildHash(s);
  window.history.replaceState(null, "", url);
}
