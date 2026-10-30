import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TympanometryData } from '../types';
import { Language, translations } from '../translations';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  data: {
    right: TympanometryData;
    left: TympanometryData;
  };
  lang: Language;
  ear?: 'right' | 'left' | 'both';
  height?: string | number;
  customTitle?: string;
}

export const TympanogramChart: React.FC<Props> = ({ data, lang, ear = 'both', height, customTitle }) => {
  const t = translations[lang];

  const generatePoints = (earData: TympanometryData) => {
    const points = [];
    const minX = -400;
    const maxX = 200;
    const step = 15;

    let sigma = 50;
    if (earData.gradient && earData.gradient > 0) {
      sigma = earData.gradient / 2.355;
    } else {
      if (earData.type === 'As') sigma = 35;
      if (earData.type === 'Ad') sigma = 65;
    }

    for (let x = minX; x <= maxX; x += step) {
      let y = 0;
      if (earData.type === 'B') {
        y = (earData.compliance || 0.1) + (Math.sin(x / 50) * 0.015);
      } else {
        const baseline = 0.05;
        const peak = Math.max(earData.compliance || 0.8, baseline + 0.1);
        y = baseline + (peak - baseline) * Math.exp(-Math.pow(x - (earData.pressure || 0), 2) / (2 * Math.pow(sigma, 2)));
      }
      points.push({ x, y: Math.max(0, y) });
    }
    return points;
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 15
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: -400,
        max: 200,
        grid: {
          color: (context: any) => {
            if (context.tick.value === 0) return 'rgba(100, 116, 139, 0.4)';
            return 'rgba(148, 163, 184, 0.2)';
          },
        },
        title: {
          display: true,
          text: lang === 'ar' ? 'الضغط daPa (Middle Ear Pressure)' : 'Pressure (daPa)',
          color: '#64748b',
          font: { 
            size: 11,
            weight: '600',
            family: 'Plus Jakarta Sans, sans-serif'
          },
          padding: { top: 6 }
        },
        ticks: { 
          stepSize: 100,
          font: { 
            size: 10,
            family: 'JetBrains Mono, monospace'
          },
          color: '#475569'
        }
      },
      y: {
        min: 0,
        max: 2.2,
        grid: {
          color: 'rgba(148, 163, 184, 0.2)',
        },
        title: {
          display: true,
          text: lang === 'ar' ? 'المطاوعة ml (Acoustic Admittance)' : 'Compliance (ml)',
          color: '#64748b',
          font: { 
            size: 11,
            weight: '600',
            family: 'Plus Jakarta Sans, sans-serif'
          },
          padding: { bottom: 6 }
        },
        ticks: {
          stepSize: 0.5,
          font: { 
            size: 10,
            family: 'JetBrains Mono, monospace'
          },
          color: '#475569'
        }
      },
    },
    plugins: {
      legend: {
        display: ear === 'both',
        position: 'top' as const,
        align: 'end' as const,
        labels: { 
          font: { 
            size: 11,
            family: 'Plus Jakarta Sans, sans-serif',
            weight: '600'
          },
          boxWidth: 14,
          padding: 10,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 8,
        cornerRadius: 6,
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${context.raw.y?.toFixed(2)} ml @ ${context.raw.x} daPa`
        }
      }
    },
  };

  const datasets: any[] = [];

  if ((ear === 'right' || ear === 'both') && data.right) {
    datasets.push({
      label: `${t.rightEar} (Type ${data.right.type || 'A'})`,
      data: generatePoints(data.right),
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220, 38, 38, 0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2.5,
    });
  }

  if ((ear === 'left' || ear === 'both') && data.left) {
    datasets.push({
      label: `${t.leftEar} (Type ${data.left.type || 'A'})`,
      data: generatePoints(data.left),
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2.5,
    });
  }

  const chartData = {
    datasets: datasets,
  };

  return (
    <div className={`w-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border ${ear === 'right' ? 'border-red-200/80 dark:border-red-900/50' : ear === 'left' ? 'border-blue-200/80 dark:border-blue-900/50' : 'border-slate-200/80 dark:border-slate-800'} p-3.5 sm:p-4 shadow-sm`}>
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${ear === 'right' ? 'bg-red-500' : ear === 'left' ? 'bg-blue-500' : 'bg-purple-500'}`} />
          <h4 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${ear === 'right' ? 'text-red-700 dark:text-red-400' : ear === 'left' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
            {customTitle || (ear === 'right' ? (lang === 'ar' ? 'ضغط الطبلة: الأذن اليمنى (Right Ear)' : 'Right Ear Tympanogram') : ear === 'left' ? (lang === 'ar' ? 'ضغط الطبلة: الأذن اليسرى (Left Ear)' : 'Left Ear Tympanogram') : (lang === 'ar' ? 'منحنى تخطيط المعاوقة والضغط (Tympanogram)' : 'Tympanometric Admittance Curves'))}
          </h4>
        </div>
        <div className="text-[10px] sm:text-[11px] font-mono text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
          Probe Tone: 226 Hz
        </div>
      </div>
      <div 
        className="relative w-full"
        style={{ height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined }}
      >
        <div className={height ? 'w-full h-full' : 'relative w-full h-64 sm:h-72'}>
          <Line options={options} data={chartData as any} />
        </div>
      </div>
    </div>
  );
};
