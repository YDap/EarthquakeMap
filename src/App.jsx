import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "./components/Globe.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Tooltip from "./components/Tooltip.jsx";
import Starfield from "./components/Starfield.jsx";
import Timeline from "./components/Timeline.jsx";
import Toasts from "./components/Toasts.jsx";
import { useQuakes } from "./hooks/useQuakes.js";
import { useLand } from "./hooks/useLand.js";
import { usePlates } from "./hooks/usePlates.js";
import { useReplay } from "./hooks/useReplay.js";
import { useAlerts } from "./hooks/useAlerts.js";
import { readUrlState, writeUrlState, buildHash } from "./lib/urlState.js";
import { unlockAudio } from "./lib/sound.js";

// Read once at startup: settings from a shared link (or defaults).
const initial = readUrlState();
const { view: initialView, ...initialSettings } = initial;

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

  const { quakes, loadedFeed, error, updatedAt, secondsLeft } = useQuakes(settings.feed);
  const { land, error: landError } = useLand();
  const { plates, error: platesError } = usePlates(settings.plates);
  const replay = useReplay(quakes);

  // Keep the URL in sync with the settings, so reload / bookmarks keep them.
  useEffect(() => writeUrlState(settings), [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(alertPrefs));
    } catch {
      /* storage unavailable: preference just won't persist */
    }
  }, [alertPrefs]);

  // Switching feed: back to live and close any tooltip.
  const { reset: resetReplay } = replay;
  useEffect(() => {
    resetReplay();
    setTip(null);
  }, [settings.feed]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (f) => {
    const [lon, lat] = f.geometry.coordinates;
    globeRef.current.flyTo(lon, lat);
    setTip(null);
  };

  const { toasts, dismiss } = useAlerts({
    quakes,
    loadedFeed,
    enabled: alertPrefs.enabled,
    sound: alertPrefs.sound,
    threshold: settings.alertMag,
    onSelect: select,
  });

  const changeAlerts = (patch) => {
    // Clicks are the only moment browsers let us start audio / ask for notifications.
    if (patch.enabled || patch.sound) unlockAudio();
    if (patch.enabled && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(() => rerender((n) => n + 1));
    }
    setAlertPrefs((p) => ({ ...p, ...patch }));
  };

  // Filters + replay cursor -> what's actually drawn / listed.
  const { minMag, minDepth, maxDepth } = settings;
  const cursor = replay.cursor;
  const shown = useMemo(
    () =>
      quakes.filter((f) => {
        const depth = f.geometry.coordinates[2] || 0;
        return (
          f.properties.mag >= minMag &&
          depth >= minDepth &&
          depth <= maxDepth &&
          (cursor === null || f.properties.time <= cursor)
        );
      }),
    [quakes, minMag, minDepth, maxDepth, cursor]
  );

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
            quakes={shown}
            land={land}
            plates={plates}
            tip={tip}
            onTip={setTip}
            refTime={cursor}
            freshMs={replay.freshMs}
            spin={settings.spin}
            initialView={initialView}
          />
          <Toasts toasts={toasts} onSelect={select} onDismiss={dismiss} />
          <Timeline replay={replay} />
        </div>
        <Sidebar
          settings={settings}
          update={update}
          alerts={alertPrefs}
          onAlertsChange={changeAlerts}
          quakes={shown}
          totalCount={quakes.length}
          updatedAt={updatedAt}
          secondsLeft={secondsLeft}
          message={error || landError || platesError}
          onSelect={select}
          onCopyLink={copyLink}
        />
      </div>
      <Tooltip tip={tip} />
    </>
  );
}
