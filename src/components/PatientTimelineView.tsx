import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Activity,
  FileText,
  Eye,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  UserCheck,
  Search,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Stethoscope,
  Volume2,
  Radio,
  Sparkles,
} from 'lucide-react';
import { Patient, FREQUENCIES, DEFAULT_THRESHOLDS } from '../types';
import { analyzeHearing, detectAirBoneGap } from '../services/hearingAnalysis';
import { Language, translations } from '../translations';

export interface PatientGroup {
  key: string;
  name: string;
  phone: string;
  age: number;
  email?: string;
  dob?: string;
  doctorName: string;
  visitsAsc: Patient[]; // Sorted Oldest -> Newest
}

interface VisitComparison {
  prevVisitDate: string;
  daysElapsed: number;
  rightPtaDelta: number;
  leftPtaDelta: number;
  rightSdsDelta: number | null;
  leftSdsDelta: number | null;
  rightDiagChanged: boolean;
  leftDiagChanged: boolean;
  rightPrevDegree: string;
  rightCurrDegree: string;
  rightPrevType: string;
  rightCurrType: string;
  leftPrevDegree: string;
  leftCurrDegree: string;
  leftPrevType: string;
  leftCurrType: string;
  rightTympChanged: boolean;
  leftTympChanged: boolean;
  rightPrevTymp: string;
  rightCurrTymp: string;
  leftPrevTymp: string;
  leftCurrTymp: string;
  narrativeChanged: boolean;
}

interface PatientTimelineViewProps {
  patients: Patient[];
  lang: Language;
  selectedPatientKey: string | null;
  onSelectPatientKey: (key: string) => void;
  onViewVisitReport: (visit: Patient) => void;
  onEditVisit: (visit: Patient) => void;
  onDeleteVisit: (id: string | number) => void;
  onNewFollowUpVisit: (latestVisit: Patient) => void;
  onAddPriorVisitForPatient: (baseVisit: Patient) => Promise<void>;
  onSeedSampleLongitudinalCases: () => Promise<void>;
}

export function getPatientIdentityKey(p: Pick<Patient, 'name' | 'phone'>): string {
  const normName = (p.name || '').trim().toLowerCase();
  const normPhone = (p.phone || '').trim();
  return `${normName}|${normPhone}`;
}

export const PatientTimelineView: React.FC<PatientTimelineViewProps> = ({
  patients,
  lang,
  selectedPatientKey,
  onSelectPatientKey,
  onViewVisitReport,
  onEditVisit,
  onDeleteVisit,
  onNewFollowUpVisit,
  onAddPriorVisitForPatient,
  onSeedSampleLongitudinalCases,
}) => {
  const t = translations[lang];
  const isRTL = lang === 'ar';

  const [patientSearch, setPatientSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [earFilter, setEarFilter] = useState<'both' | 'right' | 'left'>('both');
  const [expandedFreqVisitIds, setExpandedFreqVisitIds] = useState<Record<string, boolean>>({});
  const [isSeeding, setIsSeeding] = useState(false);

  // Group all visit records by unique patient identity
  const patientGroups = useMemo<PatientGroup[]>(() => {
    const map = new Map<string, Patient[]>();

    patients.forEach((p) => {
      const key = getPatientIdentityKey(p);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(p);
    });

    const groups: PatientGroup[] = [];
    map.forEach((list, key) => {
      const visitsAsc = [...list].sort((a, b) => {
        const timeA = new Date(a.visitDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.visitDate || b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return Number(a.id || 0) - Number(b.id || 0);
      });
      const latest = visitsAsc[visitsAsc.length - 1];
      groups.push({
        key,
        name: latest.name,
        phone: latest.phone,
        age: latest.age,
        email: latest.email,
        dob: latest.dob,
        doctorName: latest.doctorName,
        visitsAsc,
      });
    });

    // Sort groups by multi-visit count first, then most recent visit date
    return groups.sort((a, b) => {
      if (b.visitsAsc.length !== a.visitsAsc.length) {
        return b.visitsAsc.length - a.visitsAsc.length;
      }
      const latestA = new Date(a.visitsAsc[a.visitsAsc.length - 1]?.visitDate || 0).getTime();
      const latestB = new Date(b.visitsAsc[b.visitsAsc.length - 1]?.visitDate || 0).getTime();
      return latestB - latestA;
    });
  }, [patients]);

  const filteredGroups = useMemo(() => {
    if (!patientSearch.trim()) return patientGroups;
    const q = patientSearch.toLowerCase();
    return patientGroups.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.phone && g.phone.includes(q))
    );
  }, [patientGroups, patientSearch]);

  // Ensure a valid patient is selected
  useEffect(() => {
    if (patientGroups.length > 0) {
      const exists = patientGroups.some((g) => g.key === selectedPatientKey);
      if (!selectedPatientKey || !exists) {
        onSelectPatientKey(patientGroups[0].key);
      }
    }
  }, [patientGroups, selectedPatientKey, onSelectPatientKey]);

  const activeGroup = useMemo(() => {
    return patientGroups.find((g) => g.key === selectedPatientKey) || patientGroups[0] || null;
  }, [patientGroups, selectedPatientKey]);

  // Compute visit-to-visit chronological comparisons (always comparing Visit[i] vs Visit[i-1])
  const enrichedVisits = useMemo(() => {
    if (!activeGroup) return [];

    const visitsWithMeta = activeGroup.visitsAsc.map((visit, index) => {
      const hearing = visit.data ? analyzeHearing(visit.data) : null;
      const rightAbg = visit.data ? detectAirBoneGap(visit.data.right.AC, visit.data.right.BC) : null;
      const leftAbg = visit.data ? detectAirBoneGap(visit.data.left.AC, visit.data.left.BC) : null;

      const rightTymp = visit.data?.tympanometry?.right;
      const leftTymp = visit.data?.tympanometry?.left;
      const rightSpeech = visit.data?.speech?.right;
      const leftSpeech = visit.data?.speech?.left;

      let comparison: VisitComparison | null = null;
      if (index > 0) {
        const prevVisit = activeGroup.visitsAsc[index - 1];
        const prevHearing = prevVisit.data ? analyzeHearing(prevVisit.data) : null;
        const prevRightTymp = prevVisit.data?.tympanometry?.right?.type || 'A';
        const prevLeftTymp = prevVisit.data?.tympanometry?.left?.type || 'A';
        const currRightTymp = rightTymp?.type || 'A';
        const currLeftTymp = leftTymp?.type || 'A';

        const prevTime = new Date(prevVisit.visitDate).getTime();
        const currTime = new Date(visit.visitDate).getTime();
        const daysElapsed = Math.max(0, Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24)));

        const rPtaDelta =
          hearing && prevHearing ? hearing.right.pta - prevHearing.right.pta : 0;
        const lPtaDelta =
          hearing && prevHearing ? hearing.left.pta - prevHearing.left.pta : 0;

        const rSdsDelta =
          typeof rightSpeech?.sds === 'number' &&
          rightSpeech.sds > 0 &&
          typeof prevVisit.data?.speech?.right?.sds === 'number' &&
          prevVisit.data.speech.right.sds > 0
            ? rightSpeech.sds - prevVisit.data.speech.right.sds
            : null;

        const lSdsDelta =
          typeof leftSpeech?.sds === 'number' &&
          leftSpeech.sds > 0 &&
          typeof prevVisit.data?.speech?.left?.sds === 'number' &&
          prevVisit.data.speech.left.sds > 0
            ? leftSpeech.sds - prevVisit.data.speech.left.sds
            : null;

        const rPrevDeg = prevHearing?.right.degree || 'normalGood';
        const rCurrDeg = hearing?.right.degree || 'normalGood';
        const rPrevType = prevHearing?.right.type || 'normalHearing';
        const rCurrType = hearing?.right.type || 'normalHearing';

        const lPrevDeg = prevHearing?.left.degree || 'normalGood';
        const lCurrDeg = hearing?.left.degree || 'normalGood';
        const lPrevType = prevHearing?.left.type || 'normalHearing';
        const lCurrType = hearing?.left.type || 'normalHearing';

        comparison = {
          prevVisitDate: prevVisit.visitDate,
          daysElapsed,
          rightPtaDelta: rPtaDelta,
          leftPtaDelta: lPtaDelta,
          rightSdsDelta: rSdsDelta,
          leftSdsDelta: lSdsDelta,
          rightDiagChanged: rPrevDeg !== rCurrDeg || rPrevType !== rCurrType,
          leftDiagChanged: lPrevDeg !== lCurrDeg || lPrevType !== lCurrType,
          rightPrevDegree: rPrevDeg,
          rightCurrDegree: rCurrDeg,
          rightPrevType: rPrevType,
          rightCurrType: rCurrType,
          leftPrevDegree: lPrevDeg,
          leftCurrDegree: lCurrDeg,
          leftPrevType: lPrevType,
          leftCurrType: lCurrType,
          rightTympChanged: prevRightTymp !== currRightTymp,
          leftTympChanged: prevLeftTymp !== currLeftTymp,
          rightPrevTymp: prevRightTymp,
          rightCurrTymp: currRightTymp,
          leftPrevTymp: prevLeftTymp,
          leftCurrTymp: currLeftTymp,
          narrativeChanged:
            (visit.diagnosis || '').trim() !== (prevVisit.diagnosis || '').trim(),
        };
      }

      return {
        visit,
        chronologicalNumber: index + 1,
        isBaseline: index === 0,
        isLatest: index === activeGroup.visitsAsc.length - 1,
        hearing,
        rightAbg,
        leftAbg,
        rightTymp,
        leftTymp,
        rightSpeech,
        leftSpeech,
        comparison,
      };
    });

    return sortOrder === 'asc' ? visitsWithMeta : [...visitsWithMeta].reverse();
  }, [activeGroup, sortOrder]);

  // Overall net progression between First Visit and Latest Visit
  const netTrajectory = useMemo(() => {
    if (!activeGroup || activeGroup.visitsAsc.length === 0) return null;
    const first = activeGroup.visitsAsc[0];
    const latest = activeGroup.visitsAsc[activeGroup.visitsAsc.length - 1];
    const firstHearing = first.data ? analyzeHearing(first.data) : null;
    const latestHearing = latest.data ? analyzeHearing(latest.data) : null;

    if (!firstHearing || !latestHearing) return null;

    return {
      firstDate: first.visitDate,
      latestDate: latest.visitDate,
      totalVisits: activeGroup.visitsAsc.length,
      rightFirstPta: firstHearing.right.pta,
      rightLatestPta: latestHearing.right.pta,
      rightNetDelta: latestHearing.right.pta - firstHearing.right.pta,
      leftFirstPta: firstHearing.left.pta,
      leftLatestPta: latestHearing.left.pta,
      leftNetDelta: latestHearing.left.pta - firstHearing.left.pta,
      rightLatestDegree: latestHearing.right.degree,
      rightLatestType: latestHearing.right.type,
      leftLatestDegree: latestHearing.left.degree,
      leftLatestType: latestHearing.left.type,
    };
  }, [activeGroup]);

  const toggleFreqTable = (idKey: string) => {
    setExpandedFreqVisitIds((prev) => ({ ...prev, [idKey]: !prev[idKey] }));
  };

  const renderDeltaBadge = (deltaDb: number) => {
    // Lower PTA dB HL means better hearing threshold (improvement)
    // Higher PTA dB HL means worse hearing threshold (progression)
    if (deltaDb <= -5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tabular-nums bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <ArrowDownRight size={12} />
          {deltaDb} dB ({t.thresholdImproved})
        </span>
      );
    }
    if (deltaDb >= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tabular-nums bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
          <ArrowUpRight size={12} />
          +{deltaDb} dB ({t.thresholdWorsened})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <Minus size={12} />
        {deltaDb > 0 ? `+${deltaDb}` : deltaDb} dB ({t.thresholdStable})
      </span>
    );
  };

  const formatDiagnosisLabel = (degreeKey: string, typeKey: string) => {
    const deg = t[degreeKey as keyof typeof t] || degreeKey;
    const typ = t[typeKey as keyof typeof t] || typeKey;
    if (typeKey === 'normalHearing') return `${typ}`;
    return `${deg} • ${typ}`;
  };

  if (patients.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center mx-auto">
          <History size={28} />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {t.patientTimelineTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'ar'
              ? 'لا توجد سجلات زيارات حالياً. يمكنك تحميل حالات مرضية تتابعية نموذجية لاستعراض الخط الزمني وتغيرات التشخيص بين الزيارات.'
              : 'No patient visit records found yet. Load sample multi-visit patient cases to explore chronological visit tracking and diagnosis progression.'}
          </p>
        </div>
        <div className="pt-2">
          <button
            disabled={isSeeding}
            onClick={async () => {
              setIsSeeding(true);
              await onSeedSampleLongitudinalCases();
              setIsSeeding(false);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all shadow-xs disabled:opacity-50"
          >
            <Sparkles size={16} />
            <span>{t.loadSampleTimeline}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar: Patient Roster & Selection */}
      <div className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {lang === 'ar' ? 'قائمة المرضى' : 'Patient Roster'}
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50">
              {patientGroups.length}
            </span>
          </div>

          <div className="relative">
            <Search
              className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`}
              size={14}
            />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className={`w-full ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500 dark:text-white`}
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-[600px] overflow-y-auto">
          {filteredGroups.map((group) => {
            const isSelected = activeGroup?.key === group.key;
            const latestVisit = group.visitsAsc[group.visitsAsc.length - 1];
            const firstVisit = group.visitsAsc[0];
            const latestHearing = latestVisit?.data ? analyzeHearing(latestVisit.data) : null;

            return (
              <button
                key={group.key}
                type="button"
                onClick={() => onSelectPatientKey(group.key)}
                className={`w-full text-start p-3.5 transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-teal-50/70 dark:bg-teal-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    {group.name.charAt(0)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p
                      className={`text-xs font-bold truncate ${
                        isSelected
                          ? 'text-teal-800 dark:text-teal-300'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {group.name}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400">
                      {group.age} {t.years} • {group.phone || '---'}
                    </p>
                    {latestHearing && (
                      <div className="flex items-center gap-2 pt-0.5 font-mono text-[10px] tabular-nums">
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          R: {latestHearing.right.pta} dB
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          L: {latestHearing.left.pta} dB
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums border ${
                      group.visitsAsc.length > 1
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {group.visitsAsc.length} {t.visitsCount}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-400">
                    {latestVisit.visitDate}
                  </span>
                  {group.visitsAsc.length > 1 && (
                    <span className="text-[9px] font-mono tabular-nums text-teal-600 dark:text-teal-400">
                      {firstVisit.visitDate.slice(5)} → {latestVisit.visitDate.slice(5)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
          <button
            type="button"
            disabled={isSeeding}
            onClick={async () => {
              setIsSeeding(true);
              await onSeedSampleLongitudinalCases();
              setIsSeeding(false);
            }}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Sparkles size={13} className="text-teal-600 dark:text-teal-400" />
            <span>{t.loadSampleTimeline}</span>
          </button>
        </div>
      </div>

      {/* Main Column: Chronological Timeline & Longitudinal Trajectory */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-6">
        {activeGroup && netTrajectory ? (
          <>
            {/* Selected Patient Longitudinal Header Card */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-extrabold text-base shrink-0">
                    {activeGroup.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {activeGroup.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50">
                        {activeGroup.visitsAsc.length} {t.visitsCount}
                      </span>
                    </div>
                    <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                      {activeGroup.age} {t.years} • {t.phone}: {activeGroup.phone || '---'} •{' '}
                      {t.firstVisit}: {netTrajectory.firstDate} → {t.latestVisit}:{' '}
                      {netTrajectory.latestDate}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeGroup.visitsAsc.length === 1 && (
                    <button
                      type="button"
                      disabled={isSeeding}
                      onClick={async () => {
                        setIsSeeding(true);
                        await onAddPriorVisitForPatient(activeGroup.visitsAsc[0]);
                        setIsSeeding(false);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <History size={14} />
                      <span>{t.simulatePriorVisit}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onNewFollowUpVisit(
                        activeGroup.visitsAsc[activeGroup.visitsAsc.length - 1]
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={15} />
                    <span>{t.newFollowUpVisit}</span>
                  </button>
                </div>
              </div>

              {/* Longitudinal Trajectory Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Right Ear Trajectory */}
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {t.rightEar} (OD)
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      {t.netPtaChange}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono tabular-nums">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {netTrajectory.rightLatestPta} dB
                      </span>
                      {netTrajectory.totalVisits > 1 && (
                        <span className="text-xs text-slate-400 ms-1.5">
                          ({lang === 'ar' ? 'من' : 'from'} {netTrajectory.rightFirstPta} dB)
                        </span>
                      )}
                    </div>
                    {netTrajectory.totalVisits > 1 &&
                      renderDeltaBadge(netTrajectory.rightNetDelta)}
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                    {formatDiagnosisLabel(
                      netTrajectory.rightLatestDegree,
                      netTrajectory.rightLatestType
                    )}
                  </p>
                </div>

                {/* Left Ear Trajectory */}
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {t.leftEar} (OS)
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      {t.netPtaChange}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono tabular-nums">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {netTrajectory.leftLatestPta} dB
                      </span>
                      {netTrajectory.totalVisits > 1 && (
                        <span className="text-xs text-slate-400 ms-1.5">
                          ({lang === 'ar' ? 'من' : 'from'} {netTrajectory.leftFirstPta} dB)
                        </span>
                      )}
                    </div>
                    {netTrajectory.totalVisits > 1 &&
                      renderDeltaBadge(netTrajectory.leftNetDelta)}
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                    {formatDiagnosisLabel(
                      netTrajectory.leftLatestDegree,
                      netTrajectory.leftLatestType
                    )}
                  </p>
                </div>

                {/* Multi-Visit Progression Matrix Table */}
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {t.longitudinalTrajectory}
                    </span>
                    <Clock size={14} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto font-mono text-[11px] tabular-nums">
                    {activeGroup.visitsAsc.map((v, i) => {
                      const h = v.data ? analyzeHearing(v.data) : null;
                      return (
                        <div
                          key={v.id || i}
                          className="flex items-center justify-between py-0.5 border-b border-slate-200/50 dark:border-slate-700/50 last:border-none"
                        >
                          <span className="text-slate-500 dark:text-slate-400">
                            #{i + 1} • {v.visitDate}
                          </span>
                          {h ? (
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              <span className="text-red-600 dark:text-red-400">
                                R:{h.right.pta}
                              </span>{' '}
                              /{' '}
                              <span className="text-blue-600 dark:text-blue-400">
                                L:{h.left.pta}
                              </span>{' '}
                              dB
                            </span>
                          ) : (
                            <span>---</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Filter & Sort Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEarFilter('both')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      earFilter === 'both'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.bothEars}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEarFilter('right')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      earFilter === 'right'
                        ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {t.rightEar}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEarFilter('left')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      earFilter === 'left'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {t.leftEar}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSortOrder('desc')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      sortOrder === 'desc'
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.sortNewestFirst}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('asc')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      sortOrder === 'asc'
                        ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.sortOldestFirst}
                  </button>
                </div>
              </div>
            </div>

            {/* Chronological Vertical Timeline Track */}
            <div className="relative space-y-5">
              {enrichedVisits.map((item) => {
                const {
                  visit,
                  chronologicalNumber,
                  isBaseline,
                  isLatest,
                  hearing,
                  rightAbg,
                  leftAbg,
                  rightTymp,
                  leftTymp,
                  rightSpeech,
                  leftSpeech,
                  comparison,
                } = item;

                const visitIdKey = String(visit.id || `${visit.visitDate}-${chronologicalNumber}`);
                const isFreqOpen = !!expandedFreqVisitIds[visitIdKey];

                return (
                  <div
                    key={visitIdKey}
                    className="relative flex gap-4 sm:gap-5 items-stretch"
                  >
                    {/* Vertical Timeline Spine & Node Badge */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={`w-9 h-9 rounded-xl font-mono text-xs font-extrabold tabular-nums flex items-center justify-center border ${
                          isLatest
                            ? 'bg-teal-600 text-white border-teal-600'
                            : isBaseline
                            ? 'bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        #{chronologicalNumber}
                      </div>
                      <div className="w-px flex-1 bg-slate-200 dark:bg-slate-800 my-1.5" />
                    </div>

                    {/* Visit Card */}
                    <div className="flex-1 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                      {/* Visit Top Bar: Date, Visit Badge, Doctor, and Actions */}
                      <div className="p-4 sm:px-6 bg-slate-50/60 dark:bg-slate-850/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                            <Calendar size={15} className="text-teal-600 dark:text-teal-400" />
                            <span>{visit.visitDate}</span>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                              isBaseline
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                : 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/50'
                            }`}
                          >
                            {isBaseline ? t.baselineVisit : `${t.followUpVisit} #${chronologicalNumber}`}
                          </span>

                          {comparison && comparison.daysElapsed > 0 && (
                            <span className="text-[11px] font-mono tabular-nums text-slate-400">
                              (+{comparison.daysElapsed} {t.daysSincePrev})
                            </span>
                          )}

                          {visit.doctorName && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Stethoscope size={13} className="text-slate-400" />
                              <span>{visit.doctorName}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewVisitReport(visit)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 text-xs font-bold flex items-center gap-1.5 transition-all"
                          >
                            <Eye size={14} />
                            <span>{t.viewReport}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditVisit(visit)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            title={t.editAnalysis}
                          >
                            <FileText size={15} />
                          </button>
                          {visit.id && (
                            <button
                              type="button"
                              onClick={() => onDeleteVisit(visit.id!)}
                              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                              title={lang === 'ar' ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-5 sm:p-6 space-y-5">
                        {/* SECTION 1: Diagnosis & Threshold Changes Since Previous Visit */}
                        {comparison && (
                          <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                              <div className="flex items-center gap-2">
                                <Activity size={15} className="text-indigo-600 dark:text-indigo-400" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                  {t.diagnosisChanges}
                                </h4>
                                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                                  ({t.comparedToVisit} {comparison.prevVisitDate})
                                </span>
                              </div>

                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                                  comparison.rightDiagChanged || comparison.leftDiagChanged
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                }`}
                              >
                                {comparison.rightDiagChanged || comparison.leftDiagChanged
                                  ? t.diagnosisChanged
                                  : t.diagnosisStable}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Right Ear Diagnosis Delta */}
                              {(earFilter === 'both' || earFilter === 'right') && (
                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                      {t.rightEar}
                                    </span>
                                    {renderDeltaBadge(comparison.rightPtaDelta)}
                                  </div>

                                  <div className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-1.5">
                                    <span className="text-slate-400">
                                      {formatDiagnosisLabel(
                                        comparison.rightPrevDegree,
                                        comparison.rightPrevType
                                      )}
                                    </span>
                                    {isRTL ? (
                                      <ArrowLeft size={13} className="text-teal-600 shrink-0" />
                                    ) : (
                                      <ArrowRight size={13} className="text-teal-600 shrink-0" />
                                    )}
                                    <span
                                      className={`font-bold ${
                                        comparison.rightDiagChanged
                                          ? 'text-indigo-600 dark:text-indigo-400'
                                          : 'text-slate-800 dark:text-slate-200'
                                      }`}
                                    >
                                      {formatDiagnosisLabel(
                                        comparison.rightCurrDegree,
                                        comparison.rightCurrType
                                      )}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono tabular-nums text-slate-500">
                                    {comparison.rightTympChanged && (
                                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                        Tymp: Type {comparison.rightPrevTymp} → Type{' '}
                                        {comparison.rightCurrTymp}
                                      </span>
                                    )}
                                    {comparison.rightSdsDelta !== null &&
                                      comparison.rightSdsDelta !== 0 && (
                                        <span
                                          className={
                                            comparison.rightSdsDelta > 0
                                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                              : 'text-rose-600 dark:text-rose-400 font-semibold'
                                          }
                                        >
                                          SDS: {comparison.rightSdsDelta > 0 ? '+' : ''}
                                          {comparison.rightSdsDelta}%
                                        </span>
                                      )}
                                  </div>
                                </div>
                              )}

                              {/* Left Ear Diagnosis Delta */}
                              {(earFilter === 'both' || earFilter === 'left') && (
                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      {t.leftEar}
                                    </span>
                                    {renderDeltaBadge(comparison.leftPtaDelta)}
                                  </div>

                                  <div className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-1.5">
                                    <span className="text-slate-400">
                                      {formatDiagnosisLabel(
                                        comparison.leftPrevDegree,
                                        comparison.leftPrevType
                                      )}
                                    </span>
                                    {isRTL ? (
                                      <ArrowLeft size={13} className="text-teal-600 shrink-0" />
                                    ) : (
                                      <ArrowRight size={13} className="text-teal-600 shrink-0" />
                                    )}
                                    <span
                                      className={`font-bold ${
                                        comparison.leftDiagChanged
                                          ? 'text-indigo-600 dark:text-indigo-400'
                                          : 'text-slate-800 dark:text-slate-200'
                                      }`}
                                    >
                                      {formatDiagnosisLabel(
                                        comparison.leftCurrDegree,
                                        comparison.leftCurrType
                                      )}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono tabular-nums text-slate-500">
                                    {comparison.leftTympChanged && (
                                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                        Tymp: Type {comparison.leftPrevTymp} → Type{' '}
                                        {comparison.leftCurrTymp}
                                      </span>
                                    )}
                                    {comparison.leftSdsDelta !== null &&
                                      comparison.leftSdsDelta !== 0 && (
                                        <span
                                          className={
                                            comparison.leftSdsDelta > 0
                                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                              : 'text-rose-600 dark:text-rose-400 font-semibold'
                                          }
                                        >
                                          SDS: {comparison.leftSdsDelta > 0 ? '+' : ''}
                                          {comparison.leftSdsDelta}%
                                        </span>
                                      )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* SECTION 2: Key Audiometric Findings (Pure-Tone, Tympanometry, Speech) */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {t.keyFindings}
                            </h4>
                            <button
                              type="button"
                              onClick={() => toggleFreqTable(visitIdKey)}
                              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline font-mono"
                            >
                              {isFreqOpen
                                ? lang === 'ar'
                                  ? 'إخفاء جدول الترددات (250-8k Hz)'
                                  : 'Hide Frequency Table (250–8k Hz)'
                                : lang === 'ar'
                                ? 'عرض جدول الترددات (250-8k Hz)'
                                : 'Show Frequency Table (250–8k Hz)'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Right Ear Key Findings */}
                            {(earFilter === 'both' || earFilter === 'right') && hearing && (
                              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {t.rightEarAnalysis}
                                    </span>
                                  </div>
                                  <span className="text-sm font-extrabold font-mono tabular-nums text-red-600 dark:text-red-400">
                                    PTA: {hearing.right.pta} dB HL
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                                    <span className="text-[10px] text-slate-400 block">
                                      {t.degree} / {t.type}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                      {formatDiagnosisLabel(
                                        hearing.right.degree,
                                        hearing.right.type
                                      )}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono tabular-nums">
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      {t.tympanometry}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                      Type {rightTymp?.type || 'A'} ({rightTymp?.pressure ?? 0}{' '}
                                      daPa)
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      Comp: {rightTymp?.compliance ?? 0.6} ml • Reflex:{' '}
                                      {rightTymp?.reflex1kIpsi || '85'}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono tabular-nums">
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      {t.speechAudiometry}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                      SRT: {rightSpeech?.srt || Math.max(10, hearing.right.pta + 5)}{' '}
                                      dB
                                    </span>
                                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                                      SDS: {rightSpeech?.sds || (hearing.right.pta <= 25 ? 96 : 84)}
                                      %
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                                  <span>{t.airBoneGap}:</span>
                                  <span
                                    className={`font-mono font-semibold tabular-nums ${
                                      rightAbg?.significant
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {rightAbg?.significant ? t.significantAbg : t.noSignificantAbg}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Left Ear Key Findings */}
                            {(earFilter === 'both' || earFilter === 'left') && hearing && (
                              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {t.leftEarAnalysis}
                                    </span>
                                  </div>
                                  <span className="text-sm font-extrabold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                                    PTA: {hearing.left.pta} dB HL
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                                    <span className="text-[10px] text-slate-400 block">
                                      {t.degree} / {t.type}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                      {formatDiagnosisLabel(hearing.left.degree, hearing.left.type)}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono tabular-nums">
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      {t.tympanometry}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                      Type {leftTymp?.type || 'A'} ({leftTymp?.pressure ?? 0} daPa)
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      Comp: {leftTymp?.compliance ?? 0.6} ml • Reflex:{' '}
                                      {leftTymp?.reflex1kIpsi || '85'}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono tabular-nums">
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      {t.speechAudiometry}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                                      SRT: {leftSpeech?.srt || Math.max(10, hearing.left.pta + 5)}{' '}
                                      dB
                                    </span>
                                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                                      SDS: {leftSpeech?.sds || (hearing.left.pta <= 25 ? 96 : 84)}%
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                                  <span>{t.airBoneGap}:</span>
                                  <span
                                    className={`font-mono font-semibold tabular-nums ${
                                      leftAbg?.significant
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {leftAbg?.significant ? t.significantAbg : t.noSignificantAbg}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Expandable Pure-Tone Frequency Thresholds Table (250 - 8000 Hz) */}
                          {isFreqOpen && visit.data && (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-xs font-mono tabular-nums">
                                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                  <tr>
                                    <th className="px-3 py-2 text-start font-sans">{t.ear}</th>
                                    {FREQUENCIES.map((f) => (
                                      <th key={f} className="px-3 py-2 text-center">
                                        {f} Hz
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  <tr>
                                    <td className="px-3 py-2 font-bold text-red-600 dark:text-red-400 font-sans">
                                      {t.rightEar} (AC / BC)
                                    </td>
                                    {FREQUENCIES.map((f) => (
                                      <td key={f} className="px-3 py-2 text-center">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                          {visit.data.right.AC[f] ?? 0}
                                        </span>
                                        <span className="text-slate-400">
                                          {' '}
                                          / {visit.data.right.BC[f] ?? 0}
                                        </span>
                                      </td>
                                    ))}
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400 font-sans">
                                      {t.leftEar} (AC / BC)
                                    </td>
                                    {FREQUENCIES.map((f) => (
                                      <td key={f} className="px-3 py-2 text-center">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                          {visit.data.left.AC[f] ?? 0}
                                        </span>
                                        <span className="text-slate-400">
                                          {' '}
                                          / {visit.data.left.BC[f] ?? 0}
                                        </span>
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* SECTION 3: Clinical Notes & Recorded Diagnosis Summary */}
                        {(visit.diagnosis || visit.notes) && (
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {visit.diagnosis && (
                              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block mb-1">
                                  {t.diagnosis}
                                </span>
                                <p className="text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                                  {visit.diagnosis.replace(/[#*`]/g, '')}
                                </p>
                              </div>
                            )}
                            {visit.notes && (
                              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                  {t.clinicalNotes}
                                </span>
                                <p className="text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                                  {visit.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
            {t.selectPatientPrompt}
          </div>
        )}
      </div>
    </div>
  );
};
