import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.7, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Dot({ color = "var(--emerald)", pulse }: { color?: string; pulse?: boolean }) {
  return (
    <span
      className={cx("dot", pulse && "live-dot")}
      style={pulse ? { background: color } : { background: color }}
    />
  );
}

export function Pill({
  children,
  color,
  soft = true,
}: {
  children: ReactNode;
  color?: string;
  soft?: boolean;
}) {
  return (
    <span
      className="pill"
      style={
        color
          ? {
              color,
              borderColor: `${color}40`,
              background: soft ? `${color}14` : color,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function IconBox({
  icon: Icon,
  color = "var(--violet)",
  size = 40,
}: {
  icon: any;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="grid place-items-center rounded-[13px] flex-none"
      style={{
        width: size,
        height: size,
        background: `${color}16`,
        border: `1px solid ${color}33`,
        boxShadow: `0 8px 22px -14px ${color}`,
      }}
    >
      <Icon size={size * 0.46} style={{ color }} strokeWidth={1.9} />
    </span>
  );
}

export function SectionHeader({
  label,
  title,
  right,
}: {
  label: string;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <div className="mono-label mb-2">{label}</div>
        <h2 className="font-display text-[21px] md:text-[24px] font-semibold tracking-tight leading-tight">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

/** bloco de carregamento — usado enquanto a VERDADE não chegou (modo logado) */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx("skeleton", className)} style={style} />;
}

/** um card-esqueleto genérico (mesma moldura dos cards reais) */
export function SkeletonCard({ lines = 3, h = 130 }: { lines?: number; h?: number }) {
  return (
    <div className="card p-5" style={{ minHeight: h }}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="!rounded-xl" style={{ width: 40, height: 40 }} />
        <div className="flex-1">
          <Skeleton style={{ width: "55%", height: 13 }} />
          <Skeleton className="mt-2" style={{ width: "78%", height: 10 }} />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="mt-2.5" style={{ width: `${90 - i * 12}%`, height: 11 }} />
      ))}
    </div>
  );
}

export function Delta({ up, children }: { up: boolean; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] font-medium font-mono"
      style={{ color: up ? "var(--emerald)" : "var(--rose)" }}
    >
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {children}
    </span>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex items-center rounded-full transition-all"
      style={{
        width: 38,
        height: 22,
        background: on ? "var(--grad)" : "var(--surface-hi)",
        border: "1px solid var(--line)",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all"
        style={{
          width: 16,
          height: 16,
          top: 2,
          left: on ? 18 : 2,
          boxShadow: "0 2px 6px rgba(0,0,0,.4)",
        }}
      />
    </span>
  );
}
