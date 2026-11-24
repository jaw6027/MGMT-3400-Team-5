/* No network calls, dependencies, analytics, or remote assets. */
(() => {
  'use strict';
  const C=window.CraftTracker;
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const demoBadge=record=>record.demo?' <span class="demo-badge">Demo</span>':'';
  const dateLabel=value=>new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const uid=()=>globalThis.crypto?.randomUUID?.() || 'record-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  let state={version:1,partners:[],referrals:[]};
  let storageMode='saved', lastSaved=null, toastTimer, confirmCallback=null, addingFromReferral=false;
  const returnFocus=new WeakMap();

  function storageWarning(message) {
    $('#storage-warning').textContent=message;
    $('#storage-warning').hidden=false;
    $('#storage-status').textContent='Session only · not saved';
  }
  try {
    lastSaved=localStorage.getItem(C.STORAGE_KEY);
    if (lastSaved===null) {
      state=C.createDemo();
      localStorage.setItem(C.STORAGE_KEY,JSON.stringify(state));
      lastSaved=JSON.stringify(state);
    } else state=C.validateState(JSON.parse(lastSaved));
  } catch(error) {
    storageMode='memory';
    storageWarning('Browser storage could not be read or written. Changes will last only for this page session. Any unreadable saved data is left untouched. Use “Reset local data” in About to try a fresh start.');
  }

  function toast(message) {
    clearTimeout(toastTimer); const node=$('#toast');
    node.textContent=message; node.classList.add('visible');
    toastTimer=setTimeout(()=>node.classList.remove('visible'),6000);
  }
  function commit(next,errorNode) {
    try {
      C.validateState(next);
      if(storageMode==='saved') {
        const current=localStorage.getItem(C.STORAGE_KEY);
        if(current!==lastSaved) throw new Error('Records changed in another tab. Refresh this page before saving to avoid overwriting them.');
        const serialized=JSON.stringify(next);
        localStorage.setItem(C.STORAGE_KEY,serialized);
        lastSaved=serialized;
      }
      state=next; render();
      return true;
    } catch(error) {
      const message=error.name==='QuotaExceededError'?'Browser storage is full. Your change was not saved. Remove unneeded records or free browser storage, then try again.':error.name==='SecurityError'?'Browser storage is unavailable. Your change was not saved. Check browser settings and refresh.':error.message;
      if(errorNode) errorNode.textContent=message; else toast(message);
      return false;
    }
  }
  const saveMessage=text=>storageMode==='memory'?text+' Session only; browser storage is unavailable.':text;
  function statusBadge(status) {
    const cls=['new','contacted','quote','progress','paid','lost'][C.STATUSES.indexOf(status)];
    return `<span class="status-badge status-${cls}">${esc(status)}</span>`;
  }
  function empty(title,body,action,label,compact=false) {
    return `<div class="empty-state ${compact?'compact':''}"><span class="empty-icon" aria-hidden="true">↗</span><h3>${esc(title)}</h3><p>${esc(body)}</p>${action?`<button class="button secondary" data-action="${action}">${label}</button>`:''}</div>`;
  }
  function referralTable(referrals,compact=false) {
    if(!referrals.length) return empty('A fresh start for new connections.',compact?'Your latest referrals will appear here.':'No referrals match this view. Try clearing the filters or add a referral.','add-referral','＋ New referral',compact);
    return `<div class="table-scroll" role="region" aria-label="${compact?'Recent referrals':'Customer referral records'}; scroll horizontally for more columns" tabindex="0"><table><caption class="visually-hidden">${compact?'Recent customer referrals':'Customer referrals matching your filters'}</caption><thead><tr><th scope="col">Customer</th><th scope="col">Referring retailer</th><th scope="col">Service requested</th><th scope="col">Status</th><th scope="col">Date referred</th><th scope="col" class="number">Paid amount</th><th scope="col" class="number">Actions</th></tr></thead><tbody>${referrals.map(r=>{
      const partner=state.partners.find(p=>p.id===r.partnerId);
      return `<tr><td class="cell-name">${esc(r.customer)}${demoBadge(r)}${!compact&&r.contact?`<small>${esc(r.contact)}</small>`:''}</td><td class="cell-secondary">${esc(partner?.name)}${demoBadge(partner||{})}</td><td class="cell-secondary">${esc(r.service)}</td><td>${statusBadge(r.status)}</td><td>${dateLabel(r.date)}</td><td class="number">${r.status===C.PAID?C.money(r.paidCents):'—'}</td><td><div class="row-actions"><button class="text-button" data-action="edit-referral" data-id="${esc(r.id)}" aria-label="Edit referral for ${esc(r.customer)}">Edit</button><button class="text-button danger-text" data-action="delete-referral" data-id="${esc(r.id)}" aria-label="Delete referral for ${esc(r.customer)}">Delete</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function renderMetrics() {
    const s=C.summarize(state.partners,state.referrals);
    const metrics=[['Total referrals',s.referrals,'All introductions recorded','↗'],['Completed paid jobs',s.paidJobs,'Marked paid work completed','✓'],['Revenue from paid referrals',C.money(s.revenueCents),'Revenue, before business expenses','$'],['Referral cost / paid job',s.costPerJobCents===null?'—':C.money(s.costPerJobCents),`${C.money(s.costCents)} total partnership cost`,'÷']];
    $('#metrics').innerHTML=metrics.map(([label,value,note,icon])=>`<article class="metric"><div class="metric-top"><h2 class="metric-label">${label}</h2><span class="metric-icon" aria-hidden="true">${icon}</span></div><div class="metric-value">${value}</div><small>${note}</small></article>`).join('');
  }
  function renderPartners() {
    $('#partner-count').textContent=state.partners.length;
    const ranked=state.partners.map(p=>({...p,stats:C.partnerSummary(p,state.referrals)})).sort((a,b)=>b.stats.paidJobs-a.stats.paidJobs || b.stats.referrals-a.stats.referrals || a.name.localeCompare(b.name));
    $('#partner-cards').innerHTML=ranked.length?ranked.slice(0,4).map(p=>`<div class="partner-card"><span class="partner-avatar" aria-hidden="true">${esc(p.name.split(/\s+/).filter(w=>/^[a-z]/i.test(w)).slice(0,2).map(w=>w[0]).join(''))}</span><div><div class="partner-card-name">${esc(p.name)}${demoBadge(p)}</div><small>${esc(p.type)} · ${p.stats.referrals} referral${p.stats.referrals===1?'':'s'}</small></div><div class="partner-result">${C.money(p.stats.revenueCents)}<small>${p.stats.paidJobs} paid job${p.stats.paidJobs===1?'':'s'}</small></div></div>`).join(''):empty('Meet your future partners.','Add a retailer to start exploring referrals.','add-partner','＋ Add partner',true);
    $('#partner-table').innerHTML=ranked.length?`<div class="table-scroll" role="region" aria-label="Partner comparison; scroll horizontally for more columns" tabindex="0"><table><caption class="visually-hidden">Retailer referral performance and partnership costs, sorted by paid jobs</caption><thead><tr><th scope="col">Retailer partner</th><th scope="col">Partner type</th><th scope="col" class="number">Referrals</th><th scope="col" class="number">Paid jobs</th><th scope="col" class="number">Revenue</th><th scope="col" class="number">Referral cost</th><th scope="col" class="number">Cost / paid job</th><th scope="col" class="number">Actions</th></tr></thead><tbody>${ranked.map(p=>`<tr><td class="cell-name">${esc(p.name)}${demoBadge(p)}</td><td class="cell-secondary">${esc(p.type)}</td><td class="number">${p.stats.referrals}</td><td class="number">${p.stats.paidJobs}</td><td class="number">${C.money(p.stats.revenueCents)}</td><td class="number">${C.money(p.costCents)}</td><td class="number">${p.stats.costPerJobCents===null?'—':C.money(p.stats.costPerJobCents)}</td><td><div class="row-actions"><button class="text-button" data-action="edit-partner" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button><button class="text-button danger-text" data-action="delete-partner" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('Build your circle of retailers.','Start with a boutique, vintage shop, dry cleaner, or another local business.','add-partner','＋ Add partner');
  }
  function renderReferrals() {
    const filtered=C.filterReferrals(state,{search:$('#search').value,status:$('#status-filter').value,partnerId:$('#partner-filter').value});
    $('#referral-count').textContent=state.referrals.length;
    $('#results-line').textContent=`Showing ${filtered.length} of ${state.referrals.length} referrals · CSV export includes all ${state.referrals.length} records, regardless of filters.`;
    $('#referral-table').innerHTML=referralTable(filtered);
    $('#recent-referrals').innerHTML=referralTable(C.filterReferrals(state).slice(0,5),true);
  }
  function render() {
    $('#nav-count').textContent=state.referrals.length;
    $('#demo-banner').hidden=!state.referrals.some(r=>r.demo)&&!state.partners.some(p=>p.demo);
    const selected=$('#partner-filter').value;
    $('#partner-filter').innerHTML='<option value="">All retailers</option>'+partnerOptions();
    $('#partner-filter').value=state.partners.some(p=>p.id===selected)?selected:'';
    renderMetrics(); renderPartners(); renderReferrals();
  }
  function partnerOptions() {return [...state.partners].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.demo?' (Demo)':''}</option>`).join('');}
  function route(focus=false) {
    const name=location.hash.slice(1);
    const current=['overview','referrals','partners','about'].includes(name)?name:'overview';
    const copy={overview:['Overview','Every connection starts somewhere.','See who’s sending customers your way, and what happens next.'],referrals:['Customer referrals','From first hello to a better fit.','Keep every introduction, next step, and finished job in view.'],partners:['Retailer partners','Good neighbors. New possibilities.','Explore which retail relationships could help your venture grow.'],about:['About this prototype','A small tool for a big question.','Who might our customers be, and how could we reach them?']}[current];
    document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+current);
    document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('#breadcrumb-current').textContent=copy[0]; $('#page-title').textContent=copy[1]; $('#page-description').textContent=copy[2];
    document.title=`${copy[0]} · CraftNDetail Retailer Referral Tracker`;
    $('#local-data-tools').hidden=current!=='about';
    if(focus){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  }
  function openDialog(dialog) {returnFocus.set(dialog,document.activeElement);dialog.showModal();}
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{
    const focusTarget=returnFocus.get(dialog);
    if(focusTarget?.isConnected && !focusTarget.closest('[hidden]') && (!focusTarget.closest('dialog') || focusTarget.closest('dialog').open)) focusTarget.focus();
    else $('#main').focus({preventScroll:true});
    if(dialog.id==='partner-dialog'&&addingFromReferral) {addingFromReferral=false;$('#referral-dialog').showModal();}
  }));
  function openReferral(id) {
    if(!state.partners.length){toast('Add a retailer partner before recording a referral.');openPartner();return;}
    const r=state.referrals.find(r=>r.id===id),form=$('#referral-form');
    form.reset(); $('#referral-error').textContent='';
    $('#referral-dialog-title').textContent=r?'Edit referral':'New referral';
    form.elements.id.value=r?.id||'';
    form.elements.customer.value=r?.customer||'';form.elements.contact.value=r?.contact||'';
    form.elements.partnerId.innerHTML='<option value="">Choose a retailer</option>'+partnerOptions();
    form.elements.partnerId.value=r?.partnerId||'';
    form.elements.service.value=r?.service||'';form.elements.date.value=r?.date||C.localDate();
    form.elements.status.value=r?.status||C.STATUSES[0];
    form.elements.paidAmount.value=r?.status===C.PAID?(r.paidCents/100).toFixed(2):'';
    form.elements.consent.checked=r?.consent||false;
    form.elements.contact.disabled=!form.elements.consent.checked;
    updatePaidField();openDialog($('#referral-dialog'));
  }
  function updatePaidField() {
    const paid=$('#referral-status').value===C.PAID;
    $('#paid-field').hidden=!paid;
    $('#paid-amount').required=paid;$('#paid-amount').disabled=!paid;
  }
  function openPartner(id) {
    const p=state.partners.find(p=>p.id===id),form=$('#partner-form');
    form.reset();$('#partner-error').textContent='';
    $('#partner-dialog-title').textContent=p?'Edit retailer partner':'Add retailer partner';
    form.elements.id.value=p?.id||'';form.elements.name.value=p?.name||'';form.elements.type.value=p?.type||'';form.elements.cost.value=p?(p.costCents/100).toFixed(2):'0.00';
    openDialog($('#partner-dialog'));
  }
  function confirm(title,description,label,callback) {
    $('#confirm-title').textContent=title;$('#confirm-description').textContent=description;$('#confirm-action').textContent=label;$('#confirm-error').textContent='';
    confirmCallback=callback;openDialog($('#confirm-dialog'));
  }
  $('#confirm-action').addEventListener('click',()=>{if(confirmCallback?.()!==false)$('#confirm-dialog').close();});
  $('#referral-status').addEventListener('change',updatePaidField);
  $('#consent').addEventListener('change',event=>{
    $('#contact').disabled=!event.currentTarget.checked;
    if(!event.currentTarget.checked) $('#contact').value='';
  });
  $('#referral-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget,fields=form.elements;
    try {
      const old=state.referrals.find(r=>r.id===fields.id.value);
      const record={id:old?.id||uid(),customer:fields.customer.value.trim(),contact:fields.contact.value.trim(),partnerId:fields.partnerId.value,service:fields.service.value.trim(),date:fields.date.value,status:fields.status.value,paidCents:fields.status.value===C.PAID?C.parseMoney(fields.paidAmount.value):0,consent:fields.consent.checked,demo:old?.demo||false};
      if(!record.customer || !record.service) throw new Error('Enter a customer name or alias and a service; spaces alone are not enough.');
      if(!record.consent) throw new Error('Confirm the customer agreed to be contacted before saving.');
      if(commit({...state,referrals:old?state.referrals.map(r=>r.id===old.id?record:r):[...state.referrals,record]},$('#referral-error'))){$('#referral-dialog').close();toast(saveMessage(old?'Referral updated.':'New referral saved.'));}
    }catch(error){$('#referral-error').textContent=error.message;}
  });
  $('#partner-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget,fields=form.elements;
    try {
      const old=state.partners.find(p=>p.id===fields.id.value);
      const record={id:old?.id||uid(),name:fields.name.value.trim(),type:fields.type.value,costCents:C.parseMoney(fields.cost.value),demo:old?.demo||false};
      if(!record.name)throw new Error('Enter a retailer name; spaces alone are not enough.');
      if(commit({...state,partners:old?state.partners.map(p=>p.id===old.id?record:p):[...state.partners,record]},$('#partner-error'))){
        if(addingFromReferral){$('#referring-partner').innerHTML='<option value="">Choose a retailer</option>'+partnerOptions();$('#referring-partner').value=record.id;}
        $('#partner-dialog').close();toast(saveMessage(old?'Retailer partner updated.':'Retailer partner added.'));
      }
    }catch(error){$('#partner-error').textContent=error.message;}
  });
  $('#referral-add-partner').addEventListener('click',()=>{
    // Keep the unsaved referral form intact while a new retailer is added.
    $('#referral-dialog').close();openPartner();addingFromReferral=true;
  });
  document.addEventListener('click',event=>{
    const close=event.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
    const button=event.target.closest('[data-action]');if(!button)return;
    const {action,id}=button.dataset;
    if(action==='add-referral')openReferral();
    if(action==='edit-referral')openReferral(id);
    if(action==='add-partner')openPartner();
    if(action==='edit-partner')openPartner(id);
    if(action==='delete-referral') {
      const r=state.referrals.find(r=>r.id===id);if(!r)return;
      confirm('Delete this referral?',`Delete the referral for ${r.customer}? This also removes any paid job and revenue associated with this record. This cannot be undone.`,'Delete referral',()=>{
        if(!commit({...state,referrals:state.referrals.filter(r=>r.id!==id)},$('#confirm-error')))return false;toast(saveMessage('Referral deleted.'));
      });
    }
    if(action==='delete-partner') {
      const p=state.partners.find(p=>p.id===id);if(!p)return;
      const s=C.partnerSummary(p,state.referrals);
      confirm('Delete this retailer?',`Delete ${p.name} and all ${s.referrals} linked referral${s.referrals===1?'':'s'}? This removes ${s.paidJobs} paid job${s.paidJobs===1?'':'s'}, ${C.money(s.revenueCents)} in recorded revenue, and ${C.money(p.costCents)} in partnership cost from your totals. This cannot be undone.`,'Delete retailer & referrals',()=>{
        if(!commit({...state,partners:state.partners.filter(p=>p.id!==id),referrals:state.referrals.filter(r=>r.partnerId!==id)},$('#confirm-error')))return false;toast(saveMessage('Retailer and linked referrals deleted.'));
      });
    }
    if(action==='remove-demo') {
      const count=state.referrals.filter(r=>r.demo).length, partners=state.partners.filter(p=>p.demo).length;
      if(!count&&!partners){toast('There are no demo records to remove.');return;}
      confirm('Remove the demo records?',`Remove ${count} fictional referrals and unlinked demo retailers? Your own referrals stay. Demo retailers linked to your own referrals keep their Demo labels and recorded costs; reassign those referrals first to remove those retailers here. Edited Demo referrals are still removed. This cannot be undone.`,'Remove demo data',()=>{
        if(!commit(C.removeDemo(state),$('#confirm-error')))return false;toast(saveMessage('Demo referrals and unlinked demo retailers removed. Your own referrals were kept.'));
      });
    }
    if(action==='load-demo') {
      const next=C.addDemo(state);
      if(next.referrals.length===state.referrals.length&&next.partners.length===state.partners.length){toast('All demo records are already present.');return;}
      if(commit(next))toast(saveMessage('Fictional demo records added. Existing records were kept.'));
    }
    if(action==='export') {
      const blob=new Blob([C.toCSV(state)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`craftndetail-referrals-${C.localDate()}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast(`Exported ${state.referrals.length} referral records. Demo records are labeled in the CSV.`);
    }
    if(action==='reset-data')confirm('Reset all local data?','This permanently removes every saved retailer and referral for this app in this browser, including your own records. Demo data will not reload automatically. Export referrals first if you need a copy.','Reset all local data',()=>{
      const next={version:1,partners:[],referrals:[]};
      try{localStorage.setItem(C.STORAGE_KEY,JSON.stringify(next));lastSaved=JSON.stringify(next);storageMode='saved';state=next;$('#storage-warning').hidden=true;$('#storage-status').innerHTML='Saved in this browser<small>No account. No syncing.</small>';render();toast('All local records reset.');}
      catch(error){$('#confirm-error').textContent='Browser storage could not be reset. Check browser settings and try again.';return false;}
    });
  });
  $('#search').addEventListener('input',renderReferrals);
  $('#status-filter').addEventListener('change',renderReferrals);
  $('#partner-filter').addEventListener('change',renderReferrals);
  $('#clear-filters').addEventListener('click',()=>{$('#search').value='';$('#status-filter').value='';$('#partner-filter').value='';renderReferrals();});
  window.addEventListener('hashchange',()=>route(true));
  window.addEventListener('storage',event=>{
    if((event.key!==C.STORAGE_KEY&&event.key!==null)||storageMode!=='saved')return;
    try {
      const raw=localStorage.getItem(C.STORAGE_KEY);
      const next=raw===null?{version:1,partners:[],referrals:[]}:C.validateState(JSON.parse(raw));
      addingFromReferral=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      state=next;lastSaved=raw;render();toast('Records changed in another tab. The latest data is shown; open forms were closed.');
    } catch(error){storageMode='memory';storageWarning('Saved data changed in another tab and cannot be read. This page is now session only. Refresh or reset local data in About.');}
  });
  const options=C.STATUSES.map(s=>`<option>${esc(s)}</option>`).join('');
  $('#status-filter').insertAdjacentHTML('beforeend',options);$('#referral-status').innerHTML=options;
  render();route();
})();
