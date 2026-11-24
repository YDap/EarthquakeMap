import { useEffect, useRef, useState } from "react";
import { REPLAY_SECONDS } from "../lib/config.js";

/**
 * Time-slider state. `cursor === null` means "live" (show everything).
 * Otherwise only events up to `cursor` are shown, and "fresh" is measured from it.
 * `startTime` is the earliest event time in the loaded data (null if none yet).
 */
export function useReplay(startTime) {
  const [cursor, setCursor] = useState(null);
  const [playing, setPlaying] = useState(false);

  const end = Date.now();
  const start = startTime != null && startTime < end ? startTime : end - 3600e3;
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
    // Pressing play while live restarts from the beginning.
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

  return {
    cursor,
    playing,
    start,
    end: start + span,
    span,
    play,
    pause,
    goLive,
    seek,
  };
}
