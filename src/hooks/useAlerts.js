import { useCallback, useEffect, useRef, useState } from "react";
import { ping } from "../lib/sound.js";

const RECENT_MS = 2 * 3600e3; // don't alert on old events that show up late in the feed
const TOAST_MS = 15000;

/**
 * Watches each poll for quakes we haven't seen before. The first load of a feed only
 * records what's there (so you don't get 30 alerts on page load); after that, any new
 * quake at or above `threshold` raises an in-page toast, an optional ping and, if allowed,
 * a browser notification. Clicking either calls onSelect(feature).
 */
export function useAlerts({ quakes, loadedFeed, enabled, sound, threshold, onSelect }) {
  const seen = useRef(new Set());
  const baselineFeed = useRef(null);
  const [toasts, setToasts] = useState([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (!loadedFeed) return;
    if (baselineFeed.current !== loadedFeed) {
      // New feed: take a baseline, no alerts.
      baselineFeed.current = loadedFeed;
      seen.current = new Set(quakes.map((f) => f.id));
      return;
    }
    const fresh = quakes.filter((f) => !seen.current.has(f.id));
    fresh.forEach((f) => seen.current.add(f.id));
    if (!enabled) return;

    const hits = fresh
      .filter((f) => f.properties.mag >= threshold && Date.now() - f.properties.time < RECENT_MS)
      .sort((a, b) => b.properties.mag - a.properties.mag);
    if (!hits.length) return;

    if (sound) ping(hits[0].properties.mag);
    setToasts((t) => [...hits.map((f) => ({ id: f.id, f })), ...t].slice(0, 5));
    hits.forEach((f) => {
      setTimeout(() => dismiss(f.id), TOAST_MS);
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification(`M${f.properties.mag.toFixed(1)} earthquake`, {
          body: `${f.properties.place || "Unknown location"}\n${new Date(f.properties.time).toLocaleString()}`,
          tag: f.id,
        });
        n.onclick = () => {
          window.focus();
          onSelectRef.current(f);
          n.close();
        };
      }
    });
  }, [quakes, loadedFeed, enabled, sound, threshold, dismiss]);

  return { toasts, dismiss };
}

/** Ask for notification permission; must be called from a click handler. */
export function requestNotifications() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
