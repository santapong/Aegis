"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  GanttChart,
  Plane,
  Shield,
  Target,
} from "lucide-react";
import s from "./landing.module.css";

const events = [
  {
    id: "income",
    day: 25,
    name: "Payday",
    amount: "+฿65,000",
    status: "Completed",
    category: "Income",
    title: "Give your month a starting point.",
    note: "An income plan marked complete on 25 September, with the commitments that follow in view.",
  },
  {
    id: "rent",
    day: 28,
    name: "Rent",
    amount: "฿18,000",
    status: "Completed",
    category: "Expense",
    title: "Put a familiar cost in context.",
    note: "A rent plan marked complete on 28 September. Its date makes the relationship to payday easy to see.",
  },
  {
    id: "savings",
    day: 30,
    name: "Emergency fund",
    amount: "฿3,000",
    status: "Planned",
    category: "Savings",
    title: "Give the future a place in your month.",
    note: "A planned contribution for 30 September. Keep it beside your other commitments and review it when the time comes.",
  },
] as const;
type EventId = (typeof events)[number]["id"];
const views = ["Calendar", "Timeline"] as const;

function moveTab(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  total: number,
  select: (index: number) => void,
  buttons: (HTMLButtonElement | null)[],
) {
  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? total - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + total) % total;
  select(next);
  buttons[next]?.focus();
}

export function MonthPreview() {
  const [view, setView] = useState(0);
  const [selected, setSelected] = useState<EventId>("income");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = events.find((event) => event.id === selected)!;
  return (
    <div className={s.monthPreview} id="sample-month">
      <div className={s.previewTop}>
        <span className={s.previewLabel}>
          <span className={s.signal} /> A month, connected
        </span>
        <span className={s.sampleBadge}>Sample data</span>
      </div>
      <div className={s.monthHeading}>
        <h2>
          September <span>2026</span>
        </h2>
        <div
          className={s.viewTabs}
          role="tablist"
          aria-label="Sample month view"
        >
          {views.map((label, i) => {
            const Icon = i === 0 ? CalendarDays : GanttChart;
            return (
              <button
                key={label}
                ref={(node) => {
                  tabRefs.current[i] = node;
                }}
                type="button"
                role="tab"
                id={`view-${i}`}
                aria-selected={view === i}
                aria-controls="month-panel"
                tabIndex={view === i ? 0 : -1}
                onClick={() => setView(i)}
                onKeyDown={(event) =>
                  moveTab(event, i, 2, setView, tabRefs.current)
                }
              >
                <Icon size={14} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        id="month-panel"
        role="tabpanel"
        aria-labelledby={`view-${view}`}
        className={s.monthPanel}
      >
        {view === 0 ? (
          <div className={s.calendarView}>
            <div className={s.dateStrip} aria-hidden="true">
              {[25, 26, 27, 28, 29, 30].map((day, i) => (
                <div
                  key={day}
                  className={active.day === day ? s.activeDate : ""}
                >
                  <small>{["FRI", "SAT", "SUN", "MON", "TUE", "WED"][i]}</small>
                  <span>{day}</span>
                  <i />
                </div>
              ))}
            </div>
            <div className={s.calendarEvents}>
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`${s.event} ${s[event.id]}`}
                  aria-pressed={selected === event.id}
                  onClick={() => setSelected(event.id)}
                  aria-label={`${event.day} September, ${event.name}, ${event.amount}, ${event.status}`}
                >
                  <span className={s.eventMeta}>
                    {event.day} Sep{" "}
                    <span>
                      {event.status === "Completed" && (
                        <Check size={10} aria-hidden="true" />
                      )}
                      {event.status}
                    </span>
                  </span>
                  <span className={s.eventName}>{event.name}</span>
                  <strong>{event.amount}</strong>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={s.timelineView}>
            <p className={s.timelineLabel}>
              The same month, one step at a time.
            </p>
            {events.map((event) => (
              <button
                type="button"
                key={event.id}
                className={s.timelineEvent}
                aria-pressed={selected === event.id}
                onClick={() => setSelected(event.id)}
                aria-label={`${event.day} September, ${event.name}, ${event.amount}, ${event.status}`}
              >
                <span className={s.timelineDate}>
                  <small>SEP</small>
                  {event.day}
                </span>
                <span className={s.timelineName}>
                  {event.name}
                  <small>
                    {event.status} · {event.category}
                  </small>
                </span>
                <strong>{event.amount}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={s.eventDetail} aria-live="polite" aria-atomic="true">
        <span className={s.detailLabel}>
          {active.day} SEPTEMBER <span>/ {active.category}</span>
        </span>
        <h3>{active.title}</h3>
        <p>{active.note}</p>
      </div>
      <div className={s.previewFoot}>
        <span>Select a plan to explore.</span>
        <span>Illustrative plans. No money is moved.</span>
      </div>
    </div>
  );
}

const goals = [
  {
    id: "buffer",
    label: "A little breathing room",
    title: "An emergency fund.",
    icon: Shield,
    subtitle: "A buffer for the things you can't put on the calendar.",
    amount: 45000,
    target: 90000,
    amountLabel: "Saved so far",
    targetLabel: "Savings target",
    nextLabel: "Next planned contribution",
    next: "฿3,000",
    date: "30 September",
    explanation:
      "Keep the target in view while you plan the next contribution. The same ฿3,000 from the sample month has a purpose here.",
  },
  {
    id: "trip",
    label: "Something to look forward to",
    title: "A weekend away.",
    icon: Plane,
    subtitle: "A trip worth planning for, alongside everyday life.",
    amount: 8000,
    target: 12000,
    amountLabel: "Saved so far",
    targetLabel: "Example trip goal",
    nextLabel: "Next planned contribution",
    next: "฿1,000",
    date: "5 October",
    explanation:
      "Give your trip a budget, track its expenses and keep a savings goal alongside it. This is a separate illustrative plan.",
  },
  {
    id: "debt",
    label: "One step at a time",
    title: "A debt to work through.",
    icon: Target,
    subtitle: "A clear record of what you've paid and what remains.",
    amount: 12000,
    target: 36000,
    amountLabel: "Paid so far",
    targetLabel: "Original example debt",
    nextLabel: "Next planned payment",
    next: "฿2,000",
    date: "5 October",
    explanation:
      "฿12,000 paid from an original ฿36,000 leaves ฿24,000 to track. The planned payment is separate from completed progress.",
  },
] as const;
const money = (amount: number) => `฿${amount.toLocaleString("en-US")}`;

export function LifePlans() {
  const [selected, setSelected] = useState(0);
  const active = goals[selected];
  const percent = Math.round((active.amount / active.target) * 100);
  const Icon = active.icon;
  return (
    <div className={s.lifePlans}>
      <div className={s.goalChoices} aria-label="Explore an example goal">
        {goals.map((goal, i) => {
          const ChoiceIcon = goal.icon;
          return (
            <button
              key={goal.id}
              type="button"
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <ChoiceIcon size={19} aria-hidden="true" />
              <span>{goal.label}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className={s.goalExample} aria-live="polite" aria-atomic="true">
        <div className={s.goalHeader}>
          <span className={s.goalIcon}>
            <Icon size={25} strokeWidth={1.4} aria-hidden="true" />
          </span>
          <span className={s.sampleBadge}>Illustrative goal</span>
        </div>
        <h3>{active.title}</h3>
        <p className={s.goalSubtitle}>{active.subtitle}</p>
        <div className={s.goalFigures}>
          <div>
            <small>{active.amountLabel}</small>
            <strong>{money(active.amount)}</strong>
          </div>
          <div>
            <small>{active.targetLabel}</small>
            <b>{money(active.target)}</b>
          </div>
        </div>
        <div
          className={s.goalProgress}
          role="progressbar"
          aria-label={active.amountLabel}
          aria-valuenow={active.amount}
          aria-valuemin={0}
          aria-valuemax={active.target}
          aria-valuetext={`${money(active.amount)} of ${money(active.target)}, ${percent} percent`}
        >
          <span
            style={{ width: `${(active.amount / active.target) * 100}%` }}
          />
        </div>
        <div className={s.progressCaption}>
          <span>{percent}% of the way</span>
          <span>Progress already recorded</span>
        </div>
        <div className={s.nextContribution}>
          <span>
            <small>{active.nextLabel}</small>
            <b>{active.date}</b>
          </span>
          <strong>{active.next}</strong>
        </div>
        <p className={s.goalExplanation}>{active.explanation}</p>
      </div>
    </div>
  );
}
