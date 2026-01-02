"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: { date: string; total: number }[];
  className?: string;
}

export function Sparkline({ data, className }: SparklineProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get computed style for colors
    const style = getComputedStyle(canvas);
    const primaryColor =
      style.getPropertyValue("--color-primary").trim() || "oklch(0.8442 0.1722 84.93)";

    // Canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    const padding = 4;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate min/max
    const values = data.map(d => d.total);
    const max = Math.max(...values, 1);
    const min = 0;

    // Calculate points
    const points: { x: number; y: number }[] = data.map((d, i) => ({
      x: padding + (i / (data.length - 1 || 1)) * (width - padding * 2),
      y: height - padding - ((d.total - min) / (max - min || 1)) * (height - padding * 2),
    }));

    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height - padding);
    ctx.closePath();
    ctx.fillStyle = `color-mix(in oklch, ${primaryColor} 20%, transparent)`;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [data]);

  return (
    <canvas ref={canvasRef} width={200} height={50} className={cn("w-full h-12", className)} />
  );
}
