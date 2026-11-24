import { scaleLinear } from "d3";

// Magnitude is logarithmic (each +1 = ~32x energy), so radius grows exponentially.
export const radius = (mag, zoom) => (1.6 + Math.pow(1.55, Math.max(mag, 0))) * Math.sqrt(zoom);

// Depth -> colour: shallow yellow ... deep blue (km)
export const depthColor = scaleLinear()
  .domain([0, 35, 100, 300, 700])
  .range(["#ffe066", "#ff9248", "#e8344e", "#8a2be2", "#2d3cff"])
  .clamp(true);

/** "Fresh" = happened within `windowMs` before `refTime` (now, or the replay cursor). */
export const isFresh = (f, refTime = Date.now(), windowMs = 3600e3) => {
  const age = refTime - f.properties.time;
  return age >= 0 && age < windowMs;
};
