import { useCallback, useEffect, useRef, useState } from "react";
import { FEED_BASE, POLL_SECONDS } from "../lib/config.js";

/** Fetches a USGS feed, re-polls every POLL_SECONDS, exposes a countdown.
 *  On failure the previous data is kept and an error message is set.
 *  `loadedFeed` says which feed `quakes` came from (null until the first load). */
export function useQuakes(feed) {
  const [data, setData] = useState({ quakes: [], loadedFeed: null });
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(POLL_SECONDS);
  const nextPollAt = useRef(0);
  const reqId = useRef(0); // ignore responses from a feed we already switched away from

  const load = useCallback(async () => {
    const id = ++reqId.current;
    nextPollAt.current = Date.now() + POLL_SECONDS * 1000;
    try {
      const res = await fetch(`${FEED_BASE}${feed}.geojson`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status); // fetch doesn't throw on 404/500 itself!
      const json = await res.json();
      if (id !== reqId.current) return;
      setData({
        quakes: json.features.filter((f) => f.geometry && f.properties.mag != null),
        loadedFeed: feed,
      });
      setError("");
      setUpdatedAt(new Date());
    } catch (err) {
      if (id !== reqId.current) return;
      setError(`⚠ Update failed (${err.message}). Showing previous data; retrying.`);
    } finally {
      if (id === reqId.current) nextPollAt.current = Date.now() + POLL_SECONDS * 1000;
    }
  }, [feed]);

  // Feed changed (or first mount): clear and load immediately.
  useEffect(() => {
    setData({ quakes: [], loadedFeed: null });
    load();
  }, [load]);

  // Polling timer: once a second, drive the countdown and re-fetch at 0.
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((nextPollAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) load();
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  return { quakes: data.quakes, loadedFeed: data.loadedFeed, error, updatedAt, secondsLeft };
}
