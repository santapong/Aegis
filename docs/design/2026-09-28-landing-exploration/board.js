const tablist = document.querySelector('.direction-tabs');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
function selectDirection(index, focus = false) {
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
    panels[i].hidden = i !== index;
  });
  if (focus) tabs[index].focus();
}
panels.forEach((panel, i) => {
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tabs[i].id);
});
tablist.hidden = false;
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectDirection(i));
  tab.addEventListener('keydown', event => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const index = key === 'Home' ? 0 : key === 'End' ? 2 : (i + (key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    selectDirection(index, true);
  });
});
selectDirection(0);
const eventData = {
  income: ['25 SEP / INCOME', 'Give your month a starting point.', 'A recorded ฿65,000 income sits alongside the commitments and plans that follow.'],
  rent: ['28 SEP / RENT', 'Put a familiar cost in context.', 'The sample rent record is ฿18,000. Its date makes the relationship to the income easy to see.'],
  saving: ['30 SEP / SAVINGS PLAN', 'Make space for a future goal.', 'A planned ฿3,000 contribution gives the goal a place in this month. Aegis is not moving this money.']
};
const horizonData = {
  now: ['Recorded / 25 September', 'Start with what happened.', 'The sample income record gives your month a clear point of reference.', 'Income', '฿65,000'],
  next: ['Planned / 30 September', 'See the next commitment.', 'A planned contribution belongs beside the dates and costs that come before it.', 'Savings contribution', '฿3,000'],
  later: ['Goal / Illustrative target', 'Keep a longer plan in view.', 'A savings target adds purpose to the monthly plan. This is an example, not a forecast.', 'Emergency fund target', '฿90,000']
};
const goalData = {
  trip: ['A weekend away.', 'Put the trip you have in mind beside the everyday costs you already know.', 'Illustrative trip budget', '฿12,000', 'Planned contribution', '฿3,000'],
  buffer: ['A little breathing room.', 'Give an emergency fund a clear target, and review the contribution beside your monthly commitments.', 'Illustrative savings target', '฿90,000', 'Planned contribution', '฿3,000'],
  debt: ['One step at a time.', 'Keep a debt record and a planned payment visible together. Review the details as your situation changes.', 'Illustrative debt balance', '฿24,000', 'Planned payment', '฿2,000']
};
function connectSelection(attribute, data, ids) {
  const buttons = [...document.querySelectorAll(`[data-${attribute}]`)];
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    data[button.dataset[attribute]].forEach((value, index) => {
      document.getElementById(ids[index]).textContent = value;
    });
  }));
}
connectSelection('event', eventData, ['event-date', 'event-title', 'event-copy']);
connectSelection('horizon', horizonData, ['horizon-label', 'horizon-title', 'horizon-copy', 'horizon-kind', 'horizon-amount']);
connectSelection('goal', goalData, ['goal-title', 'goal-copy', 'goal-total-label', 'goal-total', 'goal-step-label', 'goal-step']);
