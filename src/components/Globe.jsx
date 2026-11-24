import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from "d3";
import { radius, depthColor, isFresh } from "../lib/encoding.js";
import { SPIN_DEG_PER_SEC, RESUME_AFTER_MS } from "../lib/config.js";

const graticule = geoGraticule10();

/**
 * The spinning globe. Everything that changes every frame (rotation, zoom, drag)
 * lives in a ref, NOT React state — re-rendering React 60x/s would be wasteful.
 * React state is only touched when the tooltip changes (via onTip).
 *
 * Props: quakes, land, plates, tip ({ f, x, y, pinned } | null), onTip(tip | null),
 *        refTime (ms, or null = now), freshMs, spin (bool), initialView ({ lon, lat, zoom } | null)
 * Ref API: flyTo(lon, lat), getView() -> { lon, lat, zoom }
 */
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

const Globe = forwardRef(function Globe(
  { quakes, land, plates, tip, onTip, refTime, freshMs, spin, initialView },
  ref
) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  // Live values the draw loop reads (props are copied in on every render).
  const s = useRef({
    // [lambda, phi]: minus the lon/lat of the point facing us
    rotation: initialView ? [-initialView.lon, -initialView.lat] : [0, -20],
    zoom: initialView?.zoom ?? 1,
    lastInteraction: -Infinity,
    flyTo: null, // animation target when a list item is clicked
    drag: null,
    drawn: [], // circles drawn last frame, for hit-testing
    W: 0,
    H: 0,
    baseR: 0,
  });
  Object.assign(s.current, { quakes, land, plates, tip, refTime, freshMs, spin });

  useImperativeHandle(
    ref,
    () => ({
      flyTo(lon, lat) {
        const st = s.current;
        // Rotate so the quake sits at the centre, taking the short way round
        // (the spin keeps adding to rotation[0], so it can be many turns past 360°).
        const r0 = st.rotation[0];
        st.flyTo = [r0 + wrap180(-lon - r0), -lat];
        st.lastInteraction = Date.now();
      },
      getView() {
        const st = s.current;
        return { lon: wrap180(-st.rotation[0]), lat: -st.rotation[1], zoom: st.zoom };
      },
    }),
    []
  );

  // ---- Resize + render loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // d3.geoOrthographic turns [lon, lat] into [x, y] pixels as if looking at a sphere from space.
    const projection = geoOrthographic().clipAngle(90).precision(0.5);
    const path = geoPath(projection, ctx);
    const st = s.current;

    function resize() {
      const r = window.devicePixelRatio || 1;
      const box = wrapRef.current.getBoundingClientRect();
      st.W = box.width;
      st.H = box.height;
      canvas.width = st.W * r;
      canvas.height = st.H * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
      st.baseR = Math.min(st.W, st.H) * 0.44;
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();

    function visible(f) {
      // Great-circle distance to the globe's centre; < PI/2 = front hemisphere.
      const centre = [-st.rotation[0], -st.rotation[1]];
      return geoDistance(f.geometry.coordinates, centre) < Math.PI / 2;
    }

    let raf;
    let last = performance.now();
    function frame(now) {
      const dt = (now - last) / 1000;
      last = now;
      const { W, H, rotation, zoom } = st;

      if (st.flyTo) {
        // smooth move to clicked quake
        const k = Math.min(1, dt * 4);
        rotation[0] += (st.flyTo[0] - rotation[0]) * k;
        rotation[1] += (st.flyTo[1] - rotation[1]) * k;
        if (Math.abs(st.flyTo[0] - rotation[0]) + Math.abs(st.flyTo[1] - rotation[1]) < 0.2) st.flyTo = null;
      } else {
        if (st.spin && Date.now() - st.lastInteraction > RESUME_AFTER_MS && !st.tip?.pinned) {
          rotation[0] += SPIN_DEG_PER_SEC * dt; // the planet never sits still
        }
        if (!st.drag) rotation[0] = wrap180(rotation[0]); // keep the angle small
      }

      projection.translate([W / 2, H / 2]).scale(st.baseR * zoom).rotate(rotation);
      ctx.clearRect(0, 0, W, H);

      // atmosphere glow + ocean
      const R = projection.scale();
      const g = ctx.createRadialGradient(W / 2, H / 2, R * 0.9, W / 2, H / 2, R * 1.15);
      g.addColorStop(0, "rgba(90,209,255,.35)");
      g.addColorStop(1, "rgba(90,209,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, R * 1.15, 0, 7);
      ctx.fill();
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = "#07142e";
      ctx.fill();

      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = "rgba(90,140,255,.12)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      if (st.land) {
        ctx.beginPath();
        path(st.land);
        ctx.fillStyle = "#16315f";
        ctx.fill();
        ctx.strokeStyle = "#3b66b8";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      if (st.plates) {
        ctx.beginPath();
        path(st.plates);
        ctx.strokeStyle = "rgba(255,120,90,.7)";
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // Quakes: big first, so small circles draw on top and stay visible
      const t = now / 1000;
      const ref = st.refTime ?? Date.now();
      const drawn = [];
      for (const f of st.quakes) {
        if (!visible(f)) continue;
        const [x, y] = projection(f.geometry.coordinates);
        drawn.push({ f, x, y, r: radius(f.properties.mag, zoom) });
      }
      drawn.sort((a, b) => b.r - a.r);
      const hovered = st.tip?.f;
      for (const q of drawn) {
        const c = depthColor(q.f.geometry.coordinates[2] || 0);
        if (isFresh(q.f, ref, st.freshMs)) {
          // pulsing ring for new quakes
          const p = (t % 1.5) / 1.5;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.r + p * q.r * 1.8 + 2, 0, 7);
          ctx.strokeStyle = c;
          ctx.globalAlpha = 1 - p;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, 7);
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = q.f === hovered ? "#fff" : c;
        ctx.lineWidth = q.f === hovered ? 2 : 1;
        ctx.stroke();
      }
      st.drawn = drawn;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // Wheel needs passive:false to preventDefault, which React's onWheel can't do.
    function onWheel(e) {
      e.preventDefault();
      st.zoom = Math.max(0.6, Math.min(8, st.zoom * Math.exp(-e.deltaY * 0.0015)));
      st.lastInteraction = Date.now();
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ---- Pointer interaction ----
  function pick(e) {
    // nearest drawn circle under the pointer
    const b = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - b.left;
    const my = e.clientY - b.top;
    let best = null;
    let bd = Infinity;
    for (const q of s.current.drawn) {
      const d = Math.hypot(q.x - mx, q.y - my);
      if (d <= Math.max(q.r, 6) && d < bd) {
        best = q;
        bd = d;
      }
    }
    return best;
  }

  const onPointerDown = (e) => {
    const st = s.current;
    st.drag = { x: e.clientX, y: e.clientY, rot: [...st.rotation], moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const st = s.current;
    if (st.drag) {
      const k = 0.25 / st.zoom; // pixels -> degrees
      const dx = e.clientX - st.drag.x;
      const dy = e.clientY - st.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) st.drag.moved = true;
      st.rotation = [st.drag.rot[0] + dx * k, Math.max(-90, Math.min(90, st.drag.rot[1] - dy * k))];
      st.lastInteraction = Date.now();
      st.flyTo = null;
    } else if (!st.tip?.pinned) {
      const q = pick(e);
      if (q) onTip({ f: q.f, x: e.clientX, y: e.clientY, pinned: false });
      else if (st.tip) onTip(null);
    }
  };

  const onPointerUp = (e) => {
    const st = s.current;
    if (st.drag && !st.drag.moved) {
      const q = pick(e);
      onTip(q ? { f: q.f, x: e.clientX, y: e.clientY, pinned: true } : null);
    }
    st.drag = null;
    st.lastInteraction = Date.now();
  };

  const onPointerLeave = () => {
    if (!s.current.tip?.pinned) onTip(null);
  };

  return (
    <div className="globe-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="globe"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
    </div>
  );
});

export default Globe;
