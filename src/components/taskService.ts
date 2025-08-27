import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  limit
} from "firebase/firestore";
import type { Task, RecurringTask } from "./types";

export function subscribeToAllTasks(onUpdate: (tasks: Task[]) => void) {
  const q = collection(db, "tasks");
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Task[];
    onUpdate(items);
  });
}

export async function addTaskToDb(task: Omit<Task, "id">) {
  const ref = await addDoc(collection(db, "tasks"), task);
  // opcional: retorna ID gerado
  return ref.id;
}

export async function updateTaskInDb(id: string, data: Partial<Task>) {
  await setDoc(doc(db, "tasks", id), data, { merge: true });
}

export async function deleteTaskFromDb(id: string) {
  await deleteDoc(doc(db, "tasks", id));
}

/* Recurring tasks */
export function subscribeToRecurring(onUpdate: (items: RecurringTask[]) => void) {
  const q = collection(db, "recurringTasks");
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as RecurringTask[];
    onUpdate(items);
  });
}

export async function addRecurringToDb(r: Omit<RecurringTask, "id">) {
  const ref = await addDoc(collection(db, "recurringTasks"), r);
  return ref.id;
}

export async function updateRecurringInDb(id: string, data: Partial<RecurringTask>) {
  await setDoc(doc(db, "recurringTasks", id), data, { merge: true });
}

export async function deleteRecurringFromDb(id: string) {
  await deleteDoc(doc(db, "recurringTasks", id));
}

/* Utility: check if a recurring instance exists for given recurringId + date */
export async function recurringInstanceExists(recurringId: string, date: string) {
  const q = query(collection(db, "tasks"), where("recurringId", "==", recurringId), where("date", "==", date), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}