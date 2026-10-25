import { test, expect } from "bun:test";
import { stories, summarize, type RecordEntry } from "../../../frontend/src/app/demo/scenarios";

test("Business X separates received money, future income and reserved money", () => {
  const result = summarize(stories.business, [], false);
  expect(result.recorded).toBe(89000);
  expect(result.plannedIncome).toBe(90000);
  expect(result.plannedCosts).toBe(81000);
  expect(result.reserved).toBe(10000);
  expect(result.remaining).toBe(88000);
  expect(result.budgetUsed).toBe(3000);
});
test("Moving the client payment out of October exposes the uncovered plan", () => {
  const result = summarize(stories.business, [], true);
  expect(result.recorded).toBe(89000);
  expect(result.remaining).toBe(-2000);
  expect(result.budgetUsed).toBe(3000);
  expect(result.points.some(p => p.title === "Final client payment")).toBe(false);
  expect(result.points.at(-1)?.amount).toBe(-2000);
});
test("A personal story uses its own salary, obligations and goal", () => {
  const initial = summarize(stories.personal, [], false);
  expect(initial.recorded).toBe(47000);
  expect(initial.remaining).toBe(43900);
  expect(initial.budgetUsed).toBe(2400);
  expect(summarize(stories.personal, [], true).remaining).toBe(35900);
});
test("A recorded expense changes cash and its category budget without changing planned costs", () => {
  const extra: RecordEntry = { id: "example", day: 10, title: "Studio supplies", category: "Operations", type: "expense", amount: 1500 };
  const updated = summarize(stories.business, [extra], true);
  expect(updated.recorded).toBe(87500);
  expect(updated.budgetUsed).toBe(4500);
  expect(updated.plannedCosts).toBe(81000);
  expect(updated.remaining).toBe(-3500);
  expect(summarize(stories.business, [], false).remaining).toBe(88000);
  expect(stories.business.records).toHaveLength(3);
});
test("Cents remain exact in visible totals and unrelated categories do not consume a budget", () => {
  const extra: RecordEntry = { id: "cents", day: 10, title: "Sample", category: "Transport", type: "expense", amount: 123.45 };
  const updated = summarize(stories.personal, [extra], false);
  expect(updated.recorded).toBe(46876.55);
  expect(updated.remaining).toBe(43776.55);
  expect(updated.budgetUsed).toBe(2400);
  expect(updated.points.at(-1)?.amount).toBe(43776.55);
});
