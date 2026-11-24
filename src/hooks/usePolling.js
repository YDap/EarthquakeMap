import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic "fetch now, then every N seconds" hook with a countdown.
 *  - `key` identifies the request (e.g. the feed); when it changes, old data is dropped.
 *  - `fetcher()` returns a promise of the data.
 *  - When `enabled` is false nothing is fetched (data is kept); re-enabling fetches at once.
 *  - On failure the previous data is kept and `error` is set.
 * `loadedKey` says which key `data` belongs to (null until the first success for it).
 */
export function usePolling({ key, fetcher, intervalSec, enabled = true }) {
  const [state, setState] = useState({ data: null, loadedKey: null });
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(intervalSec);
  const nextPollAt = useRef(0);
  const reqId = useRef(0); // ignore responses for a key we already switched away from
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++reqId.current;
    nextPollAt.current = Date.now() + intervalSec * 1000;
    try {
      const data = await fetcherRef.current();
      if (id !== reqId.current) return;
      setState({ data, loadedKey: key });
      setError("");
      setUpdatedAt(new Date());
    } catch (err) {
      if (id !== reqId.current) return;
      setError(`⚠ Update failed (${err.message}). Showing previous data; retrying.`);
    } finally {
      if (id === reqId.current) nextPollAt.current = Date.now() + intervalSec * 1000;
    }
  }, [key, intervalSec]);

  // Key changed: drop the old data.
  useEffect(() => {
    setState((s) => (s.loadedKey === key ? s : { data: null, loadedKey: null }));
    setError("");
  }, [key]);

  // (Re)enabled or key changed: load now, then poll once a second for the countdown.
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((nextPollAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) load();
    }, 1000);
    return () => {
      clearInterval(t);
      reqId.current++; // a response arriving after disable/key change is ignored
    };
  }, [enabled, load]);

  const current = state.loadedKey === key;
  return { data: current ? state.data : null, loadedKey: current ? key : null, error, updatedAt, secondsLeft };
}

/** fetch() + status check + JSON. fetch doesn't throw on 404/500 by itself! */
export async function getJSON(url, opts) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
