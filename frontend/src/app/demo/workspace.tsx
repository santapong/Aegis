"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleHelp,
  Plus,
  RotateCcw,
  UserRound,
} from "lucide-react";
import {
  money,
  stories,
  summarize,
  type StoryId,
  type RecordEntry,
} from "./scenarios";
import s from "./demo.module.css";

type StoryState = {
  extras: RecordEntry[];
  delayed: boolean;
  title: string;
  amount: string;
};
const fresh = (id: StoryId): StoryState => ({
  extras: [],
  delayed: false,
  title: stories[id].expense.title,
  amount: String(stories[id].expense.amount),
});
const views = ["Recorded transactions", "Upcoming plans"];

export function DemoWorkspace() {
  const [ready, setReady] = useState(false);
  const [id, setId] = useState<StoryId>("personal");
  const [state, setState] = useState<Record<StoryId, StoryState>>(() => ({
    business: fresh("business"),
    personal: fresh("personal"),
  }));
  const [view, setView] = useState(1);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const addButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setReady(true);
    if (new URLSearchParams(window.location.search).get("story") === "business") setId("business");
  }, []);
  const story = stories[id];
  const local = state[id];
  const total = summarize(story, local.extras, local.delayed);
  const baseline = summarize(story, [], false);
  const visiblePlans = local.delayed
    ? [
        ...story.plans.filter((plan) => plan.type !== "income"),
        ...story.plans.filter((plan) => plan.type === "income"),
      ]
    : story.plans;
  const over = total.budgetUsed > story.budget.limit;
  const update = (patch: Partial<StoryState>) =>
    setState((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...patch },
    }));
  const choose = (next: StoryId) => {
    setId(next);
    setMessage("");
    setFormOpen(false);
  };
  const reset = () => {
    setState((previous) => ({ ...previous, [id]: fresh(id) }));
    setFormOpen(false);
    setView(1);
    setMessage(`${story.name} reset to the original example.`);
  };
  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(local.amount);
    if (
      !local.title.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000
    ) {
      setMessage(
        "Enter a description and an amount between ฿0.01 and ฿1,000,000.",
      );
      return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    const record: RecordEntry = {
      id: `${id}-extra-${local.extras.length}`,
      day: 10,
      title: local.title.trim(),
      category: story.budget.category,
      type: "expense",
      amount: roundedAmount,
    };
    update({ extras: [...local.extras, record] });
    setView(0);
    setFormOpen(false);
    addButton.current?.focus();
    setMessage(
      `${record.title}: ${money(roundedAmount)} added to the example. The recorded total and ${story.budget.category} budget have updated.`,
    );
  }
  function changeTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
    setView(next);
    tabs.current[next]?.focus();
  }
  return (
    <>
      <div
        className={s.storySwitch}
        role="group"
        aria-label="Choose a demo story"
      >
        <button
          type="button"
          disabled={!ready}
          aria-pressed={id === "business"}
          onClick={() => choose("business")}
        >
          <BriefcaseBusiness size={20} aria-hidden="true" />
          <span>
            Business X<small>A small studio’s month</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-pressed={id === "personal"}
          onClick={() => choose("personal")}
        >
          <UserRound size={20} aria-hidden="true" />
          <span>
            A personal month<small>Everyday money & a savings goal</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      <noscript>
        <p className={s.noScript}>
          Enable JavaScript to switch stories and try changes. The original
          Business X example is readable below.
        </p>
      </noscript>
      <section className={s.workspace} aria-labelledby="story-title">
        <aside className={s.storyAside}>
          <p className={s.eyebrow}>THE STORY</p>
          <h2 id="story-title">{story.name}</h2>
          <p className={s.storyRole}>{story.eyebrow}</p>
          <p>{story.description}</p>
          <div className={s.question}>
            <CircleHelp size={18} aria-hidden="true" />
            <h3>{story.question}</h3>
          </div>
          <ol className={s.steps}>
            <li>
              <strong>Start with records</strong>
              <span>What has already come in or gone out?</span>
            </li>
            <li>
              <strong>Look at the dates</strong>
              <span>What income and costs are still planned?</span>
            </li>
            <li>
              <strong>Try a change</strong>
              <span>Add an expense or delay a payment below.</span>
            </li>
          </ol>
          <p className={s.scope}>{story.scope}</p>
          <Link href="/docs/guides">
            How to do this in Aegis <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </aside>
        <div className={s.canvas}>
          <div className={s.workspaceTop}>
            <div>
              <span className={s.sampleDot} /> SAMPLE WORKSPACE{" "}
              <span className={s.asOf}>as of 10 October 2026</span>
            </div>
            <button
              type="button"
              className={s.reset}
              onClick={reset}
              disabled={!ready}
            >
              <RotateCcw size={14} aria-hidden="true" /> Reset this story
            </button>
          </div>
          <div className={s.monthTitle}>
            <div>
              <p>YOUR MONTH, CONNECTED</p>
              <h3>
                October <span>2026</span>
              </h3>
            </div>
            <span>
              <CalendarDays size={15} aria-hidden="true" /> All amounts in THB
            </span>
          </div>
          <div className={s.stats}>
            <div>
              <span>Cash in the example</span>
              <strong>{money(total.recorded)}</strong>
              <small>Opening cash + recorded income − spending</small>
            </div>
            <div>
              <span>Still expected this month</span>
              <strong className={s.income}>{money(total.plannedIncome)}</strong>
              <small>
                {local.delayed
                  ? "The expected payment moved to 5 Nov"
                  : "Planned income, not yet received"}
              </small>
            </div>
            <div
              className={total.remaining < 0 ? s.negativeStat : s.resultStat}
            >
              <span>
                {total.remaining < 0
                  ? "Uncovered in this plan"
                  : "Left after this month’s plans"}
              </span>
              <strong>{money(Math.abs(total.remaining))}</strong>
              <small>After planned costs and the reserve goal</small>
            </div>
          </div>
          <div className={s.projection}>
            <div className={s.panelHeading}>
              <h4>A view of what’s ahead</h4>
              <span>
                <i /> Illustrative projection
              </span>
            </div>
            <Projection points={total.points} />
            <p className={s.chartNote}>
              Based only on the records and plans shown here. This demo
              calculation is not a bank balance or a guaranteed forecast.
            </p>
            <details className={s.math}>
              <summary>How is the remainder calculated?</summary>
              <dl>
                <div>
                  <dt>Opening cash on 1 Oct</dt>
                  <dd>{money(story.opening)}</dd>
                </div>
                <div>
                  <dt>Recorded income</dt>
                  <dd>+ {money(total.income)}</dd>
                </div>
                <div>
                  <dt>Recorded expenses</dt>
                  <dd>− {money(total.spent)}</dd>
                </div>
                <div>
                  <dt>Expected income in October</dt>
                  <dd>+ {money(total.plannedIncome)}</dd>
                </div>
                <div>
                  <dt>Planned expenses</dt>
                  <dd>− {money(total.plannedCosts)}</dd>
                </div>
                <div>
                  <dt>Planned reserve contribution</dt>
                  <dd>− {money(total.reserved)}</dd>
                </div>
                <div className={s.mathTotal}>
                  <dt>October remainder</dt>
                  <dd>{money(total.remaining)}</dd>
                </div>
              </dl>
              <p>
                A savings plan sets an intention. It does not move money or
                update a savings goal automatically.
              </p>
            </details>
          </div>
          <div className={s.tryChange}>
            <div>
              <p className={s.eyebrow}>TRY A CHANGE</p>
              <h4>What if the payment is late?</h4>
              <p>
                Move {story.plans[0].title.toLowerCase()} from 15 Oct to 5 Nov.
              </p>
            </div>
            <label className={s.delayControl}>
              <input
                type="checkbox"
                checked={local.delayed}
                disabled={!ready}
                onChange={(e) => {
                  update({ delayed: e.target.checked });
                  setMessage(
                    e.target.checked
                      ? "Expected income moved to 5 November. October’s plan has updated."
                      : "Expected income restored to 15 October.",
                  );
                }}
              />
              <span>Payment arrives next month</span>
            </label>
          </div>
          {local.delayed && (
            <div className={s.changeResult}>
              <ArrowRight size={17} aria-hidden="true" />
              <p>
                Moving the income changes the original month-end remainder of{" "}
                <strong>{money(baseline.remaining)}</strong> to{" "}
                <strong>{money(total.remaining)}</strong>
                {local.extras.length
                  ? ", including your added expenses"
                  : ""}.{" "}
                {total.remaining < 0
                  ? "The listed commitments and reserve goal now exceed the money in this example."
                  : "The listed commitments still fit within the money in this example."}
              </p>
            </div>
          )}
          <div className={s.recordsHeader}>
            <div
              className={s.viewTabs}
              role="tablist"
              aria-label="Explore the example records"
            >
              {views.map((label, index) => (
                <button
                  key={label}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`demo-tab-${index}`}
                  aria-controls="demo-records-panel"
                  aria-selected={view === index}
                  tabIndex={view === index ? 0 : -1}
                  disabled={!ready}
                  onClick={() => setView(index)}
                  onKeyDown={(event) => changeTab(event, index)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className={s.addButton}
              ref={addButton}
              disabled={!ready}
              type="button"
              aria-expanded={formOpen}
              aria-controls="demo-expense-form"
              onClick={() => setFormOpen(!formOpen)}
            >
              <Plus size={15} aria-hidden="true" /> Add sample expense
            </button>
          </div>
          <div
            id="demo-expense-form"
            hidden={!formOpen}
            className={s.expenseForm}
          >
            <form onSubmit={addExpense}>
              <p>
                Add a recorded expense on <strong>10 Oct</strong>, in{" "}
                <strong>{story.budget.category}</strong>. Your demo budget
                updates too.
              </p>
              <div className={s.formFields}>
                <label>
                  Description
                  <input
                    required
                    maxLength={80}
                    value={local.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                <label>
                  Amount (THB)
                  <input
                    type="number"
                    required
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={local.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                  />
                </label>
                <button type="submit">
                  Add to example <Check size={15} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
          <div className={s.status} role="status" aria-live="polite">
            {message}
          </div>
          <div
            role="tabpanel"
            id="demo-records-panel"
            aria-labelledby={`demo-tab-${view}`}
            tabIndex={0}
            className={s.recordPanel}
          >
            <p className={s.tableIntro}>
              {view === 0
                ? "These transactions have already happened in the story. They contribute to recorded income and spending."
                : "These are future intentions. A planned cost is separate from a recorded expense."}
            </p>
            <div className={s.entryList}>
              {(view === 0 ? total.records : visiblePlans).map((entry) => (
                <div className={s.entry} key={entry.id}>
                  <span className={s.date}>
                    {view === 1 && entry.type === "income" && local.delayed
                      ? "05"
                      : String(entry.day).padStart(2, "0")}
                    <small>
                      {view === 1 && entry.type === "income" && local.delayed
                        ? "NOV"
                        : "OCT"}
                    </small>
                  </span>
                  <div className={s.entryName}>
                    <strong>{entry.title}</strong>
                    <small>
                      {entry.category} ·{" "}
                      {view === 0
                        ? "Recorded"
                        : entry.type === "savings"
                          ? "Planned reserve"
                          : "Planned"}
                    </small>
                  </div>
                  <span
                    className={`${s.entryAmount} ${entry.type === "income" ? s.income : ""}`}
                  >
                    {entry.type === "income" ? (
                      <ArrowDownLeft size={13} aria-hidden="true" />
                    ) : (
                      <ArrowUpRight size={13} aria-hidden="true" />
                    )}
                    {entry.type === "income" ? "+" : "−"}
                    {money(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className={s.budget}>
            <div className={s.panelHeading}>
              <div>
                <p className={s.eyebrow}>ONE BUDGET TO WATCH</p>
                <h4>{story.budget.name}</h4>
              </div>
              <span className={over ? s.overBudget : ""}>
                {over
                  ? `${money(total.budgetUsed - story.budget.limit)} over budget`
                  : `${money(story.budget.limit - total.budgetUsed)} remaining`}
              </span>
            </div>
            <div className={s.budgetNumbers}>
              <strong>{money(total.budgetUsed)}</strong>
              <span>recorded of {money(story.budget.limit)}</span>
            </div>
            <div
              className={s.meter}
              role="meter"
              aria-label={`${story.budget.name} spending`}
              aria-valuemin={0}
              aria-valuemax={story.budget.limit}
              aria-valuenow={Math.min(total.budgetUsed, story.budget.limit)}
              aria-valuetext={`${money(total.budgetUsed)} spent of ${money(story.budget.limit)}${over ? ", over budget" : ""}`}
            >
              <span
                className={over ? s.overFill : ""}
                style={{
                  width: `${Math.min((total.budgetUsed / story.budget.limit) * 100, 100)}%`,
                }}
              />
            </div>
            <p>
              Only recorded {story.budget.category.toLowerCase()} expenses count
              here. Upcoming plans have not been spent yet.
            </p>
          </div>
          <div className={s.demoFoot}>
            <span>Changes stay in this demo and reset on reload.</span>
            <Link href="/docs/guides/first-steps">
              Try your first real record{" "}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
function Projection({
  points,
}: {
  points: { day: number; amount: number; title: string }[];
}) {
  const low = Math.min(0, ...points.map((p) => p.amount));
  const high = Math.max(1, ...points.map((p) => p.amount)) * 1.12;
  const x = (day: number) => 56 + ((day - 10) / 21) * 538;
  const y = (amount: number) => 16 + ((high - amount) / (high - low)) * 150;
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.amount)}`)
    .join(" ");
  return (
    <svg
      className={s.chart}
      viewBox="0 0 620 202"
      role="img"
      aria-label={`Illustrative October plan: starts with ${money(points[0].amount)} on 10 October and ends with ${money(points[points.length - 1].amount)} after plans.`}
    >
      {[high * 0.8, high * 0.4, 0].map((value) => (
        <g key={value}>
          <line
            x1="56"
            x2="600"
            y1={y(value)}
            y2={y(value)}
            className={value === 0 ? s.zeroLine : s.gridLine}
          />
          <text x="44" y={y(value) + 4} textAnchor="end" className={s.axisText}>
            {Math.round(value / 1000)}k
          </text>
        </g>
      ))}
      <path d={`${line} L594,${y(0)} L56,${y(0)} Z`} className={s.area} />
      <path d={line} className={s.line} />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={x(point.day)}
          cy={y(point.amount)}
          r="3.5"
          className={s.chartPoint}
        >
          <title>{`${point.title}: ${money(point.amount)}`}</title>
        </circle>
      ))}
      {[10, 15, 20, 25, 31].map((day) => (
        <text
          key={day}
          x={x(day)}
          y="192"
          textAnchor="middle"
          className={s.axisText}
        >
          {day} Oct
        </text>
      ))}
    </svg>
  );
}
