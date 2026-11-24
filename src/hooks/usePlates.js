import { useEffect, useState } from "react";
import { PLATES_URL } from "../lib/config.js";

/** Tectonic plate boundaries; fetched the first time the layer is switched on, then kept. */
export function usePlates(enabled) {
  const [plates, setPlates] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || plates) return;
    let alive = true;
    fetch(PLATES_URL)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((geo) => {
        if (alive) {
          setPlates(geo);
          setError("");
        }
      })
      .catch(() => alive && setError("⚠ Couldn't load plate boundaries."));
    return () => {
      alive = false;
    };
  }, [enabled, plates]);

  return { plates: enabled ? plates : null, error: enabled ? error : "" };
}
