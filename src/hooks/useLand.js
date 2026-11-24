import { useEffect, useState } from "react";
import { feature } from "topojson-client";

/** World land outline (Natural Earth 110m), loaded lazily as a separate chunk. */
export function useLand() {
  const [land, setLand] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    import("world-atlas/land-110m.json")
      .then((m) => {
        const t = m.default;
        if (alive) setLand(feature(t, t.objects.land));
      })
      .catch(() => alive && setError("⚠ Couldn't load world outline (quakes still plot)."));
    return () => { alive = false; };
  }, []);
  return { land, error };
}
