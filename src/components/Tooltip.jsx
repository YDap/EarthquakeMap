/** Floating details box near the pointer; the content comes from the active mode. */
export default function Tooltip({ tip, children }) {
  if (!tip || !children) return null;
  const style = {
    left: Math.min(tip.x + 12, window.innerWidth - 270),
    top: Math.min(tip.y + 12, window.innerHeight - 140),
    pointerEvents: tip.pinned ? "auto" : "none", // pinned tips are clickable (links)
  };
  return (
    <div className="tip" style={style}>
      {children}
    </div>
  );
}
