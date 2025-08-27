"use client";

import { useState, useEffect, useCallback } from "react";
import TaskModal from "@/components/TaskModal";
import RecurringModal from "@/components/RecurringModal";
import { db, signInWithGoogle, logout, onAuthStateChangedClient } from "@/components/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";

/* ---------------------------
   Tipos
   --------------------------- */
type Task = {
  id: string;
  title: string;
  description: string;
  priority: "baixa" | "media" | "alta";
  done: boolean;
  date: string; // formato yyyy-mm-dd
  recurringId?: string | null;
};

type RecurringTask = {
  id: string;
  title: string;
  description: string;
  priority: "baixa" | "media" | "alta";
  weekday: number; // 0 = domingo ... 6 = sábado
};

type Theme = "light" | "pink" | "dark" | "terminal";
const THEME_KEY = "theme";

const normalizeTheme = (v: string | null): Theme => {
  if (!v) return "light";
  const t = v.toLowerCase();
  if (t === "pink") return "pink";
  if (t === "dark") return "dark";
  if (t === "terminal") return "terminal";
  return "light";
};

/* ---------------------------
   Helpers para collections por usuário
   --------------------------- */
const tasksCollectionRef = (uid: string) => collection(db, "users", uid, "tasks");
const recurringCollectionRef = (uid: string) => collection(db, "users", uid, "recurringTasks");

/* ---------------------------
   Componente
   --------------------------- */
export default function Home() {
  // theme localStorage (continuei mantendo local)
  const [theme, setTheme] = useState<Theme>(() =>
    normalizeTheme(typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null)
  );

  // auth user
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // tasks + recurring
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);

  // UI states
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTask | null>(null);

  // expand control
  const [expandedTaskKey, setExpandedTaskKey] = useState<string | null>(null);
  const toggleExpand = (key: string) => setExpandedTaskKey((prev) => (prev === key ? null : key));

  // Date helpers
  const formatDateForDisplay = (inputDate: string) => {
    if (!inputDate) return "";
    const [year, month, day] = inputDate.split("-");
    return `${day}/${month}/${year}`;
  };
  const toISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

  // derived lists
  const todayTasks = tasks.filter((t) => t.date === formattedDate);
  const futureTasks = tasks.filter((t) => t.date > formattedDate);
  const completedToday = todayTasks.filter((t) => t.done).length;
  const progress = todayTasks.length > 0 ? (completedToday / todayTasks.length) * 100 : 0;

  /* ---------------------------
     Auth: monitorar estado de login
     --------------------------- */
  useEffect(() => {
    setAuthLoading(true);
    const unsub = onAuthStateChangedClient((u) => {
      setUser(u as User | null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  /* ---------------------------
     Subscribes Firestore (somente quando user existe)
     --------------------------- */
  useEffect(() => {
    if (!user) {
      // limpar local state quando logout
      setTasks([]);
      setRecurringTasks([]);
      return;
    }

    const tasksUnsub = onSnapshot(tasksCollectionRef(user.uid), (snap) => {
      const items: Task[] = snap.docs.map((d) => {
        const data = d.data() as Partial<Task>;
        return {
          id: d.id,
          title: data.title,
          description: data.description,
          priority: data.priority,
          done: data.done ?? false,
          date: data.date,
          recurringId: data.recurringId ?? null,
        } as Task;
      });

      // filtrar tarefas antigas (manter hoje/futuro)
      const todayZero = new Date();
      todayZero.setHours(0, 0, 0, 0);
      const filtered = items.filter((task) => {
        const [y, m, d] = task.date.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setHours(0, 0, 0, 0);
        return dt.getTime() >= todayZero.getTime();
      });

      setTasks(filtered);
    });

    const recurringUnsub = onSnapshot(recurringCollectionRef(user.uid), (snap) => {
      const items: RecurringTask[] = snap.docs.map((d) => {
        const data = d.data() as Partial<RecurringTask>;
        return {
          id: d.id,
          title: data.title,
          description: data.description,
          priority: data.priority,
          weekday: data.weekday,
        } as RecurringTask;
      });
      setRecurringTasks(items);
    });

    return () => {
      tasksUnsub();
      recurringUnsub();
    };
  }, [user]);

  /* ---------------------------
     Firestore CRUD helpers (usando user.uid)
     --------------------------- */

  const addTask = async (payload: Omit<Task, "id" | "done">) => {
    if (!user) throw new Error("Usuário não autenticado");
    await addDoc(tasksCollectionRef(user.uid), { ...payload, done: false });
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    if (!user) throw new Error("Usuário não autenticado");
    await setDoc(doc(db, "users", user.uid, "tasks", id), patch, { merge: true });
  };

  const deleteTask = async (id: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    await deleteDoc(doc(db, "users", user.uid, "tasks", id));
  };

  const addRecurringToDb = async (r: Omit<RecurringTask, "id">) => {
    if (!user) throw new Error("Usuário não autenticado");
    await addDoc(recurringCollectionRef(user.uid), r);
  };

  const updateRecurringInDb = async (id: string, patch: Partial<RecurringTask>) => {
    if (!user) throw new Error("Usuário não autenticado");
    await setDoc(doc(db, "users", user.uid, "recurringTasks", id), patch, { merge: true });
  };

  const deleteRecurringFromDb = async (id: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    await deleteDoc(doc(db, "users", user.uid, "recurringTasks", id));
  };

  /* ---------------------------
     SYNC de recorrentes: instancia as recorrentes do dia (se ainda não existir)
     --------------------------- */
  const syncRecurringToToday = useCallback(async () => {
    if (!user) return;
    const todayDate = toISODate(new Date());
    const todayWeekday = new Date().getDay();

    // ids dos recurring já instanciados hoje (a partir do state tasks)
    const instantiatedToday = new Set(
      tasks.filter((t) => t.date === todayDate && t.recurringId).map((t) => t.recurringId!)
    );

    const toCreate = recurringTasks.filter((r) => r.weekday === todayWeekday && !instantiatedToday.has(r.id));
    if (toCreate.length === 0) return;

    // criar instâncias
    await Promise.all(
      toCreate.map((r) =>
        addDoc(tasksCollectionRef(user.uid), {
          title: r.title,
          description: r.description,
          priority: r.priority,
          done: false,
          date: todayDate,
          recurringId: r.id,
        })
      )
    );
    // onSnapshot atualizará a lista
  }, [recurringTasks, tasks, user]);

  // chamar sync quando necessário
  useEffect(() => {
    if (!user) return;
    const todayDate = toISODate(new Date());
    const instantiatedToday = new Set(tasks.filter((t) => t.date === todayDate && t.recurringId).map((t) => t.recurringId!));
    const needsSync = recurringTasks.some((r) => r.weekday === new Date().getDay() && !instantiatedToday.has(r.id));
    if (needsSync) {
      syncRecurringToToday().catch(console.error);
    }
  }, [recurringTasks, tasks, user, syncRecurringToToday]);

  /* ---------------------------
     Funções públicas (preservei nomes)
     --------------------------- */

  // tasks: wrapper usados pelos modais
  const handleAddTask = async (payload: Omit<Task, "id" | "done">) => {
    await addTask(payload);
  };

  const handleUpdateTask = async (id: string, patch: Partial<Task>) => {
    await updateTask(id, patch);
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id);
  };

  // recurring
  const addRecurring = async (r: Omit<RecurringTask, "id">) => {
    await addRecurringToDb(r);
    // sync automático via useEffect
  };

  const editRecurring = async (updated: RecurringTask) => {
    await updateRecurringInDb(updated.id, {
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      weekday: updated.weekday,
    });

    // atualiza instância de hoje (opcional)
    const todayDate = toISODate(new Date());
    const tasksToUpdate = tasks.filter((t) => t.recurringId === updated.id && t.date === todayDate);
    await Promise.all(tasksToUpdate.map((t) => updateTask(t.id, { title: updated.title, description: updated.description, priority: updated.priority })));
  };

  const deleteRecurring = async (id: string) => {
    await deleteRecurringFromDb(id);
    // not deleting task-instances intentionally
  };

  /* ---------------------------
     Theme persistence (mantive)
     --------------------------- */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  /* ---------------------------
     Sign-in/out helpers (callables from JSX)
     --------------------------- */
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Erro login:", err);
      alert("Erro ao tentar logar. Veja console.");
    }
  };
  const handleSignOut = async () => {
    try {
      await logout();
      // state será limpo pelo onAuthStateChanged effect
    } catch (err) {
      console.error("Erro logout:", err);
    }
  };

  return (
    <main className="min-h-screen bg-theme transition-colors duration-300 font-mono text-[var(--text-color)]">
      {/* AppBar */}
      <header className="w-full fixed top-0 left-0 header-theme p-2 z-30">
        <div className="flex items-center">
          <div className="flex-1">
          {authLoading ? (
            <div>carregando...</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">Olá, {user.displayName || user.email}</span>
              <button onClick={handleSignOut} className="px-3 py-1 rounded bg-gray-600">Sair</button>
            </div>
          ) : (
            <button onClick={handleSignIn} className="px-3 py-1 rounded btn-theme">Entrar com Google</button>
          )}
          </div>
          <h1 className="text-2xl font-bold text-[var(--primary-color)]">🖥️ Lista de Tarefas</h1>
          <p className="font-bold text-white-400 flex-1 text-right">
            Estilo:
            <select className="ml-2 rounded px-2 py-1 bg-[var(--card-bg)] border" onChange={(e) => setTheme(normalizeTheme(e.target.value))} value={theme}>
              <option value="light">Light</option>
              <option value="pink">Pink</option>
              <option value="dark">Dark</option>
              <option value="terminal">Terminal</option>
            </select>
          </p>
        </div>

      </header>

      {/* Main */}
      <div className="pt-20 flex flex-col items-center px-4 min-h-screen items-center justify-center">
        {/* BOTÃO abrir modal */}
        <button
          onClick={() => setIsAdding(true)}
          className="mb-6 px-6 py-2 rounded-lg font-bold btn-theme"
        >
          + Nova Tarefa
        </button>

        {/* Modal */}
        <TaskModal
        isOpen={isAdding || !!editingTask}
        onClose={() => { setIsAdding(false); setEditingTask(null); }}
        initialTask={editingTask || undefined}
        onSave={async (payload) => {
          if (!user) { alert("Faça login para salvar tarefas."); return; }
          if (editingTask) {
            // editingTask exists: update
            await handleUpdateTask(editingTask.id, payload as Partial<Task>);
          } else {
            await handleAddTask(payload as Omit<Task, "id" | "done">);
          }
          setIsAdding(false);
          setEditingTask(null);
        }}
      />

        <RecurringModal
        isOpen={isRecurringModalOpen || !!editingRecurring}
        onClose={() => { setIsRecurringModalOpen(false); setEditingRecurring(null); }}
        initial={editingRecurring || undefined}
        onSave={async (payload) => {
          if (!user) { alert("Faça login para salvar recorrentes."); return; }
          if (editingRecurring) {
            await editRecurring({ id: editingRecurring.id, ...payload });
          } else {
            await addRecurring(payload);
          }
          setIsRecurringModalOpen(false);
          setEditingRecurring(null);
        }}
        />

        {/* HOJE */}
        <div className="w-full max-w-2xl border border-theme rounded-2xl p-6 mb-10 bg-card shadow-theme">
          <h2 className="text-xl text-[var(--primary-color)] font-bold mb-4">
            📅 Tarefas de Hoje
          </h2>

          {/* Progresso */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="gray"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="var(--primary-color)"
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 35}
                  strokeDashoffset={2 * Math.PI * 35 * (1 - progress / 100)}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[var(--primary-color)] text-sm font-bold">
                {completedToday}/{todayTasks.length}
              </span>
            </div>
            <p className="text-[var(--primary-color)]">
              Progresso de hoje:{" "}
              <span className="font-bold">{Math.round(progress)}%</span>
            </p>
          </div>

          {/* Lista HOJE */}
          <ul className="space-y-3">

          {todayTasks.map((t) => {
            const key = `${t.date}|${t.title}`; 

            return (
              <li
              key={key}
                className="bg-[var(--bg-color)] p-3 rounded-lg border border-[var(--border)] hover:shadow-[0_0_10px_var(--shadow-color)]"
              >
                {/* Header da tarefa */}
                <div className="flex items-center justify-between">
                  {/* Checkbox separado */}
                  <input
                    type="checkbox" checked={t.done} onChange={() => handleUpdateTask(t.id, { done: !t.done })}
                    className="accent-[var(--border)] w-4 h-4 mr-2"
                  />

                  {/* Título */}
                  <div
                    className="flex-1 flex items-center cursor-pointer select-none"
                    onClick={() => toggleExpand(key)}
                  >
                    <span className={t.done ? "line-through text-[var(--primary-color)]" : ""}>
                      {t.title}
                    </span>

                    {/* Badge de prioridade */}
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-lg font-bold ${
                        t.priority === "alta"
                          ? "bg-red-500/30 text-red-400"
                          : t.priority === "baixa"
                          ? "bg-blue-500/30 text-blue-400"
                          : "bg-yellow-500/30 text-yellow-400"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                  {/* Botão de editar */}
                  <button
                    onClick={() => setEditingTask(t)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    ✏️
                  </button>

                  {/* Botão excluir */}
                  <button
                    onClick={() => handleDeleteTask(t.id)}
                    className="text-red-400 hover:text-red-600 font-bold ml-2"
                  >
                    ✕
                  </button>
                  </div>
                </div>

                {/* Detalhes expandíveis */}
                {expandedTaskKey === key && (
                  <div className="mt-2 p-3 border-t border-[var(--border)] text-[var(--text-color)]">
                    <p className="mb-1">{t.description || "Sem descrição"}</p>
                  </div>
                )}
              </li>
            );
          })}


            {todayTasks.length === 0 && (
              <p className="text-center text-[var(--primary-color)] italic">
                Nenhuma tarefa para hoje 🎉
              </p>
            )}
          </ul>
        </div>

        {/* FUTURO */}
        <div className="w-full max-w-2xl border border-theme rounded-2xl p-6 mb-10 bg-card shadow-theme">
          <h2 className="text-xl text-[var(--primary-color)] font-bold mb-4">
            📆 Tarefas Futuras
          </h2>
          {futureTasks.length === 0 && (
            <p className="text-center text-[var(--primary-color)] italic">
              Nenhuma tarefa futura definida...
            </p>
          )}
          {Object.entries(
            futureTasks.reduce<Record<string, Task[]>>((acc, t) => {
              if (!acc[t.date]) acc[t.date] = [];
              acc[t.date].push(t);
              return acc;
            }, {})
          ).map(([date, group]) => (
            <div key={date} className="mb-6">
              <h3 className="text-[var(--primary-color)] mb-2">
                📅 {formatDateForDisplay(date)}
              </h3>
              <ul className="space-y-2">
                {group.map((t, i) => {
                  const taskKey = `${date}-${i}`;
                  return (
                    <li
                      key={taskKey}
                      className="bg-[var(--bg-color)] p-3 rounded-lg border border-[var(--border)] hover:shadow-[0_0_10px_var(--shadow-color)]"
                    >
                      <div className="flex items-center justify-between">
                      <div
                    className="flex-1 flex items-center cursor-pointer select-none"
                    onClick={() => toggleExpand(taskKey)}
                  >
                    <span className={t.done ? "line-through text-[var(--primary-color)]" : ""}>
                      {t.title}
                    </span>

                    {/* Badge de prioridade */}
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs rounded-lg font-bold ${
                        t.priority === "alta"
                          ? "bg-red-500/30 text-red-400"
                          : t.priority === "baixa"
                          ? "bg-blue-500/30 text-blue-400"
                          : "bg-yellow-500/30 text-yellow-400"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                        <div className="flex gap-2">
                        {/* Botão de editar */}
                        <button
                          onClick={() => setEditingTask(t)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-red-400 hover:text-red-600 font-bold"
                        >
                          ✕
                        </button>
                        </div>
                      </div>

                      {/* Expansão */}
                      {expandedTaskKey === taskKey && (
                        <div className="mt-3 p-3 bg-black/40 rounded-lg border border-[var(--border)]">
                          <p className="text-[var(--text-color)] text-sm">
                            {t.description || "Sem descrição"}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

          {/* RECORRENTES */}
            <div className="w-full max-w-2xl rounded-2xl p-6 mb-6" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: "var(--primary-color)" }}>🔁 Tarefas Recorrentes</h2>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingRecurring(null); setIsRecurringModalOpen(true); }} className="px-3 py-1 rounded-lg btn-theme">
                    + Nova Recorrente
                  </button>
                </div>
              </div>

              {recurringTasks.length === 0 ? (
                <p className="text-[var(--muted)] italic">Nenhuma tarefa recorrente definida.</p>
              ) : (
                <ul className="space-y-2">
                  {recurringTasks.map((r) => (
                    <li key={r.id} className="bg-[var(--bg-color)] p-3 rounded-lg border border-[var(--border)] hover:shadow-[0_0_10px_var(--shadow-color)]">
                      <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[var(--text-color)]">Título: {r.title} <span className="ml-2 text-xs px-2 py-0.5 rounded bg-green-500/30 text-green-400">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][r.weekday]}</span></div>
                        <div className="text-sm italic text-[var(--muted)]">{r.description}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingRecurring(r); setIsRecurringModalOpen(true); }} className="text-blue-400">✏️</button>
                        <button onClick={() => deleteRecurring(r.id)} className="text-red-400">✕</button>
                      </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

      </div>
    </main>
  );
}
