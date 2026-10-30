import { AudiometryData, FREQUENCIES } from "../types";

export function calculatePTA(acValues: { [key: number]: number }) {
  // Standard PTA is average of 500, 1000, 2000 Hz
  const sum = (acValues[500] || 0) + (acValues[1000] || 0) + (acValues[2000] || 0);
  return Math.round(sum / 3);
}

export function detectAirBoneGap(ac: { [key: number]: number }, bc: { [key: number]: number }) {
  const gaps: { [key: number]: number } = {};
  let significant = false;
  
  FREQUENCIES.forEach(freq => {
    const gap = (ac[freq] || 0) - (bc[freq] || 0);
    gaps[freq] = gap;
    if (gap >= 15) significant = true;
  });
  
  return { gaps, significant };
}

export function classifyDegree(pta: number) {
  if (pta <= 25) return "normalGood";
  if (pta <= 40) return "mild";
  if (pta <= 55) return "moderate";
  if (pta <= 70) return "modSevere";
  if (pta <= 90) return "severe";
  return "profound";
}

export function classifyType(ac: { [key: number]: number }, bc: { [key: number]: number }) {
  const ptaAC = calculatePTA(ac);
  const ptaBC = calculatePTA(bc);
  const { significant } = detectAirBoneGap(ac, bc);
  
  if (ptaAC <= 25 && ptaBC <= 25) return "normalHearing";
  if (significant && ptaBC <= 25) return "conductiveHL";
  if (!significant && ptaAC > 25) return "sensorineuralHL";
  if (significant && ptaBC > 25) return "mixedHL";
  
  return "indeterminate";
}

export function analyzeHearing(data: AudiometryData) {
  const rightPTA = calculatePTA(data.right.AC);
  const leftPTA = calculatePTA(data.left.AC);
  
  const rightDegree = classifyDegree(rightPTA);
  const leftDegree = classifyDegree(leftPTA);
  
  const rightType = classifyType(data.right.AC, data.right.BC);
  const leftType = classifyType(data.left.AC, data.left.BC);
  
  return {
    right: { pta: rightPTA, degree: rightDegree, type: rightType },
    left: { pta: leftPTA, degree: leftDegree, type: leftType }
  };
}

export type AmplificationProfileId = 'mild' | 'standard' | 'power';

export interface EarAmplificationSimulation {
  unaidedAC: { [freq: number]: number };
  aidedAC: { [freq: number]: number };
  functionalGain: { [freq: number]: number };
  unaidedPTA: number;
  aidedPTA: number;
  unaidedSRT: number;
  aidedSRT: number;
  srtImprovement: number;
  unaidedSDS: number;
  aidedSDS: number;
  sdsImprovement: number;
  unaidedSII: number;
  aidedSII: number;
  pbMaxCeiling: number;
  isBaselineEstimated: boolean;
}

export interface AmplificationSimulationResult {
  profileId: AmplificationProfileId;
  right: EarAmplificationSimulation;
  left: EarAmplificationSimulation;
}

// Frequency importance weights approximating ANSI S3.5 Speech Intelligibility Index (SII)
const SII_WEIGHTS: { [freq: number]: number } = {
  250: 0.06,
  500: 0.16,
  1000: 0.24,
  2000: 0.28,
  4000: 0.20,
  8000: 0.06,
};

// Profile gain multipliers per frequency (relative to threshold above 15 dB HL)
const PROFILE_PRESCRIPTIONS: Record<
  AmplificationProfileId,
  {
    freqMultipliers: { [freq: number]: number };
    maxGain: number;
    targetFloorDb: number;
    clarityBoost: number;
  }
> = {
  mild: {
    // Comfort / Conservative Half-Gain (~35% gain, gentle high-frequency roll-off)
    freqMultipliers: { 250: 0.25, 500: 0.32, 1000: 0.38, 2000: 0.40, 4000: 0.38, 8000: 0.30 },
    maxGain: 26,
    targetFloorDb: 20,
    clarityBoost: 0.65,
  },
  standard: {
    // NAL-NL2 inspired Speech Intelligibility prescription (~50% gain in mid/high speech frequencies)
    freqMultipliers: { 250: 0.34, 500: 0.46, 1000: 0.54, 2000: 0.58, 4000: 0.56, 8000: 0.45 },
    maxGain: 42,
    targetFloorDb: 18,
    clarityBoost: 0.85,
  },
  power: {
    // DSL v5 / High-Power Audibility prescription (~68% gain for maximum consonant audibility)
    freqMultipliers: { 250: 0.48, 500: 0.62, 1000: 0.70, 2000: 0.74, 4000: 0.70, 8000: 0.58 },
    maxGain: 58,
    targetFloorDb: 15,
    clarityBoost: 0.96,
  },
};

function computeSIIFromThresholds(thresholds: { [freq: number]: number }): number {
  // Conversational speech spectrum peaks around 65 dB HL (dynamic range ~35 dB to 65 dB HL)
  let totalAudibility = 0;
  FREQUENCIES.forEach(freq => {
    const thr = thresholds[freq] ?? 0;
    const weight = SII_WEIGHTS[freq] || 0.1;
    // At 65 dB HL presentation, if threshold <= 20 dB HL, 100% of the 30 dB speech dynamic range is audible.
    // If threshold >= 75 dB HL, 0% of conversational speech is audible without amplification.
    const audibleFraction = Math.max(0, Math.min(1, (75 - Math.max(15, thr)) / 55));
    totalAudibility += audibleFraction * weight;
  });
  return Math.round(totalAudibility * 100);
}

function simulateSingleEar(
  ac: { [freq: number]: number },
  bc: { [freq: number]: number },
  recordedSrt: number | undefined,
  recordedSds: number | undefined,
  profileId: AmplificationProfileId
): EarAmplificationSimulation {
  const prescription = PROFILE_PRESCRIPTIONS[profileId];
  const unaidedPTA = calculatePTA(ac);
  const ptaBC = calculatePTA(bc);
  const hfBC = Math.round(((bc[1000] || 0) + (bc[2000] || 0) + (bc[4000] || 0)) / 3);
  const { gaps } = detectAirBoneGap(ac, bc);

  const aidedAC: { [freq: number]: number } = {};
  const functionalGain: { [freq: number]: number } = {};

  FREQUENCIES.forEach(freq => {
    const unaidedThr = ac[freq] ?? 0;
    const abg = Math.max(0, gaps[freq] || 0);
    if (unaidedThr <= prescription.targetFloorDb) {
      aidedAC[freq] = unaidedThr;
      functionalGain[freq] = 0;
    } else {
      const excessLoss = unaidedThr - 15;
      // Conductive component (air-bone gap) benefits from slightly extra linear gain recovery
      const conductiveBonus = Math.min(8, Math.round(abg * 0.15));
      const rawGain = Math.round(excessLoss * prescription.freqMultipliers[freq] + conductiveBonus);
      const clampedGain = Math.min(prescription.maxGain, rawGain);
      const aidedVal = Math.max(prescription.targetFloorDb, unaidedThr - clampedGain);
      // Round to nearest 5 dB or 1 dB for clinical precision
      aidedAC[freq] = Math.round(aidedVal);
      functionalGain[freq] = Math.max(0, unaidedThr - aidedAC[freq]);
    }
  });

  const aidedPTA = calculatePTA(aidedAC);
  const unaidedSII = computeSIIFromThresholds(ac);
  const aidedSII = computeSIIFromThresholds(aidedAC);

  // Determine Cochlear Distortion Ceiling (PB Max %) based on sensorineural (BC) loss
  // Conductive loss (low BC) has near-100% cochlear potential once amplified;
  // Severe/profound sensorineural loss (high BC) has hair-cell/neural distortion limits.
  const effectiveBC = Math.max(ptaBC, hfBC);
  let pbMaxCeiling = 98;
  if (effectiveBC <= 25) {
    pbMaxCeiling = 99;
  } else if (effectiveBC <= 45) {
    pbMaxCeiling = Math.round(98 - (effectiveBC - 25) * 0.3); // 92 - 98%
  } else if (effectiveBC <= 65) {
    pbMaxCeiling = Math.round(92 - (effectiveBC - 45) * 0.55); // 81 - 92%
  } else if (effectiveBC <= 85) {
    pbMaxCeiling = Math.round(81 - (effectiveBC - 65) * 0.9); // 63 - 81%
  } else {
    pbMaxCeiling = Math.max(38, Math.round(63 - (effectiveBC - 85) * 1.1));
  }

  // Baseline Unaided SRT
  const hasRecordedSrt = typeof recordedSrt === 'number' && recordedSrt > 0;
  const unaidedSRT = hasRecordedSrt ? recordedSrt : Math.max(10, unaidedPTA + 3);
  const avgSpeechGain = Math.round(
    ((functionalGain[500] || 0) + (functionalGain[1000] || 0) + (functionalGain[2000] || 0)) / 3
  );
  const aidedSRT = Math.max(15, unaidedSRT - avgSpeechGain);
  const srtImprovement = Math.max(0, unaidedSRT - aidedSRT);

  // Baseline Unaided SDS (%)
  const hasRecordedSds = typeof recordedSds === 'number' && recordedSds > 0;
  const isBaselineEstimated = !hasRecordedSds;

  let unaidedSDS: number;
  if (hasRecordedSds) {
    unaidedSDS = Math.min(100, Math.max(0, recordedSds));
  } else {
    // Estimate conversational speech recognition score from unaided SII and cochlear reserve
    if (unaidedPTA <= 20 && (ac[2000] || 0) <= 25 && (ac[4000] || 0) <= 25) {
      unaidedSDS = 98;
    } else {
      // Nonlinear transfer function from SII audibility to monosyllabic word recognition (SDS %)
      const siiFactor = Math.pow(unaidedSII / 100, 0.85);
      unaidedSDS = Math.max(8, Math.min(pbMaxCeiling, Math.round(pbMaxCeiling * siiFactor)));
    }
  }

  // Calculate Aided SDS (%) based on audibility recovery toward PB Max ceiling
  let aidedSDS = unaidedSDS;
  if (unaidedPTA > 20 || (ac[2000] || 0) > 25 || (ac[4000] || 0) > 25) {
    const effectiveCeiling = Math.max(unaidedSDS, pbMaxCeiling);
    const siiGainRatio = Math.max(0, (aidedSII - unaidedSII) / Math.max(15, 100 - unaidedSII));
    const highFreqGain = ((functionalGain[1000] || 0) + (functionalGain[2000] || 0) + (functionalGain[4000] || 0)) / 3;
    const gainEfficiency = Math.min(1, (highFreqGain / 28) * 0.45 + siiGainRatio * 0.55);
    const recoveryFraction = Math.min(0.95, gainEfficiency * prescription.clarityBoost);
    const potentialIncrease = Math.round((effectiveCeiling - unaidedSDS) * recoveryFraction);
    // Ensure a meaningful minimum boost if significant high-frequency gain is applied and ceiling allows
    const minGuaranteedBoost =
      highFreqGain >= 8 && unaidedSDS < effectiveCeiling
        ? Math.min(effectiveCeiling - unaidedSDS, Math.max(4, Math.round(highFreqGain * 0.55 * prescription.clarityBoost)))
        : 0;
    aidedSDS = Math.min(100, unaidedSDS + Math.max(potentialIncrease, minGuaranteedBoost));
  }

  const sdsImprovement = Math.max(0, aidedSDS - unaidedSDS);

  return {
    unaidedAC: { ...ac },
    aidedAC,
    functionalGain,
    unaidedPTA,
    aidedPTA,
    unaidedSRT,
    aidedSRT,
    srtImprovement,
    unaidedSDS,
    aidedSDS,
    sdsImprovement,
    unaidedSII,
    aidedSII,
    pbMaxCeiling,
    isBaselineEstimated,
  };
}

export function simulateAmplification(
  data: AudiometryData,
  profileId: AmplificationProfileId
): AmplificationSimulationResult {
  return {
    profileId,
    right: simulateSingleEar(
      data.right.AC,
      data.right.BC,
      data.speech?.right?.srt,
      data.speech?.right?.sds,
      profileId
    ),
    left: simulateSingleEar(
      data.left.AC,
      data.left.BC,
      data.speech?.left?.srt,
      data.speech?.left?.sds,
      profileId
    ),
  };
}

