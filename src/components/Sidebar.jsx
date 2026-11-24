import { useMemo, useState } from "react";
import { ALERT_LEVELS, FEEDS } from "../lib/config.js";

export default function Sidebar({
  settings,
  update,
  alerts,
  onAlertsChange,
  quakes,
  totalCount,
  updatedAt,
  secondsLeft,
  message,
  onSelect,
  onCopyLink,
}) {
  const top = useMemo(
    () => [...quakes].sort((a, b) => b.properties.mag - a.properties.mag).slice(0, 10),
    [quakes]
  );
  const [copied, setCopied] = useState("");

  const copy = async () => {
    const ok = await onCopyLink();
    setCopied(ok ? "Link copied!" : "Couldn't copy, see address bar");
    setTimeout(() => setCopied(""), 2500);
  };

  const notifState = "Notification" in window ? Notification.permission : "unsupported";
  const filtered = quakes.length !== totalCount;

  return (
    <aside className="sidebar">
      <h1>🌍 Earthquake Live Map</h1>
      <select value={settings.feed} onChange={(e) => update({ feed: e.target.value })} aria-label="Feed">
        {FEEDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <Stat label="Quakes shown" value={filtered ? `${quakes.length} of ${totalCount}` : quakes.length} />
      <Stat label="Strongest" value={top[0] ? `M${top[0].properties.mag.toFixed(1)}` : "–"} />
      <Stat label="Last updated" value={updatedAt ? updatedAt.toLocaleTimeString() : "–"} />
      <Stat label="Next refresh" value={`${secondsLeft} s`} />
      <div className="msg">{message}</div>

      <div className="legend" />
      <div className="legend-l">
        <span>shallow</span>
        <span>depth</span>
        <span>deep (700 km)</span>
      </div>

      <Section title="Filters">
        <label className="field">
          <span>Min magnitude <b>M{settings.minMag.toFixed(1)}</b></span>
          <input
            type="range" min="0" max="8" step="0.5"
            value={settings.minMag}
            onChange={(e) => update({ minMag: Number(e.target.value) })}
          />
        </label>
        <div className="field">
          <span>Depth <b>{settings.minDepth}–{settings.maxDepth} km</b></span>
          <input
            type="range" min="0" max="700" step="10" aria-label="Minimum depth"
            value={settings.minDepth}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ minDepth: v, maxDepth: Math.max(v, settings.maxDepth) });
            }}
          />
          <input
            type="range" min="0" max="700" step="10" aria-label="Maximum depth"
            value={settings.maxDepth}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ maxDepth: v, minDepth: Math.min(v, settings.minDepth) });
            }}
          />
        </div>
        {(settings.minMag > 0 || settings.minDepth > 0 || settings.maxDepth < 700) && (
          <button className="link-btn" onClick={() => update({ minMag: 0, minDepth: 0, maxDepth: 700 })}>
            Reset filters
          </button>
        )}
      </Section>

      <Section title="Display">
        <Check checked={settings.plates} onChange={(v) => update({ plates: v })}>
          Tectonic plate boundaries <span className="swatch plates" />
        </Check>
        <Check checked={settings.spin} onChange={(v) => update({ spin: v })}>
          Auto-rotate globe
        </Check>
      </Section>

      <Section title="Alerts">
        <div className="row">
          <Check checked={alerts.enabled} onChange={(v) => onAlertsChange({ enabled: v })}>
            Alert on new quakes ≥
          </Check>
          <select
            className="small"
            value={settings.alertMag}
            onChange={(e) => update({ alertMag: Number(e.target.value) })}
            aria-label="Alert threshold"
          >
            {ALERT_LEVELS.map((m) => (
              <option key={m} value={m}>M{m}</option>
            ))}
          </select>
        </div>
        <Check checked={alerts.sound} disabled={!alerts.enabled} onChange={(v) => onAlertsChange({ sound: v })}>
          Play a sound
        </Check>
        {alerts.enabled && (
          <p className="note">
            {notifState === "granted" && "Browser notifications are on."}
            {notifState === "denied" && "Browser notifications are blocked; alerts show on this page only."}
            {notifState === "default" && "Allow notifications in your browser to get alerts in other tabs."}
            {notifState === "unsupported" && "This browser can't show notifications; alerts show on this page."}
          </p>
        )}
      </Section>

      <Section title="Share">
        <button className="btn" onClick={copy}>🔗 Copy link to this view</button>
        <span className="note inline">{copied}</span>
      </Section>

      <h3>Top 10 by magnitude</h3>
      <ol className="top">
        {top.map((f) => (
          <li key={f.id}>
            <button onClick={() => onSelect(f)}>
              <span className="m">M{f.properties.mag.toFixed(1)}</span>
              {f.properties.place || ""}
              <small>{new Date(f.properties.time).toLocaleString()}</small>
            </button>
          </li>
        ))}
        {!top.length && <li className="note">No quakes match.</li>}
      </ol>
      <p className="hint">
        Drag to rotate · scroll to zoom · circle size = magnitude · pulsing = under 1 h old. Data: USGS;
        plates: Bird (2003).
      </p>
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Check({ checked, onChange, disabled, children }) {
  return (
    <label className={"check" + (disabled ? " disabled" : "")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
