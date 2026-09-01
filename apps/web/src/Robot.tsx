import { useEffect, useId, useRef, useState } from "react";
import type { AgentState } from "./data";

const HEAD =
  "M50 6 C69 6 82 21 82 45 C82 63 77 76 66 89 C60 97 55 102 50 102 C45 102 40 97 34 89 C23 76 18 63 18 45 C18 21 31 6 50 6 Z";

export function Robot({
  state,
  color,
  size = 72,
  track = false,
  speaking = false,
}: {
  state: AgentState;
  color: string;
  size?: number;
  track?: boolean;
  speaking?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });
  const tracking = track && state === "ativo";
  const uid = useId().replace(/:/g, "");
  const chrome = `chrome-${uid}`;
  const halo = `halo-${uid}`;
  const clip = `clip-${uid}`;

  useEffect(() => {
    if (!tracking) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.46;
        const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
        setEye({
          x: clamp(((e.clientX - cx) / (window.innerWidth / 2)) * 5, 3.4),
          y: clamp(((e.clientY - cy) / (window.innerHeight / 2)) * 4, 2.6),
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [tracking]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 116"
      width={size}
      height={Math.round(size * 1.12)}
      className={`andr andr--${state}${tracking ? " track" : ""}${speaking ? " speaking" : ""}`}
      style={{ ["--arc" as any]: color }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={chrome} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1f8" />
          <stop offset="0.34" stopColor="#b7bccc" />
          <stop offset="0.62" stopColor="#6a7186" />
          <stop offset="1" stopColor="#343a4d" />
        </linearGradient>
        <radialGradient id={halo} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor={color} stopOpacity="0.9" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <path d={HEAD} />
        </clipPath>
      </defs>

      {/* backdrop glow */}
      <ellipse className="halo" cx="50" cy="52" rx="46" ry="52" fill={`url(#${halo})`} />

      <g className="face">
        {/* neck / shoulders */}
        <path className="neck" d="M40 96 L40 112 L60 112 L60 96 Z" fill={`url(#${chrome})`} opacity="0.85" />
        <path d="M30 116 C34 106 40 102 50 102 C60 102 66 106 70 116 Z" fill={`url(#${chrome})`} opacity="0.6" />

        {/* head */}
        <path className="head" d={HEAD} fill={`url(#${chrome})`} stroke={color} strokeOpacity="0.4" strokeWidth="1" />
        {/* color tint */}
        <path d={HEAD} fill={color} fillOpacity="0.1" />

        {/* face seams */}
        <path d="M50 15 C51 28 51 40 50 60" stroke={color} strokeOpacity="0.35" strokeWidth="0.8" fill="none" />
        <path d="M24 44 C30 40 38 39 44 41" stroke="#0a0a12" strokeOpacity="0.35" strokeWidth="0.8" fill="none" />
        <path d="M76 44 C70 40 62 39 56 41" stroke="#0a0a12" strokeOpacity="0.35" strokeWidth="0.8" fill="none" />

        {/* machine cheek circuitry (right side) */}
        <g className="circuit" stroke={color} strokeWidth="0.9" strokeLinecap="round" fill="none">
          <path d="M63 64 H72 L75 68" />
          <path d="M63 70 H70" />
          <circle cx="76" cy="68" r="1.3" fill={color} stroke="none" />
          <circle cx="72" cy="70" r="1" fill={color} stroke="none" />
        </g>

        {/* mouth seam */}
        <rect className="mouth" x="42" y="80" width="16" height="2.4" rx="1.2" fill={color} fillOpacity="0.5" />

        {/* eyes */}
        <g className="eyes" style={tracking ? { transform: `translate(${eye.x}px, ${eye.y}px)` } : undefined}>
          {[38, 62].map((ex, i) => (
            <g key={i}>
              <ellipse className="eye-glow" cx={ex} cy="52" rx="8" ry="5.4" fill={color} fillOpacity="0.22" />
              <ellipse className="eye-core" cx={ex} cy="52" rx="5" ry="3.4" fill={color} />
              <ellipse className="eye-cl" cx={ex - 1.4} cy="50.6" rx="1.5" ry="1.1" fill="#ffffff" fillOpacity="0.85" />
            </g>
          ))}
        </g>

        {/* scan sweep (clipped to head) */}
        <g clipPath={`url(#${clip})`}>
          <rect className="scanline" x="16" y="8" width="68" height="2.4" fill={color} fillOpacity="0.5" />
        </g>
      </g>
    </svg>
  );
}
