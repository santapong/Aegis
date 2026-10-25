export type StoryId = "business" | "personal";
export type RecordEntry = {
  id: string;
  day: number;
  title: string;
  category: string;
  type: "income" | "expense";
  amount: number;
};
export type PlannedEntry = Omit<RecordEntry, "type"> & {
  type: "income" | "expense" | "savings";
};
export type Story = {
  id: StoryId;
  name: string;
  eyebrow: string;
  description: string;
  question: string;
  opening: number;
  records: RecordEntry[];
  plans: PlannedEntry[];
  budget: { name: string; category: string; limit: number };
  expense: { title: string; amount: number };
  scope: string;
};
export const stories: Record<StoryId, Story> = {
  business: {
    id: "business",
    name: "Business X",
    eyebrow: "A small design studio",
    description:
      "An owner has received a project deposit. Contractors and operating costs are due before the month ends.",
    question: "What changes if the final client payment arrives late?",
    opening: 60000,
    records: [
      {
        id: "b1",
        day: 2,
        title: "Project deposit",
        category: "Client work",
        type: "income",
        amount: 50000,
      },
      {
        id: "b2",
        day: 3,
        title: "Studio rent",
        category: "Rent",
        type: "expense",
        amount: 18000,
      },
      {
        id: "b3",
        day: 5,
        title: "Design software",
        category: "Operations",
        type: "expense",
        amount: 3000,
      },
    ],
    plans: [
      {
        id: "b4",
        day: 15,
        title: "Final client payment",
        category: "Client work",
        type: "income",
        amount: 90000,
      },
      {
        id: "b5",
        day: 20,
        title: "Contractor costs",
        category: "Contractors",
        type: "expense",
        amount: 65000,
      },
      {
        id: "b6",
        day: 23,
        title: "Hosting & tools",
        category: "Operations",
        type: "expense",
        amount: 4000,
      },
      {
        id: "b7",
        day: 26,
        title: "Equipment purchase",
        category: "Equipment",
        type: "expense",
        amount: 12000,
      },
      {
        id: "b8",
        day: 28,
        title: "Business reserve",
        category: "Reserve",
        type: "savings",
        amount: 10000,
      },
    ],
    budget: {
      name: "Monthly operations",
      category: "Operations",
      limit: 12000,
    },
    expense: { title: "Studio supplies", amount: 1500 },
    scope:
      "A single owner's cash-planning example. Company accounts, invoicing, payroll and team permissions are outside this demo.",
  },
  personal: {
    id: "personal",
    name: "A personal month",
    eyebrow: "Salary, side income & everyday life",
    description:
      "Mina has received her salary and paid rent. She is planning everyday costs and a contribution to her emergency fund.",
    question: "Can the month's plan still work if side income is delayed?",
    opening: 18000,
    records: [
      {
        id: "p1",
        day: 1,
        title: "Monthly salary",
        category: "Salary",
        type: "income",
        amount: 45000,
      },
      {
        id: "p2",
        day: 2,
        title: "Rent",
        category: "Housing",
        type: "expense",
        amount: 12000,
      },
      {
        id: "p3",
        day: 4,
        title: "Groceries",
        category: "Food",
        type: "expense",
        amount: 2400,
      },
      {
        id: "p4",
        day: 5,
        title: "Commuting",
        category: "Transport",
        type: "expense",
        amount: 1600,
      },
    ],
    plans: [
      {
        id: "p5",
        day: 15,
        title: "Side-project payment",
        category: "Freelance",
        type: "income",
        amount: 8000,
      },
      {
        id: "p6",
        day: 18,
        title: "Utilities",
        category: "Bills",
        type: "expense",
        amount: 2500,
      },
      {
        id: "p7",
        day: 24,
        title: "Remaining groceries",
        category: "Food",
        type: "expense",
        amount: 3600,
      },
      {
        id: "p8",
        day: 28,
        title: "Emergency fund",
        category: "Savings",
        type: "savings",
        amount: 5000,
      },
    ],
    budget: { name: "Monthly food budget", category: "Food", limit: 6000 },
    expense: { title: "Groceries top-up", amount: 600 },
    scope:
      "Mina and all amounts are fictional. This example tracks one person's money, with no bank connection or real transfers.",
  },
};
export const money = (amount: number) =>
  new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
const rounded = (amount: number) => Math.round(amount * 100) / 100;
export function summarize(
  story: Story,
  extras: RecordEntry[],
  delayed: boolean,
) {
  const records = [...story.records, ...extras];
  const income = records
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const spent = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);
  const recorded = rounded(story.opening + income - spent);
  const plannedIncome = delayed
    ? 0
    : story.plans
        .filter((p) => p.type === "income")
        .reduce((sum, p) => sum + p.amount, 0);
  const plannedCosts = story.plans
    .filter((p) => p.type === "expense")
    .reduce((sum, p) => sum + p.amount, 0);
  const reserved = story.plans
    .filter((p) => p.type === "savings")
    .reduce((sum, p) => sum + p.amount, 0);
  const remaining = rounded(recorded + plannedIncome - plannedCosts - reserved);
  const budgetUsed = rounded(
    records
      .filter(
        (r) => r.type === "expense" && r.category === story.budget.category,
      )
      .reduce((sum, r) => sum + r.amount, 0),
  );
  const points = [
    { day: 10, amount: recorded, title: "Recorded through 10 Oct" },
  ];
  let running = recorded;
  for (const plan of story.plans) {
    if (plan.type === "income" && delayed) continue;
    running = rounded(
      running + (plan.type === "income" ? plan.amount : -plan.amount),
    );
    points.push({ day: plan.day, amount: running, title: plan.title });
  }
  points.push({ day: 31, amount: remaining, title: "Month end, after plans" });
  return {
    records,
    income,
    spent,
    recorded,
    plannedIncome,
    plannedCosts,
    reserved,
    remaining,
    budgetUsed,
    points,
  };
}
