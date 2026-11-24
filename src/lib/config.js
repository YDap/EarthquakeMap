export const FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/";
export const POLL_SECONDS = 60;      // how often we re-fetch
export const SPIN_DEG_PER_SEC = 6;   // idle rotation speed
export const RESUME_AFTER_MS = 2500; // wait after user interaction before spinning again

// Bird (2003) PB2002 plate boundaries, as GeoJSON (loaded only when the layer is switched on).
export const PLATES_URL =
  "https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json";

export const REPLAY_SECONDS = 30;    // a full replay of the feed's time span takes this long

export const FEEDS = [
  { value: "all_hour", label: "Past hour – all" },
  { value: "all_day", label: "Past day – all" },
  { value: "all_week", label: "Past week – all" },
  { value: "2.5_week", label: "Past week – M2.5+" },
];

export const ALERT_LEVELS = [4, 5, 6, 7];

export const DEFAULTS = {
  feed: "all_day",
  minMag: 0,
  minDepth: 0,
  maxDepth: 700,
  plates: false,
  spin: true,
  alertMag: 5,
};
