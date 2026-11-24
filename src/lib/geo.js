import { geoArea } from "d3";

/**
 * d3 treats polygon rings as *clockwise* on the sphere; standard GeoJSON (RFC 7946, used by
 * the NWS) is counter-clockwise. Without fixing, a small warning polygon would be read as
 * "the whole world except this area". If a polygon covers more than a hemisphere, reverse it.
 */
export function rewind(geometry) {
  if (!geometry) return geometry;
  const fixPoly = (rings) => {
    const poly = { type: "Polygon", coordinates: rings };
    return geoArea(poly) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;
  };
  if (geometry.type === "Polygon") return { ...geometry, coordinates: fixPoly(geometry.coordinates) };
  if (geometry.type === "MultiPolygon") return { ...geometry, coordinates: geometry.coordinates.map(fixPoly) };
  return geometry;
}

const pad = (n) => String(n).padStart(2, "0");
/** UTC date -> "YYMMDD" as used in NOAA SPC report file names. */
export const yymmdd = (d) => `${String(d.getUTCFullYear()).slice(2)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

export const relTime = (t, now = Date.now()) => {
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};
