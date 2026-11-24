/* Small shared building blocks for the sidebar panels. */

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Check({ checked, onChange, disabled, children }) {
  return (
    <label className={"check" + (disabled ? " disabled" : "")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Discrete colour legend: [{ label, color }] */
export function SwatchLegend({ items }) {
  return (
    <div className="swatches">
      {items.map((i) => (
        <span key={i.label} className="sw" title={i.title || i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Clickable list of events (Top 10 etc.). items: [{ id, badge, badgeColor?, title, sub, onClick }] */
export function EventList({ items, empty = "Nothing to show." }) {
  return (
    <ol className="top">
      {items.map((i) => (
        <li key={i.id}>
          <button onClick={i.onClick}>
            <span className="m" style={i.badgeColor ? { color: i.badgeColor } : undefined}>
              {i.badge}
            </span>
            {i.title}
            <small>{i.sub}</small>
          </button>
        </li>
      ))}
      {!items.length && <li className="note">{empty}</li>}
    </ol>
  );
}

export function PollStats({ updatedAt, secondsLeft }) {
  const s = secondsLeft;
  return (
    <>
      <Stat label="Last updated" value={updatedAt ? updatedAt.toLocaleTimeString() : "–"} />
      <Stat label="Next refresh" value={s >= 120 ? `${Math.ceil(s / 60)} min` : `${s} s`} />
    </>
  );
}
