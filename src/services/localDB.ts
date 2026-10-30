import { openDB, IDBPDatabase } from 'idb';
import { Patient, Task, Note } from '../types';

const DB_NAME = 'SmartAudiometryDB';
const DB_VERSION = 2;

class LocalDB {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        if (!db.objectStoreNames.contains('patients')) {
          db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }

  async getAllPatients(): Promise<Patient[]> {
    const db = await this.db;
    return db.getAll('patients');
  }

  async savePatient(patient: Partial<Patient>): Promise<string | number> {
    const db = await this.db;
    const data = { ...patient };
    if (!data.id) {
      delete data.id;
      return db.add('patients', data) as Promise<any>;
    } else {
      await db.put('patients', data as any);
      return data.id as string | number;
    }
  }

  async deletePatient(id: string | number): Promise<void> {
    const db = await this.db;
    await db.delete('patients', id);
  }

  async getAllTasks(): Promise<Task[]> {
    const db = await this.db;
    return db.getAll('tasks');
  }

  async saveTask(task: Partial<Task>): Promise<string | number> {
    const db = await this.db;
    const data = { ...task };
    if (!data.id) {
      delete data.id;
      return db.add('tasks', data) as Promise<any>;
    } else {
      await db.put('tasks', data as any);
      return data.id as string | number;
    }
  }

  async deleteTask(id: string | number): Promise<void> {
    const db = await this.db;
    await db.delete('tasks', id);
  }

  async getAllNotes(): Promise<Note[]> {
    const db = await this.db;
    return db.getAll('notes');
  }

  async saveNote(note: Partial<Note>): Promise<string | number> {
    const db = await this.db;
    const data = { ...note };
    if (!data.id) {
      delete data.id;
      return db.add('notes', data) as Promise<any>;
    } else {
      await db.put('notes', data as any);
      return data.id as string | number;
    }
  }

  async deleteNote(id: string | number): Promise<void> {
    const db = await this.db;
    await db.delete('notes', id);
  }

  async getSetting(key: string): Promise<any> {
    const db = await this.db;
    return db.get('settings', key);
  }

  async setSetting(key: string, value: any): Promise<void> {
    const db = await this.db;
    await db.put('settings', value, key);
  }

  async exportBackup(): Promise<{
    app: string;
    version: number;
    exportedAt: string;
    patients: Patient[];
    tasks: Task[];
    notes: Note[];
    settings: Record<string, any>;
  }> {
    const db = await this.db;
    const [patients, tasks, notes] = await Promise.all([
      db.getAll('patients'),
      db.getAll('tasks'),
      db.getAll('notes'),
    ]);

    const settingKeys = [
      'language',
      'darkMode',
      'hospitalName',
      'hospitalAddress',
      'hospitalPhone',
      'hospitalLogo',
      'geminiApiKey',
    ];
    const settings: Record<string, any> = {};
    for (const key of settingKeys) {
      const val = await db.get('settings', key);
      if (val !== undefined) {
        settings[key] = val;
      }
    }

    try {
      const model = localStorage.getItem('gemini_model');
      if (model) settings.geminiModel = model;
    } catch {}

    return {
      app: 'SmartAudiometry',
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      patients,
      tasks,
      notes,
      settings,
    };
  }

  async importBackup(
    backupData: any,
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<{ patientsCount: number; tasksCount: number; notesCount: number }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('INVALID_BACKUP_FORMAT');
    }

    const patientsList: Partial<Patient>[] = Array.isArray(backupData)
      ? backupData
      : Array.isArray(backupData.patients)
      ? backupData.patients
      : [];

    const tasksList: Partial<Task>[] =
      !Array.isArray(backupData) && Array.isArray(backupData.tasks)
        ? backupData.tasks
        : [];

    const notesList: Partial<Note>[] =
      !Array.isArray(backupData) && Array.isArray(backupData.notes)
        ? backupData.notes
        : [];

    const settingsObj: Record<string, any> =
      !Array.isArray(backupData) && backupData.settings && typeof backupData.settings === 'object'
        ? backupData.settings
        : {};

    if (
      !Array.isArray(backupData) &&
      !Array.isArray(backupData.patients) &&
      !Array.isArray(backupData.tasks) &&
      !Array.isArray(backupData.notes) &&
      Object.keys(settingsObj).length === 0
    ) {
      throw new Error('INVALID_BACKUP_FORMAT');
    }

    const db = await this.db;

    if (mode === 'replace') {
      if (Array.isArray(backupData) || Array.isArray(backupData.patients)) {
        await db.clear('patients');
      }
      if (!Array.isArray(backupData) && Array.isArray(backupData.tasks)) {
        await db.clear('tasks');
      }
      if (!Array.isArray(backupData) && Array.isArray(backupData.notes)) {
        await db.clear('notes');
      }
    }

    let patientsCount = 0;
    for (const p of patientsList) {
      if (p && typeof p === 'object' && p.name) {
        const record = { ...p };
        if (mode === 'merge') {
          delete record.id;
        }
        await this.savePatient(record);
        patientsCount++;
      }
    }

    let tasksCount = 0;
    for (const tk of tasksList) {
      if (tk && typeof tk === 'object' && tk.title) {
        const record = { ...tk };
        if (mode === 'merge') {
          delete record.id;
        }
        await this.saveTask(record);
        tasksCount++;
      }
    }

    let notesCount = 0;
    for (const nt of notesList) {
      if (nt && typeof nt === 'object' && nt.content) {
        const record = { ...nt };
        if (mode === 'merge') {
          delete record.id;
        }
        await this.saveNote(record);
        notesCount++;
      }
    }

    for (const [key, value] of Object.entries(settingsObj)) {
      if (value !== undefined) {
        await db.put('settings', value, key);
      }
    }

    try {
      localStorage.setItem('smart_audiometry_seeded_timeline_v1', 'true');
      if (settingsObj.geminiModel) {
        localStorage.setItem('gemini_model', String(settingsObj.geminiModel));
      }
      if (settingsObj.geminiApiKey) {
        localStorage.setItem('gemini_api_key', String(settingsObj.geminiApiKey));
        localStorage.setItem('smart_audiometry_gemini_api_key', String(settingsObj.geminiApiKey));
      }
    } catch {}

    return { patientsCount, tasksCount, notesCount };
  }
}

export const localDB = new LocalDB();

