import { useEffect, useRef } from "react";

/** Static starfield background; deterministic so stars don't jump on resize. */
export default function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    function draw() {
      const c = ref.current;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      const ctx = c.getContext("2d");
      let seed = 42;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 350; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
        ctx.beginPath();
        ctx.arc(rnd() * c.width, rnd() * c.height, rnd() * 1.3 + 0.2, 0, 7);
        ctx.fill();
      }
    }
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);
  return <canvas ref={ref} className="stars" />;
}
