import type { GroceryCategory } from "./types";

export const CATEGORY_ORDER: GroceryCategory[] = [
  "produce",
  "bakery",
  "dairy",
  "meat",
  "pantry",
  "frozen",
  "drinks",
  "household",
  "other",
];

// Rough aisle guess from the item name (English, Russian and Danish words).
// It only sets the default; anyone can change the aisle when adding an item.
const KEYWORDS: [GroceryCategory, string[]][] = [
  ["frozen", ["frozen", "ice cream", "заморож", "морожен", "frost", "is "]],
  ["produce", [
    "apple", "banana", "lemon", "lime", "orange", "berr", "grape", "pear", "avocado", "tomato", "potato", "onion", "garlic",
    "carrot", "cucumber", "pepper", "lettuce", "salad", "spinach", "kale", "broccoli", "cabbage", "zucchini", "courgette",
    "mushroom", "herb", "dill", "parsley", "basil", "coriander", "cilantro", "ginger", "leek", "celery", "fruit", "veg",
    "яблок", "банан", "лимон", "апельсин", "ягод", "груш", "авокадо", "помидор", "томат", "картоф", "картош", "лук", "чеснок",
    "морков", "огур", "перец", "салат", "шпинат", "капуст", "кабач", "гриб", "укроп", "петруш", "базилик", "кинз", "имбир",
    "æble", "banan", "citron", "tomat", "kartof", "løg", "hvidløg", "gulerod", "agurk", "peber", "salat", "svamp", "dild", "persille",
  ]],
  ["bakery", ["bread", "bun", "bagel", "croissant", "tortilla", "pita", "хлеб", "батон", "булк", "лаваш", "brød", "boller", "rugbrød"]],
  ["dairy", [
    "milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "egg", "kefir", "quark", "skyr", "feta", "mozzarella", "parmesan",
    "молок", "сыр", "масло слив", "сливоч", "йогурт", "сливк", "сметан", "яйц", "кефир", "творог", "mælk", "ost", "smør", "fløde", "æg",
  ]],
  ["meat", [
    "chicken", "beef", "pork", "mince", "bacon", "ham", "sausage", "salmon", "fish", "tuna", "shrimp", "prawn", "cod", "turkey", "lamb",
    "куриц", "курин", "говяд", "свин", "фарш", "бекон", "ветчин", "колбас", "сосиск", "лосос", "рыб", "тунец", "кревет", "треск", "индейк",
    "kylling", "oksekød", "svinekød", "hakket", "laks", "fisk", "rejer", "torsk",
  ]],
  ["drinks", ["water", "juice", "coffee", "tea", "beer", "wine", "soda", "вода", "сок", "кофе", "чай", "пиво", "вино", "vand", "juice", "kaffe", "øl", "vin"]],
  ["household", [
    "paper", "towel", "soap", "detergent", "dishwasher", "tissue", "nappies", "diaper", "wipes", "bin bag", "sponge", "shampoo", "toothpaste",
    "бумаг", "полотен", "мыло", "порошок", "средство", "салфет", "подгуз", "губк", "шампун", "зубная", "bleer", "papir", "sæbe", "vaskemiddel",
  ]],
  ["pantry", [
    "pasta", "rice", "flour", "sugar", "salt", "oil", "vinegar", "sauce", "beans", "lentil", "chickpea", "oats", "cereal", "honey", "jam",
    "spice", "stock", "can", "tin", "noodle", "buckwheat", "макарон", "паста", "рис", "мука", "сахар", "соль", "масло", "уксус", "соус",
    "фасол", "чечевиц", "нут", "овсян", "хлопья", "мёд", "мед", "варень", "специ", "бульон", "консерв", "лапш", "гречк",
    "ris", "mel", "sukker", "olie", "eddike", "bønner", "havregryn", "honning",
  ]],
];

export function guessCategory(name: string): GroceryCategory {
  const n = ` ${name.toLowerCase().trim()} `;
  for (const [cat, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return "other";
}

export function normaliseItem(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
