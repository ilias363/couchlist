"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  TimeScale,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  TimeScale
);

export const DoughnutChart = Doughnut;
export const BarChart = Bar;
export const LineChart = Line;

export type ChartColorPalette = string[];

export const defaultPalette: ChartColorPalette = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

export function statusPalette(count: number): string[] {
  const base = defaultPalette;
  if (count <= base.length) return base.slice(0, count);
  // repeat with slight opacity change
  return Array.from({ length: count }, (_, i) => {
    const c = base[i % base.length];
    const alpha = 0.85 - Math.floor(i / base.length) * 0.15;
    // convert hex to rgba
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  });
}

export const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" as const } },
};

export const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  plugins: { legend: { position: "bottom" as const } },
};

export function weekdayLabel(w: number) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][w] || "?";
}