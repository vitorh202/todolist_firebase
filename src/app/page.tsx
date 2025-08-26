"use client";

import { useState, useEffect } from "react";
import TaskModal from "@/components/TaskModal";
import RecurringModal from "@/components/RecurringModal";

// Modelo de tarefa
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
  weekday: number; // 0 = domingo, 1 = segunda, ... 6 = sábado
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

export default function Home() {
  const [theme, setTheme] = useState<Theme>(() =>
  normalizeTheme(typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // const tarefas repetidas

  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTask | null>(null);



  const formatDateForDisplay = (inputDate: string) => {
    if (!inputDate) return "";
    const [year, month, day] = inputDate.split("-");
    return `${day}/${month}/${year}`;
  };

  // Data de hoje
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // separar listas
  const todayTasks = tasks.filter((t) => t.date === formattedDate);
  const futureTasks = tasks.filter((t) => t.date > formattedDate);

  const completedToday = todayTasks.filter((t) => t.done).length;
  const progress = todayTasks.length > 0 ? (completedToday / todayTasks.length) * 100 : 0;

  // controle de expandir tarefas -> agora usa uma "chave única"
  const [expandedTaskKey, setExpandedTaskKey] = useState<string | null>(null);

  const toggleExpand = (key: string) => {
    setExpandedTaskKey(expandedTaskKey === key ? null : key);
  };

    // Carregar do localStorage ao iniciar
    useEffect(() => {
      const stored = localStorage.getItem("tasks");
      if (stored) {
        const parsed: Task[] = JSON.parse(stored) as Task[];
    
        // 1. Pega a data de hoje e zera as horas.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        const filteredTasks: Task[] = parsed.filter((task) => {
          // 2. Cria a data da tarefa com base nas partes da string,
          //    usando o fuso horário local.
          const [year, month, day] = task.date.split('-').map(Number);
          const taskDate = new Date(year, month - 1, day);
    
          // 3. Compara se a data da tarefa é maior ou igual à de hoje.
          return taskDate.getTime() >= today.getTime();
        });
    
        const tasksWithDone: Task[] = filteredTasks.map((t) => ({
          ...t,
          done: t.done ?? false
        }));
    
        setTasks(tasksWithDone);
        localStorage.setItem("tasks", JSON.stringify(tasksWithDone));
      }
    }, []);

    // Salva permanente o tema

    useEffect(() => {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    // Salvar no localStorage sempre que as tarefas mudarem
    useEffect(() => {
      localStorage.setItem("tasks", JSON.stringify(tasks));
    }, [tasks]);

    // carregamento das tarefas repetitivas

        useEffect(() => {
      const stored = localStorage.getItem("recurringTasks");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as RecurringTask[];
          setRecurringTasks(parsed);
        } catch {
          setRecurringTasks([]);
        }
      }
    }, []);

    // salvar recorrentes sempre que mudarem
      useEffect(() => {
        localStorage.setItem("recurringTasks", JSON.stringify(recurringTasks));
      }, [recurringTasks]);


      // configurações das tarefas recorrentes
        const toISODate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const syncRecurringToToday = () => {
      const today = new Date();
      const todayWeekday = today.getDay(); // 0..6
      const todayDate = toISODate(today);

      // ids de tasks já criadas dnesse dia
      const existingRecurringIdsToday = new Set(
        tasks.filter((t) => t.date === todayDate && t.recurringId).map((t) => t.recurringId!)
      );

      // descubra quais recorrentes se aplicam hoje e ainda não foram instanciadas
      const toCreate = recurringTasks.filter(
        (r) => r.weekday === todayWeekday && !existingRecurringIdsToday.has(r.id)
      );

      if (toCreate.length === 0) return;

      const newInstances: Task[] = toCreate.map((r) => ({
        id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 6),
        title: r.title,
        description: r.description,
        priority: r.priority,
        done: false,
        date: todayDate,
        recurringId: r.id,
      }));
      setTasks((prev) => {
        const merged = [...prev, ...newInstances];
        return merged;
      });
    };
    //

    useEffect(() => {
      // hoje em yyyy-mm-dd (mesmo formato que toISODate)
      const todayDate = toISODate(new Date());
      const todayWeekday = new Date().getDay();
    
      // ids de recorrentes já instanciadas hoje
      const instantiatedToday = new Set(
        tasks
          .filter((t) => t.date === todayDate && t.recurringId)
          .map((t) => t.recurringId!)
      );
    
      // verifica se existe pelo menos 1 recorrente do dia que ainda não foi instanciada
      const needsSync = recurringTasks.some(
        (r) => r.weekday === todayWeekday && !instantiatedToday.has(r.id)
      );
    
      if (needsSync) {
        // chama a função que já cria as instâncias
        syncRecurringToToday();
      }
      // dependências: roda sempre que recurringTasks OU tasks mudarem
    }, [recurringTasks, tasks]);

    //Const de edição e criação das tarefas recorrentes

    const addRecurring = (r: Omit<RecurringTask, "id">) => {
      const newR: RecurringTask = { id: Date.now().toString(), ...r };
      setRecurringTasks((prev) => [...prev, newR]);
      // ao adicionar, sincronizamos para hoje imediatamente (caso se aplique)
      // setTimeout para garantir que local state tenha sido atualizado
      setTimeout(() => syncRecurringToToday(), 0);
    };

    // editar (mantém id)
    const editRecurring = (updated: RecurringTask) => {
      setRecurringTasks((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      const todayDate = toISODate(new Date());
      setTasks((prev) =>
        prev.map((t) =>
          t.recurringId === updated.id && t.date === todayDate ? { ...t, title: updated.title, description: updated.description, priority: updated.priority } : t
        )
      );
    };

    const deleteRecurring = (id: string) => {
      setRecurringTasks((prev) => prev.filter((r) => r.id !== id));
    };


  return (
    <main className="min-h-screen bg-theme transition-colors duration-300 font-mono text-[var(--text-color)]">
      {/* AppBar */}
      <header className="w-full fixed top-0 left-0 header-theme p-2 z-30">
        <div className="flex items-center">
          <div className="flex-1"></div>
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
          onClose={() => {
            setIsAdding(false);
            setEditingTask(null);
          }}
          initialTask={editingTask || undefined}
          onSave={(updated) => {
            if (editingTask) {
              // Edição
              setTasks(prev =>
                prev.map(task =>
                  task.id === editingTask.id ? { ...task, ...updated } : task
                )
              );
            } else {
              // Adição
              setTasks(prev => [
                ...prev,
                { ...updated, id: Date.now().toString(), done: false }
              ]);
            }
            setIsAdding(false);
            setEditingTask(null);
          }}
        />

        <RecurringModal
          isOpen={isRecurringModalOpen}
          onClose={() => { setIsRecurringModalOpen(false); setEditingRecurring(null); }}
          initial={editingRecurring || undefined}
          onSave={(payload) => {
            if (editingRecurring) {
              editRecurring({ id: editingRecurring.id, ...payload });
            } else {
              addRecurring(payload);
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
                    type="checkbox"
                    checked={t.done}
                    onChange={() => {
                      const newTasks = tasks.map((task) =>
                        `${task.date}|${task.title}` === key
                          ? { ...task, done: !task.done }
                          : task
                      );
                      setTasks(newTasks);
                    }}
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
                    onClick={() => {
                      setTasks(tasks.filter((task) => `${task.date}|${task.title}` !== key));
                    }}
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
                          onClick={() => setTasks(tasks.filter((x) => x !== t))}
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
