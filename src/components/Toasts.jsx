import { depthColor } from "../lib/encoding.js";

/** In-page alerts for new strong quakes (works even when browser notifications are blocked). */
export default function Toasts({ toasts, onSelect, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(({ id, f }) => (
        <div
          key={id}
          className="toast"
          style={{ borderLeftColor: depthColor(f.geometry.coordinates[2] || 0) }}
        >
          <button className="toast-body" onClick={() => { onSelect(f); onDismiss(id); }}>
            <b>New M{f.properties.mag.toFixed(1)}</b> {f.properties.place || "Unknown location"}
            <small>{new Date(f.properties.time).toLocaleTimeString()} · click to view</small>
          </button>
          <button className="toast-x" onClick={() => onDismiss(id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
