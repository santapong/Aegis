import { examples, forecast, defaultScenario, AS_OF, END, dateList } from './model.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash = cents => `${cents < 0 ? '−' : ''}฿${(Math.abs(cents)/100).toLocaleString('en-US',{maximumFractionDigits:2})}`;
const shortDate = date => new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const signed = (cents, kind) => (kind === 'income' ? '+' : '−')+cash(cents);
let workspace = 'personal', view = 'overview', lastDialogTrigger;
const states = Object.fromEntries(Object.entries(examples).map(([key,example]) => [key,{scenario:defaultScenario(example),draft:{...defaultScenario(example),extraAmount:'0'},mode:'base',match:false,day:'2026-10-15'}]));
const current = () => examples[workspace];
const state = () => states[workspace];
const base = () => forecast(current(),{match:state().match});
const changed = () => forecast(current(),{match:state().match,scenario:state().scenario});
const active = () => state().mode === 'scenario' ? changed() : base();
const announce = value => { $('announcement').textContent = value; };
function changedAssumptions() {
  const e=current(),s=state().scenario,original=defaultScenario(e),rows=[];
  if(s.incomingDate!==original.incomingDate) rows.push(`${e.plans.find(p=>p.id===e.incomingId).title}: ${shortDate(original.incomingDate)} → ${shortDate(s.incomingDate)}`);
  if(s.deferEquipment) rows.push('Equipment purchase: 26 Oct → 2 Nov');
  if(s.extraCents) rows.push(`${s.extraTitle}: ${cash(s.extraCents)} on ${shortDate(s.extraDate)}`);
  return rows;
}
function modeBar() {
  return `<div class="button-row presets" role="group" aria-label="Forecast version"><button data-mode="base" aria-pressed="${state().mode==='base'}" class="${state().mode==='base'?'primary':''}">Base plan</button><button data-mode="scenario" aria-pressed="${state().mode==='scenario'}" class="${state().mode==='scenario'?'primary':''}">Your scenario</button><span class="chip">${state().mode==='scenario'?'Scenario assumptions only':'Original plans'}</span></div>`;
}
function metrics(r) {
  return `<section class="cards" aria-label="Cash-flow summary">
    <div class="metric"><p class="name">Cash today</p><strong class="number">${cash(r.cashToday)}</strong><small>${escape(current().account)} · manual example</small></div>
    <div class="metric ${r.closing<0?'negative':'highlight'}"><p class="name">End-of-month cash</p><strong class="number">${cash(r.closing)}</strong><small>31 Oct · includes expected plans</small></div>
    <div class="metric ${r.minimum.cash<0?'negative':''}"><p class="name">Lowest planned cash</p><strong class="number">${cash(r.minimum.cash)}</strong><small>${shortDate(r.minimum.date)} · inspect the timing</small></div>
    <div class="metric ${r.headroom<0?'negative':''}"><p class="name">${r.headroom<0?'Below your buffer at month end':'Above your buffer at month end'}</p><strong class="number">${cash(Math.abs(r.headroom))}</strong><small>Selected buffer ${cash(r.reserve)} · stays in cash</small></div>
  </section>`;
}
function takeaway(r) {
  const cls=r.firstNegative?'danger':r.firstBelowBuffer?'warn':'';
  let text;
  if(r.firstNegative) text=`This plan first goes below zero on ${shortDate(r.firstNegative.date)}, at ${cash(r.firstNegative.cash)}. Month-end cash alone does not show this earlier gap.`;
  else if(r.firstBelowBuffer) text=`Cash first falls below your ${cash(r.reserve)} buffer on ${shortDate(r.firstBelowBuffer.date)}. The lowest cash is ${cash(r.minimum.cash)}; the buffer gap is ${cash(r.reserve-r.minimum.cash)}.`;
  else text=`The listed plans stay above your ${cash(r.reserve)} buffer through October. The lowest cash is ${cash(r.minimum.cash)} on ${shortDate(r.minimum.date)}.`;
  return `<div class="result ${cls}"><p>${text}</p><small>Only the included account, recorded entries, and listed plans. Expected income is not money received.</small></div>`;
}
function chart(r,compare=false) {
  const b=base(),c=changed(),points=[...b.history,...b.days,...(compare||state().mode==='scenario'?c.days:[])],floor=current().reserveCents;
  const width=730,height=280,pad={l:47,r:15,t:25,b:32};
  const lo=Math.min(0,...points.map(p=>p.cash)),hi=Math.max(floor,...points.map(p=>p.cash))*1.1;
  const span=hi-lo||1,x=date=>pad.l+(Number(date.slice(-2))-1)/30*(width-pad.l-pad.r),y=value=>height-pad.b-(value-lo)/span*(height-pad.t-pad.b);
  const path=rows=>rows.map((p,i)=>`${i?'L':'M'}${x(p.date).toFixed(2)},${y(p.cash).toFixed(2)}`).join(' ');
  const grid=[lo,lo+span/2,hi].map(value=>`<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(value)}" y2="${y(value)}" stroke="#303b3e" stroke-dasharray="2 5"/><text x="${pad.l-8}" y="${y(value)+4}" text-anchor="end">${(value/100000).toLocaleString('en-US',{maximumFractionDigits:1})}k</text>`).join('');
  const forecastPath=compare?b:r;
  const min=r.minimum;
  return `<div class="legend"><span><i></i>Recorded</span><span class="planned"><i></i>${compare?'Base plan':'Planned cash'}</span>${compare?'<span class="changed"><i></i>Your scenario</span>':''}<span class="floor"><i></i>Buffer</span></div>
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="October cash forecast, ${escape(state().mode==='scenario'||compare?'scenario compared with the base plan':'base plan')}. Lowest selected cash ${cash(min.cash)} on ${shortDate(min.date)}; closing ${cash(r.closing)}. Amounts in THB. End-of-day values; intraday timing is not modeled.">
    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8913c" stop-opacity=".12"/><stop offset="1" stop-color="#e8913c" stop-opacity="0"/></linearGradient></defs>
    ${grid}<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(floor)}" y2="${y(floor)}" stroke="#929c98" stroke-dasharray="5 5"/><text x="${width-pad.r}" y="${y(floor)-7}" text-anchor="end">buffer ${cash(floor)}</text>
    <path d="${path(forecastPath.days)} L${x(END)},${y(lo)} L${x(AS_OF)},${y(lo)} Z" fill="url(#area)"/>
    <line x1="${x(AS_OF)}" x2="${x(AS_OF)}" y1="15" y2="${height-pad.b}" stroke="#52615e" stroke-dasharray="3 4"/>
    <text x="${x(AS_OF)+7}" y="15">as of 10 Oct</text><path class="actual" d="${path(b.history)}"/><path class="base" d="${path(forecastPath.days)}"/>
    ${compare?`<path class="scenario" d="${path(c.days)}"/>`:''}
    <circle cx="${x(min.date)}" cy="${y(min.cash)}" r="4" fill="${min.cash<floor?'#ed9a8d':'#e8913c'}"/><circle cx="${x(AS_OF)}" cy="${y(b.cashToday)}" r="4" fill="#8eb9aa"/>
    ${['2026-10-01',AS_OF,'2026-10-20',END].map(date=>`<text x="${x(date)}" y="${height-8}" text-anchor="${date===END?'end':'middle'}">${shortDate(date)}</text>`).join('')}
    </svg><div class="chart-note"><p>Daily closing cash · ${escape(current().account)} · THB<br>Solid = recorded. Dashed = expected. No assumed growth.</p><button class="small quiet" data-action="daily-values">Inspect daily values ↗</button></div>`;
}
function nextDates(r) {
  return `<aside class="panel next-panel"><p class="eyebrow">NEXT IN YOUR PLAN</p><h2 style="margin-top:9px">A date. A purpose.</h2>${r.upcoming.slice(0,3).map(p=>`<div class="date-row"><div class="day-stamp"><strong>${Number(p.date.slice(-2))}</strong><small>OCT</small></div><div><div class="event-title">${escape(p.title)}</div><small>${p.kind==='income'?'Expected income':'Planned cost'}</small></div><strong class="amount ${p.kind==='income'?'incoming':'outgoing'}">${signed(p.cents,p.kind)}</strong></div>`).join('')}
  <button data-go="calendar">Open money calendar →</button><p style="margin-top:14px">Dates make the difference. Use expected receipt dates, not invoice totals alone.</p></aside>`;
}
function bridge(r) {
  return `<details class="panel" style="margin-top:18px"><summary class="details-summary">Why does October end at ${cash(r.closing)}?</summary><div class="bridge">${[['Cash as of 10 Oct',r.cashToday],['+ Expected income',r.incoming],['− Planned costs',r.outgoing],['= Closing cash',r.closing],['After buffer',r.headroom]].map(([label,value],i)=>`<div class="${i===4?'last':''}"><span>${label}</span><strong>${cash(value)}</strong></div>`).join('')}</div><p>Cash ${cash(r.cashToday)} + income ${cash(r.incoming)} − costs ${cash(r.outgoing)} = ${cash(r.closing)}. Protecting ${cash(r.reserve)} leaves ${cash(r.headroom)} above the buffer. A buffer allocation does not move money out of this account.</p>${r.later.length?`<p>Beyond October: ${r.later.map(p=>`${escape(p.title)} ${cash(p.cents)} on ${shortDate(p.date)}`).join('; ')}. These remain visible and are not counted in October.</p>`:''}</details>`;
}
function plansTable(r) {
  return `<div class="record-table-wrap"><table class="record-table"><caption class="sr-only">Outstanding planned movements with due and expected dates</caption><thead><tr><th>${workspace==='business'?'Invoice / bill':'Commitment'}</th><th>Due</th><th>Expected cash date</th><th>Still outstanding</th></tr></thead><tbody>${r.plans.map(p=>`<tr><td><button data-event="${p.id}">${escape(p.title)} ↗</button><small>${escape(p.source)}${p.dueDate<AS_OF&&p.cents?' · overdue':''}</small></td><td>${shortDate(p.dueDate)}</td><td>${shortDate(p.date)}${p.date>END?' · next month':''}</td><td class="${p.kind==='income'?'incoming':''}">${p.cents?signed(p.cents,p.kind):'Matched'}</td></tr>`).join('')}</tbody></table></div>`;
}
function overview() {
  const r=active();
  return `${modeBar()}${metrics(r)}<div class="main-grid"><section class="panel"><div class="panel-header"><div><h2>The timing behind the numbers.</h2><p>October cash, explained by your dates</p></div><span class="chip amber">${state().mode==='base'?'Base plan':'Your scenario'}</span></div>${chart(r,state().mode==='scenario')}${takeaway(r)}</section>${nextDates(r)}</div>${bridge(r)}
  <div class="below-grid"><section class="panel"><p class="eyebrow">${workspace==='business'?'RECEIVABLES & BILLS':'UPCOMING COMMITMENTS'}</p><h2 style="margin-top:10px">${workspace==='business'?'Owed is different from received.':'Keep the next dates in view.'}</h2><p>${workspace==='business'?'An invoice due date and an expected receipt date can differ. Track both; only a recorded receipt becomes cash.':'Bills, subscriptions, and income stay planned until you record or match what happened.'}</p>${plansTable(r)}</section><section class="panel"><p class="eyebrow">TRY A DECISION</p><h2 style="margin-top:10px">${workspace==='business'?'What if the client pays late?':'What if I buy the laptop?'}</h2><p>${workspace==='business'?'Move the client’s payment into November and see the cash gap against your operating buffer. Then try moving a purchase.':'A month can end above zero and still run short before your next income. Test the amount and date together.'}</p><button class="primary" data-preset="${workspace==='business'?'late':'laptop'}">${workspace==='business'?'Test late payment':'Test a ฿45,000 laptop'} →</button><div class="empty-note" style="margin-top:22px">Every result can be traced to entered records and assumptions. The explanation works without an AI provider.</div></section></div>`;
}
function scenarios() {
  const b=base(),r=changed(),d=state().draft,e=current(),assumptions=changedAssumptions();
  return `<div class="presets"><button data-preset="late">Income arrives next month</button>${workspace==='business'?'<button data-preset="bridge">Late income + defer equipment</button>':'<button data-preset="laptop">Add a ฿45,000 laptop</button>'}<button data-action="reset-scenario">Reset this scenario</button></div>
  <div class="scenario-grid"><form id="scenario-form" class="panel scenario-controls"><p class="eyebrow">CHANGE AN ASSUMPTION</p><h2 style="margin-top:12px">One choice at a time.</h2><p>Changes affect your scenario. Your recorded money and base plans stay separate.</p>
  <label class="labelled" for="incoming-date">${workspace==='business'?'Client payment expected':'Freelance payment expected'}</label><input id="incoming-date" data-draft="incomingDate" type="date" min="2026-10-11" max="2026-11-30" required value="${d.incomingDate}"><small>Base: ${shortDate(defaultScenario(e).incomingDate)}</small>
  ${workspace==='business'?`<label class="check-label"><input data-draft="deferEquipment" id="defer-equipment" type="checkbox" ${d.deferEquipment?'checked':''}>Equipment purchase on 2 Nov</label>`:''}
  <label class="labelled" for="extra-title">One-off expense name</label><input id="extra-title" data-draft="extraTitle" maxlength="60" value="${escape(d.extraTitle)}">
  <label class="labelled" for="extra-amount">One-off expense (THB)</label><input id="extra-amount" data-draft="extraAmount" type="number" min="0" max="1000000" step="0.01" required value="${escape(d.extraAmount)}">
  <label class="labelled" for="extra-date">Expense date</label><input id="extra-date" data-draft="extraDate" type="date" min="2026-10-11" max="2026-11-30" required value="${d.extraDate}">
  <button type="submit" class="primary">Update comparison</button><p class="form-note">The prototype covers October. November movements remain visible as later items.</p></form>
  <section class="panel"><div class="panel-header"><div><h2>Same records. Different timing.</h2><p>Base plan versus your current assumptions</p></div><span class="chip teal">Scenario</span></div>${chart(r,true)}<div class="compare-values"><div><span>Base · end-of-month cash</span><strong>${cash(b.closing)}</strong><small>Above buffer ${cash(b.headroom)}</small></div><div><span>Scenario · end-of-month cash</span><strong>${cash(r.closing)}</strong><small>${r.headroom<0?'Below':'Above'} buffer ${cash(Math.abs(r.headroom))}</small></div></div>${takeaway(r)}<div class="detail-list"><p class="eyebrow" style="margin-bottom:12px">ASSUMPTIONS IN THIS COMPARISON</p>${assumptions.length?assumptions.map(a=>`<p>${escape(a)}</p>`).join(''):'<p>No changed assumptions yet. Try one of the examples above.</p>'}${r.later.map(p=>`<p>${escape(p.title)} ${cash(p.cents)} remains planned for ${shortDate(p.date)}, outside October.</p>`).join('')}</div></section></div>`;
}
function dayDetail(r,date) {
  const historical=date<=AS_OF,row=(historical?r.history:r.days).find(p=>p.date===date);
  const rows=historical?row?.rows||[]:row?.rows||[];
  return `<section class="panel"><p class="eyebrow">${historical?'RECORDED DAY':'PLANNED DAY'}</p><h2 style="margin-top:10px">${shortDate(date)}</h2><div class="detail-list"><div><p>Closing cash</p><strong>${cash(row?.cash??r.cashToday)}</strong><p>${historical?'Opening amount plus recorded movements.':'Based on the selected plan and entered dates.'}</p></div>${rows.length?rows.map(p=>`<div><h3>${escape(p.title)}</h3><p>${escape(p.source||'Recorded example transaction')}</p><strong class="${p.kind==='income'?'incoming':''}">${signed(p.cents,p.kind)}</strong>${historical?'':`<button class="small quiet" data-event="${p.id}" style="margin-top:10px">Inspect this entry ↗</button>`}</div>`).join(''):'<p class="empty-note">No movement on this date. Cash carries forward from the previous day.</p>'}</div></section>`;
}
function calendar() {
  const r=active(),days=dateList('2026-10-01',END);
  return `${modeBar()}<p class="calendar-intro">${workspace==='business'?'Invoice due dates stay in the entry details; the calendar uses expected cash dates.':'A date turns an intention into a plan.'} Select a day to see its movements and closing cash.</p><div class="main-grid"><section class="panel"><div class="panel-header"><h2>October 2026</h2><span class="chip">${state().mode==='base'?'Base plan':'Scenario'}</span></div><div class="calendar-days">${['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d=>`<div class="weekday">${d}</div>`).join('')}<div class="calendar-spacer" aria-hidden="true"></div><div class="calendar-spacer" aria-hidden="true"></div><div class="calendar-spacer" aria-hidden="true"></div>${days.map(date=>{const actual=date<=AS_OF,row=(actual?r.history:r.days).find(p=>p.date===date);return `<button class="calendar-day ${actual?'actual':'planned'} ${row.cash<r.reserve?'low':''}" data-day="${date}" aria-pressed="${state().day===date}" aria-label="${shortDate(date)}, ${row.rows.length} ${actual?'recorded':'planned'} items, closing cash ${cash(row.cash)}"><span class="day-number">${Number(date.slice(-2))}</span><small>${row.rows.length?`${row.rows.length} ${actual?'recorded':'planned'}`:'—'}</small></button>`;}).join('')}</div><p style="margin-top:15px;font-size:10px">Teal text = recorded · amber text = planned · underlined day = below the selected buffer. Daily closing totals do not model intraday timing.</p></section><div id="day-detail">${dayDetail(r,state().day)}</div></div><section class="panel" style="margin-top:18px"><h2>${workspace==='business'?'Receivables & bills':'Your commitments'}</h2>${plansTable(r)}</section>`;
}
function review() {
  const e=current(),s=state(),b=base(),p=e.plans.find(p=>p.id===e.matchId);
  return `<section class="panel"><p class="eyebrow">KEEP THE PLAN AND THE RECORD TOGETHER</p><h2 style="margin-top:12px">One payment. Counted once.</h2><p>When money is recorded, link it to the planned occurrence. The remaining commitment decreases, so the forecast does not subtract the same payment again.</p><div class="review-card"><div><span class="chip ${s.match?'teal':'amber'}">${s.match?'Matched in this example':'Sample import · awaiting review'}</span><h3 style="margin-top:15px">${escape(e.pending.title)}</h3><strong class="amount">${signed(e.pending.cents,'expense')}</strong><p>10 Oct · ${escape(e.account)}<br>${s.match?'Recorded once and linked to the planned '+escape(p.title.toLowerCase())+'.':'A fictional imported row. Not included in the ledger until you confirm this example.'}</p></div>${s.match?'<button id="review-trigger" data-action="undo-match" class="review-action quiet">Undo sample match</button>':'<button id="review-trigger" data-action="review-match" class="primary review-action">Review sample payment →</button>'}</div>
  <div class="review-steps"><div><div class="number">01</div><div><h3>Review the record.</h3><p>Account, amount, date, source, and category before saving.</p></div></div><div><div class="number">02</div><div><h3>Match the occurrence.</h3><p>One bill or income occurrence. Partial payments leave a remainder.</p></div></div><div><div class="number">03</div><div><h3>See the effect.</h3><p>Cash today and planned cash update together, with an audit trail.</p></div></div></div>
  <div class="result"><p>${s.match?`Cash today is ${cash(b.cashToday)}. The matched ${cash(p.cents)} is no longer a future payment. October still closes at ${cash(b.closing)}.`:'Try the review. The same payment moves from planned to recorded, preserving the projected month-end cash.'}</p><small>Confirmation only updates this fictional browser model; it does not initiate a payment or save to your Aegis account.</small></div></section><div class="below-grid"><section class="panel"><h2>Recorded entries</h2><div class="record-table-wrap"><table class="record-table"><thead><tr><th>Date</th><th>Record</th><th>Amount</th></tr></thead><tbody>${b.includedActuals.map(a=>`<tr><td>${shortDate(a.date)}</td><td>${escape(a.title)}<small>${a.occurrenceId?'Linked to '+escape(e.plans.find(p=>p.id===a.occurrenceId).title):'Recorded example'}</small></td><td>${signed(a.cents,a.kind)}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><h2>What comes next</h2><p>The production design adds partial matches, duplicate-import review, opening-balance checks, and a clear change history. Confidence comes from reviewed records.</p><p>Chat capture can feed this review: draft → confirm → one recorded entry. Account scope must stay explicit for personal and business money.</p><button data-go="roadmap" class="quiet">See the feature plan →</button></section></div>`;
}
function roadmap() {
  const refs=[['Actual Budget','https://actualbudget.org/docs/experimental/balance-forecast-report/','Scheduled occurrences and visible account scope. Forecast report is experimental.'],['Monarch','https://www.monarch.com/features/tracking','An everyday bills/subscriptions calendar and transaction review.'],['PocketSmith','https://learn.pocketsmith.com/article/1246-using-the-calendar-and-forecast-graph','Keep the calendar, scenario, and daily projection connected.'],['Float','https://www.floatapp.com/','Business payment timing, comparison scenarios, and a 13-week view.'],['Agicap','https://agicap.com/en-us/features/cashflow-forecast/','Trace forecast versus actual variance and use short/long horizons.'],['Xero','https://www.xero.com/us/accounting-software/analytics/cash-flow/','Separate invoice due dates from expected receipt dates.']];
  return `<p style="max-width:780px">One cash-planning core, two workspaces. Build the reliable daily plan first, then business operations and capture integrations. This roadmap is proposed; the examples show proposed future features.</p><div class="roadmap-grid"><article class="roadmap-card"><span class="chip teal">First · shared foundation</span><h2>Cash you can explain.</h2><ul><li>Accounts and dated opening balances</li><li>Daily forecast and cash-buffer alerts</li><li>Recurring commitments and occurrence matching</li><li>Scenarios separate from real records</li><li>Transfers that do not become income</li></ul><p>Works for an individual and an owner-run business, with manual entry or reviewed CSV.</p></article><article class="roadmap-card"><span class="chip amber">Next · business workflow</span><h2>Timing you can manage.</h2><ul><li>Receivables and supplier bills</li><li>Due dates + expected payment dates</li><li>Partial payments and overdue review</li><li>Rolling 13-week cash plan</li><li>Saved forecast vs actual comparisons</li></ul><p>Keep cash planning clear. Accounting, payroll calculations, and tax filing need their own scope.</p></article><article class="roadmap-card"><span class="chip">Later · connections</span><h2>Less work to stay current.</h2><ul><li>LINE capture with draft confirmation</li><li>Reviewed receipt / CSV inbox</li><li>Accounting connectors with sync status</li><li>Owner / editor / viewer permissions</li><li>Optional explanations from sourced values</li></ul><p>Real channels and providers need separate validation. Self-hosted deployments keep a manual workflow.</p></article></div><div class="feature-strip"><div><h3>Personal and business money stay separate.</h3><p>An owner contribution or draw is a transfer between workspaces, with linked records. No automatic mixing or double-counted income.</p></div><span class="chip">Proposed data boundary</span></div><h2 style="margin-top:32px">Patterns worth learning from.</h2><p>Primary product pages and documentation researched on 1 October 2026. Public references; no competitor account workflow was tested. These adaptations are our design proposals.</p><div class="ref-grid">${refs.map(([name,url,text])=>`<article class="reference"><a href="${url}" target="_blank" rel="noopener">${name} ↗</a><p>${text}</p></article>`).join('')}</div><div class="source-links"><a href="proposal.md">Full feature design ↗</a><a href="references.md">Reference observations & limits ↗</a></div>`;
}
function render(focus=false) {
  $('workspace-note').textContent=workspace==='business'?'Owner-run business · cash planning':'Personal cash planning';
  const titles={overview:[current().headline,current().question,'YOUR MONTH, CONNECTED'],calendar:['A date. A clearer picture.','See the movements behind each day.','MONEY CALENDAR'],scenarios:['Try the choice before you make it.','Compare changed dates and amounts with the same recorded cash.','SCENARIO PLANNING'],review:['Keep your records in step.','Turn a reviewed record into a matched commitment.','REVIEW & MATCH'],roadmap:['More clarity. Built in the right order.','A feature direction for personal and business cash flow.','AEGIS · PRODUCT DIRECTION']};
  const [title,question,eyebrow]=titles[view];$('heading').textContent=title;$('question').textContent=question;$('eyebrow').textContent=eyebrow;
  $('page').innerHTML=({overview,calendar,scenarios,review,roadmap}[view])();
  document.querySelectorAll('[data-view]').forEach(button=>view===button.dataset.view?button.setAttribute('aria-current','page'):button.removeAttribute('aria-current'));
  if(focus){$('heading').setAttribute('tabindex','-1');$('heading').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function navigate(next) { view=next;render(true); }
function applyPreset(name) {
  const s=state(),scenario=defaultScenario(current());
  if(name==='late'||name==='bridge')scenario.incomingDate='2026-11-05';
  if(name==='bridge')scenario.deferEquipment=true;
  if(name==='laptop'){scenario.extraCents=4500000;scenario.extraTitle='Laptop purchase';}
  s.scenario=scenario;s.draft={...scenario,extraAmount:String(scenario.extraCents/100)};s.mode='scenario';navigate('scenarios');announce('Scenario comparison updated. Base records are unchanged.');
}
function openDialog(title,body,actions=[],trigger=document.activeElement) {
  lastDialogTrigger=trigger;$('details-heading').textContent=title;$('details-body').innerHTML=body;$('details-actions').replaceChildren();
  for(const action of actions){const button=document.createElement('button');button.textContent=action.label;button.className=action.primary?'primary':'quiet';button.addEventListener('click',action.run);$('details-actions').append(button);}
  $('details-dialog').showModal();
}
function closeDialog(){ $('details-dialog').close(); }
$('close-dialog').addEventListener('click',closeDialog);
$('details-dialog').addEventListener('close',()=>{ if(lastDialogTrigger?.isConnected)lastDialogTrigger.focus();else $('review-trigger')?.focus(); });
function eventDetails(id) {
  const p=active().plans.find(p=>p.id===id);if(!p)return;
  openDialog(p.title,`<span class="chip ${p.kind==='income'?'teal':'amber'}">${p.cents?'Planned '+(p.kind==='income'?'receipt':'cost'):'Matched occurrence'}</span><dl class="detail-pairs"><div><dt>Source</dt><dd>${escape(p.source)}</dd></div><div><dt>Account</dt><dd>${escape(current().account)} · THB</dd></div><div><dt>Due date</dt><dd>${shortDate(p.dueDate)}</dd></div><div><dt>Expected cash date</dt><dd>${shortDate(p.date)}</dd></div><div><dt>Original amount</dt><dd>${cash(p.originalCents)}</dd></div><div><dt>Recorded and matched</dt><dd>${cash(p.settledCents)}</dd></div><div><dt>Still outstanding</dt><dd>${cash(p.cents)}</dd></div></dl><p class="dialog-info">${p.kind==='income'?'Included on the expected receipt date, not the invoice due date. This is not cash received.':'Only the remaining amount affects future cash. A completed task is not proof of payment.'}</p>`,[{label:'Close details',run:closeDialog}]);
}
function dailyValues() {
  const r=active(),rows=[...r.history.map(p=>({...p,incoming:p.rows.filter(a=>a.kind==='income').reduce((s,a)=>s+a.cents,0),outgoing:p.rows.filter(a=>a.kind==='expense').reduce((s,a)=>s+a.cents,0),actual:true})),...r.days.filter(p=>p.date>AS_OF)];
  openDialog('Daily cash behind the chart',`<p>${escape(current().account)} · THB · ${state().mode==='base'?'Base plan':'Your scenario'}. Opening ${cash(current().openingCents)} on 1 Oct. Values are end-of-day.</p><div class="record-table-wrap"><table class="record-table"><thead><tr><th>Date</th><th>State</th><th>In</th><th>Out</th><th>Cash</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${shortDate(p.date)}</td><td>${p.actual?'Recorded':'Planned'}</td><td>${cash(p.incoming)}</td><td>${cash(p.outgoing)}</td><td>${cash(p.cash)}</td></tr>`).join('')}</tbody></table></div>`,[{label:'Close values',run:closeDialog}]);
}
function reviewMatch() {
  const e=current(),p=e.plans.find(p=>p.id===e.matchId),before=base(),after=forecast(e,{match:true});
  openDialog('Review this sample match',`<p>Confirm a fictional imported payment and its planned occurrence.</p><dl class="detail-pairs"><div><dt>Record</dt><dd>${escape(e.pending.title)}</dd></div><div><dt>Date / account</dt><dd>10 Oct · ${escape(e.account)}</dd></div><div><dt>Amount</dt><dd>${cash(e.pending.cents)} expense</dd></div><div><dt>Match to</dt><dd>${escape(p.title)} · ${shortDate(p.date)}</dd></div><div><dt>Cash today</dt><dd>${cash(before.cashToday)} → ${cash(after.cashToday)}</dd></div><div><dt>Future cost removed</dt><dd>${cash(p.cents)}</dd></div><div><dt>Base October closing</dt><dd>${cash(before.closing)} → ${cash(after.closing)}</dd></div></dl><p class="dialog-info">Record once, reduce the matching plan once. This browser-only example does not initiate a payment.</p>`,[{label:'Cancel',run:closeDialog},{label:'Confirm sample match',primary:true,run:()=>{state().match=true;closeDialog();render();$('review-trigger').focus();announce('Sample payment recorded and matched once. The projected month-end cash is unchanged.');}}]);
}
$('workspace').addEventListener('change',event=>{workspace=event.target.value;render();announce(current().name+' selected. Its scenario and sample matches are preserved separately.');});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.view)));
$('page').addEventListener('input',event=>{const key=event.target.dataset.draft;if(key)state().draft[key]=event.target.type==='checkbox'?event.target.checked:event.target.value;});
$('page').addEventListener('submit',event=>{
  if(event.target.id!=='scenario-form')return;event.preventDefault();const d=state().draft;
  const scenario={incomingDate:d.incomingDate,deferEquipment:!!d.deferEquipment,extraCents:Math.round(Number(d.extraAmount)*100),extraDate:d.extraDate,extraTitle:d.extraTitle.trim()||'One-off cost'};
  try{forecast(current(),{scenario,match:state().match});state().scenario=scenario;state().mode='scenario';render();$('incoming-date').focus();announce('Scenario comparison updated. Your base records are unchanged.');}catch(error){announce(error.message);}
});
$('page').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.mode){state().mode=button.dataset.mode;render();document.querySelector(`[data-mode="${state().mode}"]`)?.focus();return;}
  if(button.dataset.go){navigate(button.dataset.go);return;}
  if(button.dataset.preset){applyPreset(button.dataset.preset);return;}
  if(button.dataset.event){eventDetails(button.dataset.event);return;}
  if(button.dataset.day){state().day=button.dataset.day;$('day-detail').innerHTML=dayDetail(active(),state().day);document.querySelectorAll('[data-day]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.day===state().day)));announce(shortDate(state().day)+' day details updated.');return;}
  switch(button.dataset.action){
    case 'daily-values':dailyValues();break;
    case 'review-match':reviewMatch();break;
    case 'undo-match':state().match=false;render();$('review-trigger').focus();announce('Sample match undone. Original records and plans restored.');break;
    case 'reset-scenario':state().scenario=defaultScenario(current());state().draft={...state().scenario,extraAmount:'0'};state().mode='base';render();document.querySelector('[data-action="reset-scenario"]')?.focus();announce('Current scenario reset. Sample matches and the other workspace are unchanged.');break;
  }
});
render();
