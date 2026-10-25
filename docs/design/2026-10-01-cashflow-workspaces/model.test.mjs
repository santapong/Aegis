import test from 'node:test';
import assert from 'node:assert/strict';
import { examples, forecast, defaultScenario } from './model.mjs';
test('the accepted fictional stories reconcile cash and buffer separately',()=>{
  const p=forecast(examples.personal),b=forecast(examples.business);
  assert.deepEqual([p.cashToday,p.incoming,p.outgoing,p.closing,p.headroom],[4700000,800000,610000,4890000,4390000]);
  assert.deepEqual([b.cashToday,b.incoming,b.outgoing,b.closing,b.headroom],[8900000,9000000,8100000,9800000,8800000]);
});
test('late business income remains in November; October has a buffer gap, not negative cash',()=>{
  const scenario={...defaultScenario(examples.business),incomingDate:'2026-11-05'};
  const r=forecast(examples.business,{scenario});
  assert.equal(r.closing,800000);assert.equal(r.headroom,-200000);
  assert.equal(r.firstBelowBuffer.date,'2026-10-26');assert.equal(r.firstNegative,undefined);
  assert.equal(r.later[0].cents,9000000);assert.equal(r.later[0].date,'2026-11-05');
});
test('a positive month-end balance can conceal a negative earlier date',()=>{
  const scenario={...defaultScenario(examples.personal),extraCents:4500000,extraTitle:'Laptop purchase'};
  const r=forecast(examples.personal,{scenario});
  assert.equal(r.closing,390000);assert.equal(r.minimum.cash,-50000);
  assert.equal(r.firstBelowBuffer.date,'2026-10-12');assert.equal(r.firstNegative.date,'2026-10-16');
});
test('deferring equipment preserves its later event and removes the October buffer gap',()=>{
  const r=forecast(examples.business,{scenario:{...defaultScenario(examples.business),incomingDate:'2026-11-05',deferEquipment:true}});
  assert.equal(r.closing,2000000);assert.equal(r.headroom,1000000);assert.equal(r.firstBelowBuffer,undefined);assert.equal(r.later.length,2);
});
test('matching either sample moves one payment from planned to recorded without changing closing cash',()=>{
  for(const e of Object.values(examples)){
    const b=forecast(e),m=forecast(e,{match:true});
    assert.equal(m.cashToday,b.cashToday-e.pending.cents);assert.equal(m.outgoing,b.outgoing-e.pending.cents);
    assert.equal(m.closing,b.closing);assert.equal(m.plans.find(p=>p.id===e.matchId).cents,0);
  }
});
test('a partial receipt reduces only its linked occurrence, once',()=>{
  const e=structuredClone(examples.business);e.actuals.push({id:'part',title:'Part receipt',date:'2026-10-10',cents:3000000,kind:'income',accountId:e.accountId,occurrenceId:'client'});
  const r=forecast(e);assert.equal(r.cashToday,11900000);assert.equal(r.incoming,6000000);assert.equal(r.closing,9800000);
});
test('scenario projection never modifies base plans or actuals',()=>{
  const before=JSON.stringify(examples.business);forecast(examples.business,{scenario:{...defaultScenario(examples.business),incomingDate:'2026-11-05'}});
  assert.equal(JSON.stringify(examples.business),before);assert.equal(forecast(examples.business).closing,9800000);
});
test('a transfer between two included accounts nets to zero; the sending-only scope decreases',()=>{
  const e=structuredClone(examples.personal);e.accountIds=[e.accountId,'savings-cash'];
  e.actuals.push({id:'transfer',date:'2026-10-09',cents:100000,kind:'transfer',fromAccountId:e.accountId,toAccountId:'savings-cash'});
  assert.equal(forecast(e).cashToday,4700000);e.accountIds=[e.accountId];assert.equal(forecast(e).cashToday,4600000);
});
test('future actuals are excluded from cash today, and a foreign currency is rejected',()=>{
  const e=structuredClone(examples.personal);e.actuals.push({id:'future',title:'Future',date:'2026-10-15',cents:99900,kind:'income',accountId:e.accountId});
  assert.equal(forecast(e).cashToday,4700000);e.actuals[0].currency='USD';assert.throws(()=>forecast(e),/Mixed currencies/);
});
test('invalid scenario dates or fractional minor units cannot enter the calculation',()=>{
  const e=examples.personal,s=defaultScenario(e);assert.throws(()=>forecast(e,{scenario:{...s,incomingDate:'2026-11-31'}}),/Scenario dates/);assert.throws(()=>forecast(e,{scenario:{...s,extraCents:1.1}}),/Invalid scenario amount/);
});
