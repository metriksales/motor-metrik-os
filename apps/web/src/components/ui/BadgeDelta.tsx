import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

export type DeltaType = "increase" | "decrease" | "neutral";

type BadgeDeltaProps = {
  value: string | number;
  deltaType?: DeltaType;
  variant?: "outline" | "soft";
  className?: string;
};

const ICONS = {
  increase: ArrowUp,
  decrease: ArrowDown,
  neutral: ArrowRight,
};

export function BadgeDelta({
  value,
  deltaType = "neutral",
  variant = "outline",
  className = "",
}: BadgeDeltaProps) {
  const Icon = ICONS[deltaType];
  return (
    <span className={`badge-delta badge-delta--${deltaType} badge-delta--${variant} ${className}`.trim()}>
      <Icon size={12} aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}
