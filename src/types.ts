export interface AudiometryValues {
  [frequency: number]: number;
}

export interface EarData {
  AC: AudiometryValues;
  BC: AudiometryValues;
}

export interface Thresholds {
  min: number;
  max: number;
}

export interface ThresholdSettings {
  right: {
    AC: Thresholds;
    BC: Thresholds;
  };
  left: {
    AC: Thresholds;
    BC: Thresholds;
  };
}

export interface TympanometryData {
  type: string; // A, As, Ad, B, C
  pressure: number;
  volume: number;
  compliance: number;
  gradient?: number;
  reflex1kIpsi?: number | 'NR' | string;
}

export interface SpeechAudiometryData {
  srt: number;
  sds: number;
}

export interface AcousticReflexData {
  ipsi: { [freq: number]: number | 'NR' | string };
  contra: { [freq: number]: number | 'NR' | string };
}

export interface AudiometryData {
  right: EarData;
  left: EarData;
  thresholds?: ThresholdSettings;
  tympanometry?: {
    right: TympanometryData;
    left: TympanometryData;
  };
  speech?: {
    right: SpeechAudiometryData;
    left: SpeechAudiometryData;
  };
  reflex?: {
    right: AcousticReflexData;
    left: AcousticReflexData;
  };
}

export interface Feedback {
  accuracy: number; // 1-5
  usefulness: number; // 1-5
  comments: string;
  createdAt: string;
}

export interface Patient {
  id?: string | number;
  name: string;
  dob?: string;
  email?: string;
  age: number;
  phone?: string;
  gender?: 'male' | 'female';
  visitDate: string;
  doctorName: string;
  notes: string;
  data: AudiometryData;
  diagnosis?: string;
  patientAdvice?: string;
  summary?: string;
  feedback?: Feedback;
  ambientNoise?: number;
  uid?: string;
  createdAt?: string;
}

export interface Task {
  id: string | number;
  title: string;
  completed: boolean;
  uid?: string;
  createdAt: string;
}

export interface Note {
  id: string | number;
  content: string;
  uid?: string;
  createdAt: string;
}

export interface User {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  displayName: string | null;
  photoURL: string | null;
  isActive: boolean;
  subscriptionExpiry?: string | null;
  hospitalName?: string | null;
  hospitalAddress?: string | null;
  hospitalPhone?: string | null;
  hospitalLogo?: string | null;
  language?: string;
  darkMode?: boolean;
  hasUnlimitedCases?: boolean;
  subscriptionType?: 'trial' | 'premium' | 'pro' | 'clinic';
  createdAt?: string;
}

export const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  right: {
    AC: { min: -10, max: 120 },
    BC: { min: -10, max: 80 },
  },
  left: {
    AC: { min: -10, max: 120 },
    BC: { min: -10, max: 80 },
  },
};

export const INITIAL_DATA: AudiometryData = {
  right: {
    AC: { 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0 },
    BC: { 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0 },
  },
  left: {
    AC: { 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0 },
    BC: { 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0 },
  },
  thresholds: DEFAULT_THRESHOLDS,
  tympanometry: {
    right: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75, reflex1kIpsi: '85' },
    left: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75, reflex1kIpsi: '85' },
  },
  speech: {
    right: { srt: 0, sds: 0 },
    left: { srt: 0, sds: 0 },
  },
  reflex: {
    right: { 
      ipsi: { 500: '', 1000: '', 2000: '', 4000: '' }, 
      contra: { 500: '', 1000: '', 2000: '', 4000: '' } 
    },
    left: { 
      ipsi: { 500: '', 1000: '', 2000: '', 4000: '' }, 
      contra: { 500: '', 1000: '', 2000: '', 4000: '' } 
    },
  },
};
