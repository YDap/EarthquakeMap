import { useEffect, useRef, useState } from "react";
import { REPLAY_SECONDS } from "../lib/config.js";

/**
 * Time-slider state. `cursor === null` means "live" (show everything).
 * Otherwise only quakes up to `cursor` are shown, and "fresh" is measured from it.
 */
export function useReplay(quakes) {
  const [cursor, setCursor] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Time span of the loaded data: earliest quake .. now.
  let start = Infinity;
  for (const f of quakes) start = Math.min(start, f.properties.time);
  const end = Date.now();
  if (!Number.isFinite(start)) start = end - 3600e3;
  const span = Math.max(60e3, end - start);

  const range = useRef({ start, span });
  range.current = { start, span };

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  useEffect(() => {
    if (!playing) return;
    let raf;
    let last = performance.now();
    let c = cursorRef.current ?? range.current.start;
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const { start, span } = range.current;
      c += (span / REPLAY_SECONDS) * dt;
      if (c >= start + span) {
        // reached the present: back to live
        setPlaying(false);
        setCursor(null);
        return;
      }
      setCursor(c);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const play = () => {
    // Pressing play while live (or at the end) restarts from the beginning.
    if (cursor === null) setCursor(range.current.start);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const goLive = () => {
    setPlaying(false);
    setCursor(null);
  };
  const seek = (t) => {
    setPlaying(false);
    setCursor(t >= start + span - span / 500 ? null : t);
  };
  const reset = goLive;

  return {
    cursor,
    playing,
    start,
    end: start + span,
    // While replaying fast, a 1-hour "fresh" window would flash by, so scale it with the span.
    freshMs: cursor === null ? 3600e3 : Math.max(3600e3, span / 40),
    play,
    pause,
    goLive,
    seek,
    reset,
  };
}
