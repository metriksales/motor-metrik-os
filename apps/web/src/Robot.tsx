import { useEffect, useId, useRef, useState } from "react";
import type { AgentState } from "./data";

const CINZA = "#838a99";

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
  const halo = `halo-${uid}`;

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
        const cy = r.top + r.height * 0.5;
        const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
        setEye({
          x: clamp(((e.clientX - cx) / (window.innerWidth / 2)) * 3.2, 2.2),
          y: clamp(((e.clientY - cy) / (window.innerHeight / 2)) * 2.4, 1.6),
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [tracking]);

  const traco = state === "idle" ? CINZA : color;
  const glow = { filter: `drop-shadow(0 0 5px ${color})` };

  return (
    <svg
      ref={ref}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`masc masc--${state}${tracking ? " track" : ""}${speaking ? " falando" : ""}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={halo} cx="0.5" cy="0.5" r="0.55">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {state === "ativo" && <circle cx="32" cy="34" r="30" fill={`url(#${halo})`} />}

      {/* antena */}
      <line
        x1="32"
        y1="16"
        x2="32"
        y2="8.5"
        stroke={traco}
        strokeOpacity={state === "ativo" ? 1 : 0.6}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle
        className="masc-antena"
        cx="32"
        cy="6.5"
        r="2.6"
        fill={traco}
        opacity={state === "ativo" ? 1 : 0.4}
        style={state === "ativo" ? { color } : undefined}
      />

      {/* cabeça */}
      <rect
        x="10"
        y="16"
        width="44"
        height="36"
        rx="13"
        fill="#151a24"
        stroke={traco}
        strokeOpacity={state === "ativo" ? 0.7 : state === "pausado" ? 0.4 : 0.55}
        strokeWidth="1.4"
      />
      {state === "ativo" && <rect x="14" y="20" width="36" height="12" rx="6" fill={color} opacity="0.06" />}

      {/* olhos */}
      {state === "ativo" && (
        <g
          className="masc-olhos"
          style={tracking ? { transform: `translate(${eye.x}px, ${eye.y}px)`, animation: "none" } : undefined}
        >
          <rect className="masc-olho" x="21" y="28" width="7" height="11" rx="3.5" fill={color} style={glow} />
          <rect
            className="masc-olho"
            x="36"
            y="28"
            width="7"
            height="11"
            rx="3.5"
            fill={color}
            style={{ ...glow, animationDelay: "0.12s" }}
          />
        </g>
      )}
      {state === "idle" && (
        <g>
          <rect x="21" y="32" width="7" height="3.6" rx="1.8" fill={CINZA} />
          <rect x="36" y="32" width="7" height="3.6" rx="1.8" fill={CINZA} />
        </g>
      )}
      {state === "pausado" && (
        <g>
          <path d="M21 33.5c2-2.4 5-2.4 7 0" stroke={color} strokeOpacity="0.8" strokeWidth="1.9" strokeLinecap="round" fill="none" />
          <path d="M36 33.5c2-2.4 5-2.4 7 0" stroke={color} strokeOpacity="0.8" strokeWidth="1.9" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* boca */}
      {state === "ativo" && (
        <path className="masc-boca" d="M26 44c2 2.2 10 2.2 12 0" stroke={color} strokeOpacity="0.75" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      )}
      {state === "idle" && <path d="M27 45h10" stroke={CINZA} strokeOpacity="0.6" strokeWidth="1.9" strokeLinecap="round" fill="none" />}
      {state === "pausado" && (
        <path d="M28 45c1.4 1.2 6.6 1.2 8 0" stroke={color} strokeOpacity="0.5" strokeWidth="1.9" strokeLinecap="round" fill="none" />
      )}

      {/* barra do peito */}
      <rect x="24" y="52" width="16" height="3.4" rx="1.7" fill={traco} opacity={state === "ativo" ? 0.35 : 0.2} />

      {/* zZ do sono */}
      {state === "pausado" && (
        <g fill={color} fontFamily="'JetBrains Mono', monospace" fontWeight={600}>
          <text className="masc-zzz" x="48" y="14" fontSize="9">
            z
          </text>
          <text className="masc-zzz" x="54" y="8" fontSize="7" style={{ animationDelay: "0.9s" }}>
            z
          </text>
        </g>
      )}
    </svg>
  );
}
