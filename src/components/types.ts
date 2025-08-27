export type Task = {
    id: string;
    title: string;
    description: string;
    priority: "baixa" | "media" | "alta";
    done: boolean;
    date: string; // yyyy-mm-dd
    recurringId?: string | null;
  };
  
  export type RecurringTask = {
    id: string;
    title: string;
    description: string;
    priority: "baixa" | "media" | "alta";
    weekday: number; // 0 = domingo ... 6 = sábado
  };