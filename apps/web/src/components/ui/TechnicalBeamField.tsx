import { useEffect, useRef } from "react";

type Beam = { x: number; speed: number; width: number; alpha: number };

const BEAMS: Beam[] = [
  { x: -0.25, speed: 0.000015, width: 34, alpha: 0.035 },
  { x: 0.08, speed: 0.000022, width: 22, alpha: 0.045 },
  { x: 0.36, speed: 0.000013, width: 42, alpha: 0.03 },
  { x: 0.64, speed: 0.000018, width: 28, alpha: 0.04 },
  { x: 0.92, speed: 0.000011, width: 38, alpha: 0.028 },
];

export function TechnicalBeamField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      for (const beam of BEAMS) {
        const drift = reduceMotion ? 0 : ((time * beam.speed) % 0.22) * width;
        const startX = beam.x * width + drift;
        const gradient = context.createLinearGradient(startX, 0, startX + width * 0.36, height);
        gradient.addColorStop(0, `rgba(37,99,235,0)`);
        gradient.addColorStop(0.42, `rgba(37,99,235,${beam.alpha})`);
        gradient.addColorStop(0.66, `rgba(34,211,238,${beam.alpha * 0.65})`);
        gradient.addColorStop(1, "rgba(34,211,238,0)");
        context.beginPath();
        context.moveTo(startX, -20);
        context.lineTo(startX + width * 0.36, height + 20);
        context.strokeStyle = gradient;
        context.lineWidth = beam.width;
        context.stroke();
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(0);
    });
    observer.observe(canvas);
    resize();
    draw(0);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className={`technical-beam-field ${className}`} aria-hidden="true" />;
}
