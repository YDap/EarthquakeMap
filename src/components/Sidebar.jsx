import { useState } from "react";
import { MODES } from "../lib/config.js";
import { Check, Section } from "./ui.jsx";

/** Sidebar frame: mode tabs, the active mode's panel, and the settings shared by all modes. */
export default function Sidebar({ settings, update, panel, hint, message, onCopyLink }) {
  const [copied, setCopied] = useState("");
  const mode = MODES.find((m) => m.value === settings.mode) || MODES[0];

  const copy = async () => {
    const ok = await onCopyLink();
    setCopied(ok ? "Link copied!" : "Couldn't copy, see address bar");
    setTimeout(() => setCopied(""), 2500);
  };

  return (
    <aside className="sidebar">
      <h1>
        {mode.icon} {mode.title}
      </h1>
      <div className="tabs" role="tablist" aria-label="What to show">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="tab"
            aria-selected={m.value === settings.mode}
            className={"tab" + (m.value === settings.mode ? " on" : "")}
            onClick={() => update({ mode: m.value })}
          >
            <span aria-hidden="true">{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {panel}
      {message && <div className="msg">{message}</div>}

      <Section title="Display">
        <Check checked={settings.plates} onChange={(v) => update({ plates: v })}>
          Tectonic plate boundaries <span className="swatch plates" />
        </Check>
        <Check checked={settings.spin} onChange={(v) => update({ spin: v })}>
          Auto-rotate globe
        </Check>
      </Section>

      <Section title="Share">
        <button className="btn" onClick={copy}>
          🔗 Copy link to this view
        </button>
        <span className="note inline">{copied}</span>
      </Section>

      <p className="hint">Drag to rotate · scroll to zoom · {hint}</p>
    </aside>
  );
}
