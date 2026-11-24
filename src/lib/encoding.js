import { scaleLinear } from "d3";

/* ---- Earthquakes ---- */
// Magnitude is logarithmic (each +1 = ~32x energy), so radius grows exponentially.
export const quakeRadius = (mag) => 1.6 + Math.pow(1.55, Math.max(mag, 0));

// Depth -> colour: shallow yellow ... deep blue (km)
export const depthColor = scaleLinear()
  .domain([0, 35, 100, 300, 700])
  .range(["#ffe066", "#ff9248", "#e8344e", "#8a2be2", "#2d3cff"])
  .clamp(true);

/* ---- Tropical cyclones: Saffir–Simpson scale by sustained wind (knots) ---- */
export const CYCLONE_CATS = [
  { min: 0, short: "TD", label: "Tropical depression", color: "#5ebaff" },
  { min: 34, short: "TS", label: "Tropical storm", color: "#00faf4" },
  { min: 64, short: "C1", label: "Category 1", color: "#ffffcc" },
  { min: 83, short: "C2", label: "Category 2", color: "#ffe775" },
  { min: 96, short: "C3", label: "Category 3", color: "#ffc140" },
  { min: 113, short: "C4", label: "Category 4", color: "#ff8f20" },
  { min: 137, short: "C5", label: "Category 5", color: "#ff6060" },
];
export const cycloneCat = (kts) => {
  let c = CYCLONE_CATS[0];
  for (const cat of CYCLONE_CATS) if ((kts ?? 0) >= cat.min) c = cat;
  return c;
};

/* ---- Tornadoes: (Enhanced) Fujita rating ---- */
export const EF_SCALE = [
  { key: "UNK", label: "Unrated", color: "#9aa7c7" },
  { key: "0", label: "EF0", color: "#7dd87d" },
  { key: "1", label: "EF1", color: "#ffe066" },
  { key: "2", label: "EF2", color: "#ff9248" },
  { key: "3", label: "EF3", color: "#e8344e" },
  { key: "4", label: "EF4", color: "#c22ad6" },
  { key: "5", label: "EF5", color: "#7a2bff" },
];
export const efInfo = (rating) => EF_SCALE.find((e) => e.key === rating) || EF_SCALE[0];

/** "Fresh" = happened within `windowMs` before `refTime` (now, or the replay cursor). */
export const isFresh = (time, refTime = Date.now(), windowMs = 3600e3) => {
  const age = refTime - time;
  return age >= 0 && age < windowMs;
};
