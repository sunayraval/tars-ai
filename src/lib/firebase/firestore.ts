import { getFirestore, doc, collection, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from "firebase/firestore";
import { app } from "./config";

export const db = getFirestore(app);

// Types
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  onboardingCompleted?: boolean;
  workingHours?: string;
  breakPreference?: string;
  focusStyle?: string;
  [key: string]: any;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  preferences: UserPreferences;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  estimatedDuration?: number; // in minutes
  scheduledStart?: Timestamp | Date;
  scheduledEnd?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp | Date;
  context?: string;
}

export interface PlanningBacklog {
  id: string;
  date: string; // YYYY-MM-DD
  rawPlan: string;
  status: 'pending' | 'processed' | 'failed';
  createdAt: Timestamp | Date;
}

// Helpers

export const createUserDocument = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, user);
  }
  return userRef;
};

export const getUserDocument = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return snapshot.data() as User;
  }
  return null;
};

// Tasks
export const getUserTasks = async (uid: string) => {
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const snapshot = await getDocs(tasksRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

export const addTask = async (uid: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
  const tasksRef = doc(collection(db, 'users', uid, 'tasks'));
  const newTask: Task = {
    ...task,
    id: tasksRef.id,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await setDoc(tasksRef, newTask);
  return newTask;
};

// Chat History
export const getChatHistory = async (uid: string) => {
  const chatRef = collection(db, 'users', uid, 'chatHistory');
  const q = query(chatRef, orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
};

export const addChatMessage = async (uid: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
  const chatRef = doc(collection(db, 'users', uid, 'chatHistory'));
  const newMsg: ChatMessage = {
    ...message,
    id: chatRef.id,
    timestamp: new Date()
  };
  await setDoc(chatRef, newMsg);
  return newMsg;
};

// Planning Backlogs
export const getPlanningBacklogs = async (uid: string) => {
  const backlogRef = collection(db, 'users', uid, 'planningBacklogs');
  const q = query(backlogRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanningBacklog));
};

export const addPlanningBacklog = async (uid: string, backlog: Omit<PlanningBacklog, 'id' | 'createdAt'>) => {
  const backlogRef = doc(collection(db, 'users', uid, 'planningBacklogs'));
  const newBacklog: PlanningBacklog = {
    ...backlog,
    id: backlogRef.id,
    createdAt: new Date()
  };
  await setDoc(backlogRef, newBacklog);
  return newBacklog;
};
