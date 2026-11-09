export type TaskStatus = "todo" | "doing" | "done";

export type TaskPriority = "high" | "medium" | "low";

export type Task = {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  /** "daily" | "weekly" | "monthly" (legacy) or a compact rule like "2w", "3m", "10d", "1y". */
  repeat: string | null;
  priority: TaskPriority;
  /** Manual order within a column (lower = higher up). Null = not placed by hand yet. */
  position: number | null;
  /** Private tasks are only visible to their creator. Shared (false) by default. */
  is_private: boolean;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type Unit = "" | "pcs" | "g" | "kg" | "ml" | "l" | "tbsp" | "tsp" | "pack" | "can" | "bunch" | "clove";

export type Ingredient = { name: string; qty: number | null; unit: Unit };

export type Recipe = {
  id: string;
  household_id: string;
  title: string;
  servings: number;
  ingredients: Ingredient[];
  method: string | null;
  blurb: string | null;
  meal_type: "breakfast" | "main";
  style: "healthy" | "everyday" | "comfort" | null;
  protein: "fish" | "chicken" | "beef" | "veg" | null;
  is_special: boolean;
  kind: "cook" | "order" | "work";
  cook_minutes: number | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  image_url: string | null;
  source_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Meal = {
  id: string;
  household_id: string;
  date: string;
  slot: MealSlot;
  title: string;
  cook_id: string | null;
  recipe_id: string | null;
  portions: number;
  ingredients: Ingredient[];
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
  qty: number | null;
  unit: string;
  from_plan: boolean;
  plan_week: string | null;
  note: string | null;
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

export type GoogleAccount = {
  id: string;
  household_id: string;
  user_id: string;
  google_email: string;
  last_synced_at: string | null;
  sync_error: string | null;
};

export type CalendarRow = {
  id: string;
  household_id: string;
  account_id: string;
  owner_user_id: string;
  google_calendar_id: string;
  name: string;
  color: string;
  visible: boolean;
  can_write: boolean;
  is_primary: boolean;
};

export type CalendarEvent = {
  id: number;
  calendar_id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  html_link: string | null;
};
