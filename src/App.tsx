import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Activity, 
  FileText, 
  Settings, 
  Search, 
  Plus, 
  ChevronRight,
  Printer,
  Eye,
  Trash2,
  Save,
  BrainCircuit,
  LayoutDashboard,
  Languages,
  Moon,
  Sun,
  Mic,
  MicOff,
  Volume2,
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  Trash,
  LogOut,
  Download,
  Star,
  X,
  Menu,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { NoiseMonitor } from './components/NoiseMonitor';
import { LiveNoiseIndicator } from './components/LiveNoiseIndicator';
import { Patient, INITIAL_DATA, AudiometryData, Task, Note, User as UserProfile } from './types';
import { AudiogramChart } from './components/AudiogramChart';
import { TympanogramChart } from './components/TympanogramChart';
import { AudiometryInput } from './components/AudiometryInput';
import { analyzeHearing, simulateAmplification, AmplificationProfileId } from './services/hearingAnalysis';
import { localDB } from './services/localDB';
import { getLocalDiagnosis, getLocalPatientAdvice } from './services/localAnalysisService';
import { noiseDetector } from './services/noiseDetectionService';
import {
  GEMINI_API_KEY_STORAGE_KEY,
  GEMINI_MODEL_STORAGE_KEY,
  GEMINI_KEY_UPDATED_AT_STORAGE_KEY,
  AI_MODELS,
  isOpenSourceModel,
  getModelDisplayName,
  getStoredGeminiApiKey,
  getStoredGeminiModel,
  runClientAIDiagnosis,
  runClientAIPatientAdvice,
  verifyClientAIModelOrKey,
  getOpenSourceDesktopClinicalDiagnosis,
} from './services/aiService';
import { ActivationModal } from './components/ActivationModal';
import { 
  getSubscriptionStatus, 
  incrementTrialReportUsage, 
  SubscriptionStatus, 
  TRIAL_MAX_REPORTS,
  DEVELOPER_PHONE 
} from './services/subscriptionService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Language, translations } from './translations';
import ReactMarkdown from 'react-markdown';
import { Shield, Calendar as CalendarIcon, UserCheck, UserX, Clock, HelpCircle, CheckCircle, Info, Phone, Radio, History, Key, EyeOff, Sparkles, RefreshCw, ShieldAlert, Upload, Database } from 'lucide-react';

import { Tutorial } from './components/Tutorial';
import { PatientTimelineView, getPatientIdentityKey } from './components/PatientTimelineView';
import { PatientAdvice } from './components/PatientAdvice';

type View = 'dashboard' | 'patients' | 'new-patient' | 'analysis' | 'settings' | 'noise-check';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>({ uid: 'local-user', email: 'local@device' });
  const [userProfile, setUserProfile] = useState<UserProfile | null>({
    uid: 'local-user',
    email: 'local@device',
    role: 'admin',
    displayName: 'Local Doctor',
    photoURL: null,
    isActive: true,
    hasUnlimitedCases: true,
    subscriptionType: 'premium',
    createdAt: new Date().toISOString(),
    subscriptionExpiry: '2099-12-31'
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [lang, setLang] = useState<Language>('ar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const t = translations[lang];
  const isRTL = lang === 'ar';
  const isPremium = true;
  const showAILock = false;

  const [currentView, setCurrentView] = useState<View>('dashboard');

  // Sync currentView with URL path
  useEffect(() => {
    const path = location.pathname.replace('/', '') as View;
    if (path && ['dashboard', 'patients', 'new-patient', 'analysis', 'settings', 'noise-check'].includes(path)) {
      setCurrentView(path);
    } else if (location.pathname === '/') {
      setCurrentView('dashboard');
    }
  }, [location]);

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    navigate(`/${view}`);
    setIsSidebarOpen(false);
  };

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportActiveTab, setReportActiveTab] = useState<'all' | 'audiogram' | 'tympanometry' | 'diagnosis'>('all');
  const [isAmpSimEnabled, setIsAmpSimEnabled] = useState(false);
  const [ampProfile, setAmpProfile] = useState<AmplificationProfileId>('standard');
  const [includeAdviceInPrint, setIncludeAdviceInPrint] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [geminiModel, setGeminiModel] = useState<string>(() => getStoredGeminiModel());
  const [geminiKeyUpdatedAt, setGeminiKeyUpdatedAt] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(GEMINI_KEY_UPDATED_AT_STORAGE_KEY) : null;
    } catch {
      return null;
    }
  });
  const [hasSystemGeminiKey, setHasSystemGeminiKey] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [apiKeyDraft, setApiKeyDraft] = useState<string>('');
  const [apiModelDraft, setApiModelDraft] = useState<string>(() => getStoredGeminiModel());
  const [showApiKeyPlain, setShowApiKeyPlain] = useState<boolean>(false);
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);
  const [keyVerificationStatus, setKeyVerificationStatus] = useState<{
    state: 'idle' | 'success' | 'error';
    message?: string;
  }>({ state: 'idle' });
  const isGeminiActive = Boolean(geminiApiKey.trim()) || hasSystemGeminiKey;
  const [isNoiseMonitoring, setIsNoiseMonitoring] = useState(false);
  const [micPermission, setMicPermission] = useState<PermissionState | 'unknown'>('unknown');

  // Subscription & Activation state
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    isActivated: false,
    isTrial: true,
    trialReportsUsed: 0,
    trialReportsLimit: TRIAL_MAX_REPORTS,
    trialExpired: false,
    plan: 'trial',
    deviceId: '',
  });
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

  const refreshSubscriptionStatus = async () => {
    try {
      const sub = await getSubscriptionStatus();
      setSubscription(sub);
      if (sub.trialExpired && !sub.isActivated) {
        setIsActivationModalOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshSubscriptionStatus();
  }, []);

  useEffect(() => {
    const activeLocalKey = geminiApiKey.trim();
    fetch('/api/ai-status', {
      headers: activeLocalKey ? { 'x-gemini-api-key': activeLocalKey } : {},
    })
      .then(r => r.json())
      .then(data => {
        setHasSystemGeminiKey(!!data.hasSystemKey);
      })
      .catch(() => {
        setHasSystemGeminiKey(false);
      });
  }, [geminiApiKey]);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as any }).then(result => {
        setMicPermission(result.state);
        result.onchange = () => setMicPermission(result.state);
      });
    }
  }, []);

  // Synchronize noise detector level with global state
  useEffect(() => {
    const unsub = noiseDetector.subscribe(data => {
      setCurrentNoiseLevel(data.level);
    });
    return () => unsub();
  }, []);

  const toggleNoiseMonitoring = async () => {
    if (isNoiseMonitoring) {
      noiseDetector.stop();
      setIsNoiseMonitoring(false);
      return;
    }

    const started = await noiseDetector.start();
    if (started) {
      setIsNoiseMonitoring(true);
      setMicPermission('granted');
      showToast(lang === 'ar' ? 'تم تشغيل كاشف الضوضاء بنجاح' : 'Noise detector activated', 'success');
    } else {
      setIsNoiseMonitoring(false);
    }
  };

  const requestMicPermission = toggleNoiseMonitoring;
  const [currentNoiseLevel, setCurrentNoiseLevel] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [viewingUsers, setViewingUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showTutorial, setShowTutorial] = useState(false);
  const [feedback, setFeedback] = useState({
    accuracy: 0,
    usefulness: 0,
    comments: ''
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [summaryPatientId, setSummaryPatientId] = useState<string | number | null>(null);
  const [patientsSubView, setPatientsSubView] = useState<'timeline' | 'table'>('timeline');
  const [selectedTimelinePatientKey, setSelectedTimelinePatientKey] = useState<string | null>(null);

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorialCompleted');
    if (!tutorialCompleted && user) {
      setShowTutorial(true);
    }
  }, [user]);

  const isSubscriptionValid = (profile: UserProfile) => {
    if (profile.role === 'admin') return true;
    if (!profile.subscriptionExpiry) return false;
    const expiry = new Date(profile.subscriptionExpiry);
    return expiry > new Date();
  };

  const fetchAllUsers = async () => {};

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateUser = async (_uid: string, _updates: Partial<UserProfile>) => {
    showToast(lang === 'ar' ? 'غير متاح في الوضع المحلي' : 'Not available in local mode', 'error');
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '',
    dob: '',
    email: '',
    age: 0,
    phone: '',
    visitDate: new Date().toISOString().split('T')[0],
    doctorName: '',
    notes: '',
    ambientNoise: 0,
    data: INITIAL_DATA
  });

  useEffect(() => {
    setFeedback({ accuracy: 0, usefulness: 0, comments: '' });
    setFeedbackSubmitted(false);
  }, [formData.id]);

  useEffect(() => {
    loadSettings();
    refreshData();
  }, []);

  const refreshData = async () => {
    await fetchPatients();
    await fetchTasks();
    await fetchNotes();
  };

  const loadSettings = async () => {
    const savedLang = await localDB.getSetting('language');
    const savedDarkMode = await localDB.getSetting('darkMode');
    const savedHospitalName = await localDB.getSetting('hospitalName');
    const savedHospitalAddress = await localDB.getSetting('hospitalAddress');
    const savedHospitalPhone = await localDB.getSetting('hospitalPhone');
    const savedHospitalLogo = await localDB.getSetting('hospitalLogo');
    const savedDbApiKey = await localDB.getSetting('geminiApiKey');
    
    if (savedLang) setLang(savedLang as Language);
    if (savedDarkMode !== null) setIsDarkMode(savedDarkMode === 'true' || savedDarkMode === true);
    
    // Hydrate localStorage key from IndexedDB if localStorage was cleared but IndexedDB has it
    const currentLocalKey = getStoredGeminiApiKey();
    if (!currentLocalKey && typeof savedDbApiKey === 'string' && savedDbApiKey.trim()) {
      const cleanKey = savedDbApiKey.trim();
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, cleanKey);
      setGeminiApiKey(cleanKey);
    }

    if (userProfile) {
      setUserProfile(prev => prev ? {
        ...prev,
        hospitalName: (savedHospitalName as string) || prev.hospitalName,
        hospitalAddress: (savedHospitalAddress as string) || prev.hospitalAddress,
        hospitalPhone: (savedHospitalPhone as string) || prev.hospitalPhone,
        hospitalLogo: (savedHospitalLogo as string) || prev.hospitalLogo,
      } : null);
    }
  };

  const maskApiKey = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return '';
    if (trimmed.length <= 10) return '••••••••••';
    return `${trimmed.slice(0, 6)}••••••••••••••••${trimmed.slice(-4)}`;
  };

  const handleQuickModelChange = (newModelId: string) => {
    setGeminiModel(newModelId);
    setApiModelDraft(newModelId);
    try {
      localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, newModelId);
    } catch {}
    const label = getModelDisplayName(newModelId);
    showToast(
      lang === 'ar'
        ? `تم تفعيل نموذج التشخيص: ${label}${isOpenSourceModel(newModelId) ? ' (مفتوح المصدر - مجاني)' : ''}`
        : `Selected diagnostic AI model: ${label}${isOpenSourceModel(newModelId) ? ' (Free Open-Source)' : ''}`,
      'success'
    );
  };

  const openApiConfigModal = () => {
    const currentKey = getStoredGeminiApiKey() || geminiApiKey;
    const currentModel = geminiModel || getStoredGeminiModel();
    setApiKeyDraft(currentKey);
    setApiModelDraft(currentModel);
    setShowApiKeyPlain(false);
    setKeyVerificationStatus({ state: 'idle' });
    setIsApiModalOpen(true);
  };

  const handleVerifyApiKey = async (keyToVerify?: string, modelToVerify?: string) => {
    const candidateKey = (keyToVerify ?? apiKeyDraft).trim();
    const candidateModel = modelToVerify ?? apiModelDraft;
    const isOss = isOpenSourceModel(candidateModel);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setKeyVerificationStatus({
        state: 'error',
        message:
          lang === 'ar'
            ? '⚠️ لا يوجد اتصال بالإنترنت! يرجى الاتصال بالإنترنت للتحليل والتشخيص عبر نماذج الذكاء الاصطناعي.'
            : '⚠️ No internet connection! Please connect to the internet to use AI analysis and diagnosis.',
      });
      return false;
    }

    if (!isOss && (!candidateKey || candidateKey.length < 10)) {
      setKeyVerificationStatus({
        state: 'error',
        message:
          lang === 'ar'
            ? 'يرجى إدخال مفتاح Gemini API صالح أو اختيار أحد النماذج المجانية مفتوحة المصدر'
            : 'Please enter a valid Gemini API key or select one of the Free Open-Source models',
      });
      return false;
    }

    setIsVerifyingKey(true);
    setKeyVerificationStatus({ state: 'idle' });

    try {
      const data = await verifyClientAIModelOrKey(candidateKey || undefined, candidateModel);
      if (data.valid) {
        setKeyVerificationStatus({
          state: 'success',
          message:
            isOss && !candidateKey
              ? lang === 'ar'
                ? `النموذج المفتوح المصدر (${getModelDisplayName(candidateModel)}) متصل بالإنترنت وجاهز للتحليل ومطابقة الفحوصات مجاناً!`
                : `Open-source model (${getModelDisplayName(candidateModel)}) is connected online and ready for clinical cross-matching!`
              : t.keyVerifiedSuccess,
        });
        return true;
      } else {
        setKeyVerificationStatus({
          state: 'error',
          message:
            data.error === 'NO_INTERNET_CONNECTION'
              ? lang === 'ar'
                ? '⚠️ لا يوجد اتصال بالإنترنت! يرجى الاتصال بالإنترنت لتشغيل نماذج الذكاء الاصطناعي.'
                : '⚠️ No internet connection! Please connect to the internet to run AI models.'
              : data.error || t.keyVerifiedError,
        });
        return false;
      }
    } catch (err) {
      setKeyVerificationStatus({
        state: 'error',
        message:
          lang === 'ar'
            ? '⚠️ تعذر الاتصال بالإنترنت! يرجى التأكد من اتصالك بالإنترنت.'
            : '⚠️ Could not connect to the internet! Please check your connection.',
      });
      return false;
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleSaveApiKeyToLocalStorage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedKey = apiKeyDraft.trim();
    const isOss = isOpenSourceModel(apiModelDraft);

    if (!trimmedKey && !isOss) {
      showToast(
        lang === 'ar'
          ? 'يرجى إدخال مفتاح API أو اختيار نموذج ذكاء اصطناعي مجاني مفتوح المصدر'
          : 'Please enter an API key or select a Free Open-Source AI model',
        'error'
      );
      return;
    }

    if (trimmedKey && trimmedKey.length < 12) {
      setKeyVerificationStatus({
        state: 'error',
        message:
          lang === 'ar'
            ? 'صيغة المفتاح قصيرة جداً. يرجى التأكد من نسخ مفتاح API كاملاً.'
            : 'API key is too short. Please paste the full API key.',
      });
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      if (trimmedKey) {
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmedKey);
        localStorage.setItem('smart_audiometry_gemini_api_key', trimmedKey);
        localStorage.setItem(GEMINI_KEY_UPDATED_AT_STORAGE_KEY, nowIso);
        await localDB.setSetting('geminiApiKey', trimmedKey);
        setGeminiApiKey(trimmedKey);
        setGeminiKeyUpdatedAt(nowIso);
      }
      localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, apiModelDraft);
      setGeminiModel(apiModelDraft);
      setIsApiModalOpen(false);
      showToast(
        trimmedKey
          ? t.apiKeySavedToast
          : lang === 'ar'
          ? `تم تفعيل النموذج المجاني مفتوح المصدر: ${getModelDisplayName(apiModelDraft)}`
          : `Activated free open-source model: ${getModelDisplayName(apiModelDraft)}`,
        'success'
      );
    } catch (err) {
      console.error('Failed to save AI configuration to localStorage:', err);
      showToast(
        lang === 'ar' ? 'تعذر حفظ الإعدادات في التخزين المحلي' : 'Failed to save configuration in local storage',
        'error'
      );
    }
  };

  const handleRemoveSavedApiKey = async () => {
    try {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
      localStorage.removeItem('smart_audiometry_gemini_api_key');
      localStorage.removeItem(GEMINI_KEY_UPDATED_AT_STORAGE_KEY);
      await localDB.setSetting('geminiApiKey', '');

      setGeminiApiKey('');
      setApiKeyDraft('');
      setGeminiKeyUpdatedAt(null);
      setKeyVerificationStatus({ state: 'idle' });
      showToast(t.apiKeyRemovedToast, 'success');
    } catch (err) {
      console.error('Failed to clear API key from localStorage:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const data = await localDB.getAllTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks');
    }
  };

  const fetchNotes = async () => {
    try {
      const data = await localDB.getAllNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await localDB.saveTask({ title: newTaskTitle, completed: false, createdAt: new Date().toISOString() });
      setNewTaskTitle('');
      fetchTasks();
      showToast(lang === 'en' ? 'Task added' : 'تمت إضافة المهمة');
    } catch (err) {
      showToast(lang === 'en' ? 'Failed to add task' : 'فشل في إضافة المهمة', 'error');
    }
  };

  const handleToggleTask = async (task: Task) => {
    if (!task.completed) {
      if (!confirm(t.completeTaskConfirm)) return;
    }
    try {
      await localDB.saveTask({ ...task, completed: !task.completed });
      fetchTasks();
    } catch (err) {
      console.error('Failed to toggle task');
    }
  };

  const handleDeleteTask = async (id: string | number) => {
    try {
      await localDB.deleteTask(id);
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    try {
      await localDB.saveNote({ content: newNoteContent, createdAt: new Date().toISOString() });
      setNewNoteContent('');
      fetchNotes();
      showToast(lang === 'en' ? 'Note saved' : 'تم حفظ الملاحظة');
    } catch (err) {
      showToast(lang === 'en' ? 'Failed to save note' : 'فشل في حفظ الملاحظة', 'error');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for IndexedDB
        showToast(lang === 'ar' ? 'حجم الملف كبير جداً (يجب أن يكون أقل من 1 ميجابايت)' : 'File size too large (max 1MB)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => prev ? { ...prev, hospitalLogo: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteNote = async (id: string | number) => {
    try {
      await localDB.deleteNote(id);
      fetchNotes();
    } catch (err) {
      console.error('Failed to delete note');
    }
  };

  const buildSampleLongitudinalVisits = (): Partial<Patient>[] => [
    // Patient 1: Tariq Al-Mansoor (3 visits showing Conductive HL + OME -> Medical Improvement -> Full Resolution)
    {
      name: 'Tariq Al-Mansoor',
      age: 42,
      phone: '771234560',
      gender: 'male',
      visitDate: '2024-09-12',
      doctorName: 'Dr. Rami Al-Hakim',
      notes: 'Baseline evaluation: Bilateral ear fullness and muffled hearing following upper respiratory infection. Otoscopy shows dull tympanic membranes bilaterally.',
      diagnosis: 'Right Ear: Moderate Conductive Hearing Loss (PTA 47 dB HL, Type B Tympanogram). Left Ear: Mild Conductive Hearing Loss (PTA 35 dB HL, Type C Tympanogram). Consistent with bilateral otitis media with effusion (OME).',
      data: {
        ...INITIAL_DATA,
        right: {
          AC: { 250: 45, 500: 50, 1000: 45, 2000: 45, 4000: 40, 8000: 35 },
          BC: { 250: 10, 500: 15, 1000: 10, 2000: 15, 4000: 15, 8000: 15 },
        },
        left: {
          AC: { 250: 35, 500: 35, 1000: 35, 2000: 35, 4000: 30, 8000: 25 },
          BC: { 250: 10, 500: 10, 1000: 10, 2000: 15, 4000: 15, 8000: 10 },
        },
        tympanometry: {
          right: { type: 'B', pressure: -240, volume: 1.1, compliance: 0.15, gradient: 160, reflex1kIpsi: 'NR' },
          left: { type: 'C', pressure: -185, volume: 1.2, compliance: 0.45, gradient: 95, reflex1kIpsi: '95' },
        },
        speech: {
          right: { srt: 50, sds: 88 },
          left: { srt: 35, sds: 92 },
        },
      },
    },
    {
      name: 'Tariq Al-Mansoor',
      age: 42,
      phone: '771234560',
      gender: 'male',
      visitDate: '2024-11-18',
      doctorName: 'Dr. Rami Al-Hakim',
      notes: '6-week follow-up after intranasal steroid therapy and autoinflation exercises. Patient reports noticeable improvement in left ear clarity and reduced pressure in right ear.',
      diagnosis: 'Right Ear: Improved from Moderate to Mild Conductive Hearing Loss (PTA 32 dB HL, Type C Tympanogram). Left Ear: Resolved to Normal Hearing (PTA 18 dB HL, Type A Tympanogram).',
      data: {
        ...INITIAL_DATA,
        right: {
          AC: { 250: 30, 500: 35, 1000: 30, 2000: 30, 4000: 25, 8000: 25 },
          BC: { 250: 10, 500: 15, 1000: 10, 2000: 15, 4000: 15, 8000: 15 },
        },
        left: {
          AC: { 250: 20, 500: 20, 1000: 15, 2000: 20, 4000: 15, 8000: 15 },
          BC: { 250: 10, 500: 10, 1000: 10, 2000: 15, 4000: 15, 8000: 10 },
        },
        tympanometry: {
          right: { type: 'C', pressure: -145, volume: 1.2, compliance: 0.42, gradient: 90, reflex1kIpsi: '90' },
          left: { type: 'A', pressure: -20, volume: 1.2, compliance: 0.75, gradient: 65, reflex1kIpsi: '85' },
        },
        speech: {
          right: { srt: 35, sds: 94 },
          left: { srt: 20, sds: 98 },
        },
      },
    },
    {
      name: 'Tariq Al-Mansoor',
      age: 42,
      phone: '771234560',
      gender: 'male',
      visitDate: '2025-02-05',
      doctorName: 'Dr. Rami Al-Hakim',
      notes: '3-month final checkup: Complete resolution of middle ear effusion bilaterally. Air-bone gap closed in both ears.',
      diagnosis: 'Bilateral Normal Hearing (Right PTA 17 dB HL, Left PTA 15 dB HL). Bilateral Type A Tympanograms with normal middle ear compliance and acoustic reflexes present.',
      data: {
        ...INITIAL_DATA,
        right: {
          AC: { 250: 15, 500: 20, 1000: 15, 2000: 15, 4000: 20, 8000: 20 },
          BC: { 250: 10, 500: 15, 1000: 10, 2000: 15, 4000: 15, 8000: 15 },
        },
        left: {
          AC: { 250: 15, 500: 15, 1000: 15, 2000: 15, 4000: 15, 8000: 15 },
          BC: { 250: 10, 500: 10, 1000: 10, 2000: 15, 4000: 15, 8000: 10 },
        },
        tympanometry: {
          right: { type: 'A', pressure: -10, volume: 1.25, compliance: 0.8, gradient: 60, reflex1kIpsi: '85' },
          left: { type: 'A', pressure: -5, volume: 1.2, compliance: 0.82, gradient: 58, reflex1kIpsi: '85' },
        },
        speech: {
          right: { srt: 15, sds: 98 },
          left: { srt: 15, sds: 99 },
        },
      },
    },
    // Patient 2: Nadia Al-Harthi (3 visits showing Progressive High-Frequency Sensorineural HL)
    {
      name: 'Nadia Al-Harthi',
      age: 64,
      phone: '773456789',
      gender: 'female',
      visitDate: '2024-03-10',
      doctorName: 'Dr. Layla Al-Qadhi',
      notes: 'Initial audiological assessment for mild difficulty understanding speech in noisy family gatherings. No tinnitus or vertigo.',
      diagnosis: 'Bilateral Mild Sensorineural Hearing Loss (Right PTA 33 dB HL, Left PTA 35 dB HL), sloping at high frequencies (4–8 kHz). Normal Type A tympanometry.',
      data: {
        ...INITIAL_DATA,
        right: {
          AC: { 250: 20, 500: 25, 1000: 35, 2000: 40, 4000: 50, 8000: 60 },
          BC: { 250: 20, 500: 25, 1000: 30, 2000: 40, 4000: 50, 8000: 55 },
        },
        left: {
          AC: { 250: 20, 500: 30, 1000: 35, 2000: 40, 4000: 55, 8000: 65 },
          BC: { 250: 20, 500: 25, 1000: 35, 2000: 40, 4000: 50, 8000: 60 },
        },
        tympanometry: {
          right: { type: 'A', pressure: 0, volume: 1.1, compliance: 0.7, gradient: 70, reflex1kIpsi: '85' },
          left: { type: 'A', pressure: -10, volume: 1.1, compliance: 0.68, gradient: 72, reflex1kIpsi: '85' },
        },
        speech: {
          right: { srt: 35, sds: 86 },
          left: { srt: 35, sds: 84 },
        },
      },
    },
    {
      name: 'Nadia Al-Harthi',
      age: 64,
      phone: '773456789',
      gender: 'female',
      visitDate: '2024-09-22',
      doctorName: 'Dr. Layla Al-Qadhi',
      notes: '6-month follow-up: Patient reports increased difficulty with television volume and consonant clarity. Mild progression noted at 1k–4k Hz.',
      diagnosis: 'Right Ear: Progressed from Mild to Moderate Sensorineural Hearing Loss (PTA 43 dB HL). Left Ear: Progressed from Mild to Moderate Sensorineural Hearing Loss (PTA 47 dB HL). Hearing aid trial advised.',
      data: {
        ...INITIAL_DATA,
        right: {
          AC: { 250: 25, 500: 35, 1000: 45, 2000: 50, 4000: 60, 8000: 70 },
          BC: { 250: 25, 500: 35, 1000: 40, 2000: 50, 4000: 55, 8000: 65 },
        },
        left: {
          AC: { 250: 25, 500: 35, 1000: 50, 2000: 55, 4000: 65, 8000: 75 },
          BC: { 250: 25, 500: 35, 1000: 45, 2000: 50, 4000: 60, 8000: 70 },
        },
        tympanometry: {
          right: { type: 'A', pressure: -5, volume: 1.1, compliance: 0.65, gradient: 75, reflex1kIpsi: '90' },
          left: { type: 'A', pressure: -15, volume: 1.1, compliance: 0.65, gradient: 75, reflex1kIpsi: '90' },
        },
        speech: {
          right: { srt: 45, sds: 78 },
          left: { srt: 50, sds: 74 },
        },
      },
    },
    {
      name: 'Nadia Al-Harthi',
      age: 65,
      phone: '773456789',
      gender: 'female',
      visitDate: '2025-02-14',
      doctorName: 'Dr. Layla Al-Qadhi',
      notes: 'Annual review: Left ear high-frequency thresholds showed further 10 dB shift; right ear thresholds stable. Bilateral NAL-NL2 amplification programmed.',
      diagnosis: 'Right Ear: Stable Moderate Sensorineural Hearing Loss (PTA 45 dB HL). Left Ear: Progressed to Moderately Severe Sensorineural Hearing Loss (PTA 57 dB HL).',
      data: {
        ...INITIAL_DATA,
        right: {
          AC: { 250: 25, 500: 35, 1000: 45, 2000: 55, 4000: 65, 8000: 70 },
          BC: { 250: 25, 500: 35, 1000: 45, 2000: 50, 4000: 60, 8000: 65 },
        },
        left: {
          AC: { 250: 30, 500: 45, 1000: 60, 2000: 65, 4000: 75, 8000: 80 },
          BC: { 250: 30, 500: 45, 1000: 55, 2000: 60, 4000: 70, 8000: 75 },
        },
        tympanometry: {
          right: { type: 'A', pressure: 0, volume: 1.1, compliance: 0.65, gradient: 70, reflex1kIpsi: '95' },
          left: { type: 'A', pressure: -10, volume: 1.1, compliance: 0.62, gradient: 74, reflex1kIpsi: 'NR' },
        },
        speech: {
          right: { srt: 45, sds: 76 },
          left: { srt: 60, sds: 66 },
        },
      },
    },
  ];

  const handleSeedSampleLongitudinalCases = async () => {
    try {
      const sampleVisits = buildSampleLongitudinalVisits();
      for (const v of sampleVisits) {
        await localDB.savePatient(v);
      }
      localStorage.setItem('smart_audiometry_seeded_timeline_v1', 'true');
      await fetchPatients();
      showToast(
        lang === 'ar'
          ? 'تم تحميل سجلات الزيارات التتابعية النموذجية بنجاح'
          : 'Sample multi-visit longitudinal records loaded',
        'success'
      );
    } catch (err) {
      console.error('Failed to seed sample longitudinal cases', err);
    }
  };

  const handleAddPriorVisitForPatient = async (baseVisit: Patient) => {
    try {
      const baseDate = new Date(baseVisit.visitDate || new Date().toISOString().split('T')[0]);
      baseDate.setDate(baseDate.getDate() - 90);
      const priorDateStr = baseDate.toISOString().split('T')[0];

      const shift = (val: number, delta: number) => Math.max(-10, Math.min(115, (val || 0) + delta));
      const rAC = baseVisit.data?.right?.AC || INITIAL_DATA.right.AC;
      const lAC = baseVisit.data?.left?.AC || INITIAL_DATA.left.AC;
      const rBC = baseVisit.data?.right?.BC || INITIAL_DATA.right.BC;
      const lBC = baseVisit.data?.left?.BC || INITIAL_DATA.left.BC;

      const priorData: AudiometryData = {
        ...INITIAL_DATA,
        ...baseVisit.data,
        right: {
          AC: {
            250: shift(rAC[250], 15),
            500: shift(rAC[500], 15),
            1000: shift(rAC[1000], 15),
            2000: shift(rAC[2000], 10),
            4000: shift(rAC[4000], 10),
            8000: shift(rAC[8000], 10),
          },
          BC: { ...rBC },
        },
        left: {
          AC: {
            250: shift(lAC[250], 10),
            500: shift(lAC[500], 15),
            1000: shift(lAC[1000], 10),
            2000: shift(lAC[2000], 15),
            4000: shift(lAC[4000], 10),
            8000: shift(lAC[8000], 10),
          },
          BC: { ...lBC },
        },
        tympanometry: {
          right: {
            ...(baseVisit.data?.tympanometry?.right || INITIAL_DATA.tympanometry!.right),
            type: 'B',
            pressure: -210,
            compliance: 0.22,
          },
          left: {
            ...(baseVisit.data?.tympanometry?.left || INITIAL_DATA.tympanometry!.left),
            type: 'C',
            pressure: -165,
            compliance: 0.4,
          },
        },
      };

      const priorVisit: Partial<Patient> = {
        name: baseVisit.name,
        age: baseVisit.age,
        phone: baseVisit.phone,
        email: baseVisit.email,
        dob: baseVisit.dob,
        gender: baseVisit.gender,
        visitDate: priorDateStr,
        doctorName: baseVisit.doctorName || 'Dr. Audiologist',
        notes:
          lang === 'ar'
            ? 'الزيارة المرجعية السابقة قبل بدء الخطة العلاجية والمتابعة السمعية.'
            : 'Baseline clinical visit prior to medical intervention and follow-up.',
        data: priorData,
      };
      priorVisit.diagnosis = getLocalDiagnosis(priorVisit, lang);

      await localDB.savePatient(priorVisit);
      await fetchPatients();
      showToast(
        lang === 'ar'
          ? 'تمت إضافة الزيارة المرجعية السابقة للمقارنة الزمنية'
          : 'Prior baseline visit added to timeline',
        'success'
      );
    } catch (err) {
      console.error('Failed to add prior visit', err);
    }
  };

  const handleNewFollowUpVisit = (latestVisit: Patient) => {
    setFormData({
      name: latestVisit.name,
      dob: latestVisit.dob || '',
      email: latestVisit.email || '',
      age: latestVisit.age,
      phone: latestVisit.phone,
      gender: latestVisit.gender,
      visitDate: new Date().toISOString().split('T')[0],
      doctorName: latestVisit.doctorName || '',
      notes: '',
      ambientNoise: 0,
      data: latestVisit.data ? JSON.parse(JSON.stringify(latestVisit.data)) : INITIAL_DATA,
    });
    setFormErrors({});
    handleViewChange('new-patient');
  };

  const sortPatientsDesc = (list: Patient[]): Patient[] => {
    return [...list].sort((a, b) => {
      const timeA = new Date(a.visitDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.visitDate || b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  };

  const fetchPatients = async () => {
    try {
      let data = await localDB.getAllPatients();
      if (data.length === 0 && !localStorage.getItem('smart_audiometry_seeded_timeline_v1')) {
        const samples = buildSampleLongitudinalVisits();
        for (const s of samples) {
          await localDB.savePatient(s);
        }
        localStorage.setItem('smart_audiometry_seeded_timeline_v1', 'true');
        data = await localDB.getAllPatients();
      }
      setPatients(sortPatientsDesc(data));
    } catch (err) {
      console.error('Failed to fetch patients');
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name?.trim()) errors.name = t.errorNameRequired;
    if (!formData.age || formData.age <= 0) errors.age = t.errorAgeRequired;
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t.errorInvalidEmail;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePatient = async () => {
    if (!validateForm()) return;
    
    try {
      const finalFormData = { ...formData };
      await localDB.savePatient(finalFormData);
      
      fetchPatients();
      setCurrentView('patients');
      resetForm();
      showToast(t.saveSuccess);
    } catch (err) {
      console.error('Failed to save patient');
    }
  };

  const handleDeletePatient = async (id: string | number) => {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await localDB.deletePatient(id);
      fetchPatients();
      showToast(lang === 'en' ? 'Patient deleted' : 'تم حذف المريض');
    } catch (err) {
      console.error('Failed to delete patient');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      dob: '',
      email: '',
      age: 0,
      phone: '',
      visitDate: new Date().toISOString().split('T')[0],
      doctorName: '',
      notes: '',
      ambientNoise: 0,
      data: INITIAL_DATA
    });
    setFormErrors({});
  };

  const handleExportPatients = async () => {
    try {
      const pData = await localDB.getAllPatients();
      if (pData.length === 0) {
        showToast(lang === 'ar' ? 'لا يوجد بيانات للتصدير' : 'No data to export', 'error');
        return;
      }
      
      const headers = ['Name', 'Age', 'Phone', 'Visit Date', 'Diagnosis'];
      const rows = pData.map(p => [
        p.name,
        p.age,
        p.phone,
        p.visitDate,
        `"${(p.diagnosis || '').replace(/"/g, '""')}"`
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `patients_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isBackupProcessing, setIsBackupProcessing] = useState(false);
  const [backupImportMode, setBackupImportMode] = useState<'merge' | 'replace'>('merge');
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem('smart_audiometry_last_backup_date');
    } catch {
      return null;
    }
  });

  const handleExportBackup = async () => {
    setIsBackupProcessing(true);
    try {
      const backupPayload = await localDB.exportBackup();
      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const dateStamp = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `SmartAudiometry_Backup_${dateStamp}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const nowIso = new Date().toISOString();
      try {
        localStorage.setItem('smart_audiometry_last_backup_date', nowIso);
      } catch {}
      setLastBackupDate(nowIso);

      showToast(
        lang === 'ar'
          ? `تم تصدير النسخة الاحتياطية بنجاح (${backupPayload.patients.length} سجل مريض)`
          : `Backup exported successfully (${backupPayload.patients.length} patient records)`,
        'success'
      );
    } catch (error) {
      console.error('Backup export failed:', error);
      showToast(
        lang === 'ar' ? 'فشل تصدير النسخة الاحتياطية' : 'Failed to export backup file',
        'error'
      );
    } finally {
      setIsBackupProcessing(false);
    }
  };

  const handleTriggerImportBackup = () => {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
      backupFileInputRef.current.click();
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBackupProcessing(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await localDB.importBackup(parsed, backupImportMode);
      await loadSettings();
      await refreshData();

      showToast(
        lang === 'ar'
          ? `تم استيراد النسخة الاحتياطية بنجاح (${result.patientsCount} سجل مريض)`
          : `Backup imported successfully (${result.patientsCount} patient records restored)`,
        'success'
      );
    } catch (error) {
      console.error('Backup import failed:', error);
      showToast(
        lang === 'ar'
          ? 'ملف النسخة الاحتياطية غير صالح أو تالف. يرجى اختيار ملف JSON صحيح.'
          : 'Invalid or corrupted backup file. Please select a valid JSON backup.',
        'error'
      );
    } finally {
      setIsBackupProcessing(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmitFeedback = async () => {
    if (!formData.id) return;
    const fb = {
      ...feedback,
      createdAt: new Date().toISOString()
    };
    const updatedPatient = { ...formData, feedback: fb };
    await localDB.savePatient(updatedPatient);
    
    setFeedbackSubmitted(true);
    setPatients(prev => prev.map(p => p.id === formData.id ? { ...p, feedback: fb } : p));
    setFormData(updatedPatient);
  };

  const handleAIDiagnosis = async () => {
    if (!formData.name) {
      showToast(lang === 'ar' ? 'يرجى إدخال اسم المريض أولاً' : 'Please enter patient name first', 'error');
      return;
    }

    // Check subscription / trial limit
    if (!subscription.isActivated && subscription.trialReportsUsed >= TRIAL_MAX_REPORTS) {
      setIsActivationModalOpen(true);
      showToast(
        lang === 'ar'
          ? '⚠️ انتهت الفترة المجانية (3 تقارير). يرجى الاشتراك لتفعيل النظام.'
          : '⚠️ Free trial expired (3 reports). Please activate a subscription.',
        'error'
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast(
        lang === 'ar'
          ? '⚠️ لا يوجد اتصال بالإنترنت! يرجى الاتصال بالإنترنت لإجراء التحليل والتشخيص عبر نماذج الذكاء الاصطناعي مفتوحة المصدر.'
          : '⚠️ No internet connection! Please connect to the internet to run AI analysis and diagnosis.',
        'error'
      );
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const activeApiKey = geminiApiKey.trim() || getStoredGeminiApiKey();
      const activeModel = geminiModel || getStoredGeminiModel();

      const aiResult = await runClientAIDiagnosis(
        formData,
        lang,
        activeApiKey || undefined,
        activeModel
      );

      if (!aiResult || !aiResult.diagnosis || !aiResult.diagnosis.trim()) {
        throw new Error('NO_INTERNET_CONNECTION');
      }

      const diagnosis = aiResult.diagnosis.trim();
      let patientAdvice = formData.patientAdvice || '';
      try {
        const adviceResult = await runClientAIPatientAdvice(
          formData,
          lang,
          activeApiKey || undefined,
          activeModel
        );
        if (adviceResult.advice && adviceResult.advice.trim()) {
          patientAdvice = adviceResult.advice.trim();
        }
      } catch {
        // Keep existing advice if secondary call times out
      }

      setFormData(prev => {
        const updated = { ...prev, diagnosis, patientAdvice };
        if (updated.id) {
          localDB.savePatient(updated);
        }
        return updated;
      });

      // If user is in free trial, record report usage
      if (!subscription.isActivated) {
        await incrementTrialReportUsage();
        await refreshSubscriptionStatus();
      }

      showToast(
        lang === 'ar'
          ? 'تم إعداد التفسير السمعي المساعد. يرجى مراجعة التقرير مع اختصاصي السمعيات.'
          : 'AI-assisted audiology interpretation is ready. Please review it with an audiologist.',
        'success'
      );
    } catch (error) {
      const providerUnavailable = error instanceof Error && error.message === 'AI_PROVIDER_UNAVAILABLE';
      showToast(
        lang === 'ar'
          ? providerUnavailable
            ? 'تعذر الوصول إلى نموذج الذكاء الاصطناعي حالياً؛ لم يتم إنشاء تقرير تشخيصي. حاول مجدداً لاحقاً.'
            : '⚠️ لا يوجد اتصال بالإنترنت! يرجى الاتصال بالإنترنت لإجراء التحليل والتشخيص عبر نماذج الذكاء الاصطناعي.'
          : providerUnavailable
            ? 'The AI provider is currently unavailable; no diagnostic report was generated. Please try again later.'
            : '⚠️ No internet connection! Please connect to the internet to run AI analysis.',
        'error'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generatePDF = async (scope: 'all' | 'current' = 'all') => {
    setIsExportingPDF(true);
    
    // Page elements
    const page1 = document.getElementById('report-page-1');
    const page2 = document.getElementById('report-page-2');
    const page3 = document.getElementById('report-page-3');

    if (!page1 && !page2 && !page3) {
      showToast(lang === 'ar' ? 'تعذر العثور على صفحات التقرير' : 'Report pages not found in document', 'error');
      setIsExportingPDF(false);
      return null;
    }

    // Determine target elements based on requested scope & active tab
    const targets: HTMLElement[] = [];
    if (scope === 'current' && reportActiveTab !== 'all') {
      if (reportActiveTab === 'audiogram' && page1) targets.push(page1);
      else if (reportActiveTab === 'tympanometry' && page2) targets.push(page2);
      else if (reportActiveTab === 'diagnosis' && page3) targets.push(page3);
    } else {
      // 'all': export all available report pages
      if (page1) targets.push(page1);
      if (page2) targets.push(page2);
      if (page3 && formData.diagnosis) targets.push(page3);
    }

    // Fallback if no target was found
    if (targets.length === 0) {
      if (page1) targets.push(page1);
      if (page2) targets.push(page2);
    }

    // Store original styles and class states to guarantee full restoration
    const elementStates = targets.map(el => ({
      el,
      prevDisplay: el.style.display,
      wasHidden: el.classList.contains('hidden')
    }));

    try {
      // Temporarily reveal target pages so html2canvas can measure geometry and computed styles
      elementStates.forEach(({ el, wasHidden }) => {
        if (wasHidden) {
          el.classList.remove('hidden');
        }
        el.style.display = 'block';
      });

      // Brief delay to allow browser layout and font rendering pass
      await new Promise(resolve => setTimeout(resolve, 300));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      let pagesRendered = 0;

      for (let i = 0; i < targets.length; i++) {
        const targetEl = targets[i];
        try {
          const canvas = await html2canvas(targetEl, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1200
          });

          if (!canvas || canvas.width === 0 || canvas.height === 0) {
            console.warn(`Canvas for page ${i + 1} has zero dimensions, skipping.`);
            continue;
          }

          // Use JPEG to eliminate jsPDF checkSignature 'wrong PNG signature' errors and optimize file size
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          if (!imgData || !imgData.startsWith('data:image/jpeg') || imgData.length < 200) {
            console.warn(`Invalid image payload for page ${i + 1}, skipping.`);
            continue;
          }

          if (pagesRendered > 0) {
            pdf.addPage();
          }

          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          pagesRendered++;
        } catch (pageErr) {
          console.error(`Failed to capture page ${i + 1}:`, pageErr);
        }
      }

      if (pagesRendered === 0) {
        showToast(lang === 'ar' ? 'فشل تصدير التقرير، يرجى المحاولة ثانية' : 'Failed to export report, please retry', 'error');
        return null;
      }

      return pdf;
    } catch (err: any) {
      console.error('generatePDF error:', err);
      showToast(lang === 'ar' ? 'حدث خطأ أثناء إعداد ملف PDF' : 'Error generating PDF file', 'error');
      return null;
    } finally {
      // Always restore original styles
      elementStates.forEach(({ el, prevDisplay, wasHidden }) => {
        el.style.display = prevDisplay;
        if (wasHidden) {
          el.classList.add('hidden');
        }
      });
      setIsExportingPDF(false);
    }
  };

  const handlePrintPreview = async (scope: 'all' | 'current' | any = 'all') => {
    if (!subscription.isActivated && subscription.trialReportsUsed >= TRIAL_MAX_REPORTS) {
      setIsActivationModalOpen(true);
      showToast(
        lang === 'ar'
          ? '⚠️ انتهت الفترة المجانية (3 تقارير). يرجى الاشتراك لتفعيل النظام.'
          : '⚠️ Free trial expired (3 reports). Please activate a subscription.',
        'error'
      );
      return;
    }

    const validScope = scope === 'current' ? 'current' : 'all';
    try {
      const pdf = await generatePDF(validScope);
      if (pdf) {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setIsPreviewOpen(true);
      }
    } catch (e) {
      console.error('Print preview failed', e);
      showToast(lang === 'ar' ? 'فشل فتح معاينة الطباعة' : 'Failed to open print preview', 'error');
    }
  };

  const exportPDF = async (scope: 'all' | 'current' | any = 'all') => {
    if (!subscription.isActivated && subscription.trialReportsUsed >= TRIAL_MAX_REPORTS) {
      setIsActivationModalOpen(true);
      showToast(
        lang === 'ar'
          ? '⚠️ انتهت الفترة المجانية (3 تقارير). يرجى الاشتراك لتفعيل النظام.'
          : '⚠️ Free trial expired (3 reports). Please activate a subscription.',
        'error'
      );
      return;
    }

    const validScope = scope === 'current' ? 'current' : 'all';
    try {
      const pdf = await generatePDF(validScope);
      if (pdf) {
        const suffix = validScope === 'current' && reportActiveTab !== 'all' ? `_${reportActiveTab}` : '_Full_Report';
        pdf.save(`Audiology_Report_${formData.name || 'Patient'}${suffix}.pdf`);
        showToast(lang === 'ar' ? 'تم تنزيل ملف التقرير بنجاح' : 'Report downloaded successfully', 'success');
      }
    } catch (e) {
      console.error('Export PDF failed', e);
      showToast(lang === 'ar' ? 'فشل حفظ ملف PDF' : 'Failed to save PDF', 'error');
    }
  };

  const getDynamicTympanometryFindings = (patient: Partial<Patient>, currentLang: Language) => {
    const isArabic = currentLang === 'ar';
    const rTymp = patient.data?.tympanometry?.right;
    const lTymp = patient.data?.tympanometry?.left;

    const typeR = rTymp?.type || 'A';
    const typeL = lTymp?.type || 'A';

    const rRef1k = rTymp?.reflex1kIpsi || patient.data?.reflex?.right?.ipsi?.[1000];
    const lRef1k = lTymp?.reflex1kIpsi || patient.data?.reflex?.left?.ipsi?.[1000];

    if (isArabic) {
      let findings = `الأذن اليمنى: تخطيط ضغط الطبلة نمط (${typeR})، ضغط القمة (${rTymp?.pressure ?? 0} daPa)، مطاوعة (${rTymp?.compliance ?? 0} ml)، وحجم القناة (${rTymp?.volume ?? 0} ml). `;
      if (rRef1k) findings += `المنعكس الصوتي (1k Ipsi): ${rRef1k} dB HL. `;
      if (typeR === 'A') findings += 'المعاوقة وحركة الطبلة ضمن الحدود الطبيعية. ';
      else if (typeR === 'B') findings += 'يشير إلى انخفاض شديد في حركة الطبلة (غالباً ارتشاح سوائل في الأذن الوسطى OME أو انسداد). ';
      else if (typeR === 'C') findings += 'يشير إلى ضغط سلبي وخلل في تهوية قناة استاكيوس (Eustachian Tube Dysfunction). ';
      else if (typeR === 'As') findings += 'يشير إلى تصلب في سلسلة العظيمات أو تصلب الأذن (Otosclerosis). ';
      else if (typeR === 'Ad') findings += 'يشير إلى فرط حركة غشاء الطبلة أو انقطاع العظيمات السمعية. ';

      findings += `\nالأذن اليسرى: تخطيط ضغط الطبلة نمط (${typeL})، ضغط القمة (${lTymp?.pressure ?? 0} daPa)، مطاوعة (${lTymp?.compliance ?? 0} ml)، وحجم القناة (${lTymp?.volume ?? 0} ml). `;
      if (lRef1k) findings += `المنعكس الصوتي (1k Ipsi): ${lRef1k} dB HL. `;
      if (typeL === 'A') findings += 'المعاوقة وحركة الطبلة ضمن الحدود الطبيعية. ';
      else if (typeL === 'B') findings += 'يشير إلى ارتشاح سوائل في الأذن الوسطى أو تصلب الطبلة. ';
      else if (typeL === 'C') findings += 'يشير إلى ضغط سلبي وخلل في تهوية قناة استاكيوس. ';
      else if (typeL === 'As') findings += 'يشير إلى تصلب في سلسلة العظيمات. ';
      else if (typeL === 'Ad') findings += 'يشير إلى فرط في حركة غشاء الطبلة. ';

      return findings;
    } else {
      let findings = `Right Ear: Tympanogram Type (${typeR}), Peak Pressure (${rTymp?.pressure ?? 0} daPa), Compliance (${rTymp?.compliance ?? 0} ml), ECV (${rTymp?.volume ?? 0} ml). `;
      if (rRef1k) findings += `Acoustic Reflex (1k Ipsi): ${rRef1k} dB HL. `;
      if (typeR === 'A') findings += 'Middle ear admittance within normal limits. ';
      else if (typeR === 'B') findings += 'Consistent with middle ear effusion or reduced TM mobility. ';
      else if (typeR === 'C') findings += 'Indicates negative middle ear pressure / Eustachian tube dysfunction. ';
      else if (typeR === 'As') findings += 'Suggests reduced mobility / ossicular fixation. ';
      else if (typeR === 'Ad') findings += 'Suggests hypermobile TM / ossicular disarticulation. ';

      findings += `\nLeft Ear: Tympanogram Type (${typeL}), Peak Pressure (${lTymp?.pressure ?? 0} daPa), Compliance (${lTymp?.compliance ?? 0} ml), ECV (${lTymp?.volume ?? 0} ml). `;
      if (lRef1k) findings += `Acoustic Reflex (1k Ipsi): ${lRef1k} dB HL. `;
      if (typeL === 'A') findings += 'Middle ear admittance within normal limits. ';
      else if (typeL === 'B') findings += 'Consistent with middle ear effusion or reduced TM mobility. ';
      else if (typeL === 'C') findings += 'Indicates negative middle ear pressure. ';
      else if (typeL === 'As') findings += 'Suggests reduced mobility. ';
      else if (typeL === 'Ad') findings += 'Suggests hypermobility. ';

      return findings;
    }
  };

  const getDynamicRecommendations = (patient: Partial<Patient>, currentLang: Language) => {
    if (patient.notes && patient.notes.trim()) {
      return patient.notes;
    }
    if (!patient.data) {
      return currentLang === 'ar' 
        ? 'الفحص السريري وتخطيط السمع مكتمل. يوصى بالمتابعة الدورية.' 
        : 'Clinical examination and audiometry complete. Periodic follow-up recommended.';
    }
    try {
      const hearing = analyzeHearing(patient.data);
      const isArabic = currentLang === 'ar';
      const tr = translations[currentLang];
      const rDeg = tr[hearing.right.degree as keyof typeof tr] || hearing.right.degree;
      const lDeg = tr[hearing.left.degree as keyof typeof tr] || hearing.left.degree;
      const rType = tr[hearing.right.type as keyof typeof tr] || hearing.right.type;
      const lType = tr[hearing.left.type as keyof typeof tr] || hearing.left.type;
      const rTymp = patient.data.tympanometry?.right?.type || 'A';
      const lTymp = patient.data.tympanometry?.left?.type || 'A';

      if (isArabic) {
        let msg = `يُظهر التخطيط النغمي للأذن اليمنى عتبات سمعية بمعدل (${hearing.right.pta} dB) تتماشى مع ضعف سمع ${rType} بدرجة ${rDeg}، بينما تُظهر الأذن اليسرى عتبات بمعدل (${hearing.left.pta} dB) تتماشى مع ضعف سمع ${lType} بدرجة ${lDeg}. `;
        msg += `قياس ضغط الطبلة: الأذن اليمنى نمط (${rTymp})، والأذن اليسرى نمط (${lTymp}). `;
        if (hearing.right.pta > 25 || hearing.left.pta > 25) {
          if (hearing.right.type === 'conductiveHL' || hearing.left.type === 'conductiveHL' || rTymp === 'B' || lTymp === 'B') {
            msg += `يوصى باستشارة طبيب الأنف والأذن والحنجرة لتقييم تجويف الأذن الوسطى وتحديد العلاج الطبي أو الجراحي المناسب.`;
          } else {
            msg += `يوصى بمراجعة استشاري السمعيات لتقييم الاحتياج للمعينات السمعية الطبية والمتابعة السريرية الدورية.`;
          }
        } else {
          msg += `وظيفة السمع تقع ضمن الحدود الطبيعية بالجهتين. يُوصى بحماية السمع وتجنب التعرض للأصوات الصاخبة.`;
        }
        return msg;
      } else {
        let msg = `Pure-tone audiometry shows right ear PTA of (${hearing.right.pta} dB) consistent with ${rDeg} ${rType} hearing loss, while left ear PTA is (${hearing.left.pta} dB) consistent with ${lDeg} ${lType} hearing loss. `;
        msg += `Tympanometry: Right ear Type (${rTymp}), Left ear Type (${lTymp}). `;
        if (hearing.right.pta > 25 || hearing.left.pta > 25) {
          if (hearing.right.type === 'conductiveHL' || hearing.left.type === 'conductiveHL' || rTymp === 'B' || lTymp === 'B') {
            msg += `ENT specialist consultation recommended to evaluate middle ear pathology and formulate medical/surgical management.`;
          } else {
            msg += `Audiological consultation recommended for hearing aid candidacy and annual audiological monitoring.`;
          }
        } else {
          msg += `Hearing thresholds within normal limits bilaterally. Periodic hearing conservation advised.`;
        }
        return msg;
      }
    } catch (e) {
      return currentLang === 'ar' ? 'فحص السمع وتخطيط الطبلة مكتمل.' : 'Audiometry and tympanometry complete.';
    }
  };

  const filteredPatients = sortPatientsDesc(
    patients.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery))
    )
  );

  const analysis = formData.data ? analyzeHearing(formData.data) : null;
  const ampSimulation = formData.data ? simulateAmplification(formData.data, ampProfile) : null;

  const toggleLanguage = () => {
    const newLang = lang === 'en' ? 'ar' : 'en';
    setLang(newLang);
    localDB.setSetting('language', newLang);
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localDB.setSetting('darkMode', newMode);
  };

  const handleSignOut = async () => {
    if (confirm(lang === 'en' ? 'Are you sure you want to log out?' : 'هل أنت متأكد من تسجيل الخروج؟')) {
      setUser(null);
      setUserProfile(null);
      showToast(lang === 'en' ? 'Logged out' : 'تم تسجيل الخروج');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      await localDB.setSetting('language', lang);
      await localDB.setSetting('darkMode', isDarkMode);
      if (userProfile) {
        await localDB.setSetting('hospitalName', userProfile.hospitalName || '');
        await localDB.setSetting('hospitalAddress', userProfile.hospitalAddress || '');
        await localDB.setSetting('hospitalPhone', userProfile.hospitalPhone || '');
        await localDB.setSetting('hospitalLogo', userProfile.hospitalLogo || '');
      }
      showToast(t.saveSuccess);
    } catch (err) {
      showToast(lang === 'en' ? 'Failed to save settings' : 'فشل في حفظ الإعدادات', 'error');
    }
    setSettingsLoading(false);
  };
  const handleLogin = async () => {
    // Local mode automatically signed in
  };

  return (
    <div 
      className={`flex h-[100dvh] h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300 ${isRTL ? 'rtl' : 'ltr'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      translate="no"
    >
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 ${isRTL ? 'right-0' : 'left-0'} z-50 w-72 bg-white dark:bg-[#0c1322] border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-300 shadow-lg lg:shadow-none ${isRTL ? 'border-l' : 'border-r'} ${isSidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Activity size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                {lang === 'ar' ? 'سمارت أوديومتري' : 'Smart Audiometry'}
              </h1>
              <p className="text-[11px] font-mono font-medium text-teal-600 dark:text-teal-400">
                {lang === 'ar' ? 'المنظومة السريرية الذكية' : 'Clinical Audiology Suite'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation Categories */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {/* Group 1: Clinical Operations */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 px-3 block">
              {lang === 'ar' ? 'الفحوصات السريرية' : 'Clinical Workflow'}
            </span>
            <button 
              onClick={() => handleViewChange('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'dashboard' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard size={18} className={currentView === 'dashboard' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
              <span>{t.dashboard}</span>
            </button>
            <button 
              onClick={() => handleViewChange('patients')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'patients' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Users size={18} className={currentView === 'patients' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
              <span>{t.patients}</span>
            </button>
            <button 
              id="nav-new-analysis"
              onClick={() => { resetForm(); handleViewChange('new-patient'); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'new-patient' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <UserPlus size={18} className={currentView === 'new-patient' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
              <span>{t.newAnalysis}</span>
            </button>
            <button 
              onClick={() => handleViewChange('noise-check')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'noise-check' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Mic size={18} className={currentView === 'noise-check' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
              <span>{t.noiseCheck}</span>
            </button>
          </div>

          {/* Group 2: Clinic & Support */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 px-3 block">
              {lang === 'ar' ? 'إدارة العيادة' : 'Administration'}
            </span>
            <button 
              onClick={() => handleViewChange('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'settings' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Settings size={18} className={currentView === 'settings' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} />
              <span>{lang === 'en' ? 'Clinic Settings' : 'إعدادات العيادة'}</span>
            </button>
            <button 
              onClick={() => { setIsSidebarOpen(false); setIsActivationModalOpen(true); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-teal-700 dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/60 transition-all shadow-xs"
            >
              <Key size={18} className="text-teal-600 dark:text-teal-400" />
              <span>{lang === 'ar' ? 'تفعيل النظام والاشتراكات 🔑' : 'Activate & Subscriptions 🔑'}</span>
            </button>
            <button 
              onClick={handleExportPatients}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
            >
              <Download size={18} className="text-slate-400" />
              <span>{t.exportData}</span>
            </button>
            <button 
              onClick={() => setShowTutorial(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all"
            >
              <HelpCircle size={18} className="text-slate-400" />
              <span>{lang === 'ar' ? 'دليل الاستخدام' : 'User Guide'}</span>
            </button>
          </div>
        </div>

        {/* System & Database Status Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <div>
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{t.secureOnline}</p>
                <p className="text-[10px] text-slate-400 font-mono">EMR IndexedDB Ready</p>
              </div>
            </div>
            <Shield size={16} className="text-teal-600 dark:text-teal-400" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden transition-all duration-300 w-full min-w-0">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-[#0c1322] border-b border-slate-200/80 dark:border-slate-800/80 px-4 lg:px-8 flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Menu size={22} />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {currentView === 'dashboard' && (lang === 'ar' ? 'لوحة المعلومات السريرية' : 'Clinical Dashboard')}
                {currentView === 'patients' && t.patientDatabase}
                {currentView === 'new-patient' && (formData.id ? t.editAnalysis : (lang === 'ar' ? 'فحص سريري جديد' : 'New Clinical Examination'))}
                {currentView === 'analysis' && t.diagnosticReport}
                {currentView === 'settings' && t.advancedSettings}
                {currentView === 'noise-check' && t.noiseCheck}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick New Patient CTA (if not already on new-patient view) */}
            {currentView !== 'new-patient' && (
              <button
                onClick={() => { resetForm(); handleViewChange('new-patient'); }}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-500 font-semibold text-xs shadow-xs transition-all"
              >
                <Plus size={15} />
                <span>{t.newAnalysis}</span>
              </button>
            )}

            {/* Room noise indicator */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button 
                onClick={toggleNoiseMonitoring}
                className={`p-2 rounded-xl transition-all active:scale-95 touch-manipulation ${
                  isNoiseMonitoring 
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={isNoiseMonitoring ? t.stopNoiseCheck : t.startNoiseCheck}
              >
                {isNoiseMonitoring ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <div className="hidden sm:block">
                <LiveNoiseIndicator 
                  level={currentNoiseLevel} 
                  isActive={isNoiseMonitoring} 
                  threshold={30} 
                  lang={lang} 
                />
              </div>
            </div>

            {/* Subscription / Activation Status Badge */}
            <button
              onClick={() => setIsActivationModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 touch-manipulation ${
                subscription.isActivated
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : subscription.trialExpired
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}
              title={lang === 'ar' ? 'إدارة الاشتراك والتفعيل' : 'Subscription & Activation'}
            >
              <Key size={14} className={subscription.isActivated ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
              <span className="hidden sm:inline">
                {subscription.isActivated
                  ? (lang === 'ar' ? `مفعّل (${subscription.plan === 'yearly' ? 'سنوي' : subscription.plan === 'monthly' ? 'شهري' : 'دائم'})` : 'Active Pro')
                  : subscription.trialExpired
                  ? (lang === 'ar' ? 'انتهت التجربة (تفعيل)' : 'Trial Expired')
                  : (lang === 'ar' ? `تجريبي (${subscription.trialReportsUsed}/${TRIAL_MAX_REPORTS})` : `Trial (${subscription.trialReportsUsed}/${TRIAL_MAX_REPORTS})`)}
              </span>
            </button>

            {/* Dark Mode Switcher */}
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              title={isDarkMode ? t.lightMode : t.darkMode}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Language Switcher */}
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs font-bold font-mono"
            >
              <Languages size={15} className="text-teal-600 dark:text-teal-400" />
              <span>{lang === 'en' ? 'AR' : 'EN'}</span>
            </button>

            {/* Search Input */}
            <div className="relative hidden xl:block">
              <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} size={16} />
              <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                className={`${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-teal-500 rounded-xl text-xs outline-none transition-all w-52 dark:text-white`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 0 && currentView !== 'patients') {
                    handleViewChange('patients');
                  }
                }}
              />
            </div>

            {/* Doctor Profile Pill */}
            <div className="flex items-center gap-2 ps-2 border-s border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'Dr'}
              </div>
              <div className="hidden lg:block text-start">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {userProfile?.displayName || 'Dr. Audiologist'}
                </p>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">
                  {userProfile?.hospitalName || 'Audiology Clinic'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 max-w-7xl mx-auto"
              >
                {/* Clinical Welcome Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-teal-800/30 shadow-lg relative overflow-hidden">
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-500/30">
                        <Activity size={14} />
                        <span>{lang === 'ar' ? 'نظام أوديومتري طبي معتمد' : 'Clinical Audiometry Suite'}</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                        {lang === 'ar' ? `مرحباً بك، د. ${userProfile?.displayName || 'المختص'}` : `Welcome, Dr. ${userProfile?.displayName || 'Specialist'}`}
                      </h3>
                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                        {lang === 'ar' 
                          ? 'إجراء تخطيط السمع النغمي (AC/BC)، قياس المعاوقة والضغط، اختبار تمييز الكلام، وتحليل الذكاء الاصطناعي مع حفظ السجلات السريرية.' 
                          : 'Conduct pure-tone testing (AC/BC), tympanometric compliance, speech discrimination, and clinical AI analysis.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => { resetForm(); handleViewChange('new-patient'); }}
                        className="px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center gap-2"
                      >
                        <UserPlus size={18} />
                        <span>{t.newAnalysis}</span>
                      </button>
                      <button
                        onClick={() => handleViewChange('noise-check')}
                        className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 transition-all flex items-center gap-2"
                      >
                        <Mic size={18} />
                        <span>{t.noiseCheck}</span>
                      </button>
                    </div>
                  </div>

                  {/* Decorative background lines */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                </div>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Patients */}
                  <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-xs">
                    <div className="w-10 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3">
                      <Users size={20} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t.totalPatients}</p>
                    <p className="text-1xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {patients.length}
                    </p>
                  </div>

                  {/* Normal Hearing */}
                  <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-red-300/80 dark:border-slate-800 shadow-xs">
                    <div className="w-10 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                      <CheckCircle2 size={20} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t.normalHearing}</p>
                    <p className="text-2xl sm:text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                      {patients.filter(p => {
                        const diag = p.diagnosis?.toLowerCase() || '';
                        if (diag.includes('normal') || diag.includes('سليم') || diag.includes('طبيعي')) return true;
                        if (!p.data) return false;
                        try {
                          const a = analyzeHearing(p.data);
                          return a.right.type === 'normalHearing' && a.left.type === 'normalHearing';
                        } catch (e) { return false; }
                      }).length}
                    </p>
                  </div>

                  {/* Sensorineural HL */}
                  <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-green-300/80 dark:border-slate-800 shadow-xs">
                    <div className="w-10 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                      <Activity size={20} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t.sensorineural}</p>
                    <p className="text-1xl sm:text-2xl font-extrabold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                      {patients.filter(p => {
                        const diag = p.diagnosis?.toLowerCase() || '';
                        if (diag.includes('sensorineural') || diag.includes('عصبي')) return true;
                        if (!p.data) return false;
                        try {
                          const a = analyzeHearing(p.data);
                          return a.right.type === 'sensorineuralHL' || a.left.type === 'sensorineuralHL';
                        } catch (e) { return false; }
                      }).length}
                    </p>
                  </div>

                  {/* Conductive & Mixed HL */}
                  <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-blue-300/80 dark:border-slate-800 shadow-xs">
                    <div className="w-10 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                      <Radio size={20} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{lang === 'ar' ? 'فقدان توصيلي ومختلط' : 'Conductive & Mixed'}</p>
                    <p className="text-1xl sm:text-2xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                      {patients.filter(p => {
                        const diag = p.diagnosis?.toLowerCase() || '';
                        if (diag.includes('conductive') || diag.includes('توصيلي') || diag.includes('mixed') || diag.includes('مختلط')) return true;
                        if (!p.data) return false;
                        try {
                          const a = analyzeHearing(p.data);
                          return a.right.type === 'conductiveHL' || a.left.type === 'conductiveHL' || a.right.type === 'mixedHL' || a.left.type === 'mixedHL';
                        } catch (e) { return false; }
                      }).length}
                    </p>
                  </div>
                </div>

                {/* Middle Grid: Room Acoustic Compliance & Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Real-time Room Acoustics Card */}
                  <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                            {lang === 'ar' ? 'معايير صوت الغرفة العازلة' : 'Room Acoustic Compliance'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">ANSI S3.1</span>
                      </div>

                      <div className="space-y-2">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs text-slate-500">{lang === 'ar' ? 'المستوى الصوتي الحالي' : 'Live Room Sound Level'}</span>
                            <span className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 tabular-nums">
                              {isNoiseMonitoring ? `${currentNoiseLevel} dB SPL` : '-- dB'}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                            <div 
                              className={`h-full transition-all duration-300 ${currentNoiseLevel > 30 ? 'bg-rose-500' : 'bg-teal-500'}`}
                              style={{ width: `${Math.min(100, (currentNoiseLevel / 50) * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {currentNoiseLevel <= 30 ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 size={16} />
                              <span>{lang === 'ar' ? 'الغرفة مطابقة لمعايير الفحص السريري الدقيق' : 'Room is quiet and compliant for accurate testing'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
                              <AlertCircle size={16} />
                              <span>{lang === 'ar' ? 'مستوى الضجيج مرتفع قد يؤثر على عتبات 250 و 500 هرتز' : 'Noise may artifact 250 & 500 Hz thresholds'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                      <button
                        onClick={toggleNoiseMonitoring}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation ${
                          isNoiseMonitoring 
                            ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                            : 'bg-teal-600 hover:bg-teal-700 text-white'
                        }`}
                      >
                        {isNoiseMonitoring ? <MicOff size={15} /> : <Mic size={15} />}
                        <span>{isNoiseMonitoring ? (lang === 'ar' ? 'إيقاف الفحص' : 'Stop Monitor') : (lang === 'ar' ? 'فحص الضجيج الآن' : 'Check Acoustics')}</span>
                      </button>
                      <button
                        onClick={() => handleViewChange('noise-check')}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Clinical Checklist & Tasks */}
                  <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-teal-600 dark:text-teal-400" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {t.clinicalTasks}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-400">
                        {tasks.filter(tk => tk.completed).length} / {tasks.length}
                      </span>
                    </div>

                    <form onSubmit={handleAddTask} className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        placeholder={t.taskPlaceholder}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 outline-none dark:text-white"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                      />
                      <button 
                        type="submit"
                        className="px-3 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-xs font-bold"
                      >
                        <Plus size={16} />
                      </button>
                    </form>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {tasks.length === 0 ? (
                        <p className="text-center text-slate-400 py-6 text-xs italic">{t.noTasks}</p>
                      ) : (
                        tasks.map((task) => (
                          <div 
                            key={task.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                              task.completed 
                                ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60' 
                                : 'bg-white dark:bg-slate-850 border-slate-200/70 dark:border-slate-800 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button 
                                onClick={() => handleToggleTask(task)}
                                className={`shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-teal-600'}`}
                              >
                                {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>
                              <span className={`text-xs font-medium truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                {task.title}
                              </span>
                            </div>
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors p-1 shrink-0"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Clinical Scratchpad & Notes */}
                  <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-teal-600 dark:text-teal-400" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {lang === 'ar' ? 'ملاحظات سريرية سريعة' : 'Clinical Scratchpad'}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{notes.length} {lang === 'ar' ? 'ملاحظة' : 'notes'}</span>
                    </div>

                    <form onSubmit={handleAddNote} className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        placeholder={lang === 'ar' ? 'أضف تذكيراً أو ملاحظة سريعة...' : 'Record clinical note...'}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 outline-none dark:text-white"
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                      />
                      <button 
                        type="submit"
                        className="px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-800 text-xs font-bold"
                      >
                        <Save size={15} />
                      </button>
                    </form>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {notes.length === 0 ? (
                        <p className="text-center text-slate-400 py-6 text-xs italic">{lang === 'ar' ? 'لا توجد ملاحظات سريرية' : 'No clinical notes recorded'}</p>
                      ) : (
                        notes.map((note) => (
                          <div 
                            key={note.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-xs"
                          >
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate pe-2">
                              {note.content}
                            </span>
                            <button 
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-slate-300 hover:text-rose-500 transition-colors p-1 shrink-0"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Patients Table Preview */}
                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/40 dark:bg-slate-850/40">
                    <div className="flex items-center gap-2.5">
                      <Users size={18} className="text-teal-600 dark:text-teal-400" />
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                        {t.recentActivity}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleViewChange('patients')}
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <span>{lang === 'ar' ? 'عرض كافة المرضى' : 'View all patients'}</span>
                      <ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {patients.slice(0, 6).map((p, i) => {
                      let analysis = null;
                      if (p.data) {
                        try {
                          analysis = analyzeHearing(p.data);
                        } catch (e) {}
                      }

                      return (
                        <div 
                          key={p.id || i}
                          onClick={() => { setFormData(p); handleViewChange('analysis'); }}
                          className="flex items-center justify-between p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50 flex items-center justify-center font-bold text-sm">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {p.visitDate} • {p.age} {t.years} • {t.doctor} {p.doctorName || '---'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {analysis && (
                              <div className="hidden sm:flex items-center gap-2 font-mono text-xs">
                                <span className="text-red-600 font-bold bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-200/60 dark:border-red-900/40">
                                  R: {analysis.right.pta} dB
                                </span>
                                <span className="text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40">
                                  L: {analysis.left.pta} dB
                                </span>
                              </div>
                            )}
                            <ChevronRight className={`text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} size={18} />
                          </div>
                        </div>
                      );
                    })}
                    {patients.length === 0 && (
                      <div className="py-12 text-center text-slate-400 italic text-xs">
                        {lang === 'ar' ? 'لا يوجد مرضى مسجلين حتى الآن. ابدأ بإضافة فحص جديد.' : 'No patient records found. Start by creating a new examination.'}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'patients' && (
              <motion.div 
                key="patients"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 max-w-7xl mx-auto"
              >
                {/* Header Banner & Controls */}
                <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center font-bold">
                      {patientsSubView === 'timeline' ? <History size={22} /> : <Users size={22} />}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {patientsSubView === 'timeline' ? t.patientTimelineTitle : t.patientDatabase}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {patientsSubView === 'timeline'
                          ? t.patientTimelineSubtitle
                          : lang === 'ar'
                          ? `إجمالي السجلات المسجلة: ${patients.length} زيارة`
                          : `Total registered visit records: ${patients.length} records`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
                    {/* Segmented View Switcher: Chronological Timeline vs. Records Table */}
                    <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                      <button
                        type="button"
                        onClick={() => setPatientsSubView('timeline')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          patientsSubView === 'timeline'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <History size={15} />
                        <span>{t.timelineView}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatientsSubView('table')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          patientsSubView === 'table'
                            ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Users size={15} />
                        <span>{t.recordsTableView}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => { resetForm(); handleViewChange('new-patient'); }}
                        className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2"
                      >
                        <Plus size={16} />
                        <span>{t.newAnalysis}</span>
                      </button>
                      <button 
                        onClick={handleExportPatients}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-all flex items-center gap-1.5"
                      >
                        <Download size={15} />
                        <span>{t.exportData}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        disabled={isBackupProcessing}
                        className="px-3.5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Database size={15} />
                        <span>{lang === 'ar' ? 'تصدير نسخة احتياطية' : 'Export Backup'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerImportBackup}
                        disabled={isBackupProcessing}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Upload size={15} />
                        <span>{lang === 'ar' ? 'استيراد نسخة احتياطية' : 'Import Backup'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {patientsSubView === 'timeline' ? (
                  <PatientTimelineView
                    patients={patients}
                    lang={lang}
                    selectedPatientKey={selectedTimelinePatientKey}
                    onSelectPatientKey={setSelectedTimelinePatientKey}
                    onViewVisitReport={(visit) => {
                      setFormData(visit);
                      handleViewChange('analysis');
                    }}
                    onEditVisit={(visit) => {
                      setFormData(visit);
                      handleViewChange('new-patient');
                    }}
                    onDeleteVisit={(id) => handleDeletePatient(id)}
                    onNewFollowUpVisit={handleNewFollowUpVisit}
                    onAddPriorVisitForPatient={handleAddPriorVisitForPatient}
                    onSeedSampleLongitudinalCases={handleSeedSampleLongitudinalCases}
                  />
                ) : (
                  /* Patient Table Card */
                  <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {searchQuery ? `${lang === 'ar' ? 'نتائج البحث عن' : 'Results for'}: "${searchQuery}" (${filteredPatients.length})` : `${lang === 'ar' ? 'سجلات الفحص' : 'Medical Records'} (${patients.length})`}
                        </span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} size={15} />
                        <input 
                          type="text" 
                          placeholder={t.searchPlaceholder}
                          className={`w-full ${isRTL ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500 dark:text-white`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[750px]">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className={`px-5 py-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.patient}</th>
                            <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.phone}</th>
                            <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.age}</th>
                            <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.hearingProfile}</th>
                            <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.lastVisits}</th>
                            <th className={`px-5 py-3.5 ${isRTL ? 'text-left' : 'text-right'}`}>{t.actions}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-sm">
                          {filteredPatients.map((p) => {
                            const history = patients
                              .filter(hp => hp.name === p.name && hp.phone === p.phone)
                              .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                              .slice(0, 3);
                            
                            let analysis = null;
                            if (p.data) {
                              try {
                                analysis = analyzeHearing(p.data);
                              } catch (e) {}
                            }

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                <td 
                                  className="px-5 py-2 cursor-pointer group"
                                  onClick={() => {
                                    setSelectedTimelinePatientKey(getPatientIdentityKey(p));
                                    setPatientsSubView('timeline');
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50 flex items-center justify-center font-bold text-xs">
                                      {p.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                        {p.name}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                                        {p.visitDate}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-400">{p.phone || '---'}</td>
                                <td className="px-4 py-2 text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-400">{p.age} {t.years}</td>
                                <td className="px-4 py-2">
                                  {analysis ? (
                                    <div className="flex flex-col gap-1 font-mono tabular-nums text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                          R: {analysis.right.pta} dB ({t[analysis.right.degree as keyof typeof t] || analysis.right.degree})
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                          L: {analysis.left.pta} dB ({t[analysis.left.degree as keyof typeof t] || analysis.left.degree})
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">{t.noDiagnosis}</span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {history.map((h, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          setSelectedTimelinePatientKey(getPatientIdentityKey(p));
                                          setPatientsSubView('timeline');
                                        }}
                                        className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200/60 dark:border-slate-700/60 transition-colors"
                                      >
                                        {h.visitDate}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className={`px-5 py-2 ${isRTL ? 'text-left' : 'text-right'}`}>
                                  <div className="inline-flex items-center gap-1">
                                    <button 
                                      onClick={() => {
                                        setSelectedTimelinePatientKey(getPatientIdentityKey(p));
                                        setPatientsSubView('timeline');
                                      }}
                                      className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                                      title={t.timelineView}
                                    >
                                      <History size={17} />
                                    </button>
                                    <button 
                                      onClick={() => setSummaryPatientId(p.id!)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                                      title={t.viewSummary}
                                    >
                                      <Activity size={17} />
                                    </button>
                                    <button 
                                      onClick={() => { setFormData(p); handleViewChange('analysis'); }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                                      title={t.viewReport}
                                    >
                                      <Eye size={17} />
                                    </button>
                                    <button 
                                      onClick={() => { setFormData(p); handleViewChange('new-patient'); }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
                                      title={t.editAnalysis}
                                    >
                                      <FileText size={17} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeletePatient(p.id!)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                                      title={lang === 'ar' ? 'حذف' : 'Delete'}
                                    >
                                      <Trash2 size={17} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredPatients.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-400 italic text-xs">
                                {lang === 'ar' ? 'لم يتم العثور على أي مرضى يطابقون البحث.' : 'No patients match your search criteria.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {currentView === 'new-patient' && (
              <motion.div 
                key="new-patient"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-4 max-w-7xl mx-auto"
              >
                {/* Examination Header Banner */}
                <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center font-bold">
                      <Activity size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {formData.id ? (lang === 'ar' ? `تعديل فحص المريض: ${formData.name}` : `Edit Patient Exam: ${formData.name}`) : (lang === 'ar' ? 'جلسة فحص سريري جديدة' : 'New Clinical Examination Session')}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {lang === 'ar' ? 'تخطيط السمع النغمي الهوائي والعظمي، قياس ضغط الأذن، واختبارات الكلام' : 'Pure-tone AC/BC audiometry, acoustic immittance & speech testing'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSavePatient}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      <span>{t.saveRecord}</span>
                    </button>
                    <div className="flex items-center bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-xl p-0.5">
                      <select
                        value={geminiModel}
                        onChange={(e) => handleQuickModelChange(e.target.value)}
                        aria-label={lang === 'ar' ? 'نموذج الذكاء الاصطناعي للتشخيص' : 'AI Diagnostic Model'}
                        className="bg-transparent text-indigo-900 dark:text-indigo-200 font-mono text-[11px] font-bold px-2.5 py-2 rounded-lg outline-none cursor-pointer max-w-[185px] truncate"
                        dir="ltr"
                      >
                        <optgroup label={lang === 'ar' ? 'نماذج مفتوحة المصدر (مجانية)' : 'Free Open-Source Models'}>
                          {AI_MODELS.filter(m => m.provider === 'open-source').map(m => (
                            <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                              🆓 {m.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Google Gemini API">
                          {AI_MODELS.filter(m => m.provider === 'gemini').map(m => (
                            <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                              ✨ {m.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <button
                        onClick={handleAIDiagnosis}
                        disabled={isAnalyzing}
                        className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        title={
                          lang === 'ar'
                            ? `تحليل وتشخيص بالذكاء الاصطناعي (${getModelDisplayName(geminiModel)})`
                            : `AI Clinical Analysis & Diagnosis (${getModelDisplayName(geminiModel)})`
                        }
                      >
                        <BrainCircuit size={15} className={isAnalyzing ? 'animate-pulse text-amber-300' : ''} />
                        <span>
                          {isAnalyzing
                            ? t.analyzing
                            : lang === 'ar'
                            ? 'تحليل وتشخيص AI'
                            : 'AI Diagnose'}
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={() => handleViewChange('analysis')}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-all flex items-center gap-1.5"
                      title={t.diagnosticReport}
                    >
                      <FileText size={16} />
                      <span className="hidden md:inline">{t.diagnosticReport}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Patient Demographics & Clinic Info */}
                  <div id="patient-info-section" className="space-y-4">
                    <div className="bg-white dark:bg-[#111827] p-6 rounded-2xl border border-blue-300/80 dark:border-slate-800 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <UserCheck size={18} className="text-teal-600 dark:text-teal-400" />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{t.patientInfo}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">EMR Entry</span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                            {t.fullName} *
                          </label>
                          <input 
                            type="text" 
                            placeholder={lang === 'ar' ? 'اسم المريض الثلاثي' : 'Patient full name'}
                            className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${formErrors.name ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'} rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all`}
                            value={formData.name || ''}
                            onChange={(e) => {
                              setFormData({...formData, name: e.target.value});
                              if (formErrors.name) setFormErrors({...formErrors, name: ''});
                            }}
                          />
                          {formErrors.name && <p className="text-[10px] text-rose-500 mt-1 font-bold">{formErrors.name}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                              {t.dob}
                            </label>
                            <input 
                              type="date" 
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                              value={formData.dob || ''}
                              onChange={(e) => {
                                const dobVal = e.target.value;
                                let calculatedAge = formData.age || 0;
                                if (dobVal) {
                                  const diff = new Date().getTime() - new Date(dobVal).getTime();
                                  const ageYears = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
                                  if (!isNaN(ageYears) && ageYears >= 0) calculatedAge = ageYears;
                                }
                                setFormData({...formData, dob: dobVal, age: calculatedAge});
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                              {t.age} ({t.years}) *
                            </label>
                            <input 
                              type="number" 
                              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border ${formErrors.age ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'} rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-teal-500 dark:text-white`}
                              value={formData.age ?? 0}
                              onChange={(e) => {
                                setFormData({...formData, age: parseInt(e.target.value) || 0});
                                if (formErrors.age) setFormErrors({...formErrors, age: ''});
                              }}
                            />
                            {formErrors.age && <p className="text-[10px] text-rose-500 mt-1 font-bold">{formErrors.age}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                              {t.phone}
                            </label>
                            <input 
                              type="text" 
                              placeholder="05xxxxxxxx"
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                              value={formData.phone || ''}
                              onChange={(e) => {
                                const phone = e.target.value;
                                setFormData({...formData, phone});
                                if (phone.length >= 7) {
                                  const existing = patients.find(p => p.phone === phone);
                                  if (existing && existing.id !== formData.id) {
                                    setFormData(existing);
                                  }
                                }
                              }}
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                              {t.visitDate}
                            </label>
                            <input 
                              type="date" 
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                              value={formData.visitDate || new Date().toISOString().split('T')[0]}
                              onChange={(e) => setFormData({...formData, visitDate: e.target.value})}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                            {t.doctorName}
                          </label>
                          <input 
                            type="text" 
                            placeholder={userProfile?.displayName || 'Dr. Audiologist'}
                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                            value={formData.doctorName || ''}
                            onChange={(e) => setFormData({...formData, doctorName: e.target.value})}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                            {t.clinicalNotes}
                          </label>
                          <textarea 
                            rows={3}
                            placeholder={lang === 'ar' ? 'الشكوى الرئيسية، تاريخ الحالة، الفحص العياني للأذن...' : 'Chief complaint, otoscopy findings, history...'}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500 dark:text-white resize-none"
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Room Acoustics Calibrator */}
                    <NoiseMonitor 
                      lang={lang} 
                      isActive={isNoiseMonitoring}
                      onToggle={setIsNoiseMonitoring}
                      onNoiseLevelChange={(level) => {
                        setCurrentNoiseLevel(level);
                        setFormData(prev => ({ ...prev, ambientNoise: level }));
                      }}
                      threshold={30}
                    />
                  </div>

                  {/* Right 2 Columns: Audiometry Workstation Inputs & Live Charts */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Interactive Audiometry Data Entry Component */}
                    <div id="data-entry-section">
                      <AudiometryInput 
                        data={formData.data || INITIAL_DATA} 
                        onChange={(data) => setFormData({...formData, data})} 
                        lang={lang}
                      />
                    </div>

                    {/* Live Graphical Pure Tone Audiogram */}
                    <div id="audiogram-chart-section">
                      <AudiogramChart 
                        data={formData.data || INITIAL_DATA} 
                        lang={lang} 
                      />
                    </div>

                    {/* Tympanogram Curves */}
                    {formData.data?.tympanometry && (
                      <div id="tympanogram-chart-section">
                        <TympanogramChart 
                          data={formData.data.tympanometry} 
                          lang={lang} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'analysis' && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                {/* Actions Toolbar */}
                <div className="flex flex-col gap-3 bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                      <button 
                        onClick={() => handleViewChange('new-patient')}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ChevronRight size={16} className={isRTL ? '' : 'rotate-180'} />
                        <span>{t.backToEntry}</span>
                      </button>
                      <button 
                        onClick={() => { resetForm(); handleViewChange('new-patient'); }}
                        className="bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
                      >
                        <Plus size={16} />
                        <span>{t.newAnalysis}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end">
                      <div className="flex items-center bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-xl p-0.5">
                        <select
                          value={geminiModel}
                          onChange={(e) => handleQuickModelChange(e.target.value)}
                          aria-label={lang === 'ar' ? 'نموذج الذكاء الاصطناعي للتشخيص' : 'AI Diagnostic Model'}
                          className="bg-transparent text-indigo-900 dark:text-indigo-200 font-mono text-[11px] font-bold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer max-w-[185px] truncate"
                          dir="ltr"
                        >
                          <optgroup label={lang === 'ar' ? 'نماذج مفتوحة المصدر (مجانية)' : 'Free Open-Source Models'}>
                            {AI_MODELS.filter(m => m.provider === 'open-source').map(m => (
                              <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                🆓 {m.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Google Gemini API">
                            {AI_MODELS.filter(m => m.provider === 'gemini').map(m => (
                              <option key={m.id} value={m.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                ✨ {m.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <button 
                          onClick={handleAIDiagnosis}
                          disabled={isAnalyzing}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                          title={
                            lang === 'ar'
                              ? `تحليل وتشخيص بالذكاء الاصطناعي (${getModelDisplayName(geminiModel)})`
                              : `AI Clinical Analysis (${getModelDisplayName(geminiModel)})`
                          }
                        >
                          <BrainCircuit size={15} className={isAnalyzing ? 'animate-pulse text-amber-300' : ''} />
                          <span>
                            {isAnalyzing 
                              ? t.analyzing 
                              : (lang === 'ar' ? 'تحليل وتشخيص AI' : 'AI Diagnose')}
                          </span>
                        </button>
                      </div>
                      <button 
                        onClick={() => handlePrintPreview('all')}
                        disabled={isExportingPDF}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                        title={lang === 'ar' ? 'معاينة وطباعة التقرير' : 'Preview & Print Report'}
                      >
                        <Printer size={16} />
                        <span>{isExportingPDF ? (lang === 'ar' ? 'جاري التحضير...' : 'Preparing...') : t.printReport}</span>
                      </button>
                      <button 
                        onClick={() => exportPDF('all')}
                        disabled={isExportingPDF}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                        title={lang === 'ar' ? 'تحميل التقرير الكامل كملف PDF' : 'Download Complete PDF Report'}
                      >
                        <Save size={16} />
                        <span>
                          {isExportingPDF 
                            ? (lang === 'ar' ? 'جاري التصدير...' : 'Exporting...') 
                            : (reportActiveTab === 'all' ? t.download : (lang === 'ar' ? 'تحميل التقرير الكامل' : 'Download Full PDF'))}
                        </span>
                      </button>
                      {reportActiveTab !== 'all' && (
                        <button 
                          onClick={() => exportPDF('current')}
                          disabled={isExportingPDF}
                          className="bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-300/80 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/60 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                          title={lang === 'ar' ? 'تحميل الصفحة المحددة حالياً كملف PDF' : 'Download Current View Page as PDF'}
                        >
                          <Download size={15} />
                          <span>
                            {lang === 'ar' 
                              ? (reportActiveTab === 'tympanometry' ? 'تحميل ضغط الطبلة فقط' : (reportActiveTab === 'audiogram' ? 'تحميل تخطيط السمع فقط' : 'تحميل التشخيص فقط'))
                              : (reportActiveTab === 'tympanometry' ? 'Tympanometry Only' : (reportActiveTab === 'audiogram' ? 'Audiogram Only' : 'Diagnosis Only'))}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub-Tabs View Switcher */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden overflow-x-auto">
                    <span className="text-[11px] font-bold text-slate-400 px-2 shrink-0">
                      {lang === 'ar' ? 'معاينة التقرير:' : 'View Mode:'}
                    </span>
                    <button
                      onClick={() => setReportActiveTab('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        reportActiveTab === 'all'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'ar' ? '📑 كافة الصفحات' : '📑 All Pages'}
                    </button>
                    <button
                      onClick={() => setReportActiveTab('audiogram')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        reportActiveTab === 'audiogram'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'ar' ? '1. تقرير تخطيط السمع (Audiogram)' : '1. Audiogram Report'}
                    </button>
                    <button
                      onClick={() => setReportActiveTab('tympanometry')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        reportActiveTab === 'tympanometry'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'ar' ? '2. تقرير ضغط الطبلة (Tympanometry)' : '2. Tympanometry Report'}
                    </button>
                    {formData.diagnosis && (
                      <button
                        onClick={() => setReportActiveTab('diagnosis')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                          reportActiveTab === 'diagnosis'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {lang === 'ar' ? '3. التحليل التشخيصي المفصل' : '3. Clinical Diagnosis'}
                      </button>
                    )}
                  </div>

                  {/* Hearing Aid Amplification & Speech Recognition Simulator Toggle Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 print:hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/90 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/70">
                      <div className="flex items-center justify-between md:justify-start gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                            isAmpSimEnabled
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            <Volume2 size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {lang === 'ar'
                                  ? 'محاكاة تضخيم السماعات الطبية وتمييز الكلام (SDS %)'
                                  : 'Hearing Aid Amplification & Speech Recognition Simulator'}
                              </h4>
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                                isAmpSimEnabled
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800'
                                  : 'bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                              }`}>
                                {isAmpSimEnabled
                                  ? (lang === 'ar' ? 'مُفعّل (Aided)' : 'ACTIVE (Aided)')
                                  : (lang === 'ar' ? 'بدون سماعة (Unaided)' : 'OFF (Unaided)')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {lang === 'ar'
                                ? 'محاكاة تأثير درجات التضخيم السمعي المختلفة على نسبة تمييز الكلام (SDS %) وعتبات السمع الحالية للمريض'
                                : 'Simulate how different degrees of hearing aid amplification improve speech recognition (SDS %) from pure-tone thresholds'}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isAmpSimEnabled}
                          onClick={() => setIsAmpSimEnabled(prev => !prev)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isAmpSimEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                          title={lang === 'ar' ? 'تفعيل / إيقاف محاكاة السماعة الطبية' : 'Toggle Hearing Aid Amplification Simulation'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              isAmpSimEnabled
                                ? (isRTL ? '-translate-x-5' : 'translate-x-5')
                                : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Amplification Profile Degree Selector */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase px-1">
                          {lang === 'ar' ? 'درجة التضخيم:' : 'Amplification Profile:'}
                        </span>
                        {([
                          {
                            id: 'mild' as AmplificationProfileId,
                            labelAr: 'خفيف / مريح (Comfort)',
                            labelEn: 'Mild / Comfort (~35%)',
                            descAr: 'كسب محافظ للضعف البسيط والمتوسط',
                            descEn: 'Conservative gain for mild-moderate loss',
                          },
                          {
                            id: 'standard' as AmplificationProfileId,
                            labelAr: 'قياسي متوازن (NAL-NL2)',
                            labelEn: 'Standard (NAL-NL2 ~50%)',
                            descAr: 'معادلة NAL-NL2 المثالية لوضوح الكلام',
                            descEn: 'NAL-NL2 speech intelligibility prescription',
                          },
                          {
                            id: 'power' as AmplificationProfileId,
                            labelAr: 'عالي القوة (DSL v5 Power)',
                            labelEn: 'High-Power (DSL v5 ~68%)',
                            descAr: 'أقصى مسموعية للحروف الساكنة والضعف الشديد',
                            descEn: 'Maximum audibility for severe/high-freq loss',
                          },
                        ]).map(prof => {
                          const isSelected = isAmpSimEnabled && ampProfile === prof.id;
                          return (
                            <button
                              key={prof.id}
                              type="button"
                              onClick={() => {
                                setAmpProfile(prof.id);
                                if (!isAmpSimEnabled) setIsAmpSimEnabled(true);
                              }}
                              title={lang === 'ar' ? prof.descAr : prof.descEn}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                              }`}
                            >
                              {lang === 'ar' ? prof.labelAr : prof.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive Simulation Results Panel when Toggle is ON */}
                    {isAmpSimEnabled && ampSimulation && (
                      <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/70 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200/60 dark:border-emerald-800/50">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
                              {lang === 'ar'
                                ? `نتائج المحاكاة السمعية (${ampProfile === 'mild' ? 'النمط الخفيف المريح - Comfort Gain' : ampProfile === 'standard' ? 'المعادلة القياسية - NAL-NL2' : 'النمط عالي القوة - DSL v5 Max Audibility'})`
                                : `Simulated Speech Recognition & Audibility (${ampProfile === 'mild' ? 'Mild Comfort Profile' : ampProfile === 'standard' ? 'NAL-NL2 Standard Prescription' : 'DSL v5 High-Power Profile'})`}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {lang === 'ar'
                              ? 'تُعرض المنحنيات المُحاكاة [A ◆] مباشرة على مخطط السمع أدناه'
                              : 'Aided thresholds [A ◆] are plotted live on the audiogram below'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Right Ear Simulation Card */}
                          <div className="bg-white dark:bg-slate-900/90 rounded-xl p-3.5 border border-red-200/80 dark:border-red-900/50 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                <span className="text-xs font-black text-red-700 dark:text-red-400">
                                  {lang === 'ar' ? 'الأذن اليمنى (Right Ear - AD)' : 'Right Ear (AD)'}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60">
                                {ampSimulation.right.sdsImprovement > 0
                                  ? `+${ampSimulation.right.sdsImprovement}% ${lang === 'ar' ? 'تحسن تمييز الكلام' : 'SDS Gain'}`
                                  : (lang === 'ar' ? 'ضمن الحد الأقصى السمعي' : 'At Optimal Ceiling')}
                              </span>
                            </div>

                            {/* SDS Recognition Score Bar Comparison */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-600 dark:text-slate-400">
                                  {lang === 'ar' ? 'تمييز الكلام (SDS / WRS):' : 'Speech Recognition (SDS):'}
                                  {ampSimulation.right.isBaselineEstimated && (
                                    <span className="text-[9px] text-slate-400 font-normal ms-1">
                                      ({lang === 'ar' ? 'مقدر من العتبات' : 'est. from PTA'})
                                    </span>
                                  )}
                                </span>
                                <div className="font-mono font-black text-xs flex items-center gap-1.5">
                                  <span className="text-slate-500 line-through">{ampSimulation.right.unaidedSDS}%</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">{ampSimulation.right.aidedSDS}%</span>
                                </div>
                              </div>
                              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                                <div
                                  className="h-full bg-slate-300 dark:bg-slate-600 rounded-full absolute top-0 left-0 transition-all duration-300"
                                  style={{ width: `${ampSimulation.right.unaidedSDS}%` }}
                                />
                                <div
                                  className="h-full bg-emerald-500/85 rounded-full absolute top-0 left-0 transition-all duration-500"
                                  style={{ width: `${ampSimulation.right.aidedSDS}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] font-mono text-slate-400">
                                <span>{lang === 'ar' ? `بدون سماعة: ${ampSimulation.right.unaidedSDS}%` : `Unaided: ${ampSimulation.right.unaidedSDS}%`}</span>
                                <span>{lang === 'ar' ? `الحد القوقعي الأقصى (PB Max): ${ampSimulation.right.pbMaxCeiling}%` : `Cochlear Reserve (PB Max): ${ampSimulation.right.pbMaxCeiling}%`}</span>
                              </div>
                            </div>

                            {/* Key Metrics Strip */}
                            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center pt-1">
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700">
                                <span className="text-[9px] text-slate-400 block font-sans">{lang === 'ar' ? 'عتبة الكلام SRT' : 'SRT (dB HL)'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{ampSimulation.right.unaidedSRT}</span>
                                <span className="text-slate-400 mx-0.5">→</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{ampSimulation.right.aidedSRT} dB</span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700">
                                <span className="text-[9px] text-slate-400 block font-sans">{lang === 'ar' ? 'متوسط النغمات PTA' : 'PTA (500-2k)'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{ampSimulation.right.unaidedPTA}</span>
                                <span className="text-slate-400 mx-0.5">→</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{ampSimulation.right.aidedPTA} dB</span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700">
                                <span className="text-[9px] text-slate-400 block font-sans">{lang === 'ar' ? 'مؤشر المسموعية SII' : 'Audibility (SII)'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{ampSimulation.right.unaidedSII}%</span>
                                <span className="text-slate-400 mx-0.5">→</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{ampSimulation.right.aidedSII}%</span>
                              </div>
                            </div>

                            {/* Frequency Functional Gain Mini-Table */}
                            <div className="grid grid-cols-6 gap-1 text-[9px] font-mono text-center pt-1">
                              {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                <div key={f} className="p-1 rounded bg-red-50/40 dark:bg-slate-800 border border-red-100 dark:border-slate-700">
                                  <span className="text-[8px] text-slate-400 block">{f >= 1000 ? `${f / 1000}k` : f}</span>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{ampSimulation.right.aidedAC[f]}</span>
                                  <span className="text-[8px] text-emerald-600/80 block">
                                    {ampSimulation.right.functionalGain[f] > 0 ? `+${ampSimulation.right.functionalGain[f]}dB` : '0dB'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Left Ear Simulation Card */}
                          <div className="bg-white dark:bg-slate-900/90 rounded-xl p-3.5 border border-blue-200/80 dark:border-blue-900/50 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <span className="text-xs font-black text-blue-700 dark:text-blue-400">
                                  {lang === 'ar' ? 'الأذن اليسرى (Left Ear - AS)' : 'Left Ear (AS)'}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60">
                                {ampSimulation.left.sdsImprovement > 0
                                  ? `+${ampSimulation.left.sdsImprovement}% ${lang === 'ar' ? 'تحسن تمييز الكلام' : 'SDS Gain'}`
                                  : (lang === 'ar' ? 'ضمن الحد الأقصى السمعي' : 'At Optimal Ceiling')}
                              </span>
                            </div>

                            {/* SDS Recognition Score Bar Comparison */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-600 dark:text-slate-400">
                                  {lang === 'ar' ? 'تمييز الكلام (SDS / WRS):' : 'Speech Recognition (SDS):'}
                                  {ampSimulation.left.isBaselineEstimated && (
                                    <span className="text-[9px] text-slate-400 font-normal ms-1">
                                      ({lang === 'ar' ? 'مقدر من العتبات' : 'est. from PTA'})
                                    </span>
                                  )}
                                </span>
                                <div className="font-mono font-black text-xs flex items-center gap-1.5">
                                  <span className="text-slate-500 line-through">{ampSimulation.left.unaidedSDS}%</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">{ampSimulation.left.aidedSDS}%</span>
                                </div>
                              </div>
                              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                                <div
                                  className="h-full bg-slate-300 dark:bg-slate-600 rounded-full absolute top-0 left-0 transition-all duration-300"
                                  style={{ width: `${ampSimulation.left.unaidedSDS}%` }}
                                />
                                <div
                                  className="h-full bg-teal-500/85 rounded-full absolute top-0 left-0 transition-all duration-500"
                                  style={{ width: `${ampSimulation.left.aidedSDS}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] font-mono text-slate-400">
                                <span>{lang === 'ar' ? `بدون سماعة: ${ampSimulation.left.unaidedSDS}%` : `Unaided: ${ampSimulation.left.unaidedSDS}%`}</span>
                                <span>{lang === 'ar' ? `الحد القوقعي الأقصى (PB Max): ${ampSimulation.left.pbMaxCeiling}%` : `Cochlear Reserve (PB Max): ${ampSimulation.left.pbMaxCeiling}%`}</span>
                              </div>
                            </div>

                            {/* Key Metrics Strip */}
                            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center pt-1">
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700">
                                <span className="text-[9px] text-slate-400 block font-sans">{lang === 'ar' ? 'عتبة الكلام SRT' : 'SRT (dB HL)'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{ampSimulation.left.unaidedSRT}</span>
                                <span className="text-slate-400 mx-0.5">→</span>
                                <span className="font-black text-teal-600 dark:text-teal-400">{ampSimulation.left.aidedSRT} dB</span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700">
                                <span className="text-[9px] text-slate-400 block font-sans">{lang === 'ar' ? 'متوسط النغمات PTA' : 'PTA (500-2k)'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{ampSimulation.left.unaidedPTA}</span>
                                <span className="text-slate-400 mx-0.5">→</span>
                                <span className="font-black text-teal-600 dark:text-teal-400">{ampSimulation.left.aidedPTA} dB</span>
                              </div>
                              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700">
                                <span className="text-[9px] text-slate-400 block font-sans">{lang === 'ar' ? 'مؤشر المسموعية SII' : 'Audibility (SII)'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{ampSimulation.left.unaidedSII}%</span>
                                <span className="text-slate-400 mx-0.5">→</span>
                                <span className="font-black text-teal-600 dark:text-teal-400">{ampSimulation.left.aidedSII}%</span>
                              </div>
                            </div>

                            {/* Frequency Functional Gain Mini-Table */}
                            <div className="grid grid-cols-6 gap-1 text-[9px] font-mono text-center pt-1">
                              {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                <div key={f} className="p-1 rounded bg-blue-50/40 dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
                                  <span className="text-[8px] text-slate-400 block">{f >= 1000 ? `${f / 1000}k` : f}</span>
                                  <span className="font-bold text-teal-700 dark:text-teal-400">{ampSimulation.left.aidedAC[f]}</span>
                                  <span className="text-[8px] text-teal-600/80 block">
                                    {ampSimulation.left.functionalGain[f] > 0 ? `+${ampSimulation.left.functionalGain[f]}dB` : '0dB'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {viewingUsers.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <div className="flex -space-x-2">
                      {viewingUsers.map((u) => (
                        <div 
                          key={u.uid} 
                          className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-xs font-bold"
                          title={u.displayName}
                        >
                          {u.displayName?.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      {viewingUsers.length === 1 
                        ? (lang === 'ar' ? `${viewingUsers[0].displayName} يشاهد الآن` : `${viewingUsers[0].displayName} is viewing now`)
                        : (lang === 'ar' ? `${viewingUsers.length} أشخاص يشاهدون الآن` : `${viewingUsers.length} people are viewing now`)}
                    </span>
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-2 h-2 rounded-full bg-emerald-500 ml-auto"
                    />
                  </div>
                )}

                <div className="space-y-8 print:space-y-0 overflow-x-auto pb-4">
                  {/* ========================================================
                      PAGE 1: PURE-TONE AUDIOMETRY REPORT (تقرير تخطيط السمع)
                      Features TWO distinct side-by-side charts: Right Ear & Left Ear
                      ======================================================== */}
                  <div 
                    id="report-page-1" 
                    className={`bg-white p-8 space-y-4 transition-colors min-h-[1100px] relative text-slate-900 w-[820px] mx-auto shadow-2xl print:shadow-none font-sans ${
                      reportActiveTab !== 'all' && reportActiveTab !== 'audiogram' ? 'hidden print:block' : 'block'
                    }`} 
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <div className="border-2 border-slate-300 rounded-[2rem] p-5 relative min-h-[1050px] flex flex-col justify-between">
                      <div>
                        {/* Top Letterhead with Hospital Logo & Brand Title */}
                        <div className="flex justify-between items-center mb-5 px-3">
                          <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-white border-2 border-teal-100 rounded-2xl flex items-center justify-center p-2 shadow-xs overflow-hidden">
                              {userProfile?.hospitalLogo ? (
                                <img src={userProfile.hospitalLogo} alt="Logo" className="w-full h-full object-contain" />
                              ) : (
                                <Activity size={36} className="text-teal-700 stroke-[2.5]" />
                              )}
                            </div>
                            <div className={isRTL ? 'text-right' : 'text-left'}>
                              <h1 className="text-1xl font-black text-[#1e3a5f] leading-none mb-1">
                                {userProfile?.hospitalName || (lang === 'ar' ? 'العيادة التخصصية للسمع والتخاطب' : 'Specialized Audiology Clinic')}
                              </h1>
                              <p className="text-xs font-bold text-slate-600">
                                {userProfile?.hospitalAddress || (lang === 'ar' ? 'مركز تشخيص السمع واضطرابات التوازن' : 'Hearing Diagnostics & Balance Center')}
                              </p>
                              {userProfile?.hospitalPhone && (
                                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  {lang === 'ar' ? 'هاتف / طوارئ:' : 'Tel:'} {userProfile.hospitalPhone}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-[#1e3a5f] text-white px-7 py-3 rounded-bl-[2rem] rounded-tr-[1.5rem] shadow-md text-center">
                            <h2 className="text-base font-black  uppercase">
                              {lang === 'ar' ? 'تقرير تخطيط السمع النغمي' : 'Pure-Tone Audiometry Report'}
                            </h2>
                            <p className="text-[10px] font-mono text-teal-200 ">
                              ISO 8253-1 / ASHA STANDARD
                            </p>
                          </div>
                        </div>

                        {/* Section Title Banner */}
                        <div className="w-full text-center mb-2">
                          <h3 className="text-sm font-black text-slate-800 border-y-2 border-slate-100 py-1.5 bg-slate-50/70 uppercase">
                            {lang === 'ar' ? 'تخطيط السمع النغمي الهوائي والعظمي (Pure-Tone AC / BC Audiogram)' : 'Pure-Tone Air & Bone Conduction Audiogram'}
                          </h3>
                        </div>

                        {/* Patient Demographics Box */}
                        <div className="relative mb-3">
                          <div className="absolute -top-3 right-6 bg-[#1e3a5f] text-white text-[10px] font-bold px-4 py-1 rounded-full z-10 shadow-xs uppercase ">
                            {t.patientData}
                          </div>
                          <div className="grid grid-cols-3 gap-y-2.5 p-4 pt-6 border-2 border-slate-200 rounded-2xl bg-white shadow-2xs text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">{t.fullName}:</span>
                              <span className="text-xs font-black text-slate-900">{formData.name || '---'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">{t.dob}:</span>
                              <span className="text-xs font-bold text-slate-800">{formData.dob || '---'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">{t.visitDate}:</span>
                              <span className="text-xs font-bold font-mono text-slate-800">{formData.visitDate}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">{t.medicalId}:</span>
                              <span className="text-xs font-bold font-mono text-teal-700">#SA-{formData.id || 'N/A'}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">{t.examiner}:</span>
                              <span className="text-xs font-bold text-slate-800">{formData.doctorName || userProfile?.displayName || '---'}</span>
                            </div>
                          </div>
                        </div>

                        {/* ========================================================
                            TWO SEPARATE AUDIOGRAM CHARTS: RIGHT EAR & LEFT EAR
                            ======================================================== */}
                        <div className="grid grid-cols-2 gap-4 mb-2 items-stretch">
                          {/* Right Ear Pure-Tone Audiogram (Red) */}
                          <div className="border-2 border-red-200/90 rounded-2xl p-3 bg-white flex flex-col h-full shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-red-100">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                <h4 className="text-xs font-black text-red-700 uppercase">
                                  {lang === 'ar' ? 'الأذن اليمنى (Right Ear - AD)' : 'Right Ear (AD)'}
                                </h4>
                              </div>
                              <span className="text-[9px] font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                AC: ○ | BC: &lt;
                              </span>
                            </div>

                            <div className="flex-grow min-h-[220px]">
                              <AudiogramChart 
                                data={formData.data || INITIAL_DATA} 
                                lang={lang} 
                                ear="right" 
                                height={260} 
                                showSeverityFooter={false}
                                customTitle={lang === 'ar' ? '  right (AD)' : 'Right Ear (AD)'}
                                aidedThresholds={isAmpSimEnabled && ampSimulation ? { right: ampSimulation.right.aidedAC } : undefined}
                              />
                            </div>

                            {/* Frequency Thresholds Table Right Ear */}
                            <div className="mt-2.5 overflow-hidden rounded-xl border border-red-200">
                              <table className="w-full text-[9px] border-collapse font-mono">
                                <thead>
                                  <tr className="bg-red-50/80 font-bold border-b border-red-200 text-slate-700">
                                    <th className="p-1 border-r border-red-200 w-12 text-center">{lang === 'ar' ? 'تردد' : 'Hz'}</th>
                                    {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                      <th key={f} className="p-1 border-r border-red-200 last:border-r-0 text-center">{f}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-red-100">
                                    <td className="p-1 font-black bg-red-50/30 border-r border-red-200 text-red-600 text-center">AC ○</td>
                                    {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                      <td key={f} className="p-1 text-center border-r border-red-100 last:border-r-0 font-bold text-red-700">
                                        {formData.data?.right?.AC?.[f] ?? '-'}
                                      </td>
                                    ))}
                                  </tr>
                                  <tr className={isAmpSimEnabled && ampSimulation ? 'border-b border-red-100' : ''}>
                                    <td className="p-1 font-black bg-red-50/30 border-r border-red-200 text-red-500 text-center">BC &lt;</td>
                                    {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                      <td key={f} className="p-1 text-center border-r border-red-100 last:border-r-0 font-bold text-red-600">
                                        {formData.data?.right?.BC?.[f] ?? '-'}
                                      </td>
                                    ))}
                                  </tr>
                                  {isAmpSimEnabled && ampSimulation && (
                                    <tr className="bg-emerald-50/60">
                                      <td className="p-1 font-black border-r border-red-200 text-emerald-700 text-center">Aided ◆</td>
                                      {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                        <td key={f} className="p-1 text-center border-r border-emerald-100 last:border-r-0 font-black text-emerald-700">
                                          {ampSimulation.right.aidedAC[f]}
                                        </td>
                                      ))}
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {analysis && (
                              <div className="mt-2 p-1.5 bg-red-50/60 rounded-lg border border-red-100 flex items-center justify-between text-[10px]">
                                <span className="font-bold text-red-800">
                                  PTA: <span className="font-mono">{analysis.right.pta} dB HL</span>
                                  {isAmpSimEnabled && ampSimulation && (
                                    <span className="text-emerald-700 font-mono ms-1">
                                      → {ampSimulation.right.aidedPTA} dB (Aided)
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold text-red-700">
                                  {translations[lang][analysis.right.degree as keyof typeof translations['ar']] || analysis.right.degree} • {translations[lang][analysis.right.type as keyof typeof translations['ar']] || analysis.right.type}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Left Ear Pure-Tone Audiogram (Blue) */}
                          <div className="border-2 border-blue-200/90 rounded-2xl p-3 bg-white flex flex-col h-full shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-blue-100">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <h4 className="text-xs font-black text-blue-700 uppercase">
                                  {lang === 'ar' ? 'الأذن اليسرى (Left Ear - AS)' : 'Left Ear (AS)'}
                                </h4>
                              </div>
                              <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                AC: ✕ | BC: &gt;
                              </span>
                            </div>

                            <div className="flex-grow min-h-[220px]">
                              <AudiogramChart 
                                data={formData.data || INITIAL_DATA} 
                                lang={lang} 
                                ear="left" 
                                height={260} 
                                showSeverityFooter={false}
                                customTitle={lang === 'ar' ? '  left (AS)' : 'Left Ear (AS)'}
                                aidedThresholds={isAmpSimEnabled && ampSimulation ? { left: ampSimulation.left.aidedAC } : undefined}
                              />
                            </div>

                            {/* Frequency Thresholds Table Left Ear */}
                            <div className="mt-2.5 overflow-hidden rounded-xl border border-blue-200">
                              <table className="w-full text-[9px] border-collapse font-mono">
                                <thead>
                                  <tr className="bg-blue-50/80 font-bold border-b border-blue-200 text-slate-700">
                                    <th className="p-1 border-r border-blue-200 w-12 text-center">{lang === 'ar' ? 'تردد' : 'Hz'}</th>
                                    {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                      <th key={f} className="p-1 border-r border-blue-200 last:border-r-0 text-center">{f}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-blue-100">
                                    <td className="p-1 font-black bg-blue-50/30 border-r border-blue-200 text-blue-600 text-center">AC ✕</td>
                                    {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                      <td key={f} className="p-1 text-center border-r border-blue-100 last:border-r-0 font-bold text-blue-700">
                                        {formData.data?.left?.AC?.[f] ?? '-'}
                                      </td>
                                    ))}
                                  </tr>
                                  <tr className={isAmpSimEnabled && ampSimulation ? 'border-b border-blue-100' : ''}>
                                    <td className="p-1 font-black bg-blue-50/30 border-r border-blue-200 text-blue-500 text-center">BC &gt;</td>
                                    {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                      <td key={f} className="p-1 text-center border-r border-blue-100 last:border-r-0 font-bold text-blue-600">
                                        {formData.data?.left?.BC?.[f] ?? '-'}
                                      </td>
                                    ))}
                                  </tr>
                                  {isAmpSimEnabled && ampSimulation && (
                                    <tr className="bg-teal-50/60">
                                      <td className="p-1 font-black border-r border-blue-200 text-teal-700 text-center">Aided ◆</td>
                                      {[250, 500, 1000, 2000, 4000, 8000].map(f => (
                                        <td key={f} className="p-1 text-center border-r border-teal-100 last:border-r-0 font-black text-teal-700">
                                          {ampSimulation.left.aidedAC[f]}
                                        </td>
                                      ))}
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {analysis && (
                              <div className="mt-2 p-1.5 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between text-[10px]">
                                <span className="font-bold text-blue-800">
                                  PTA: <span className="font-mono">{analysis.left.pta} dB HL</span>
                                  {isAmpSimEnabled && ampSimulation && (
                                    <span className="text-teal-700 font-mono ms-1">
                                      → {ampSimulation.left.aidedPTA} dB (Aided)
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold text-blue-700">
                                  {translations[lang][analysis.left.degree as keyof typeof translations['ar']] || analysis.left.degree} • {translations[lang][analysis.left.type as keyof typeof translations['ar']] || analysis.left.type}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Speech Audiometry & Reference Severity Strip */}
                        <div className="grid grid-cols-2 gap-4 mb-2">
                          {/* Speech Audiometry Table */}
                          <div className="border-2 border-slate-200 rounded-2xl p-3 bg-white">
                            <h4 className="text-[10px] font-black text-center mb-2 bg-[#1e3a5f] text-white py-1 rounded-full uppercase ">
                              {t.speechAudiometryReport}
                              {isAmpSimEnabled && (
                                <span className="text-emerald-300 ms-1.5">
                                  ({lang === 'ar' ? 'مع محاكاة التضخيم' : '+ Aided Simulation'})
                                </span>
                              )}
                            </h4>
                            <table className="w-full text-[9px] border-collapse text-center font-mono">
                              <thead>
                                <tr className="bg-slate-100/70 border-b border-slate-200">
                                  <th className="p-1 border-r border-slate-200 font-bold text-red-600">RE (اليمنى)</th>
                                  <th className="p-1 border-r border-slate-200 font-bold text-blue-600">LE (اليسرى)</th>
                                  <th className="p-1 font-bold text-slate-800">{lang === 'ar' ? 'الاختبار السريري' : 'Speech Test'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-100">
                                  <td className="p-1 border-r border-slate-200 font-bold text-red-700">
                                    {isAmpSimEnabled && ampSimulation ? (
                                      <span>
                                        {ampSimulation.right.unaidedSRT} → <strong className="text-emerald-700">{ampSimulation.right.aidedSRT} dB</strong>
                                      </span>
                                    ) : (
                                      `${formData.data?.speech?.right?.srt || 0} dB`
                                    )}
                                  </td>
                                  <td className="p-1 border-r border-slate-200 font-bold text-blue-700">
                                    {isAmpSimEnabled && ampSimulation ? (
                                      <span>
                                        {ampSimulation.left.unaidedSRT} → <strong className="text-teal-700">{ampSimulation.left.aidedSRT} dB</strong>
                                      </span>
                                    ) : (
                                      `${formData.data?.speech?.left?.srt || 0} dB`
                                    )}
                                  </td>
                                  <td className="p-1 bg-slate-50 font-bold">{t.srt} (Speech Reception)</td>
                                </tr>
                                <tr>
                                  <td className="p-1 border-r border-slate-200 font-bold text-red-700">
                                    {isAmpSimEnabled && ampSimulation ? (
                                      <span>
                                        {ampSimulation.right.unaidedSDS}% → <strong className="text-emerald-700">{ampSimulation.right.aidedSDS}%</strong>
                                        {ampSimulation.right.sdsImprovement > 0 && (
                                          <span className="text-[8px] text-emerald-600 ms-0.5">(+{ampSimulation.right.sdsImprovement}%)</span>
                                        )}
                                      </span>
                                    ) : (
                                      `${formData.data?.speech?.right?.sds || 0}%`
                                    )}
                                  </td>
                                  <td className="p-1 border-r border-slate-200 font-bold text-blue-700">
                                    {isAmpSimEnabled && ampSimulation ? (
                                      <span>
                                        {ampSimulation.left.unaidedSDS}% → <strong className="text-teal-700">{ampSimulation.left.aidedSDS}%</strong>
                                        {ampSimulation.left.sdsImprovement > 0 && (
                                          <span className="text-[8px] text-teal-600 ms-0.5">(+{ampSimulation.left.sdsImprovement}%)</span>
                                        )}
                                      </span>
                                    ) : (
                                      `${formData.data?.speech?.left?.sds || 0}%`
                                    )}
                                  </td>
                                  <td className="p-1 bg-slate-50 font-bold">{t.sds} (Discrimination)</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Severity Reference Strip */}
                          <div className="border-2 border-slate-200 rounded-2xl p-3 bg-white flex flex-col justify-between">
                            <h4 className="text-[10px] font-black text-center mb-1.5 text-slate-700 uppercase ">
                              {lang === 'ar' ? 'المستويات المعيارية لدرجات ضعف السمع (WHO / ASHA)' : 'Hearing Loss Classification (WHO / ASHA)'}
                            </h4>
                            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
                              <div className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="font-bold">{lang === 'ar' ? 'طبيعي' : 'Normal'}</span>: ≤20 dB
                              </div>
                              <div className="p-1 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                <span className="font-bold">{lang === 'ar' ? 'خفيف' : 'Mild'}</span>: 21-40 dB
                              </div>
                              <div className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="font-bold">{lang === 'ar' ? 'متوسط' : 'Moderate'}</span>: 41-55 dB
                              </div>
                              <div className="p-1 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                <span className="font-bold">{lang === 'ar' ? 'متوسط الشدة' : 'Mod. Severe'}</span>: 56-70 dB
                              </div>
                              <div className="p-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="font-bold">{lang === 'ar' ? 'شديد' : 'Severe'}</span>: 71-90 dB
                              </div>
                              <div className="p-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                <span className="font-bold">{lang === 'ar' ? 'عميق' : 'Profound'}</span>: &gt;90 dB
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Medical Recommendations / Impression */}
                        <div className="border-2 border-slate-300 rounded-2xl p-4 bg-white relative">
                          <div className="flex items-center gap-2 mb-2 border-b-2 border-slate-100 pb-1.5">
                            <span className="text-sm font-black text-[#1e3a5f] ">
                              {t.medicalRecommendations}
                            </span>
                          </div>
                          <div className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="text-xs text-slate-800 leading-relaxed font-bold">
                              {getDynamicRecommendations(formData, lang)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Doctor Signature & Clinic Stamp */}
                      <div className="mt-2 pt-3 border-t-2 border-slate-100 flex justify-between items-end">
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="text-xs font-black text-slate-800 mb-1.5">
                            {t.doctorSignature}: {formData.doctorName || userProfile?.displayName || '---'}
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-20 rounded-full border-2 border-teal-800/10 flex items-center justify-center p-1.5">
                              <div className="w-full h-full rounded-full border-2 border-teal-800 flex items-center justify-center border-dashed opacity-60">
                                <span className="text-[9px] font-black text-teal-800 rotate-12">
                                  {lang === 'ar' ? 'ختم العيادة' : 'Clinic Stamp'}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">
                              <p className="text-slate-700 font-extrabold">{userProfile?.hospitalName || (lang === 'ar' ? 'العيادة التخصصية' : 'Clinic')}</p>
                              <p className="font-mono">{userProfile?.hospitalPhone || ''}</p>
                            </div>
                          </div>
                        </div>
                        <div className={isRTL ? 'text-left' : 'text-right'}>
                          <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 mb-1 inline-block">
                            {t.pageCount} 1 / {formData.diagnosis ? '3' : '2'}
                          </div>
                          <p className="text-[10px] font-black font-mono text-slate-900">{formData.visitDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ========================================================
                      PAGE 2: TYMPANOMETRY & ACOUSTIC IMMITTANCE REPORT
                      Separated from pure-tone audiometry with dedicated curves & reflex tables
                      ======================================================== */}
                  <div 
                    id="report-page-2" 
                    className={`bg-white p-8 space-y-4 transition-colors min-h-[1100px] relative text-slate-900 w-[820px] mx-auto shadow-2xl print:shadow-none font-sans ${
                      reportActiveTab !== 'all' && reportActiveTab !== 'tympanometry' ? 'hidden print:block' : 'block'
                    }`} 
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <div className="border-2 border-slate-300 rounded-[2rem] p-5 relative min-h-[1050px] flex flex-col justify-between">
                      <div>
                        {/* Letterhead Header */}
                        <div className="flex justify-between items-center mb-4 px-3">
                          <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-white border-2 border-purple-100 rounded-2xl flex items-center justify-center p-2 shadow-xs overflow-hidden">
                              {userProfile?.hospitalLogo ? (
                                <img src={userProfile.hospitalLogo} alt="Logo" className="w-full h-full object-contain" />
                              ) : (
                                <Activity size={36} className="text-purple-700 stroke-[2.5]" />
                              )}
                            </div>
                            <div className={isRTL ? 'text-right' : 'text-left'}>
                              <h1 className="text-1xl font-black text-[#1e3a5f] leading-none mb-1">
                                {userProfile?.hospitalName || (lang === 'ar' ? 'العيادة التخصصية للسمع والتخاطب' : 'Specialized Audiology Clinic')}
                              </h1>
                              <p className="text-xs font-bold text-slate-600">
                                {userProfile?.hospitalAddress || (lang === 'ar' ? 'وحدة الفسيولوجيا السمعية وضغط الأذن الوسطى' : 'Middle Ear & Immittance Laboratory')}
                              </p>
                              {userProfile?.hospitalPhone && (
                                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  {lang === 'ar' ? 'هاتف:' : 'Tel:'} {userProfile.hospitalPhone}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-[#1e3a5f] text-white px-7 py-3 rounded-bl-[2rem] rounded-tr-[1.5rem] shadow-md text-center">
                            <h2 className="text-base font-black  uppercase">
                              {lang === 'ar' ? 'تقرير تخطيط ضغط الطبلة والمنعكس' : 'Tympanometry & Reflex Report'}
                            </h2>
                            <p className="text-[10px] font-mono text-purple-200 ">
                              MIDDLE EAR IMMITTANCE SUITE
                            </p>
                          </div>
                        </div>

                        {/* Section Title Banner */}
                        <div className="w-full text-center mb-5">
                          <h3 className="text-sm font-black text-slate-800 border-y-2 border-slate-100 py-1.5 bg-slate-50/70 uppercase ">
                            {lang === 'ar' ? 'قياس وظائف الأذن الوسطى والمنعكس الصوتي (Tympanometry & Acoustic Stapedial Reflex)' : 'Middle Ear Admittance & Acoustic Stapedial Reflex'}
                          </h3>
                        </div>

                        {/* Patient Summary Strip */}
                        <div className="grid grid-cols-4 gap-2 p-3 border-2 border-slate-200 rounded-2xl bg-white shadow-2xs mb-5 text-xs font-mono">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block font-sans">{t.fullName}:</span>
                            <span className="font-black text-slate-900 font-sans">{formData.name || '---'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block font-sans">{t.medicalId}:</span>
                            <span className="font-bold text-purple-700">#SA-{formData.id || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block font-sans">{t.visitDate}:</span>
                            <span className="font-bold text-slate-800">{formData.visitDate}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block font-sans">{t.examiner}:</span>
                            <span className="font-bold text-slate-800 font-sans">{formData.doctorName || userProfile?.displayName || '---'}</span>
                          </div>
                        </div>

                        {/* ========================================================
                            TWO TYMPANOGRAM CURVE CHARTS: RIGHT & LEFT
                            ======================================================== */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          {/* Right Ear Tympanogram Curve */}
                          <div className="border-2 border-red-200 rounded-2xl p-3 bg-white shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-red-100">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                                <h4 className="text-xs font-black text-red-700">
                                  {lang === 'ar' ? 'الأذن اليمنى (Right Ear - AD)' : 'Right Ear (AD)'}
                                </h4>
                              </div>
                              <span className="text-xs font-black font-mono px-2.5 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-300">
                                Type {formData.data?.tympanometry?.right?.type || 'A'}
                              </span>
                            </div>

                            <TympanogramChart 
                              data={formData.data?.tympanometry || { left: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75 }, right: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75 } }} 
                              ear="right" 
                              lang={lang} 
                              height={190} 
                            />

                            <div className="mt-2.5 grid grid-cols-5 gap-1 text-[9px] font-mono text-center">
                              <div className="p-1 bg-red-50/70 rounded border border-red-100">
                                <span className="text-slate-500 block">Peak</span>
                                <span className="font-bold text-red-700">{formData.data?.tympanometry?.right?.pressure ?? 0} daPa</span>
                              </div>
                              <div className="p-1 bg-red-50/70 rounded border border-red-100">
                                <span className="text-slate-500 block">Comp</span>
                                <span className="font-bold text-red-700">{formData.data?.tympanometry?.right?.compliance ?? 0} ml</span>
                              </div>
                              <div className="p-1 bg-red-50/70 rounded border border-red-100">
                                <span className="text-slate-500 block">ECV</span>
                                <span className="font-bold text-red-700">{formData.data?.tympanometry?.right?.volume ?? 0} ml</span>
                              </div>
                              <div className="p-1 bg-red-50/70 rounded border border-red-100">
                                <span className="text-slate-500 block">Grad</span>
                                <span className="font-bold text-red-700">{formData.data?.tympanometry?.right?.gradient ?? 0} daPa</span>
                              </div>
                              <div className="p-1 bg-red-50/70 rounded border border-red-100">
                                <span className="text-slate-500 block">Ref 1k</span>
                                <span className="font-bold text-red-700">{formData.data?.tympanometry?.right?.reflex1kIpsi || formData.data?.reflex?.right?.ipsi?.[1000] || 'NR'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Left Ear Tympanogram Curve */}
                          <div className="border-2 border-blue-200 rounded-2xl p-3 bg-white shadow-2xs">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-blue-100">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <h4 className="text-xs font-black text-blue-700">
                                  {lang === 'ar' ? 'الأذن اليسرى (Left Ear - AS)' : 'Left Ear (AS)'}
                                </h4>
                              </div>
                              <span className="text-xs font-black font-mono px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                                Type {formData.data?.tympanometry?.left?.type || 'A'}
                              </span>
                            </div>

                            <TympanogramChart 
                              data={formData.data?.tympanometry || { left: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75 }, right: { type: 'A', pressure: 0, volume: 1.2, compliance: 0.6, gradient: 75 } }} 
                              ear="left" 
                              lang={lang} 
                              height={190} 
                            />

                            <div className="mt-2.5 grid grid-cols-5 gap-1 text-[9px] font-mono text-center">
                              <div className="p-1 bg-blue-50/70 rounded border border-blue-100">
                                <span className="text-slate-500 block">Peak</span>
                                <span className="font-bold text-blue-700">{formData.data?.tympanometry?.left?.pressure ?? 0} daPa</span>
                              </div>
                              <div className="p-1 bg-blue-50/70 rounded border border-blue-100">
                                <span className="text-slate-500 block">Comp</span>
                                <span className="font-bold text-blue-700">{formData.data?.tympanometry?.left?.compliance ?? 0} ml</span>
                              </div>
                              <div className="p-1 bg-blue-50/70 rounded border border-blue-100">
                                <span className="text-slate-500 block">ECV</span>
                                <span className="font-bold text-blue-700">{formData.data?.tympanometry?.left?.volume ?? 0} ml</span>
                              </div>
                              <div className="p-1 bg-blue-50/70 rounded border border-blue-100">
                                <span className="text-slate-500 block">Grad</span>
                                <span className="font-bold text-blue-700">{formData.data?.tympanometry?.left?.gradient ?? 0} daPa</span>
                              </div>
                              <div className="p-1 bg-blue-50/70 rounded border border-blue-100">
                                <span className="text-slate-500 block">Ref 1k</span>
                                <span className="font-bold text-blue-700">{formData.data?.tympanometry?.left?.reflex1kIpsi || formData.data?.reflex?.left?.ipsi?.[1000] || 'NR'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Full Immittance Parameters Table */}
                        <div className="mb-4 overflow-hidden rounded-2xl border-2 border-slate-200">
                          <table className="w-full text-[10px] border-collapse font-mono">
                            <thead>
                              <tr className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                                <th className="p-2 border-r border-slate-200 w-24 text-center">{t.ear}</th>
                                <th className="p-2 border-r border-slate-200 text-center">{t.tympType}</th>
                                <th className="p-2 border-r border-slate-200 text-center">{lang === 'ar' ? 'ضغط القمة (daPa)' : 'Peak Pressure (daPa)'}</th>
                                <th className="p-2 border-r border-slate-200 text-center">{lang === 'ar' ? 'المطاوعة (ml)' : 'Compliance (ml)'}</th>
                                <th className="p-2 border-r border-slate-200 text-center">{lang === 'ar' ? 'حجم القناة (ml)' : 'ECV (ml)'}</th>
                                <th className="p-2 border-r border-slate-200 text-center">{lang === 'ar' ? 'الميل (daPa)' : 'Gradient (daPa)'}</th>
                                <th className="p-2 text-center">{lang === 'ar' ? 'منعكس 1k مماثل' : 'Reflex 1k Ipsi'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100">
                                <td className="p-2 font-black bg-red-50/50 border-r border-slate-200 text-red-600 text-center">
                                  {lang === 'ar' ? 'الأذن اليمنى (Right)' : 'Right Ear'}
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-black text-red-700 bg-red-50/20">
                                  Type {formData.data?.tympanometry?.right?.type || 'A'}
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.right?.pressure ?? 0} daPa
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.right?.compliance ?? 0} ml
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.right?.volume ?? 0} ml
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.right?.gradient ?? 0} daPa
                                </td>
                                <td className="p-2 text-center font-black text-red-700 bg-red-50/10">
                                  {formData.data?.tympanometry?.right?.reflex1kIpsi || formData.data?.reflex?.right?.ipsi?.[1000] || 'NR'}
                                </td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="p-2 font-black bg-blue-50/50 border-r border-slate-200 text-blue-600 text-center">
                                  {lang === 'ar' ? 'الأذن اليسرى (Left)' : 'Left Ear'}
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-black text-blue-700 bg-blue-50/20">
                                  Type {formData.data?.tympanometry?.left?.type || 'A'}
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.left?.pressure ?? 0} daPa
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.left?.compliance ?? 0} ml
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.left?.volume ?? 0} ml
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 font-bold text-slate-800">
                                  {formData.data?.tympanometry?.left?.gradient ?? 0} daPa
                                </td>
                                <td className="p-2 text-center font-black text-blue-700 bg-blue-50/10">
                                  {formData.data?.tympanometry?.left?.reflex1kIpsi || formData.data?.reflex?.left?.ipsi?.[1000] || 'NR'}
                                </td>
                              </tr>
                              <tr className="bg-slate-50/60 text-[8px] text-slate-500 font-sans">
                                <td colSpan={7} className="p-1.5 text-center italic">
                                  {lang === 'ar' 
                                    ? 'القيم المعيارية: الضغط (-100 إلى +50 daPa) • المطاوعة (0.3 إلى 1.6 ml) • حجم القناة (0.6 إلى 2.0 ml) • التدرج (50 إلى 110 daPa) • المنعكس 1k مماثل (70 إلى 100 dB HL)' 
                                    : 'Normative: Pressure (-100 to +50 daPa) • Compliance (0.3 to 1.6 ml) • ECV (0.6 to 2.0 ml) • Gradient (50 to 110 daPa) • Reflex 1k Ipsi (70 to 100 dB HL)'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Acoustic Stapedial Reflex Table */}
                        <div className="border-2 border-slate-200 rounded-2xl p-3.5 bg-white mb-4">
                          <h4 className="text-[10px] font-black text-center mb-2.5 bg-[#1e3a5f] text-white py-1 rounded-full uppercase ">
                            {t.acousticReflexReport} (Acoustic Stapedial Reflex Thresholds)
                          </h4>
                          <table className="w-full text-[9px] border-collapse font-mono">
                            <thead>
                              <tr className="bg-slate-100/70 border-b border-slate-200">
                                <th className="p-1.5 border-r border-slate-200 w-36 text-center">{lang === 'ar' ? 'الأذن والمسار' : 'Ear / Pathway'}</th>
                                {[500, 1000, 2000, 4000].map(f => (
                                  <th key={f} className="p-1.5 border-r border-slate-200 last:border-r-0 text-center">{f} Hz</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100">
                                <td className="p-1.5 font-bold bg-red-50/40 border-r border-slate-200 text-red-700">
                                  {lang === 'ar' ? 'اليمنى مماثل (Right Ipsi)' : 'Right Ipsilateral'}
                                </td>
                                {[500, 1000, 2000, 4000].map(f => (
                                  <td key={f} className="p-1.5 border-r border-slate-100 last:border-r-0 text-center font-bold text-slate-800">
                                    {formData.data?.reflex?.right?.ipsi?.[f] || 'NR'}
                                  </td>
                                ))}
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="p-1.5 font-bold bg-red-50/20 border-r border-slate-200 text-red-600">
                                  {lang === 'ar' ? 'اليمنى مقابل (Right Contra)' : 'Right Contralateral'}
                                </td>
                                {[500, 1000, 2000, 4000].map(f => (
                                  <td key={f} className="p-1.5 border-r border-slate-100 last:border-r-0 text-center font-bold text-slate-800">
                                    {formData.data?.reflex?.right?.contra?.[f] || 'NR'}
                                  </td>
                                ))}
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="p-1.5 font-bold bg-blue-50/40 border-r border-slate-200 text-blue-700">
                                  {lang === 'ar' ? 'اليسرى مماثل (Left Ipsi)' : 'Left Ipsilateral'}
                                </td>
                                {[500, 1000, 2000, 4000].map(f => (
                                  <td key={f} className="p-1.5 border-r border-slate-100 last:border-r-0 text-center font-bold text-slate-800">
                                    {formData.data?.reflex?.left?.ipsi?.[f] || 'NR'}
                                  </td>
                                ))}
                              </tr>
                              <tr>
                                <td className="p-1.5 font-bold bg-blue-50/20 border-r border-slate-200 text-blue-600">
                                  {lang === 'ar' ? 'اليسرى مقابل (Left Contra)' : 'Left Contralateral'}
                                </td>
                                {[500, 1000, 2000, 4000].map(f => (
                                  <td key={f} className="p-1.5 border-r border-slate-100 last:border-r-0 text-center font-bold text-slate-800">
                                    {formData.data?.reflex?.left?.contra?.[f] || 'NR'}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Middle Ear Clinical Interpretation */}
                        <div className="border-2 border-slate-300 rounded-2xl p-4 bg-white relative">
                          <div className="flex items-center gap-2 mb-2 border-b-2 border-slate-100 pb-1.5">
                            <span className="text-sm font-black text-[#1e3a5f] ">
                              {lang === 'ar' ? 'الرأي والتقرير السريري لوظائف الأذن الوسطى' : 'Middle Ear Clinical Impression'}
                            </span>
                          </div>
                          <div className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="text-xs text-slate-800 leading-relaxed font-bold whitespace-pre-line">
                              {getDynamicTympanometryFindings(formData, lang)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Doctor Signature & Clinic Stamp */}
                      <div className="mt-4 pt-3 border-t-2 border-slate-100 flex justify-between items-end">
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="text-xs font-black text-slate-800 mb-1.5">
                            {t.doctorSignature}: {formData.doctorName || userProfile?.displayName || '---'}
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-20 rounded-full border-2 border-purple-800/10 flex items-center justify-center p-1.5">
                              <div className="w-full h-full rounded-full border-2 border-purple-800 flex items-center justify-center border-dashed opacity-60">
                                <span className="text-[9px] font-black text-purple-800 rotate-12">
                                  {lang === 'ar' ? 'ختم العيادة' : 'Clinic Stamp'}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">
                              <p className="text-slate-700 font-extrabold">{userProfile?.hospitalName || (lang === 'ar' ? 'العيادة التخصصية' : 'Clinic')}</p>
                              <p className="font-mono">{userProfile?.hospitalPhone || ''}</p>
                            </div>
                          </div>
                        </div>
                        <div className={isRTL ? 'text-left' : 'text-right'}>
                          <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 mb-1 inline-block">
                            {t.pageCount} 2 / {formData.diagnosis ? '3' : '2'}
                          </div>
                          <p className="text-[10px] font-black font-mono text-slate-900">{formData.visitDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ========================================================
                      PAGE 3: DETAILED CLINICAL & AI DIAGNOSIS
                      Rendered when algorithmic or AI diagnostic text is generated
                      ======================================================== */}
                  {formData.diagnosis && (
                    <div 
                      id="report-page-3" 
                      className={`bg-white p-8 space-y-1 transition-colors min-h-[1100px] relative text-slate-900 w-[820px] mx-auto shadow-2xl print:shadow-none font-sans ${
                        reportActiveTab !== 'all' && reportActiveTab !== 'diagnosis' ? 'hidden print:block' : 'block'
                      }`} 
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <div className="border-2 border-slate-300 rounded-[2rem] p-8 relative min-h-[1050px] flex flex-col justify-between">
                        <div>
                          {/* Page 3 Header */}
                          <div className="flex justify-between items-start mb-2 border-b-2 border-slate-100 pb-5">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-8 bg-[#1e3a5f] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                                <Shield size={28} className="text-white" />
                              </div>
                              <div className={isRTL ? 'text-right' : 'text-left'}>
                                <h2 className="text-1xl font-black text-[#1e3a5f]  uppercase leading-none mb-1">
                                  {lang === 'ar'
                                    ? 'التفسير السمعي المساعد بالذكاء الاصطناعي'
                                    : 'AI-Assisted Audiology Interpretation'}
                                </h2>
                                <p className="text-slate-400 text-[10px] font-black uppercase ">
                                  {t.clinicalReport} • AI-ASSISTED • PAGE 03
                                </p>
                                <p className="text-[10px] text-amber-700 font-semibold mt-1">
                                  {lang === 'ar'
                                    ? 'تفسير مساعد للقياسات، وليس تشخيصاً نهائياً؛ يلزم اعتماد اختصاصي السمعيات.'
                                    : 'Decision support only, not a final diagnosis; specialist review is required.'}
                                </p>
                              </div>
                            </div>
                            <div className={isRTL ? 'text-left' : 'text-right'}>
                              <p className="text-base font-black text-slate-800">{formData.name}</p>
                              <p className="text-[10px] font-mono font-bold text-slate-400 ">ID: #SA-{formData.id || 'N/A'}</p>
                            </div>
                          </div>

                          {/* Analysis Content */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-8 bg-[#1e3a5f] rounded-full" />
                              <h3 className="text-lg font-black text-slate-900 ">
                                {t.diagnosticInsight}
                              </h3>
                            </div>

                            <div className="bg-slate-50/70 rounded-[2rem] p-6 border border-slate-200/50 relative overflow-hidden min-h-[550px] shadow-inner">
                              <div className="relative z-10 prose prose-slate max-w-none prose-p:leading-relaxed prose-strong:text-[#1e3a5f]">
                                <div className={` text-[10px] text-slate-800 leading-relaxed font-medium  ${isRTL ? 'text-right' : 'text-left'}`}>
                                  <div className="markdown-body">
                                    <ReactMarkdown>{formData.diagnosis}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {includeAdviceInPrint && (
                              <div className="bg-teal-50/40 rounded-[1.5rem] p-6 border border-teal-200/70">
                                <h4 className="text-sm font-black text-teal-900 mb-1">
                                  {t.patientAdviceTitle}
                                </h4>
                                <div className={`text-xs text-slate-800 leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                                  <div className="markdown-body">
                                    <ReactMarkdown>
                                      {formData.patientAdvice || getLocalPatientAdvice(formData, lang)}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Page 3 Footer */}
                        <div className="mt-6 pt-6 border-t-2 border-slate-100 flex justify-between items-end">
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase  leading-none">{t.doctorSignature}</p>
                            <div className="flex flex-col">
                              <p className="text-base font-black text-[#1e3a5f]  mb-1">
                                {formData.doctorName || userProfile?.displayName || "Dr. Audiologist"}
                              </p>
                              <div className="w-48 h-0.5 bg-gradient-to-r from-[#1e3a5f] to-transparent rounded-full opacity-30" />
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1.5">
                            <div className="bg-slate-100 px-5 py-1 rounded-full text-[10px] font-black text-slate-500 shadow-xs border border-slate-200/50 uppercase ">
                              {t.pageCount} 3 / 3
                            </div>
                            <div className="flex items-center gap-2 text-[#1e3a5f] opacity-25">
                              <Activity size={16} />
                              <span className="font-black text-xs  uppercase">{t.appName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Patient Advice & AI Hearing Conservation Tips Component */}
                  <PatientAdvice
                    patient={formData}
                    lang={lang}
                    apiKey={geminiApiKey.trim() || getStoredGeminiApiKey()}
                    model={geminiModel || getStoredGeminiModel()}
                    includeInPrint={includeAdviceInPrint}
                    onToggleIncludeInPrint={setIncludeAdviceInPrint}
                    onUpdateAdvice={(newAdvice, isAiGenerated) => {
                      setFormData(prev => {
                        const updated = { ...prev, patientAdvice: newAdvice };
                        if (updated.id) {
                          localDB.savePatient(updated);
                        }
                        return updated;
                      });
                      showToast(
                        isAiGenerated ? t.adviceAiGeneratedToast : t.adviceLocalGeneratedToast,
                        'success'
                      );
                    }}
                  />

                  {/* AI Feedback Section - Outside printable area */}
                  {formData.diagnosis && (
                    <div className="w-[800px] mx-auto mt-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden transition-colors">
                      <div className={`flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Star size={24} />
                        <h4 className="font-bold text-lg">{t.aiFeedbackTitle}</h4>
                      </div>

                      {feedbackSubmitted || formData.feedback ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 text-center text-emerald-700 dark:text-emerald-400 font-medium">
                          {t.feedbackSuccess}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <label className={`block text-sm font-bold text-slate-700 dark:text-slate-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {t.aiAccuracy}
                              </label>
                              <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                {[1, 2, 3, 4, 5].map(rating => (
                                  <motion.button
                                    key={rating}
                                    whileHover={{ scale: 1.2, rotate: 5 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setFeedback(prev => ({ ...prev, accuracy: rating }))}
                                    className={`p-2 rounded-xl transition-colors ${
                                      feedback.accuracy >= rating 
                                        ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' 
                                        : 'text-slate-200 dark:text-slate-800 hover:text-amber-200'
                                    }`}
                                  >
                                    <Star 
                                      size={28} 
                                      fill={feedback.accuracy >= rating ? 'currentColor' : 'none'} 
                                      strokeWidth={feedback.accuracy >= rating ? 0 : 2}
                                    />
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <label className={`block text-sm font-bold text-slate-700 dark:text-slate-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {t.aiUsefulness}
                              </label>
                              <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                {[1, 2, 3, 4, 5].map(rating => (
                                  <motion.button
                                    key={rating}
                                    whileHover={{ scale: 1.2, rotate: -5 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setFeedback(prev => ({ ...prev, usefulness: rating }))}
                                    className={`p-2 rounded-xl transition-colors ${
                                      feedback.usefulness >= rating 
                                        ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' 
                                        : 'text-slate-200 dark:text-slate-800 hover:text-amber-200'
                                    }`}
                                  >
                                    <Star 
                                      size={28} 
                                      fill={feedback.usefulness >= rating ? 'currentColor' : 'none'} 
                                      strokeWidth={feedback.usefulness >= rating ? 0 : 2}
                                    />
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className={`block text-sm font-bold text-slate-700 dark:text-slate-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                              {t.aiComments}
                            </label>
                            <textarea
                              value={feedback.comments}
                              onChange={(e) => setFeedback(prev => ({ ...prev, comments: e.target.value }))}
                              className={`w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm min-h-[100px] ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={t.aiComments}
                            />
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmitFeedback}
                            disabled={!feedback.accuracy || !feedback.usefulness}
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200 dark:shadow-none"
                          >
                            {t.submitFeedback}
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {currentView === 'noise-check' && (
              <motion.div 
                key="noise-check"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-white dark:bg-[#111827] p-6 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center">
                        <Mic size={24} />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{t.noiseCheck}</h2>
                        <p className="text-xs text-slate-400">{t.noiseDescription}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleViewChange('dashboard')}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <NoiseMonitor 
                      lang={lang} 
                      isActive={isNoiseMonitoring}
                      onToggle={setIsNoiseMonitoring}
                      onNoiseLevelChange={setCurrentNoiseLevel}
                      threshold={30}
                    />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                      <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2">
                          <Volume2 size={16} />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">{lang === 'ar' ? 'المستوى الحالي' : 'Current Level'}</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{currentNoiseLevel} dB SPL</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${currentNoiseLevel > 30 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'}`}>
                          <Activity size={16} />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">{lang === 'ar' ? 'الحالة الصوتية' : 'Status'}</p>
                        <p className={`text-xl font-bold ${currentNoiseLevel > 30 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {currentNoiseLevel > 30 ? (lang === 'ar' ? 'ضوضاء عالية' : 'High Noise') : (lang === 'ar' ? 'مثالي وهادئ' : 'Optimal')}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${micPermission === 'granted' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'}`}>
                          <Mic size={16} />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">{lang === 'ar' ? 'إذن الميكروفون' : 'Microphone'}</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {micPermission === 'granted' ? (lang === 'ar' ? 'متاح ومفعل' : 'Granted') : (lang === 'ar' ? 'غير مفعل' : 'Denied')}
                        </p>
                      </div>
                    </div>

                    <div className="bg-teal-50/70 dark:bg-teal-950/20 p-5 rounded-2xl border border-teal-200/60 dark:border-teal-900/40">
                      <h4 className="font-bold text-teal-800 dark:text-teal-300 text-sm mb-1 flex items-center gap-2">
                        <HelpCircle size={16} />
                        {lang === 'ar' ? 'معايير ANSI S3.1 للغرف العازلة' : 'Clinical ANSI S3.1 Room Standards'}
                      </h4>
                      <p className="text-xs text-teal-900/80 dark:text-teal-200/80 leading-relaxed">
                        {lang === 'ar' 
                          ? 'تحدد المعايير السريرية الدولية (ISO 8253-1 و ANSI S3.1) الحد الأقصى المسموح به لضجيج الغرفة العازلة أثناء الفحص بـ 30 ديسيبل لضمان دقة قياس عتبات السمع المنخفضة عند 250 و 500 هرتز.'
                          : 'International audiological standards specify ambient noise must remain below 30 dB SPL for reliable low-frequency threshold verification (250 Hz & 500 Hz).'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                {/* Gemini AI Engine & API Key Configuration Card */}
                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/60 via-slate-50/40 to-teal-50/50 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-teal-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
                        <BrainCircuit size={22} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {t.aiApiConfigTitle}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                              isOpenSourceModel(geminiModel)
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                : geminiApiKey.trim()
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                : hasSystemGeminiKey
                                ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/70'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOpenSourceModel(geminiModel) || geminiApiKey.trim()
                                  ? 'bg-emerald-500'
                                  : hasSystemGeminiKey
                                  ? 'bg-teal-500'
                                  : 'bg-amber-500'
                              }`}
                            />
                            {isOpenSourceModel(geminiModel)
                              ? lang === 'ar'
                                ? `متصل ونشط (نموذج مجاني مفتوح المصدر: ${getModelDisplayName(geminiModel)})`
                                : `Active (Free Open-Source: ${getModelDisplayName(geminiModel)})`
                              : geminiApiKey.trim()
                              ? t.apiStatusCustomActive
                              : hasSystemGeminiKey
                              ? t.apiStatusSystemActive
                              : t.apiStatusUnconfigured}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {t.aiApiConfigSubtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={openApiConfigModal}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                      <Key size={15} />
                      <span>{geminiApiKey.trim() ? t.updateApiKey : t.configureApiKey}</span>
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Stored Key Preview Box */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {t.apiKeyLabel} (localStorage)
                          </span>
                          <Lock size={13} className="text-indigo-500" />
                        </div>
                        {geminiApiKey.trim() ? (
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-wider truncate" dir="ltr">
                            {maskApiKey(geminiApiKey)}
                          </p>
                        ) : isOpenSourceModel(geminiModel) ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            {lang === 'ar'
                              ? 'لا يتطلب مفتاح API — يعمل مجاناً عبر النماذج مفتوحة المصدر'
                              : 'No API key required — Running on Free Open-Source AI'}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            {lang === 'ar'
                              ? 'لم يتم حفظ مفتاح خاص في المتصفح بعد'
                              : 'No custom key saved in localStorage yet'}
                          </p>
                        )}
                        {geminiKeyUpdatedAt && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            {lang === 'ar' ? 'آخر تحديث: ' : 'Updated: '}
                            {new Date(geminiKeyUpdatedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        )}
                      </div>

                      {/* Active Model & Storage Info Box */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {t.apiModelLabel}
                          </span>
                          <Sparkles size={13} className="text-teal-500" />
                        </div>
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white" dir="ltr">
                          {getModelDisplayName(geminiModel)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {isOpenSourceModel(geminiModel)
                            ? lang === 'ar'
                              ? 'نموذج ذكاء اصطناعي مفتوح المصدر • مجاني للتحليل والتشخيص'
                              : 'Free Open-Source AI Model for clinical analysis & diagnosis'
                            : lang === 'ar'
                            ? 'مفتاح التخزين المحلي: localStorage["gemini_api_key"]'
                            : 'Storage key: localStorage["gemini_api_key"]'}
                        </p>
                      </div>
                    </div>

                    {/* Quick Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Shield size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        <span>
                          {lang === 'ar'
                            ? 'يُحفظ المفتاح محلياً في متصفحك لتفعيل التحليل الذكي لتقارير تخطيط السمع.'
                            : 'Saved directly in browser localStorage to authenticate clinical AI diagnostics.'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {geminiApiKey.trim() && (
                          <button
                            type="button"
                            onClick={handleRemoveSavedApiKey}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <Trash2 size={14} />
                            <span>{t.clearApiKey}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openApiConfigModal}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <Settings size={14} />
                          <span>{lang === 'ar' ? 'فتح نافذة إعدادات API' : 'Open API Configuration Modal'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {lang === 'en' ? 'Clinic & Hospital Profile' : 'بيانات العيادة والترويسة الطبية'}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {lang === 'en' ? 'Manage official clinical letterhead, clinic logo, and report info' : 'تخصيص شعار واسم العيادة لتقارير تخطيط السمع الرسمية'}
                      </p>
                    </div>
                  </div>
                  
                  <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.hospitalLogo}</label>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center">
                            {userProfile?.hospitalLogo ? (
                              <img src={userProfile.hospitalLogo} alt="Clinic Logo" className="w-full h-full object-contain" />
                            ) : (
                              <Activity size={24} className="text-teal-600" />
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all text-center">
                              {t.uploadLogo}
                              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            </label>
                            {userProfile?.hospitalLogo && (
                              <button 
                                type="button"
                                onClick={() => setUserProfile(prev => prev ? { ...prev, hospitalLogo: null } : null)}
                                className="px-3.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-all"
                              >
                                {t.removeLogo}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.hospitalName}</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all font-semibold"
                          value={userProfile?.hospitalName || ''}
                          onChange={(e) => setUserProfile(prev => prev ? { ...prev, hospitalName: e.target.value } : null)}
                          placeholder={t.hospitalName}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.hospitalAddress}</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all"
                          value={userProfile?.hospitalAddress || ''}
                          onChange={(e) => setUserProfile(prev => prev ? { ...prev, hospitalAddress: e.target.value } : null)}
                          placeholder={t.hospitalAddress}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.hospitalPhone}</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all font-mono"
                          value={userProfile?.hospitalPhone || ''}
                          onChange={(e) => setUserProfile(prev => prev ? { ...prev, hospitalPhone: e.target.value } : null)}
                          placeholder={t.hospitalPhone}
                        />
                      </div>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={settingsLoading}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white p-3.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {settingsLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      <span>{t.saveChanges}</span>
                    </button>
                  </form>
                </div>

                {/* Backup & Restore Card */}
                <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <Database size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {lang === 'ar' ? 'النسخ الاحتياطي واستعادة البيانات' : 'Backup & Restore Data'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lang === 'ar'
                            ? 'تصدير واستيراد نسخة احتياطية كاملة لسجلات المرضى وتخطيط السمع والملاحظات وإعدادات العيادة'
                            : 'Export and import a complete backup of patient records, audiograms, tasks, notes, and clinic settings'}
                        </p>
                      </div>
                    </div>

                    {lastBackupDate && (
                      <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                        {lang === 'ar' ? 'آخر تصدير: ' : 'Last backup: '}
                        {new Date(lastBackupDate).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    )}
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Summary of local data */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <p className="text-lg font-extrabold text-teal-600 dark:text-teal-400 font-mono">
                          {patients.length}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {lang === 'ar' ? 'سجلات المرضى' : 'Patient Records'}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                          {tasks.length}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {lang === 'ar' ? 'المهام السريرية' : 'Clinical Tasks'}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-center">
                        <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                          {notes.length}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {lang === 'ar' ? 'الملاحظات السريرية' : 'Clinical Notes'}
                        </p>
                      </div>
                    </div>

                    {/* Import Mode Selection */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        {lang === 'ar' ? 'طريقة استيراد النسخة الاحتياطية:' : 'Backup Import Mode:'}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setBackupImportMode('merge')}
                          className={`p-3 rounded-xl border text-xs font-bold text-start transition-all flex items-center justify-between ${
                            backupImportMode === 'merge'
                              ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-500 text-teal-800 dark:text-teal-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span>
                            {lang === 'ar'
                              ? 'دمج مع السجلات الحالية (الحفاظ على البيانات الموجودة)'
                              : 'Merge with current records (Keep existing data)'}
                          </span>
                          {backupImportMode === 'merge' && <CheckCircle2 size={16} className="text-teal-600 shrink-0" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBackupImportMode('replace')}
                          className={`p-3 rounded-xl border text-xs font-bold text-start transition-all flex items-center justify-between ${
                            backupImportMode === 'replace'
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-800 dark:text-indigo-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span>
                            {lang === 'ar'
                              ? 'استعادة كاملة (استبدال السجلات الحالية بالنسخة الاحتياطية)'
                              : 'Full Restore (Replace current records with backup)'}
                          </span>
                          {backupImportMode === 'replace' && <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />}
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        disabled={isBackupProcessing}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Download size={18} />
                        <span>
                          {lang === 'ar' ? 'تصدير نسخة احتياطية (JSON)' : 'Export Backup (JSON)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerImportBackup}
                        disabled={isBackupProcessing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Upload size={18} />
                        <span>
                          {lang === 'ar' ? 'استيراد نسخة احتياطية (JSON)' : 'Import Backup (JSON)'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <input
            ref={backupFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportBackupFile}
          />
        </div>
      </main>

      {/* Gemini API Key Configuration Modal */}
      <AnimatePresence>
        {isApiModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
            onClick={() => setIsApiModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 16, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="bg-white dark:bg-[#111827] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/70 via-white to-teal-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-teal-950/30 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    <Key size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {t.apiModalTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {t.apiModalDesc}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveApiKeyToLocalStorage} className="p-6 space-y-5">
                {/* API Key Input with Show/Hide & Clear */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock size={13} className="text-indigo-500" />
                      <span>{t.apiKeyLabel}</span>
                    </label>
                    {geminiApiKey.trim() && (
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {lang === 'ar' ? 'محفوظ حالياً في المتصفح' : 'Currently Saved in Browser'}
                      </span>
                    )}
                  </div>

                  <div className="relative flex items-center" dir="ltr">
                    <input
                      type={showApiKeyPlain ? 'text' : 'password'}
                      value={apiKeyDraft}
                      onChange={(e) => {
                        setApiKeyDraft(e.target.value);
                        if (keyVerificationStatus.state !== 'idle') {
                          setKeyVerificationStatus({ state: 'idle' });
                        }
                      }}
                      placeholder={t.apiKeyPlaceholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl py-3 pl-4 pr-24 text-sm font-mono text-slate-900 dark:text-white outline-none transition-all"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      {apiKeyDraft && (
                        <button
                          type="button"
                          onClick={() => {
                            setApiKeyDraft('');
                            setKeyVerificationStatus({ state: 'idle' });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                          title={lang === 'ar' ? 'مسح الحقل' : 'Clear input'}
                        >
                          <X size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowApiKeyPlain(prev => !prev)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                        title={showApiKeyPlain ? (lang === 'ar' ? 'إخفاء المفتاح' : 'Hide key') : (lang === 'ar' ? 'إظهار المفتاح' : 'Show key')}
                      >
                        {showApiKeyPlain ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Model Selector: Free Open-Source Models + Google Gemini Models */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emerald-500" />
                        <span>
                          {lang === 'ar'
                            ? 'نماذج الذكاء الاصطناعي مفتوحة المصدر (مجانية • تعمل بدون مفتاح)'
                            : 'Free Open-Source AI Models (Zero API Key Required)'}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        FREE / OPEN SOURCE
                      </span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AI_MODELS.filter(m => m.provider === 'open-source').map((m) => {
                        const selected = apiModelDraft === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setApiModelDraft(m.id)}
                            className={`p-2.5 rounded-xl border text-start transition-all ${
                              selected
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate" dir="ltr">
                                {m.name}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                                {lang === 'ar' ? m.badgeAr : m.badgeEn}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                              {lang === 'ar' ? m.descAr : m.descEn}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <BrainCircuit size={13} className="text-indigo-500" />
                      <span>
                        {lang === 'ar'
                          ? 'نماذج Google Gemini (عبر مفتاح Gemini API)'
                          : 'Google Gemini Models (Requires Gemini API Key)'}
                      </span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AI_MODELS.filter(m => m.provider === 'gemini').map((m) => {
                        const selected = apiModelDraft === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setApiModelDraft(m.id)}
                            className={`p-2.5 rounded-xl border text-start transition-all ${
                              selected
                                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white" dir="ltr">
                                {m.name}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {lang === 'ar' ? m.badgeAr : m.badgeEn}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                              {lang === 'ar' ? m.descAr : m.descEn}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Test / Verify Key or Open-Source Model Button & Feedback Banner */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={isVerifyingKey || (!apiKeyDraft.trim() && !isOpenSourceModel(apiModelDraft))}
                    onClick={() => handleVerifyApiKey()}
                    className="w-full py-2.5 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={isVerifyingKey ? 'animate-spin' : ''} />
                    <span>
                      {isVerifyingKey
                        ? t.verifyingKey
                        : isOpenSourceModel(apiModelDraft) && !apiKeyDraft.trim()
                        ? lang === 'ar'
                          ? `فحص جاهزية النموذج المجاني (${getModelDisplayName(apiModelDraft)})`
                          : `Test Free Open-Source Model (${getModelDisplayName(apiModelDraft)})`
                        : t.verifyApiKey}
                    </span>
                  </button>

                  {keyVerificationStatus.state !== 'idle' && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                        keyVerificationStatus.state === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {keyVerificationStatus.state === 'success' ? (
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span>{keyVerificationStatus.message}</span>
                    </div>
                  )}
                </div>

                {/* Security & Local Storage Best-Practice Callout */}
                <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 space-y-1">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <ShieldAlert size={15} className="shrink-0" />
                    <span>{t.apiSecurityNoticeTitle}</span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                    {t.apiSecurityNoticeDesc}
                  </p>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  {geminiApiKey.trim() ? (
                    <button
                      type="button"
                      onClick={handleRemoveSavedApiKey}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={15} />
                      <span>{t.clearApiKey}</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2.5 ms-auto">
                    <button
                      type="button"
                      onClick={() => setIsApiModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs transition-colors"
                    >
                      {t.close}
                    </button>
                    <button
                      type="submit"
                      disabled={!apiKeyDraft.trim() && !isOpenSourceModel(apiModelDraft)}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>
                        {isOpenSourceModel(apiModelDraft) && !apiKeyDraft.trim()
                          ? lang === 'ar'
                            ? 'تفعيل النموذج المجاني مفتوح المصدر'
                            : 'Activate Free Open-Source Model'
                          : t.saveApiKey}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-5xl h-full rounded-3xl overflow-hidden flex flex-col shadow-2xl transition-colors"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0 transition-colors">
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Printer className="text-blue-500" size={24} />
                  {t.printPreview}
                </h3>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const iframe = document.querySelector('iframe');
                      if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.print();
                      }
                    }}
                    className="bg-slate-900 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                  >
                    <Printer size={18} />
                    {t.printReport}
                  </button>
                  <button 
                    onClick={() => exportPDF('all')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    <Save size={18} />
                    {t.download}
                  </button>
                  <button 
                    onClick={() => {
                      setIsPreviewOpen(false);
                      setPreviewUrl(null);
                    }}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-6 py-2 rounded-full font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-800 dark:bg-slate-950 p-4 overflow-hidden">
                <iframe 
                  src={previewUrl} 
                  className="w-full h-full rounded-xl border-none shadow-inner"
                  title="PDF Preview"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTutorial && (
          <Tutorial 
            lang={lang} 
            onClose={() => {
              setShowTutorial(false);
              localStorage.setItem('tutorialCompleted', 'true');
            }} 
            onStepChange={(step) => {
              if (step === 1) handleViewChange('dashboard');
              if (step >= 2 && step <= 5) handleViewChange('new-patient');
              if (step === 6) handleViewChange('analysis');
              if (step === 7) handleViewChange('dashboard');
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {summaryPatientId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {(() => {
                const p = patients.find(pat => pat.id === summaryPatientId);
                if (!p) return null;
                const analysis = p.data ? analyzeHearing(p.data) : null;
                const history = patients
                  .filter(hp => hp.name === p.name && hp.phone === p.phone)
                  .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

                return (
                  <div className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{p.name}</h3>
                        <p className="text-slate-500 dark:text-slate-400">{p.age} {t.years} • {p.phone}</p>
                      </div>
                      <button 
                        onClick={() => setSummaryPatientId(null)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                      >
                        <Plus className="rotate-45 text-slate-400" size={24} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">{t.leftEar}</p>
                        {analysis ? (
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{analysis.left.pta} dB</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{t[analysis.left.degree as keyof typeof t] || analysis.left.degree}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t[analysis.left.type as keyof typeof t] || analysis.left.type}</p>
                          </div>
                        ) : <p className="text-xs text-slate-400">---</p>}
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800/50">
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">{t.rightEar}</p>
                        {analysis ? (
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{analysis.right.pta} dB</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{t[analysis.right.degree as keyof typeof t] || analysis.right.degree}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t[analysis.right.type as keyof typeof t] || analysis.right.type}</p>
                          </div>
                        ) : <p className="text-xs text-slate-400">---</p>}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className={`text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Clock size={16} className="text-indigo-500" />
                        {t.lastVisits}
                      </h4>
                      <div className="space-y-2">
                        {history.map((h, i) => (
                          <div key={i} className={`flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{h.visitDate}</span>
                            <span className="text-[10px] text-slate-400 italic">{h.doctorName}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button 
                        onClick={() => { setFormData(p); handleViewChange('analysis'); setSummaryPatientId(null); }}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye size={18} />
                        {t.viewReport}
                      </button>
                      <button 
                        onClick={() => setSummaryPatientId(null)}
                        className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        {t.skip}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-3 ${
              toast.type === 'success' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-rose-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <Activity size={20} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      {isNoiseMonitoring && currentView !== 'new-patient' && currentView !== 'noise-check' && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-40 max-w-[calc(100vw-2rem)]">
          <NoiseMonitor 
            lang={lang} 
            isActive={isNoiseMonitoring}
            onToggle={(active) => {
              if (!active) noiseDetector.stop();
              setIsNoiseMonitoring(active);
            }}
            onNoiseLevelChange={(level) => {
              setCurrentNoiseLevel(level);
            }}
            onError={(error) => {
              showToast(error, 'error');
            }}
            threshold={30}
          />
        </div>
      )}
      {/* License & Subscription Activation Modal */}
      <ActivationModal 
        isOpen={isActivationModalOpen}
        onClose={() => setIsActivationModalOpen(false)}
        status={subscription}
        lang={lang}
        canDismiss={!subscription.trialExpired || subscription.isActivated}
        onActivationSuccess={async () => {
          await refreshSubscriptionStatus();
          showToast(
            lang === 'ar'
              ? '🎉 تم تفعيل النظام بنجاح! يمكنك الآن الاستخدام دون أي قيود.'
              : '🎉 System activated successfully! Unlimited access granted.',
            'success'
          );
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
