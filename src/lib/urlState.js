import { DEFAULTS, FEEDS } from "./config.js";

/**
 * App settings <-> URL hash, e.g.
 *   #feed=all_week&mag=4&depth=0-300&plates=1&spin=0&view=-140.2,-35.0,2.5
 * Only values that differ from the defaults are written, so links stay short.
 */
const num = (v, lo, hi, fallback) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export function readUrlState() {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const s = { ...DEFAULTS, view: null };
  if (FEEDS.some((f) => f.value === p.get("feed"))) s.feed = p.get("feed");
  if (p.has("mag")) s.minMag = num(p.get("mag"), 0, 9, DEFAULTS.minMag);
  if (p.has("depth")) {
    const [a, b] = p.get("depth").split("-");
    s.minDepth = num(a, 0, 700, DEFAULTS.minDepth);
    s.maxDepth = num(b, s.minDepth, 700, DEFAULTS.maxDepth);
  }
  if (p.has("plates")) s.plates = p.get("plates") === "1";
  if (p.has("spin")) s.spin = p.get("spin") !== "0";
  if (p.has("alert")) s.alertMag = num(p.get("alert"), 0, 9, DEFAULTS.alertMag);
  if (p.has("view")) {
    const [lon, lat, zoom] = p.get("view").split(",").map(Number);
    if ([lon, lat, zoom].every(Number.isFinite)) {
      s.view = { lon, lat: Math.max(-90, Math.min(90, lat)), zoom: Math.max(0.6, Math.min(8, zoom)) };
    }
  }
  return s;
}

export function buildHash(s, view) {
  const p = new URLSearchParams();
  if (s.feed !== DEFAULTS.feed) p.set("feed", s.feed);
  if (s.minMag !== DEFAULTS.minMag) p.set("mag", String(s.minMag));
  if (s.minDepth !== DEFAULTS.minDepth || s.maxDepth !== DEFAULTS.maxDepth) p.set("depth", `${s.minDepth}-${s.maxDepth}`);
  if (s.plates !== DEFAULTS.plates) p.set("plates", s.plates ? "1" : "0");
  if (s.spin !== DEFAULTS.spin) p.set("spin", s.spin ? "1" : "0");
  if (s.alertMag !== DEFAULTS.alertMag) p.set("alert", String(s.alertMag));
  if (view) p.set("view", `${view.lon.toFixed(1)},${view.lat.toFixed(1)},${view.zoom.toFixed(2)}`);
  const str = p.toString().replace(/%2C/g, ",");
  return str ? "#" + str : "";
}

export function writeUrlState(s) {
  const url = window.location.pathname + window.location.search + buildHash(s);
  window.history.replaceState(null, "", url);
}
