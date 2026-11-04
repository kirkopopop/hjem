export type TaskStatus = "todo" | "doing" | "done";

export type Task = {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  repeat: "daily" | "weekly" | "monthly" | null;
  points: number;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
