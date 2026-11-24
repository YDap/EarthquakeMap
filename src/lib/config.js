export const SPIN_DEG_PER_SEC = 6;   // idle rotation speed
export const RESUME_AFTER_MS = 2500; // wait after user interaction before spinning again
export const REPLAY_SECONDS = 30;    // a full replay of the loaded time span takes this long

// Bird (2003) PB2002 plate boundaries, as GeoJSON (loaded only when the layer is switched on).
export const PLATES_URL =
  "https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json";

export const MODES = [
  { value: "quakes", label: "Quakes", icon: "🌍", title: "Earthquake Live Map" },
  { value: "cyclones", label: "Cyclones", icon: "🌀", title: "Tropical Cyclones" },
  { value: "tornadoes", label: "Tornadoes", icon: "🌪️", title: "US Tornadoes" },
];

/* ---- Earthquakes (USGS) ---- */
export const QUAKE_FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/";
export const QUAKE_POLL_SECONDS = 60;
export const FEEDS = [
  { value: "all_hour", label: "Past hour – all" },
  { value: "all_day", label: "Past day – all" },
  { value: "all_week", label: "Past week – all" },
  { value: "2.5_week", label: "Past week – M2.5+" },
];
export const ALERT_LEVELS = [4, 5, 6, 7];

/* ---- Tropical cyclones (NASA EONET, tracks from JTWC / NOAA NHC) ---- */
export const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";
export const CYCLONE_POLL_SECONDS = 15 * 60; // advisories come every ~6 h
export const CYCLONE_PERIODS = [7, 30, 60];

/* ---- Tornadoes (NOAA SPC storm reports + NWS live warnings, US only) ---- */
export const SPC_REPORTS_BASE = "https://www.spc.noaa.gov/climo/reports/";
export const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active?event=Tornado%20Warning";
export const TORNADO_POLL_SECONDS = 2 * 60;
export const TORNADO_PERIODS = [1, 3, 7, 30];

export const DEFAULTS = {
  mode: "quakes",
  // shared
  plates: false,
  spin: true,
  // quakes
  feed: "all_day",
  minMag: 0,
  minDepth: 0,
  maxDepth: 700,
  alertMag: 5,
  // cyclones
  cycloneDays: 30,
  activeOnly: false,
  // tornadoes
  tornadoDays: 7,
  warnings: true,
};
