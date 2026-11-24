import { useMemo } from "react";
import { geoCentroid } from "d3";
import { usePolling, getJSON } from "../hooks/usePolling.js";
import { NWS_ALERTS_URL, SPC_REPORTS_BASE, TORNADO_PERIODS, TORNADO_POLL_SECONDS } from "../lib/config.js";
import { EF_SCALE, efInfo } from "../lib/encoding.js";
import { relTime, rewind, yymmdd } from "../lib/geo.js";
import { Check, EventList, PollStats, Section, Stat, SwatchLegend } from "../components/ui.jsx";

export const US_VIEW = { lon: -96, lat: 38, zoom: 2.6 };

/*
 * NOAA SPC storm reports: one CSV per "convective day", which runs 12:00 UTC -> 11:59 UTC
 * the next day. Columns: Time(HHMM UTC),F_Scale,Location,County,State,Lat,Lon,Comments
 * The current day is "today_torn.csv"; earlier days are "YYMMDD_rpts_torn.csv".
 */
export function parseReports(csv, day, page) {
  const out = [];
  const lines = csv.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line || line.startsWith("Time")) return;
    const parts = line.split(",");
    if (parts.length < 7) return;
    const [time, rating, location, county, state, latS, lonS] = parts;
    const comments = parts.slice(7).join(",").trim(); // comments may contain commas
    const lat = parseFloat(latS);
    const lon = parseFloat(lonS);
    const hh = parseInt(time.slice(0, 2), 10);
    const mm = parseInt(time.slice(2, 4), 10);
    if (![lat, lon, hh, mm].every(Number.isFinite)) return;
    // Times before 12:00 UTC belong to the next calendar day.
    const t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + (hh < 12 ? 1 : 0), hh, mm);
    out.push({
      id: `${yymmdd(day)}-${i}`,
      t,
      rating: (rating || "UNK").trim().toUpperCase().replace(/^E?F/, ""),
      location,
      county,
      state,
      coords: [lon, lat],
      comments,
      page,
    });
  });
  return out;
}

async function fetchTornadoes(days) {
  // Current convective day = UTC date of (now - 12 h).
  const day0 = new Date(Date.now() - 12 * 3600e3);
  day0.setUTCHours(0, 0, 0, 0);
  const dayList = Array.from({ length: days }, (_, i) => new Date(day0.getTime() - i * 86400e3));

  const reportReqs = dayList.map(async (d, i) => {
    const file = i === 0 ? "today_torn.csv" : `${yymmdd(d)}_rpts_torn.csv`;
    const page = i === 0 ? "today.html" : `${yymmdd(d)}_rpts.html`;
    const res = await fetch(SPC_REPORTS_BASE + file, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return parseReports(await res.text(), d, page);
  });
  const warningReq = getJSON(NWS_ALERTS_URL, { headers: { Accept: "application/geo+json" } });

  const [warningRes, ...reportRes] = await Promise.allSettled([warningReq, ...reportReqs]);
  const ok = reportRes.filter((r) => r.status === "fulfilled");
  if (!ok.length && warningRes.status === "rejected") throw warningRes.reason;

  const reports = ok.flatMap((r) => r.value).sort((a, b) => b.t - a.t);
  const warnings =
    warningRes.status === "fulfilled"
      ? warningRes.value.features
          .filter((f) => f.geometry)
          .map((f) => ({ id: f.properties.id || f.id, geometry: rewind(f.geometry), props: f.properties }))
      : [];
  const partial = reportRes.length - ok.length > 0 || warningRes.status === "rejected";
  return { reports, warnings, partial };
}

export function useTornadoMode({ active, settings, update, cursor, select }) {
  const { tornadoDays, warnings: showWarnings } = settings;
  const poll = usePolling({
    key: String(tornadoDays),
    intervalSec: TORNADO_POLL_SECONDS,
    enabled: active,
    fetcher: () => fetchTornadoes(tornadoDays),
  });
  const reports = useMemo(() => poll.data?.reports || [], [poll.data]);
  const warnings = useMemo(() => poll.data?.warnings || [], [poll.data]);

  const shown = useMemo(
    () => (cursor === null ? reports : reports.filter((r) => r.t <= cursor)),
    [reports, cursor]
  );

  const points = useMemo(
    () =>
      shown.map((r) => {
        const ef = efInfo(r.rating);
        const level = ef.key === "UNK" ? 0 : Number(ef.key) + 1;
        return { id: r.id, coords: r.coords, r: 3 + level * 1.5, color: ef.color, time: r.t, item: { report: r } };
      }),
    [shown]
  );

  // Warnings are live-only: hide them while replaying the past.
  const liveWarnings = showWarnings && cursor === null ? warnings : [];
  const areas = useMemo(
    () => liveWarnings.map((w) => ({ id: w.id, geometry: w.geometry, fill: "#ff3b5c", stroke: "#ff8a9c", item: { warning: w } })),
    [liveWarnings]
  );

  const startTime = useMemo(() => (reports.length ? reports[reports.length - 1].t : null), [reports]);
  const strongest = shown.reduce((m, r) => {
    const v = r.rating === "UNK" ? -1 : Number(r.rating);
    return v > m ? v : m;
  }, -1);

  const panel = (
    <>
      <select
        value={tornadoDays}
        onChange={(e) => update({ tornadoDays: Number(e.target.value) })}
        aria-label="Period"
      >
        {TORNADO_PERIODS.map((d) => (
          <option key={d} value={d}>
            {d === 1 ? "Today (since 12:00 UTC)" : `Past ${d} days`}
          </option>
        ))}
      </select>

      <Stat label="Tornado reports" value={shown.length} />
      <Stat label="Active warnings" value={cursor === null ? warnings.length : "–"} />
      <Stat label="Strongest rated" value={strongest >= 0 ? `EF${strongest}` : "–"} />
      <PollStats updatedAt={poll.updatedAt} secondsLeft={poll.secondsLeft} />
      <div className="msg">
        {poll.error || (poll.data?.partial ? "⚠ Some days or the warnings couldn't be loaded." : "")}
      </div>

      <SwatchLegend items={EF_SCALE.map((e) => ({ label: e.key === "UNK" ? "?" : e.label, color: e.color, title: e.label }))} />
      <div className="legend-l">
        <span>circle colour = EF rating (often unrated at first)</span>
      </div>

      <Section title="Layers">
        <Check checked={showWarnings} onChange={(v) => update({ warnings: v })}>
          Live tornado warnings <span className="swatch warn" />
        </Check>
        <button className="link-btn" onClick={() => select(US_VIEW.lon, US_VIEW.lat, US_VIEW.zoom)}>
          Zoom to the US
        </button>
      </Section>

      {cursor === null && liveWarnings.length > 0 && (
        <>
          <h3>Active warnings</h3>
          <EventList
            items={liveWarnings.map((w) => {
              const [lon, lat] = geoCentroid(w.geometry);
              return {
                id: w.id,
                badge: "⚠",
                badgeColor: "#ff5a6e",
                title: w.props.areaDesc,
                sub: w.props.expires ? `until ${new Date(w.props.expires).toLocaleTimeString()}` : "",
                onClick: () => select(lon, lat, 4),
              };
            })}
          />
        </>
      )}

      <h3>Latest reports</h3>
      <EventList
        empty={
          !poll.updatedAt
            ? "Loading…"
            : tornadoDays < 30
              ? "No tornado reports in this period. Tornadoes are rare outside spring and early summer; try “Past 30 days”."
              : "No tornado reports in the past 30 days."
        }
        items={shown.slice(0, 15).map((r) => {
          const ef = efInfo(r.rating);
          return {
            id: r.id,
            badge: ef.key === "UNK" ? "EF?" : ef.label,
            badgeColor: ef.color,
            title: `${r.location}, ${r.state}`,
            sub: `${new Date(r.t).toLocaleString()} · ${relTime(r.t)}`,
            onClick: () => select(r.coords[0], r.coords[1], 3),
          };
        })}
      />
    </>
  );

  return {
    points,
    lines: [],
    areas,
    startTime,
    liveFreshMs: 3 * 3600e3,
    panel,
    renderTip: (item) => (item.warning ? <WarningTip w={item.warning} /> : <ReportTip r={item.report} />),
    hint: "US only. Circles = tornado reports (pulsing = last 3 h) · red areas = live warnings. Data: NOAA SPC, NWS.",
  };
}

function ReportTip({ r }) {
  const ef = efInfo(r.rating);
  return (
    <>
      <b style={{ color: ef.color }}>Tornado · {ef.key === "UNK" ? "unrated" : ef.label}</b>
      <br />
      {r.location}, {r.county} County, {r.state}
      <br />
      {new Date(r.t).toLocaleString()}
      {r.comments && (
        <>
          <br />
          <span className="tip-dim">{r.comments.length > 240 ? r.comments.slice(0, 240) + "…" : r.comments}</span>
        </>
      )}
      <br />
      <a href={SPC_REPORTS_BASE + r.page} target="_blank" rel="noopener noreferrer">
        SPC report page ↗
      </a>
    </>
  );
}

function WarningTip({ w }) {
  const p = w.props;
  return (
    <>
      <b style={{ color: "#ff5a6e" }}>⚠ Tornado Warning</b>
      <br />
      {p.areaDesc}
      <br />
      {p.expires && <>Until {new Date(p.expires).toLocaleTimeString()}<br /></>}
      <span className="tip-dim">{p.senderName}</span>
    </>
  );
}
