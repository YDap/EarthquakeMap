/** Quake details near the pointer. React escapes text for us, so no manual esc() is needed. */
export default function Tooltip({ tip }) {
  if (!tip) return null;
  const p = tip.f.properties;
  const depth = tip.f.geometry.coordinates[2] ?? 0;
  const style = {
    left: Math.min(tip.x + 12, window.innerWidth - 270),
    top: Math.min(tip.y + 12, window.innerHeight - 120),
    pointerEvents: tip.pinned ? "auto" : "none", // pinned tips are clickable (link)
  };
  return (
    <div className="tip" style={style}>
      <b>M {p.mag.toFixed(1)}</b> – {p.place || "Unknown"}
      <br />
      {new Date(p.time).toLocaleString()}
      <br />
      Depth: {depth.toFixed(1)} km
      <br />
      <a href={p.url} target="_blank" rel="noopener noreferrer">
        USGS event page ↗
      </a>
    </div>
  );
}
