// Fictional, browser-only design model. This is not the production forecast API.
export const AS_OF = '2026-10-10';
export const END = '2026-10-31';
const money = value => Math.round(value * 100);
const event = (id, title, date, amount, kind, accountId, other = {}) => ({ id, title, date, cents: money(amount), kind, accountId, ...other });
export const examples = {
  personal: {
    name: 'Mina · Personal', short: 'Personal', account: 'Everyday cash', currency: 'THB', reserveCents: money(5000),
    openingDate: '2026-10-01', openingCents: money(30000), accountId: 'personal-cash',
    headline: 'A calmer month, by the day.', question: 'Can my next plans fit before more money arrives?',
    bufferLabel: 'Emergency buffer', incomingId: 'freelance', matchId: 'utilities',
    actuals: [event('salary','Salary received','2026-10-01',35000,'income','personal-cash'), event('rent','Rent paid','2026-10-08',18000,'expense','personal-cash')],
    plans: [
      event('groceries','Groceries','2026-10-16',2500,'expense','personal-cash',{source:'Weekly living costs',dueDate:'2026-10-16'}),
      event('freelance','Freelance payment','2026-10-18',8000,'income','personal-cash',{source:'Side project',dueDate:'2026-10-18'}),
      event('utilities','Utilities','2026-10-20',1200,'expense','personal-cash',{source:'Household bill',dueDate:'2026-10-20'}),
      event('transport','Transport','2026-10-23',1800,'expense','personal-cash',{source:'Monthly travel',dueDate:'2026-10-23'}),
      event('subscriptions','Subscriptions','2026-10-26',600,'expense','personal-cash',{source:'Recurring commitment',dueDate:'2026-10-26'}),
    ],
    pending: event('pending-utilities','Utilities payment','2026-10-10',1200,'expense','personal-cash',{occurrenceId:'utilities'}),
  },
  business: {
    name: 'Business X · Studio', short: 'Business', account: 'Operating cash', currency: 'THB', reserveCents: money(10000),
    openingDate: '2026-10-01', openingCents: money(60000), accountId: 'business-cash',
    headline: 'See the timing behind your cash.', question: 'Will client money arrive before the bills are due?',
    bufferLabel: 'Operating buffer', incomingId: 'client', matchId: 'contractors',
    actuals: [event('deposit','Project deposit received','2026-10-05',50000,'income','business-cash'),event('studio-rent','Studio rent paid','2026-10-08',18000,'expense','business-cash'),event('tools-paid','Operations paid','2026-10-09',3000,'expense','business-cash')],
    plans: [
      event('client','Final client payment','2026-10-15',90000,'income','business-cash',{source:'Client invoice BX-104',dueDate:'2026-10-08'}),
      event('contractors','Contractor bill','2026-10-20',65000,'expense','business-cash',{source:'Supplier bill BX-201',dueDate:'2026-10-20'}),
      event('hosting','Hosting & tools','2026-10-23',4000,'expense','business-cash',{source:'Recurring operating cost',dueDate:'2026-10-23'}),
      event('equipment','Equipment purchase','2026-10-26',12000,'expense','business-cash',{source:'Planned purchase',dueDate:'2026-10-26'}),
    ],
    pending: event('pending-contractors','Contractor payment','2026-10-10',65000,'expense','business-cash',{occurrenceId:'contractors'}),
  },
};
export function dateList(start, end) {
  const dates = [];
  for (let t = new Date(start + 'T00:00:00Z').getTime(); t <= new Date(end + 'T00:00:00Z').getTime(); t += 86400000) dates.push(new Date(t).toISOString().slice(0,10));
  return dates;
}
export function defaultScenario(example) {
  return { incomingDate: example.plans.find(p => p.id === example.incomingId).date, deferEquipment: false, extraCents: 0, extraDate: '2026-10-12', extraTitle: 'One-off cost' };
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
export function forecast(example, { scenario = defaultScenario(example), match = false, asOf = AS_OF, end = END } = {}) {
  if (!validDate(asOf) || !validDate(end) || asOf > end) throw new Error('Invalid forecast period');
  for (const value of [scenario.incomingDate,scenario.extraDate]) if (!validDate(value) || value <= asOf) throw new Error('Scenario dates must be after the as-of date');
  if (!Number.isSafeInteger(scenario.extraCents) || scenario.extraCents < 0) throw new Error('Invalid scenario amount');
  const actuals = [...example.actuals, ...(match ? [example.pending] : [])];
  const accountScope = new Set(example.accountIds || [example.accountId]);
  const cashEffect = row => row.kind === 'transfer' ? ((accountScope.has(row.toAccountId) ? row.cents : 0) - (accountScope.has(row.fromAccountId) ? row.cents : 0)) : !accountScope.has(row.accountId) ? 0 : row.kind === 'income' ? row.cents : -row.cents;
  for (const row of [...actuals,...example.plans]) {
    if (!Number.isSafeInteger(row.cents) || row.cents < 0) throw new Error('Use nonnegative integer minor units');
    if (row.currency && row.currency !== example.currency) throw new Error('Mixed currencies require a separate forecast');
  }
  const includedActuals = actuals.filter(row => row.date >= example.openingDate && row.date <= asOf && (row.kind === 'transfer' ? accountScope.has(row.fromAccountId) || accountScope.has(row.toAccountId) : accountScope.has(row.accountId)));
  const cashToday = example.openingCents + includedActuals.reduce((sum,row) => sum + cashEffect(row),0);
  const plans = example.plans.filter(row => accountScope.has(row.accountId)).map(row => {
    const settled = includedActuals.filter(a => a.occurrenceId === row.id && a.kind === row.kind && a.accountId === row.accountId).reduce((sum,a) => sum + a.cents,0);
    const date = row.id === example.incomingId ? scenario.incomingDate : row.id === 'equipment' && scenario.deferEquipment ? '2026-11-02' : row.date;
    return { ...row, date, originalDate: row.date, originalCents: row.cents, cents: Math.max(0,row.cents-settled), settledCents:settled };
  });
  if (scenario.extraCents) plans.push(event('scenario-extra',scenario.extraTitle || 'One-off cost',scenario.extraDate,0,'expense',example.accountId,{cents:scenario.extraCents,source:'Scenario assumption',dueDate:scenario.extraDate,originalCents:scenario.extraCents,settledCents:0}));
  plans.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const upcoming = plans.filter(row => row.cents && row.date > asOf && row.date <= end);
  const later = plans.filter(row => row.cents && row.date > end);
  const overdue = plans.filter(row => row.cents && row.date <= asOf);
  let running = example.openingCents;
  const history = dateList(example.openingDate,asOf).map(date => { const rows = includedActuals.filter(row => row.date === date); running += rows.reduce((sum,row) => sum + cashEffect(row),0); return {date,cash:running,rows}; });
  running = cashToday;
  const days = dateList(asOf,end).map(date => {
    const rows = upcoming.filter(row => row.date === date);
    const incoming = rows.filter(row => row.kind === 'income').reduce((sum,row) => sum+row.cents,0);
    const outgoing = rows.filter(row => row.kind === 'expense').reduce((sum,row) => sum+row.cents,0);
    running += incoming-outgoing;
    return {date,cash:running,incoming,outgoing,headroom:running-example.reserveCents,rows};
  });
  const incoming = upcoming.filter(row => row.kind === 'income').reduce((sum,row) => sum+row.cents,0);
  const outgoing = upcoming.filter(row => row.kind === 'expense').reduce((sum,row) => sum+row.cents,0);
  const minimum = days.reduce((low,row) => row.cash < low.cash ? row : low,days[0]);
  return { cashToday, closing:running, incoming,outgoing,headroom:running-example.reserveCents,reserve:example.reserveCents,minimum,firstBelowBuffer:days.find(row => row.cash < example.reserveCents),firstNegative:days.find(row => row.cash < 0),plans,upcoming,later,overdue,history,days,includedActuals };
}
