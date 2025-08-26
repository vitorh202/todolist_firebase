"use client";

import { useEffect, useState } from "react";

type RecurringTask = {
  id?: string;
  title: string;
  description: string;
  priority: "baixa" | "media" | "alta";
  weekday: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: { title: string; description: string; priority: RecurringTask["priority"]; weekday: number }) => void;
  initial?: RecurringTask | null;
};

export default function RecurringModal({ isOpen, onClose, onSave, initial }: Props) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [priority, setPriority] = useState<RecurringTask["priority"]>(initial?.priority || "media");
  const [weekday, setWeekday] = useState<number>(initial?.weekday ?? 1);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description);
      setPriority(initial.priority);
      setWeekday(initial.weekday);
    } else {
      setTitle("");
      setDescription("");
      setPriority("media");
      setWeekday(1);
    }
  }, [initial, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) {
      alert("Digite um título");
      return;
    }
    onSave({ title, description, priority, weekday });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-color)] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-[var(--primary-color)] mb-4">{initial ? "Editar recorrente" : "Nova recorrente"}</h3>

        <label className="block mb-3">
          <span className="text-sm text-[var(--muted)]">Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-color)] p-2 text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--primary-hover)]" />
        </label>

        <label className="block mb-3">
          <span className="text-sm text-[var(--muted)]">Descrição</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-color)] p-2 text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--primary-hover)]" />
        </label>

        <div className="flex gap-3 mb-3">
          <label className="flex-1">
            <span className="text-sm text-[var(--muted)]">Dia da semana</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-color)] p-2 text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--primary-hover)]">
              <option value={0}>Domingo</option>
              <option value={1}>Segunda</option>
              <option value={2}>Terça</option>
              <option value={3}>Quarta</option>
              <option value={4}>Quinta</option>
              <option value={5}>Sexta</option>
              <option value={6}>Sábado</option>
            </select>
          </label>

          <label className="flex-1">
            <span className="text-sm text-[var(--muted)]">Prioridade</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as RecurringTask["priority"])} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-color)] p-2 text-[var(--text-color)] outline-none focus:ring-2 focus:ring-[var(--primary-hover)]">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg bg-gray-700 px-4 py-2 text-[var(--alt-text)] transition hover:bg-gray-600">Cancelar</button>
          <button onClick={handleSave} className="rounded-lg bg-[var(--primary-color)] px-4 py-2 font-bold text-[var(--alt-text)] shadow-[var(--shadow-color)] transition hover:bg-[var(--primary-hover)]">Salvar</button>
        </div>
      </div>
    </div>
  );
}