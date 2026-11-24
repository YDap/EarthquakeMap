/** Replay bar along the bottom of the globe. */
export default function Timeline({ replay }) {
  const { cursor, playing, start, end, play, pause, goLive, seek } = replay;
  const live = cursor === null;
  const value = live ? end : cursor;
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  const fmt = (t) =>
    new Date(t).toLocaleString([], sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { weekday: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="timeline">
      <button
        className="icon-btn"
        onClick={playing ? pause : play}
        aria-label={playing ? "Pause replay" : "Play replay"}
        title={playing ? "Pause" : "Replay the period"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="timeline-track">
        <input
          type="range"
          min={start}
          max={end}
          step={(end - start) / 1000}
          value={value}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Replay time"
        />
        <div className="timeline-labels">
          <span>{fmt(start)}</span>
          <span className="timeline-now">{live ? "" : new Date(cursor).toLocaleString()}</span>
          <span>now</span>
        </div>
      </div>
      <button className={"live-btn" + (live ? " on" : "")} onClick={goLive} title="Show everything up to now">
        ● LIVE
      </button>
    </div>
  );
}
