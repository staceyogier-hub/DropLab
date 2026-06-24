/**
 * Thin react-chartjs-2 wrapper. Registers only the Chart.js parts we use (no
 * network, no plugins fetched) and adds an inline vertical phase-marker plugin
 * — no extra dependency.
 */
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

export interface PhaseMarker {
  x: number;
  label: string;
  color?: string;
}

const verticalMarkers: Plugin<'line'> = {
  id: 'verticalMarkers',
  afterDatasetsDraw(chart) {
    const markers = (chart.options.plugins as { markers?: PhaseMarker[] } | undefined)?.markers;
    if (!markers || markers.length === 0) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x;
    if (!x) return;
    ctx.save();
    for (const m of markers) {
      if (m.x < x.min || m.x > x.max) continue;
      const px = x.getPixelForValue(m.x);
      ctx.beginPath();
      ctx.moveTo(px, chartArea.top);
      ctx.lineTo(px, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = m.color ?? 'rgba(11,37,69,0.55)';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = m.color ?? 'rgba(11,37,69,0.85)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(m.label, px + 3, chartArea.top + 10);
    }
    ctx.restore();
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  verticalMarkers,
);

export interface Series {
  label: string;
  points: { x: number; y: number }[];
  color: string;
  fill?: boolean;
  dashed?: boolean;
}

export interface LineChartProps {
  series: Series[];
  xLabel: string;
  yLabel: string;
  markers?: PhaseMarker[];
  height?: number;
}

export function LineChart({ series, xLabel, yLabel, markers, height = 280 }: LineChartProps) {
  const data = {
    datasets: series.map((s) => ({
      label: s.label,
      data: s.points,
      borderColor: s.color,
      backgroundColor: s.fill ? `${s.color}22` : s.color,
      borderWidth: 1.5,
      borderDash: s.dashed ? [5, 4] : undefined,
      pointRadius: 0,
      fill: s.fill ?? false,
      tension: 0.1,
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: series.length > 1, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
      tooltip: { enabled: true },
      // Consumed by the inline verticalMarkers plugin.
      ...(markers ? ({ markers } as object) : {}),
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: xLabel },
        ticks: { maxTicksLimit: 10 },
      },
      y: { title: { display: true, text: yLabel } },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
