/* Shared, dependency-free data rules. Also loaded by the Node verification script. */
(function (root) {
  'use strict';
  const STATUSES = ['New lead', 'Contacted', 'Quote provided', 'Work in progress', 'Paid work completed', 'Did not convert'];
  const TYPES = ['Clothing boutique', 'Thrift or vintage shop', 'Dry cleaner', 'Wedding or formalwear shop', 'Other local business'];
  const PAID = STATUSES[4];
  const MAX_CENTS = 999999999;
  const STORAGE_KEY = 'craftndetail.referrals.v1';
  const money = cents => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(cents / 100);
  function parseMoney(value) {
    const text = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a non-negative amount with up to two decimal places.');
    const [whole, decimal = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) throw new Error('Enter an amount of $9,999,999.99 or less.');
    return cents;
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  }
  function summarize(partners, referrals) {
    const paid = referrals.filter(r => r.status === PAID);
    const costCents = partners.reduce((sum,p) => sum + p.costCents, 0);
    return { referrals:referrals.length, paidJobs:paid.length, revenueCents:paid.reduce((sum,r) => sum+r.paidCents,0), costCents, costPerJobCents:paid.length ? costCents/paid.length : null };
  }
  function partnerSummary(partner, referrals) { return summarize([partner], referrals.filter(r=>r.partnerId === partner.id)); }
  function filterReferrals(state, {search='',status='',partnerId=''} = {}) {
    const query = search.trim().toLocaleLowerCase();
    const names = new Map(state.partners.map(p => [p.id,p.name]));
    return state.referrals.filter(r => (!status || r.status===status) && (!partnerId || r.partnerId===partnerId) && (!query || [r.customer,r.contact,r.service,names.get(r.partnerId)].join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>b.date.localeCompare(a.date));
  }
  function validateState(state) {
    const text = (v,max,empty=false) => typeof v==='string' && v.length<=max && (empty || v.trim().length>0);
    const cents = v => Number.isSafeInteger(v) && v>=0 && v<=MAX_CENTS;
    if (!state || state.version!==1 || !Array.isArray(state.partners) || !Array.isArray(state.referrals)) throw new Error('Unrecognized saved data format.');
    const ids = new Set();
    for (const p of state.partners) {
      if (!p || !text(p.id,100) || ids.has(p.id) || !text(p.name,100) || !TYPES.includes(p.type) || !cents(p.costCents) || typeof p.demo!=='boolean') throw new Error('Invalid retailer data.');
      ids.add(p.id);
    }
    const refIds = new Set();
    for (const r of state.referrals) {
      if (!r || !text(r.id,100) || refIds.has(r.id) || !text(r.customer,100) || !text(r.contact,200,true) || !text(r.service,160) || !ids.has(r.partnerId) || !validDate(r.date) || !STATUSES.includes(r.status) || !cents(r.paidCents) || r.consent!==true || typeof r.demo!=='boolean' || (r.status!==PAID && r.paidCents!==0)) throw new Error('Invalid referral data.');
      refIds.add(r.id);
    }
    return state;
  }
  function createDemo() {
    const partners = [
      {id:'demo-p1',name:'Willow & Thread Boutique',type:TYPES[0],costCents:4500,demo:true},
      {id:'demo-p2',name:'Second Story Vintage',type:TYPES[1],costCents:2000,demo:true},
      {id:'demo-p3',name:'The Press Room Cleaners',type:TYPES[2],costCents:3000,demo:true},
      {id:'demo-p4',name:'Ivory Lane Bridal',type:TYPES[3],costCents:6000,demo:true}
    ];
    const seeds = [
      ['Avery (sample)','demo-p1','Trouser hemming',4,4500,1],
      ['Jordan (sample)','demo-p2','Denim repair',4,3500,2],
      ['Riley (sample)','demo-p4','Dress alterations',3,0,3],
      ['Sam (sample)','demo-p1','Sleeve shortening',2,0,4],
      ['Morgan (sample)','demo-p3','Zipper replacement',1,0,5],
      ['Taylor (sample)','demo-p4','Formalwear alterations',4,12000,6],
      ['Casey (sample)','demo-p2','Custom clothing',0,0,7],
      ['Alex (sample)','demo-p3','Jacket repair',5,0,8]
    ];
    const referrals = seeds.map(([customer,partnerId,service,status,paidCents,days],i)=>{
      const date = new Date(); date.setDate(date.getDate()-days);
      return {id:'demo-r'+(i+1),customer,contact:'',partnerId,service,date:localDate(date),status:STATUSES[status],paidCents,consent:true,demo:true};
    });
    return {version:1,partners,referrals};
  }
  function removeDemo(state) {
    const referrals=state.referrals.filter(r=>!r.demo);
    const retained = new Set(referrals.map(r=>r.partnerId));
    return {version:1,referrals,partners:state.partners.filter(p=>!p.demo || retained.has(p.id))};
  }
  function addDemo(state) {
    const demo = createDemo();
    // Do not overwrite edited samples or demo retailers retained for user records.
    return {version:1, partners:[...state.partners,...demo.partners.filter(p=>!state.partners.some(x=>x.id===p.id))],referrals:[...state.referrals,...demo.referrals.filter(r=>!state.referrals.some(x=>x.id===r.id))]};
  }
  function csvCell(value) {
    let text = String(value ?? '');
    // Spreadsheet programs can execute cells starting with these characters, even after whitespace.
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  }
  function toCSV(state, referrals=state.referrals) {
    const header=['Customer name or alias','Contact information','Referring retailer','Service requested','Date referred','Status','Paid amount (USD)','Customer agreed to contact (workflow reminder only)','Demo referral','Demo retailer'];
    const rows=referrals.map(r=>{
      const p=state.partners.find(p=>p.id===r.partnerId);
      return [r.customer,r.contact,p?.name || '',r.service,r.date,r.status,r.status===PAID?(r.paidCents/100).toFixed(2):'', 'Yes — not verified legal consent',r.demo?'Yes':'No',p?.demo?'Yes':'No'];
    });
    return '\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  const api = {STATUSES,TYPES,PAID,STORAGE_KEY,money,parseMoney,validDate,localDate,summarize,partnerSummary,filterReferrals,validateState,createDemo,removeDemo,addDemo,toCSV};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.CraftTracker=Object.freeze(api);
})(typeof window==='undefined' ? globalThis : window);
