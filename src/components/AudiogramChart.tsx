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
import { AudiometryData, FREQUENCIES, DEFAULT_THRESHOLDS } from '../types';
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
  data: AudiometryData;
  lang: Language;
  ear?: 'right' | 'left' | 'both';
  height?: string | number;
  showSeverityFooter?: boolean;
  showLegend?: boolean;
  customTitle?: string;
  aidedThresholds?: {
    right?: { [freq: number]: number };
    left?: { [freq: number]: number };
  };
}

export const AudiogramChart: React.FC<Props> = ({ 
  data, 
  lang, 
  ear = 'both', 
  height,
  showSeverityFooter = true,
  showLegend,
  customTitle,
  aidedThresholds
}) => {
  const t = translations[lang];
  const isRTL = lang === 'ar';

  const chartMin = -10;
  const chartMax = 120;

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
        grid: {
          color: 'rgba(148, 163, 184, 0.25)',
          lineWidth: 1,
        },
        title: {
          display: true,
          text: lang === 'ar' ? 'التردد (هرتز / Hz)' : 'Frequency (Hz)',
          color: '#64748b',
          font: { 
            size: 11,
            weight: '600',
            family: 'Plus Jakarta Sans, sans-serif'
          },
          padding: { top: 6 }
        },
        ticks: { 
          font: { 
            size: 11,
            family: 'JetBrains Mono, monospace',
            weight: '500'
          },
          color: '#475569'
        }
      },
      y: {
        reverse: true,
        min: chartMin,
        max: chartMax,
        grid: {
          color: (context: any) => {
            if (context.tick.value === 20) return 'rgba(16, 185, 129, 0.45)'; // Normal threshold guide line
            if (context.tick.value === 0) return 'rgba(100, 116, 139, 0.4)';
            return 'rgba(148, 163, 184, 0.2)';
          },
          lineWidth: (context: any) => (context.tick.value === 20 ? 1.5 : 1),
        },
        title: {
          display: true,
          text: lang === 'ar' ? 'مستوى السمع (dB HL)' : 'Hearing Level (dB HL)',
          color: '#64748b',
          font: { 
            size: 11,
            weight: '600',
            family: 'Plus Jakarta Sans, sans-serif'
          },
          padding: { bottom: 6 }
        },
        ticks: {
          stepSize: 10,
          font: { 
            size: 10,
            family: 'JetBrains Mono, monospace',
            weight: '500'
          },
          color: '#475569',
          callback: (value: any) => `${value}`
        }
      },
    },
    plugins: {
      legend: {
        display: showLegend !== undefined ? showLegend : (ear === 'both' || !!aidedThresholds),
        position: 'top' as const,
        align: 'end' as const,
        labels: { 
          font: { 
            size: 10,
            family: 'Plus Jakarta Sans, sans-serif',
            weight: '600'
          },
          boxWidth: 12,
          boxHeight: 12,
          padding: 10,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${context.raw} dB HL`
        }
      }
    },
  };

  const datasets: any[] = [];

  // Right Ear AC (Red Circle O)
  if (ear === 'right' || ear === 'both') {
    datasets.push({
      label: `${t.rightEar} AC [O]`,
      data: FREQUENCIES.map(f => data.right.AC[f]),
      borderColor: '#dc2626',
      backgroundColor: '#dc2626',
      pointBorderColor: '#dc2626',
      pointBackgroundColor: '#ffffff',
      pointBorderWidth: 2.5,
      pointStyle: 'circle',
      pointRadius: 5.5,
      pointHoverRadius: 7,
      showLine: true,
      borderWidth: 2.5,
      tension: 0.05,
    });

    // Right Ear BC (Red < dashed)
    datasets.push({
      label: `${t.rightEar} BC [<]`,
      data: FREQUENCIES.map(f => data.right.BC[f]),
      borderColor: '#f87171',
      backgroundColor: '#f87171',
      pointBorderColor: '#f87171',
      pointBackgroundColor: '#ffffff',
      pointBorderWidth: 2,
      pointStyle: 'triangle',
      pointRadius: 5,
      borderDash: [6, 4],
      showLine: true,
      borderWidth: 1.5,
      tension: 0.05,
    });

    // Right Ear Aided AC [A] (Emerald Green curve)
    if (aidedThresholds?.right) {
      datasets.push({
        label: lang === 'ar' ? `${t.rightEar} مع السماعة [A]` : `${t.rightEar} Aided [A]`,
        data: FREQUENCIES.map(f => aidedThresholds.right![f]),
        borderColor: '#059669',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        pointBorderColor: '#059669',
        pointBackgroundColor: '#10b981',
        pointBorderWidth: 2,
        pointStyle: 'rectRot',
        pointRadius: 5.5,
        pointHoverRadius: 7,
        borderDash: [4, 3],
        showLine: true,
        borderWidth: 2.5,
        tension: 0.1,
      });
    }
  }

  // Left Ear AC (Blue Cross X)
  if (ear === 'left' || ear === 'both') {
    datasets.push({
      label: `${t.leftEar} AC [X]`,
      data: FREQUENCIES.map(f => data.left.AC[f]),
      borderColor: '#2563eb',
      backgroundColor: '#2563eb',
      pointBorderColor: '#2563eb',
      pointBackgroundColor: '#2563eb',
      pointBorderWidth: 2.5,
      pointStyle: 'crossRot',
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: true,
      borderWidth: 2.5,
      tension: 0.05,
    });

    // Left Ear BC (Blue > dashed)
    datasets.push({
      label: `${t.leftEar} BC [>]`,
      data: FREQUENCIES.map(f => data.left.BC[f]),
      borderColor: '#60a5fa',
      backgroundColor: '#60a5fa',
      pointBorderColor: '#60a5fa',
      pointBackgroundColor: '#ffffff',
      pointBorderWidth: 2,
      pointStyle: 'rect',
      pointRadius: 5,
      borderDash: [6, 4],
      showLine: true,
      borderWidth: 1.5,
      tension: 0.05,
    });

    // Left Ear Aided AC [A] (Emerald Green curve)
    if (aidedThresholds?.left) {
      datasets.push({
        label: lang === 'ar' ? `${t.leftEar} مع السماعة [A]` : `${t.leftEar} Aided [A]`,
        data: FREQUENCIES.map(f => aidedThresholds.left![f]),
        borderColor: '#0d9488',
        backgroundColor: 'rgba(20, 184, 166, 0.12)',
        pointBorderColor: '#0d9488',
        pointBackgroundColor: '#14b8a6',
        pointBorderWidth: 2,
        pointStyle: 'rectRot',
        pointRadius: 5.5,
        pointHoverRadius: 7,
        borderDash: [4, 3],
        showLine: true,
        borderWidth: 2.5,
        tension: 0.1,
      });
    }
  }

  const chartData = {
    labels: FREQUENCIES.map(f => `${f}`),
    datasets: datasets,
  };

  const borderColorClass = ear === 'right' 
    ? 'border-red-200/90 dark:border-red-900/50' 
    : ear === 'left' 
      ? 'border-blue-200/90 dark:border-blue-900/50' 
      : 'border-slate-200/80 dark:border-slate-800';

  const defaultTitle = ear === 'right'
    ? (lang === 'ar' ? 'الأذن اليمنى (Right Ear - AD)' : 'Right Ear (AD)')
    : ear === 'left'
      ? (lang === 'ar' ? 'الأذن اليسرى (Left Ear - AS)' : 'Left Ear (AS)')
      : (lang === 'ar' ? 'مخطط السمع السريري (Audiogram)' : 'Clinical Pure-Tone Audiogram');

  return (
    <div className={`w-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border ${borderColorClass} p-3.5 sm:p-4 shadow-sm`}>
      {/* Top Header Information Bar */}
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${ear === 'right' ? 'bg-red-500' : ear === 'left' ? 'bg-blue-500' : 'bg-teal-500'}`} />
          <h4 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${ear === 'right' ? 'text-red-700 dark:text-red-400' : ear === 'left' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
            {customTitle || defaultTitle}
          </h4>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono">
          {ear === 'right' && (
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200/60 dark:border-red-900/40 font-bold">
              <span>AC: <span className="inline-block w-3.5 h-3.5 text-center leading-3 rounded-full border border-red-600 bg-white text-red-600 font-bold">○</span></span>
              <span className="text-slate-300">|</span>
              <span>BC: &lt;</span>
              {aidedThresholds?.right && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-emerald-700 dark:text-emerald-300">Aided: ◆</span>
                </>
              )}
            </div>
          )}
          {ear === 'left' && (
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40 font-bold">
              <span>AC: <span className="text-blue-600 font-bold text-xs">✕</span></span>
              <span className="text-slate-300">|</span>
              <span>BC: &gt;</span>
              {aidedThresholds?.left && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-teal-700 dark:text-teal-300">Aided: ◆</span>
                </>
              )}
            </div>
          )}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            {lang === 'ar' ? 'طبيعي ≤ 20 dB' : 'Normal ≤ 20 dB'}
          </span>
        </div>
      </div>

      {/* Main Chart Area */}
      <div 
        className="relative w-full"
        style={{ height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined }}
      >
        <div className={height ? 'w-full h-full' : 'relative w-full h-80 sm:h-96'}>
          <Line options={options} data={chartData} />
        </div>
      </div>

      {/* Degree Severity Spectrum Footer Strip */}
      {showSeverityFooter && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-6 gap-1.5 text-[10px] text-center font-mono">
          <div className="p-1 rounded bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
            <div className="font-bold">{lang === 'ar' ? 'طبيعي' : 'Normal'}</div>
            <div className="text-[9px] text-slate-500">0 - 20 dB</div>
          </div>
          <div className="p-1 rounded bg-teal-50/70 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-200/50 dark:border-teal-900/30">
            <div className="font-bold">{lang === 'ar' ? 'خفيف' : 'Mild'}</div>
            <div className="text-[9px] text-slate-500">21 - 40 dB</div>
          </div>
          <div className="p-1 rounded bg-amber-50/70 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
            <div className="font-bold">{lang === 'ar' ? 'متوسط' : 'Moderate'}</div>
            <div className="text-[9px] text-slate-500">41 - 55 dB</div>
          </div>
          <div className="p-1 rounded bg-orange-50/70 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/30">
            <div className="font-bold">{lang === 'ar' ? 'متوسط الشدة' : 'Mod. Severe'}</div>
            <div className="text-[9px] text-slate-500">56 - 70 dB</div>
          </div>
          <div className="p-1 rounded bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30">
            <div className="font-bold">{lang === 'ar' ? 'شديد' : 'Severe'}</div>
            <div className="text-[9px] text-slate-500">71 - 90 dB</div>
          </div>
          <div className="p-1 rounded bg-purple-50/70 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30">
            <div className="font-bold">{lang === 'ar' ? 'عميق' : 'Profound'}</div>
            <div className="text-[9px] text-slate-500">&gt; 90 dB</div>
          </div>
        </div>
      )}
    </div>
  );
};
