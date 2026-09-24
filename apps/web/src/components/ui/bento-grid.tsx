import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface BentoGridProps {
  className?: string;
  children?: ReactNode;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4", className)}
    >
      {children}
    </motion.div>
  );
}

export default BentoGrid;
