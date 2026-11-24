'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../public/referral-tracker/core.js');

test('demo records are valid, fictional, consent-confirmed, and cover all statuses',()=>{
  const state=C.createDemo();
  assert.equal(C.validateState(state),state);
  assert.equal(state.partners.length,4);assert.equal(state.referrals.length,8);
  assert.ok(state.referrals.every(r=>r.demo && r.consent && !r.contact));
  assert.ok(state.partners.every(p=>p.demo));
  assert.equal(new Set(state.referrals.map(r=>r.status)).size,6);
});
test('only completed paid jobs count; overall cost includes partners without paid jobs',()=>{
  const state=C.createDemo();
  assert.deepEqual(C.summarize(state.partners,state.referrals),{referrals:8,paidJobs:3,revenueCents:20000,costCents:15500,costPerJobCents:15500/3});
  const cleaner=state.partners[2];
  assert.equal(C.partnerSummary(cleaner,state.referrals).costPerJobCents,null);
  assert.equal(C.money(15500/3),'$51.67');
  const dirty=state.referrals.map(r=>r.status!==C.PAID?{...r,paidCents:99999}:r);
  assert.equal(C.summarize(state.partners,dirty).revenueCents,20000);
});
test('empty totals and zero-cost paid job avoid division by zero',()=>{
  assert.deepEqual(C.summarize([],[]),{referrals:0,paidJobs:0,revenueCents:0,costCents:0,costPerJobCents:null});
  assert.equal(C.summarize([{costCents:0}],[{status:C.PAID,paidCents:0}]).costPerJobCents,0);
});
test('money uses exact cents and rejects invalid or excessive amounts',()=>{
  assert.equal(C.parseMoney('0.29'),29);assert.equal(C.parseMoney('12.1'),1210);
  assert.equal(C.parseMoney(' 0 '),0);assert.equal(C.parseMoney('9999999.99'),999999999);
  for(const input of ['-1','NaN','Infinity','','1.001','1e2','10000000','1,000'])assert.throws(()=>C.parseMoney(input));
});
test('filter combines search, partner, and status without mutating records',()=>{
  const state=C.createDemo();
  assert.equal(C.filterReferrals(state,{search:' WILLOW ',status:C.PAID,partnerId:'demo-p1'}).length,1);
  assert.equal(C.filterReferrals(state,{search:'denim'}).length,1);
  state.referrals[0].contact='fictional@example.invalid';
  assert.equal(C.filterReferrals(state,{search:'example.invalid'}).length,1);
  assert.equal(C.filterReferrals(state,{search:'no match'}).length,0);
  assert.equal(state.referrals.length,8);
});
test('removing demos preserves user referrals and their retailer and recorded cost',()=>{
  const state=C.createDemo();
  state.referrals.push({...state.referrals[0],id:'user-1',customer:'My class example',demo:false});
  const cleaned=C.removeDemo(state);
  assert.equal(cleaned.referrals.length,1);assert.equal(cleaned.partners.length,1);
  assert.equal(cleaned.partners[0].demo,true);assert.equal(cleaned.partners[0].costCents,4500);
  C.validateState(cleaned);
  assert.equal(C.removeDemo(cleaned).referrals.length,1);
  assert.equal(state.referrals.length,9);
});
test('adding demos is idempotent and preserves edited and retained retailers',()=>{
  const state=C.createDemo();state.partners[0].name='Edited name';
  const repeated=C.addDemo(state);
  assert.equal(repeated.partners.length,4);assert.equal(repeated.referrals.length,8);
  assert.equal(repeated.partners[0].name,'Edited name');
  assert.equal(C.addDemo(C.removeDemo(state)).referrals.length,8);
});
test('CSV handles commas, quotes, newlines, Unicode, formula injection, and demo labels',()=>{
  const state=C.createDemo();
  state.referrals[0].customer='=SUM(1,2)';state.referrals[0].contact='"Hello",\nworld';
  state.referrals[1].customer='  +1';
  const csv=C.toCSV(state);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"\'  +1"'));
  assert.ok(csv.includes('""Hello"",\nworld'));
  assert.ok(csv.includes('"45.00"'));assert.ok(csv.includes('"Demo referral"'));
  assert.ok(csv.includes('"Yes","Yes"'));
  assert.ok(csv.includes('"Work in progress",""'));
  assert.ok(C.toCSV({partners:[],referrals:[]}).includes('Customer name or alias'));
});
test('storage validation rejects missing consent, orphan referrals, bad dates, duplicate IDs, and invalid amounts',()=>{
  for(const mutate of [
    s=>s.referrals[0].consent=false,s=>s.referrals[0].partnerId='missing',
    s=>s.referrals[0].date='2026-02-30',s=>s.partners.push(s.partners[0]),
    s=>s.referrals.push(s.referrals[0]),s=>s.referrals[0].paidCents=-1,
    s=>s.referrals[3].paidCents=1,s=>s.referrals[0].customer='   ',
    s=>s.version=2,s=>s.referrals[0].status='Paid'
  ]){const s=C.createDemo();mutate(s);assert.throws(()=>C.validateState(s));}
  assert.equal(C.validDate('2024-02-29'),true);assert.equal(C.validDate('2026-02-29'),false);
});
