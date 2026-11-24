import { useMemo } from "react";
import { usePolling, getJSON } from "../hooks/usePolling.js";
import { CYCLONE_PERIODS, CYCLONE_POLL_SECONDS, EONET_URL } from "../lib/config.js";
import { CYCLONE_CATS, cycloneCat } from "../lib/encoding.js";
import { safeUrl } from "../lib/safeUrl.js";
import { Check, EventList, PollStats, Section, Stat, SwatchLegend } from "../components/ui.jsx";

/**
 * Tropical cyclones from NASA EONET ("severeStorms"), which republishes the JTWC / NOAA NHC
 * best-track fixes: one position + max sustained wind (knots) every 6 hours per storm.
 */
async function fetchStorms(days) {
  const json = await getJSON(`${EONET_URL}?category=severeStorms&status=all&days=${days}`);
  return json.events
    .map((e) => {
      const fixes = e.geometry
        .filter((g) => g.type === "Point" && Array.isArray(g.coordinates))
        .map((g) => ({ t: Date.parse(g.date), coords: g.coordinates, kts: g.magnitudeValue ?? null }))
        .filter((f) => Number.isFinite(f.t))
        .sort((a, b) => a.t - b.t);
      const peak = Math.max(0, ...fixes.map((f) => f.kts ?? 0));
      return {
        id: e.id,
        title: e.title,
        closed: e.closed ? Date.parse(e.closed) : null,
        sources: e.sources || [],
        link: e.link,
        fixes,
        peak,
      };
    })
    .filter((s) => s.fixes.length);
}

export function useCycloneMode({ active, settings, update, cursor, select }) {
  const { cycloneDays, activeOnly } = settings;
  const poll = usePolling({
    key: String(cycloneDays),
    intervalSec: CYCLONE_POLL_SECONDS,
    enabled: active,
    fetcher: () => fetchStorms(cycloneDays),
  });
  const storms = useMemo(() => poll.data || [], [poll.data]);

  // What each storm looks like at the replay cursor (or now).
  const view = useMemo(() => {
    const out = [];
    for (const s of storms) {
      if (activeOnly && s.closed) continue;
      const fixes = cursor === null ? s.fixes : s.fixes.filter((f) => f.t <= cursor);
      if (!fixes.length) continue;
      const last = fixes[fixes.length - 1];
      // Live: EONET says it's still open. Replay: there are newer fixes, so it was still going.
      const activeNow = cursor === null ? !s.closed : last !== s.fixes[s.fixes.length - 1] || !s.closed;
      const peakSoFar = Math.max(0, ...fixes.map((f) => f.kts ?? 0));
      out.push({ storm: s, fixes, last, activeNow, peakSoFar });
    }
    return out;
  }, [storms, activeOnly, cursor]);

  const { points, lines } = useMemo(() => {
    const points = [];
    const lines = [];
    for (const v of view) {
      // Track: merge consecutive segments of the same category into one line.
      let run = null;
      for (let i = 1; i < v.fixes.length; i++) {
        const a = v.fixes[i - 1];
        const b = v.fixes[i];
        const color = cycloneCat(a.kts).color;
        if (run && run.color === color) run.coords.push(b.coords);
        else {
          run = { color, width: 2, coords: [a.coords, b.coords] };
          lines.push(run);
        }
      }
      // Small hoverable dot per 6-hourly fix...
      v.fixes.forEach((f, i) => {
        if (f === v.last) return;
        points.push({
          id: `${v.storm.id}:${i}`,
          coords: f.coords,
          r: 2,
          color: cycloneCat(f.kts).color,
          alpha: 0.9,
          pulse: false,
          item: { storm: v.storm, fix: f },
        });
      });
      // ...and a big marker where the storm is (or was last seen).
      points.push({
        id: `${v.storm.id}:now`,
        coords: v.last.coords,
        r: 4 + (v.last.kts ?? 0) / 14,
        color: cycloneCat(v.last.kts).color,
        alpha: v.activeNow ? 0.75 : 0.35,
        pulse: v.activeNow,
        item: { storm: v.storm, fix: v.last, current: true, activeNow: v.activeNow },
      });
    }
    return { points, lines };
  }, [view]);

  const list = useMemo(
    () => [...view].sort((a, b) => b.activeNow - a.activeNow || b.peakSoFar - a.peakSoFar),
    [view]
  );
  const startTime = useMemo(
    () => (storms.length ? Math.min(...storms.map((s) => s.fixes[0].t)) : null),
    [storms]
  );
  const activeCount = view.filter((v) => v.activeNow).length;
  const strongest = list.reduce((m, v) => (!m || v.peakSoFar > m.peakSoFar ? v : m), null);

  const fmtDay = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });

  const panel = (
    <>
      <select
        value={cycloneDays}
        onChange={(e) => update({ cycloneDays: Number(e.target.value) })}
        aria-label="Period"
      >
        {CYCLONE_PERIODS.map((d) => (
          <option key={d} value={d}>
            Past {d} days
          </option>
        ))}
      </select>

      <Stat label="Storms shown" value={view.length} />
      <Stat label="Active now" value={activeCount} />
      <Stat
        label="Strongest"
        value={strongest ? `${cycloneCat(strongest.peakSoFar).short} · ${strongest.peakSoFar} kt` : "–"}
      />
      <PollStats updatedAt={poll.updatedAt} secondsLeft={poll.secondsLeft} />
      <div className="msg">{poll.error}</div>

      <SwatchLegend
        items={CYCLONE_CATS.map((c) => ({ label: c.short, color: c.color, title: `${c.label}: ${c.min}+ kt` }))}
      />
      <div className="legend-l">
        <span>track colour = strength (Saffir–Simpson)</span>
      </div>

      <Section title="Filters">
        <Check checked={activeOnly} onChange={(v) => update({ activeOnly: v })}>
          Active storms only
        </Check>
      </Section>

      <h3>Storms</h3>
      <EventList
        empty={poll.updatedAt ? "No storms in this period." : "Loading…"}
        items={list.map((v) => {
          const cat = cycloneCat(v.peakSoFar);
          return {
            id: v.storm.id,
            badge: cat.short,
            badgeColor: cat.color,
            title: v.storm.title,
            sub: `${v.activeNow ? "● Active · " : ""}peak ${v.peakSoFar} kt · ${fmtDay(v.fixes[0].t)} – ${fmtDay(v.last.t)}`,
            onClick: () => select(v.last.coords[0], v.last.coords[1], 2),
          };
        })}
      />
    </>
  );

  return {
    points,
    lines,
    areas: [],
    startTime,
    liveFreshMs: 0,
    panel,
    renderTip: (item) => <CycloneTip {...item} />,
    hint: "Lines = storm tracks · big circle = latest position (pulsing = active). Data: NASA EONET, JTWC, NOAA NHC.",
  };
}

function CycloneTip({ storm, fix, current, activeNow }) {
  const cat = cycloneCat(fix.kts);
  return (
    <>
      <b style={{ color: cat.color }}>{storm.title}</b>
      <br />
      {current ? (activeNow ? "Latest position · " : "Last position · ") : ""}
      {new Date(fix.t).toLocaleString()}
      <br />
      {fix.kts != null ? (
        <>
          Wind: {fix.kts} kt ({Math.round(fix.kts * 1.852)} km/h) · {cat.label}
        </>
      ) : (
        "Wind: unknown"
      )}
      <br />
      Peak: {storm.peak} kt · {cycloneCat(storm.peak).label}
      {storm.sources.map((s) => {
        const url = safeUrl(s.url);
        return url ? (
          <span key={s.id}>
            <br />
            <a href={url} target="_blank" rel="noopener noreferrer">
              {s.id} advisory ↗
            </a>
          </span>
        ) : null;
      })}
    </>
  );
}
