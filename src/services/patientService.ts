import { Patient, Task, Note } from '../types';
import { db, auth } from '../firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const isDesktop = false;

export const patientService = {
  // جلب المرضى (Real-time)
  subscribeToPatients(callback: (patients: Patient[]) => void): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const path = 'patients';
    const q = query(
      collection(db, path), 
      where('uid', '==', auth.currentUser.uid)
    );
    
    return onSnapshot(q, (snapshot) => {
      const patients = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      callback(patients);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Subscribe to a single patient
  subscribeToPatient(patientId: string, callback: (patient: Patient | null) => void): Unsubscribe {
    const path = `patients/${patientId}`;
    const docRef = doc(db, 'patients', patientId);
    
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as Patient);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  // Presence tracking
  async updatePresence(patientId: string, isViewing: boolean): Promise<void> {
    if (!auth.currentUser) return;
    const path = `presence/${patientId}/users/${auth.currentUser.uid}`;
    try {
      const presenceRef = doc(db, 'presence', patientId, 'users', auth.currentUser.uid);
      if (isViewing) {
        await setDoc(presenceRef, {
          uid: auth.currentUser.uid,
          displayName: auth.currentUser.displayName || auth.currentUser.email,
          lastActive: serverTimestamp()
        });
      } else {
        await deleteDoc(presenceRef);
      }
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  },

  subscribeToPresence(patientId: string, callback: (users: any[]) => void): Unsubscribe {
    const path = `presence/${patientId}/users`;
    const q = collection(db, 'presence', patientId, 'users');
    
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      callback(users);
    }, (error) => {
      console.error("Error subscribing to presence:", error);
    });
  },

  // Tasks (Real-time)
  subscribeToTasks(callback: (tasks: Task[]) => void): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const path = 'tasks';
    const q = query(
      collection(db, path),
      where('uid', '==', auth.currentUser.uid)
    );
    
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      callback(tasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Notes (Real-time)
  subscribeToNotes(callback: (notes: Note[]) => void): Unsubscribe {
    if (!auth.currentUser) return () => {};
    const path = 'notes';
    const q = query(
      collection(db, path),
      where('uid', '==', auth.currentUser.uid)
    );
    
    return onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Note))
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      callback(notes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // جلب المرضى
  async getAll(): Promise<Patient[]> {
    if (!auth.currentUser) return [];
    const path = 'patients';
    try {
      const q = query(
        collection(db, path), 
        where('uid', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // حفظ مريض جديد أو تحديثه
  async save(patient: Partial<Patient>): Promise<boolean> {
    if (!auth.currentUser) return false;
    const path = 'patients';
    try {
      // Filter out undefined values and 'id' for new patients
      const cleanData = Object.fromEntries(
        Object.entries(patient).filter(([k, v]) => v !== undefined && k !== 'id')
      );

      const data = {
        ...cleanData,
        uid: auth.currentUser.uid,
        createdAt: patient.createdAt || new Date().toISOString()
      };
      
      if (patient.id) {
        const docRef = doc(db, path, String(patient.id));
        await updateDoc(docRef, data as any);
      } else {
        await addDoc(collection(db, path), data);
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, patient.id ? OperationType.UPDATE : OperationType.CREATE, path);
      return false;
    }
  },

  // حذف مريض
  async delete(id: string | number): Promise<boolean> {
    const path = `patients/${id}`;
    try {
      await deleteDoc(doc(db, 'patients', String(id)));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      return false;
    }
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    if (!auth.currentUser) return [];
    const path = 'tasks';
    try {
      const q = query(
        collection(db, path),
        where('uid', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveTask(task: Partial<Task>): Promise<boolean> {
    if (!auth.currentUser) return false;
    const path = 'tasks';
    try {
      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(task).filter(([_, v]) => v !== undefined)
      );

      const data = {
        ...cleanData,
        uid: auth.currentUser.uid,
        createdAt: task.createdAt || new Date().toISOString()
      };
      
      if (task.id) {
        const docRef = doc(db, path, String(task.id));
        const updateData = { ...data };
        delete (updateData as any).id;
        await updateDoc(docRef, updateData as any);
      } else {
        await addDoc(collection(db, path), data);
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, task.id ? OperationType.UPDATE : OperationType.CREATE, path);
      return false;
    }
  },

  async deleteTask(id: string | number): Promise<boolean> {
    const path = `tasks/${id}`;
    try {
      await deleteDoc(doc(db, 'tasks', String(id)));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      return false;
    }
  },

  // Notes
  async getNotes(): Promise<Note[]> {
    if (!auth.currentUser) return [];
    const path = 'notes';
    try {
      const q = query(
        collection(db, path),
        where('uid', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Note))
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveNote(note: any): Promise<boolean> {
    if (!auth.currentUser) return false;
    const path = 'notes';
    try {
      const data = {
        ...note,
        uid: auth.currentUser.uid,
        createdAt: note.createdAt || new Date().toISOString()
      };
      
      if (note.id) {
        const docRef = doc(db, path, String(note.id));
        const updateData = { ...data };
        delete updateData.id;
        await updateDoc(docRef, updateData);
      } else {
        await addDoc(collection(db, path), data);
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, note.id ? OperationType.UPDATE : OperationType.CREATE, path);
      return false;
    }
  },

  async deleteNote(id: string | number): Promise<boolean> {
    const path = `notes/${id}`;
    try {
      await deleteDoc(doc(db, 'notes', String(id)));
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      return false;
    }
  },

  // Settings Store
  async getSetting(key: string, uid?: string): Promise<any> {
    if (uid) {
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          return userSnap.data()[key];
        }
      } catch (error) {
        console.error("Error getting setting from Firestore:", error);
      }
    }
    
    return localStorage.getItem(key);
  },

  async setSetting(key: string, value: any, uid?: string): Promise<void> {
    if (uid) {
      try {
        await updateDoc(doc(db, 'users', uid), { [key]: value });
      } catch (error) {
        console.error("Error setting setting in Firestore:", error);
      }
    }

    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  },

  // Export all patients to CSV
  async exportAllPatients(): Promise<string> {
    const patients = await this.getAll();
    if (patients.length === 0) return '';

    const frequencies = [250, 500, 1000, 2000, 4000, 8000];
    const headers = [
      'ID', 'Name', 'DOB', 'Age', 'Email', 'Phone', 'VisitDate', 'Doctor', 'Notes', 'AmbientNoise', 'CreatedAt',
      ...frequencies.map(f => `Right_AC_${f}`),
      ...frequencies.map(f => `Right_BC_${f}`),
      ...frequencies.map(f => `Left_AC_${f}`),
      ...frequencies.map(f => `Left_BC_${f}`),
      'Diagnosis', 'Feedback_Accuracy', 'Feedback_Usefulness', 'Feedback_Comments'
    ];

    const rows = patients.map(p => {
      const data = p.data || { right: { AC: {}, BC: {} }, left: { AC: {}, BC: {} } };
      const rightAC = frequencies.map(f => data.right?.AC?.[f] ?? '');
      const rightBC = frequencies.map(f => data.right?.BC?.[f] ?? '');
      const leftAC = frequencies.map(f => data.left?.AC?.[f] ?? '');
      const leftBC = frequencies.map(f => data.left?.BC?.[f] ?? '');

      return [
        p.id,
        `"${p.name || ''}"`,
        p.dob || '',
        p.age || '',
        p.email || '',
        p.phone || '',
        p.visitDate || '',
        `"${p.doctorName || ''}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`,
        p.ambientNoise || '',
        p.createdAt || '',
        ...rightAC,
        ...rightBC,
        ...leftAC,
        ...leftBC,
        `"${(p.diagnosis || '').replace(/"/g, '""')}"`,
        p.feedback?.accuracy || '',
        p.feedback?.usefulness || '',
        `"${(p.feedback?.comments || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  async saveFeedback(patientId: string, feedback: any): Promise<boolean> {
    const path = `patients/${patientId}`;
    try {
      const docRef = doc(db, 'patients', patientId);
      await updateDoc(docRef, { feedback });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      return false;
    }
  }
};
