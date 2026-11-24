import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoContains } from "d3";
import { isFresh } from "../lib/encoding.js";
import { SPIN_DEG_PER_SEC, RESUME_AFTER_MS } from "../lib/config.js";

const graticule = geoGraticule10();
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * The spinning globe. It knows nothing about earthquakes or storms; each mode hands it:
 *   points: [{ id, coords:[lon,lat], r, color, time?, pulse?, alpha?, item }]
 *           r is the radius at zoom 1; `pulse` forces a pulse ring, otherwise
 *           points with a `time` within `freshMs` of `refTime` pulse.
 *   lines:  [{ coords:[[lon,lat], ...], color, width? }]
 *   areas:  [{ id, geometry, fill, stroke, item }]  (GeoJSON geometry; hoverable)
 *
 * Everything that changes every frame (rotation, zoom, drag) lives in a ref, NOT React
 * state: re-rendering React 60x/s would be wasteful. React only hears about hover/click
 * through onTip({ id, item, x, y, pinned } | null).
 *
 * Ref API: flyTo(lon, lat, zoom?), getView() -> { lon, lat, zoom }
 */
const Globe = forwardRef(function Globe(
  { points, lines, areas, land, plates, tip, onTip, refTime, freshMs, spin, initialView },
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
    flyTo: null, // animation target { rot:[l,p], zoom }
    drag: null,
    drawn: [], // points drawn last frame, for hit-testing
    projection: null,
    W: 0,
    H: 0,
    baseR: 0,
  });
  Object.assign(s.current, { points, lines, areas, land, plates, tip, refTime, freshMs, spin });

  useImperativeHandle(
    ref,
    () => ({
      flyTo(lon, lat, zoom) {
        const st = s.current;
        // Take the short way round (the spin keeps adding to rotation[0]).
        const r0 = st.rotation[0];
        st.flyTo = { rot: [r0 + wrap180(-lon - r0), -lat], zoom: zoom ?? st.zoom };
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
    st.projection = projection;

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

    let raf;
    let last = performance.now();
    function frame(now) {
      const dt = (now - last) / 1000;
      last = now;
      const { W, H, rotation } = st;

      if (st.flyTo) {
        // smooth move (and zoom) to a selected event
        const k = Math.min(1, dt * 4);
        const [tl, tp] = st.flyTo.rot;
        rotation[0] += (tl - rotation[0]) * k;
        rotation[1] += (tp - rotation[1]) * k;
        st.zoom += (st.flyTo.zoom - st.zoom) * k;
        const done =
          Math.abs(tl - rotation[0]) + Math.abs(tp - rotation[1]) < 0.2 && Math.abs(st.flyTo.zoom - st.zoom) < 0.01;
        if (done) st.flyTo = null;
      } else {
        if (st.spin && Date.now() - st.lastInteraction > RESUME_AFTER_MS && !st.tip?.pinned) {
          rotation[0] += SPIN_DEG_PER_SEC * dt; // the planet never sits still
        }
        if (!st.drag) rotation[0] = wrap180(rotation[0]); // keep the angle small
      }
      const zoom = st.zoom;
      const zr = Math.sqrt(zoom);

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

      const t = now / 1000;
      const pulsePhase = (t % 1.5) / 1.5;
      const hoveredId = st.tip?.id;

      // Areas (e.g. tornado warnings): breathing fill so they read as "live"
      for (const a of st.areas || []) {
        ctx.beginPath();
        path(a.geometry);
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3);
        ctx.fillStyle = a.fill;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = a.id === hoveredId ? "#fff" : a.stroke;
        ctx.lineWidth = a.id === hoveredId ? 2 : 1.2;
        ctx.stroke();
      }

      // Lines (e.g. cyclone tracks)
      ctx.lineCap = "round";
      for (const l of st.lines || []) {
        ctx.beginPath();
        path({ type: "LineString", coordinates: l.coords });
        ctx.strokeStyle = l.color;
        ctx.lineWidth = (l.width ?? 2) * Math.min(zr, 2);
        ctx.stroke();
      }

      // Points: big first, so small circles draw on top and stay visible
      const ref = st.refTime ?? Date.now();
      const centre = [-rotation[0], -rotation[1]];
      const drawn = [];
      for (const p of st.points || []) {
        // Great-circle distance to the globe's centre; < PI/2 = front hemisphere.
        if (geoDistance(p.coords, centre) >= Math.PI / 2) continue;
        const [x, y] = projection(p.coords);
        drawn.push({ p, x, y, r: p.r * zr });
      }
      drawn.sort((a, b) => b.r - a.r);
      for (const { p, x, y, r } of drawn) {
        if (p.pulse || (p.pulse !== false && p.time != null && isFresh(p.time, ref, st.freshMs))) {
          ctx.beginPath();
          ctx.arc(x, y, r + pulsePhase * r * 1.8 + 2, 0, 7);
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 1 - pulsePhase;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 7);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha ?? 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        const hov = p.id === hoveredId;
        ctx.strokeStyle = hov ? "#fff" : p.color;
        ctx.lineWidth = hov ? 2 : 1;
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
      st.flyTo = null;
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ---- Pointer interaction ----
  /** What's under the pointer: the nearest point, else an area containing it. */
  function pick(e) {
    const st = s.current;
    const b = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - b.left;
    const my = e.clientY - b.top;
    let best = null;
    let bd = Infinity;
    for (const q of st.drawn) {
      const d = Math.hypot(q.x - mx, q.y - my);
      if (d <= Math.max(q.r, 6) && d < bd) {
        best = q.p;
        bd = d;
      }
    }
    if (best || !st.areas?.length || !st.projection) return best;

    const lonlat = st.projection.invert([mx, my]);
    if (!lonlat || geoDistance(lonlat, [-st.rotation[0], -st.rotation[1]]) >= Math.PI / 2) return null;
    return st.areas.find((a) => geoContains(a.geometry, lonlat)) || null;
  }

  const tipFor = (hit, e, pinned) => ({ id: hit.id, item: hit.item, x: e.clientX, y: e.clientY, pinned });

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
      const hit = pick(e);
      if (hit) onTip(tipFor(hit, e, false));
      else if (st.tip) onTip(null);
    }
  };

  const onPointerUp = (e) => {
    const st = s.current;
    if (st.drag && !st.drag.moved) {
      const hit = pick(e);
      onTip(hit ? tipFor(hit, e, true) : null);
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
