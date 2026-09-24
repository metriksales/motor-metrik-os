import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type BentoCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  eyebrow?: string;
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
  children?: ReactNode;
};

const columnSpan: Record<NonNullable<BentoCardProps["colSpan"]>, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
};

export function BentoCard({
  title,
  description,
  icon,
  eyebrow,
  className,
  colSpan = 1,
  children,
}: BentoCardProps) {
  return (
    <motion.section
      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("metrik-bento-card", columnSpan[colSpan], className)}
    >
      <header className="metrik-bento-card__head">
        {icon ? <span className="metrik-bento-card__icon" aria-hidden="true">{icon}</span> : null}
        <div>
          {eyebrow ? <span className="metrik-bento-card__eyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children ? <div className="metrik-bento-card__body">{children}</div> : null}
    </motion.section>
  );
}
