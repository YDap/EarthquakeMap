import { useEffect, useRef, useState } from "react";
import Globe from "./components/Globe.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Tooltip from "./components/Tooltip.jsx";
import Starfield from "./components/Starfield.jsx";
import Timeline from "./components/Timeline.jsx";
import Toasts from "./components/Toasts.jsx";
import { useLand } from "./hooks/useLand.js";
import { usePlates } from "./hooks/usePlates.js";
import { useReplay } from "./hooks/useReplay.js";
import { useQuakeMode } from "./modes/quakes.jsx";
import { useCycloneMode } from "./modes/cyclones.jsx";
import { useTornadoMode } from "./modes/tornadoes.jsx";
import { readUrlState, writeUrlState, buildHash } from "./lib/urlState.js";
import { unlockAudio } from "./lib/sound.js";

// Read once at startup: settings from a shared link (or defaults).
const { settings: initialSettings, view: initialView } = readUrlState();

// Alert on/off is a per-browser preference, so it lives in localStorage (not in shared links).
const ALERTS_KEY = "quake-alerts";
function loadAlertPrefs() {
  try {
    return { enabled: false, sound: true, ...JSON.parse(localStorage.getItem(ALERTS_KEY) || "{}") };
  } catch {
    return { enabled: false, sound: true };
  }
}

export default function App() {
  const [settings, setSettings] = useState(initialSettings);
  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const [alertPrefs, setAlertPrefs] = useState(loadAlertPrefs);
  const [, rerender] = useState(0);
  const [tip, setTip] = useState(null);
  const globeRef = useRef(null);
  const { mode } = settings;

  const { land, error: landError } = useLand();
  const { plates, error: platesError } = usePlates(settings.plates);

  // Fly the globe to a place and close any tooltip.
  const select = (lon, lat, zoom) => {
    globeRef.current.flyTo(lon, lat, zoom);
    setTip(null);
  };

  const changeAlerts = (patch) => {
    // Clicks are the only moment browsers let us start audio / ask for notifications.
    if (patch.enabled || patch.sound) unlockAudio();
    if (patch.enabled && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(() => rerender((n) => n + 1));
    }
    setAlertPrefs((p) => ({ ...p, ...patch }));
  };

  // The replay cursor belongs to whichever mode is showing; its range comes from that mode.
  const [replayStart, setReplayStart] = useState(null);
  const replay = useReplay(replayStart);
  const cursor = replay.cursor;

  // All three modes are always "mounted" (hooks can't be conditional); only the active
  // one fetches (quakes also keep fetching while alerts are on).
  const common = { settings, update, select };
  // From an alert (toast or notification): switch to quakes and fly there.
  const showQuake = (f) => {
    update({ mode: "quakes" });
    select(f.geometry.coordinates[0], f.geometry.coordinates[1]);
  };
  const quakes = useQuakeMode({
    ...common,
    active: mode === "quakes",
    cursor: mode === "quakes" ? cursor : null,
    alertPrefs,
    onAlertsChange: changeAlerts,
    onAlertSelect: showQuake,
  });
  const cyclones = useCycloneMode({ ...common, active: mode === "cyclones", cursor: mode === "cyclones" ? cursor : null });
  const tornadoes = useTornadoMode({ ...common, active: mode === "tornadoes", cursor: mode === "tornadoes" ? cursor : null });
  const current = { quakes, cyclones, tornadoes }[mode];

  useEffect(() => setReplayStart(current.startTime), [current.startTime]);

  // Keep the URL in sync with the settings, so reload / bookmarks keep them.
  useEffect(() => writeUrlState(settings), [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(alertPrefs));
    } catch {
      /* storage unavailable: preference just won't persist */
    }
  }, [alertPrefs]);

  // Switching mode or period: back to live, close tooltips; some modes have a home view.
  const { goLive } = replay;
  const firstRun = useRef(true);
  useEffect(() => {
    goLive();
    setTip(null);
    if (firstRun.current) {
      firstRun.current = false; // keep the view from a shared link on startup
      return;
    }
    const focus = current.focus;
    if (focus) globeRef.current.flyTo(focus.lon, focus.lat, focus.zoom);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    goLive();
    setTip(null);
  }, [settings.feed, settings.cycloneDays, settings.tornadoDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tooltip opened in another mode must never be rendered by this one.
  const shownTip = tip && tip.mode === mode ? tip : null;

  const freshMs = cursor === null ? current.liveFreshMs : Math.max(current.liveFreshMs, replay.span / 40);

  const copyLink = async () => {
    // A shared link opens on this exact view, so auto-rotate is switched off in it.
    const url =
      window.location.origin + window.location.pathname + window.location.search +
      buildHash({ ...settings, spin: false }, globeRef.current.getView());
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      window.history.replaceState(null, "", url);
      return false;
    }
  };

  return (
    <>
      <Starfield />
      <div className="app">
        <div className="stage">
          <Globe
            ref={globeRef}
            points={current.points}
            lines={current.lines}
            areas={current.areas}
            land={land}
            plates={plates}
            tip={shownTip}
            onTip={(t) => setTip(t && { ...t, mode })}
            refTime={cursor}
            freshMs={freshMs}
            spin={settings.spin}
            initialView={initialView}
          />
          <Toasts toasts={quakes.toasts} onSelect={showQuake} onDismiss={quakes.dismissToast} />
          <Timeline replay={replay} />
        </div>
        <Sidebar
          settings={settings}
          update={update}
          panel={current.panel}
          hint={current.hint}
          message={landError || platesError}
          onCopyLink={copyLink}
        />
      </div>
      <Tooltip tip={shownTip}>{shownTip && current.renderTip(shownTip.item)}</Tooltip>
    </>
  );
}
