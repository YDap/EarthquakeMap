import { useMemo } from "react";
import { usePolling, getJSON } from "../hooks/usePolling.js";
import { useAlerts } from "../hooks/useAlerts.js";
import { ALERT_LEVELS, FEEDS, QUAKE_FEED_BASE, QUAKE_POLL_SECONDS } from "../lib/config.js";
import { depthColor, quakeRadius } from "../lib/encoding.js";
import { safeUrl } from "../lib/safeUrl.js";
import { Check, EventList, PollStats, Section, Stat } from "../components/ui.jsx";

/**
 * Earthquakes from the USGS GeoJSON summary feeds.
 * Keeps polling while another mode is shown if alerts are on, so alerts still arrive.
 */
export function useQuakeMode({ active, settings, update, cursor, select, alertPrefs, onAlertsChange, onAlertSelect }) {
  const { feed, minMag, minDepth, maxDepth, alertMag } = settings;
  const poll = usePolling({
    key: feed,
    intervalSec: QUAKE_POLL_SECONDS,
    enabled: active || alertPrefs.enabled,
    fetcher: async () => {
      const json = await getJSON(`${QUAKE_FEED_BASE}${feed}.geojson`);
      return json.features.filter((f) => f.geometry && f.properties.mag != null);
    },
  });
  const all = useMemo(() => poll.data || [], [poll.data]);

  const { toasts, dismiss } = useAlerts({
    quakes: all,
    loadedFeed: poll.loadedKey,
    enabled: alertPrefs.enabled,
    sound: alertPrefs.sound,
    threshold: alertMag,
    onSelect: onAlertSelect,
  });

  // Filters + replay cursor -> what's actually drawn / listed.
  const shown = useMemo(
    () =>
      all.filter((f) => {
        const depth = f.geometry.coordinates[2] || 0;
        return (
          (minMag <= 0 || f.properties.mag >= minMag) && // tiny quakes can have negative magnitudes

          // Sliders at their ends mean "no limit" (depths can be negative = above sea level).
          (minDepth <= 0 || depth >= minDepth) &&
          (maxDepth >= 700 || depth <= maxDepth) &&
          (cursor === null || f.properties.time <= cursor)
        );
      }),
    [all, minMag, minDepth, maxDepth, cursor]
  );

  const points = useMemo(
    () =>
      shown.map((f) => ({
        id: f.id,
        coords: f.geometry.coordinates,
        r: quakeRadius(f.properties.mag),
        color: depthColor(f.geometry.coordinates[2] || 0),
        time: f.properties.time,
        item: f,
      })),
    [shown]
  );

  const top = useMemo(
    () => [...shown].sort((a, b) => b.properties.mag - a.properties.mag).slice(0, 10),
    [shown]
  );
  const startTime = useMemo(() => (all.length ? Math.min(...all.map((f) => f.properties.time)) : null), [all]);

  const goTo = (f) => select(f.geometry.coordinates[0], f.geometry.coordinates[1]);
  const notifState = "Notification" in window ? Notification.permission : "unsupported";
  const filtered = shown.length !== all.length;

  const panel = (
    <>
      <select value={feed} onChange={(e) => update({ feed: e.target.value })} aria-label="Feed">
        {FEEDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <Stat label="Quakes shown" value={filtered ? `${shown.length} of ${all.length}` : shown.length} />
      <Stat label="Strongest" value={top[0] ? `M${top[0].properties.mag.toFixed(1)}` : "–"} />
      <PollStats updatedAt={poll.updatedAt} secondsLeft={poll.secondsLeft} />
      <div className="msg">{poll.error}</div>

      <div className="legend" />
      <div className="legend-l">
        <span>shallow</span>
        <span>depth</span>
        <span>deep (700 km)</span>
      </div>

      <Section title="Filters">
        <label className="field">
          <span>
            Min magnitude <b>M{minMag.toFixed(1)}</b>
          </span>
          <input
            type="range" min="0" max="8" step="0.5"
            value={minMag}
            onChange={(e) => update({ minMag: Number(e.target.value) })}
          />
        </label>
        <div className="field">
          <span>
            Depth <b>{minDepth}–{maxDepth} km</b>
          </span>
          <input
            type="range" min="0" max="700" step="10" aria-label="Minimum depth"
            value={minDepth}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ minDepth: v, maxDepth: Math.max(v, maxDepth) });
            }}
          />
          <input
            type="range" min="0" max="700" step="10" aria-label="Maximum depth"
            value={maxDepth}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ maxDepth: v, minDepth: Math.min(v, minDepth) });
            }}
          />
        </div>
        {(minMag > 0 || minDepth > 0 || maxDepth < 700) && (
          <button className="link-btn" onClick={() => update({ minMag: 0, minDepth: 0, maxDepth: 700 })}>
            Reset filters
          </button>
        )}
      </Section>

      <Section title="Alerts">
        <div className="row">
          <Check checked={alertPrefs.enabled} onChange={(v) => onAlertsChange({ enabled: v })}>
            Alert on new quakes ≥
          </Check>
          <select
            className="small"
            value={alertMag}
            onChange={(e) => update({ alertMag: Number(e.target.value) })}
            aria-label="Alert threshold"
          >
            {ALERT_LEVELS.map((m) => (
              <option key={m} value={m}>
                M{m}
              </option>
            ))}
          </select>
        </div>
        <Check checked={alertPrefs.sound} disabled={!alertPrefs.enabled} onChange={(v) => onAlertsChange({ sound: v })}>
          Play a sound
        </Check>
        {alertPrefs.enabled && (
          <p className="note">
            {notifState === "granted" && "Browser notifications are on. Alerts keep working in the other tabs."}
            {notifState === "denied" && "Browser notifications are blocked; alerts show on this page only."}
            {notifState === "default" && "Allow notifications in your browser to get alerts in other tabs."}
            {notifState === "unsupported" && "This browser can't show notifications; alerts show on this page."}
          </p>
        )}
      </Section>

      <h3>Top 10 by magnitude</h3>
      <EventList
        empty="No quakes match."
        items={top.map((f) => ({
          id: f.id,
          badge: `M${f.properties.mag.toFixed(1)}`,
          title: f.properties.place || "",
          sub: new Date(f.properties.time).toLocaleString(),
          onClick: () => goTo(f),
        }))}
      />
    </>
  );

  return {
    points,
    lines: [],
    areas: [],
    startTime,
    liveFreshMs: 3600e3,
    panel,
    renderTip: (f) => <QuakeTip f={f} />,
    hint: "Circle size = magnitude · colour = depth · pulsing = under 1 h old. Data: USGS.",
    toasts,
    dismissToast: dismiss,
  };
}

function QuakeTip({ f }) {
  const p = f.properties;
  const depth = f.geometry.coordinates[2] ?? 0;
  const url = safeUrl(p.url);
  return (
    <>
      <b>M {p.mag.toFixed(1)}</b> – {p.place || "Unknown"}
      <br />
      {new Date(p.time).toLocaleString()}
      <br />
      Depth: {depth.toFixed(1)} km
      {url && (
        <>
          <br />
          <a href={url} target="_blank" rel="noopener noreferrer">
            USGS event page ↗
          </a>
        </>
      )}
    </>
  );
}
