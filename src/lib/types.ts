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
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type Meal = {
  id: string;
  household_id: string;
  date: string;
  slot: MealSlot;
  title: string;
  cook_id: string | null;
  ingredients: string[];
  notes: string | null;
  cooked: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GroceryCategory =
  | "produce"
  | "dairy"
  | "meat"
  | "bakery"
  | "pantry"
  | "frozen"
  | "drinks"
  | "household"
  | "other";

export type GroceryItem = {
  id: string;
  household_id: string;
  name: string;
  category: GroceryCategory;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  archived: boolean;
  meal_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type BadgeRow = {
  id: number;
  household_id: string;
  user_id: string | null;
  badge_key: string;
  earned_at: string;
};
