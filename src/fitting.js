// Customer fitting uses the existing app's profile, requests, and confirmed quotes.
// The bridge keeps these shared records current without replacing other sections.
export function initializeFitting(bridge) {
  const {read, escape: e, toast, page, money, requestSummary, updateCount} = bridge;
  let profile = bridge.getProfile(), requests = bridge.getRequests(), quotes = bridge.getQuotes();
  function syncSharedRecords() {
    profile = bridge.getProfile();
    requests = bridge.getRequests();
    quotes = bridge.getQuotes();
  }
  const KEY='cnd-fitting-v1', PRIMARY=profile.customerId || 'customer-jamie';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const uid=()=>crypto.randomUUID();
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const field=(id)=>document.getElementById(id);
  const fields={arm:['Arm length','Shoulder point to wrist, over a slightly bent elbow.'],torso:['Torso length','Base of neck at the prominent back bone, straight down the back to natural waist.'],chest:['Chest','Around the fullest chest, under the arms and across the shoulder blades.'],inseam:['Inside leg length (inseam)','Top of the inner leg at the crotch, down the inside leg to the ankle bone.'],hips:['Hips','Around the fullest hips and seat, with feet together.'],waist:['Waist','Around the natural waist crease, usually above the navel.']};
  const needs={skirt:['waist','hips'],trousers:['waist','hips','inseam'],top:['chest','arm','torso'],repair:[]};
  const typeLabels={initial:'Initial fitting',adjustment:'Adjustment fitting',final:'Final fit check'};
  const checks=['Agreed alteration finished','Garment fit and movement','Seams and finishing'];
  const lengths=['arm','torso','chest','inseam','hips','waist'];
  let state=read(KEY,null);
  if(!state || state.version!==1) state={version:1,customers:[{id:PRIMARY,name:profile.name,email:profile.email,phone:profile.phone||''},{id:'customer-riley',name:'Riley Morgan',email:'riley@example.com',phone:'555-0102'}],appointments:[],proposals:[],orders:[],measurements:[],questions:[]};
  let mode='customer', client=PRIMARY, tab='appointments', editAppointment=null, selectedJob='', selectedMeasureJob='', selectedType='initial';
  let measureDraft={}, unit='in', garment='skirt';
  profile.customerId=PRIMARY;
  const customer=id=>id===PRIMARY?{...state.customers.find(c=>c.id===id),name:profile.name,email:profile.email,phone:profile.phone||''}:state.customers.find(c=>c.id===id);
  const owner=r=>r.customerId || r.customer?.customerId || (r.customer?.email===profile.email ? PRIMARY : `legacy:${r.customer?.email||r.id}`);
  const ownRequest=id=>requests.find(r=>r.id===id && owner(r)===client);
  const ownOrder=id=>state.orders.find(o=>o.id===id && o.customerId===client);
  const mine=rows=>rows.filter(r=>r.customerId===client);
  const active=o=>!o.canceled && o.status!=='complete';
  function jobs(){return [...requests.filter(r=>owner(r)===client&&!state.orders.some(o=>o.requestId===r.id)).map(r=>({id:'request:'+r.id,label:`Request · ${r.garment||r.serviceName||'Skirt alteration'}`,kind:'request',record:r})),...mine(state.orders).filter(active).map(o=>({id:'order:'+o.id,label:`Order · ${o.garment}`,kind:'order',record:o}))];}
  const getJob=id=>jobs().find(j=>j.id===id);
  const showTime=a=>new Date(a.start).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});
  const upcoming=id=>state.appointments.filter(a=>a.customerId===client&&a.jobId===id&&a.status==='booked'&&new Date(a.start)>new Date()).sort((a,b)=>a.start.localeCompare(b.start));
  function blockers(o){return [...(o.problems.some(p=>p.state==='open')?['Resolve every open fit problem.']:[]),...(checks.some(k=>o.checks[k]!=='Passed')?['Pass every required fit check.']:[]),...(!o.fitApproval?['Ask the customer to approve the fit.']:[])];}
  function stripMeasurements(obj){if(!obj||typeof obj!=='object')return;for(const k of [...lengths,'measurements','measurement','measurementId','measurementsCm','valuesCm','measurementDate','measuredBy','source'])delete obj[k];}
  function scrubRequest(r){stripMeasurements(r);stripMeasurements(r.customer);}
  function validate(s){
    for(const o of s.orders){
      if(!['on going','ready for check up','complete'].includes(o.status))throw Error('Choose one of the three work statuses.');
      if(!o.studioAccepted||!o.customerAgreement||!o.quote?.approvedAt)throw Error('Orders need studio acceptance, an approved quote, and customer agreement.');
      if(o.status==='complete'&&!o.canceled&&blockers(o).length)throw Error(blockers(o).join(' '));
      if(o.pickup?.status==='Picked up'&&(o.status!=='complete'||o.canceled||!o.pickup.date))throw Error('Pickup needs a completed order and a pickup date.');
    }
    const booked=s.appointments.filter(a=>a.status==='booked');
    for(let i=0;i<booked.length;i++)for(let j=i+1;j<booked.length;j++)if(booked[i].tailor===booked[j].tailor&&Date.parse(booked[i].start)<Date.parse(booked[j].end)&&Date.parse(booked[j].start)<Date.parse(booked[i].end))throw Error('That tailor is already booked. Choose another available time.');
  }
  // Store one canonical workflow record; contact and legacy-request updates roll back on a storage failure.
  function transaction(fn){
    const next=clone(state), nextRequests=clone(requests), nextProfile=clone(profile);
    fn(next,nextRequests,nextProfile);validate(next);
    const keys=[KEY,'cnd-requests','cnd-profile'], before=keys.map(k=>localStorage.getItem(k));
    try{localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem('cnd-requests',JSON.stringify(nextRequests));localStorage.setItem('cnd-profile',JSON.stringify(nextProfile));}
    catch(err){keys.forEach((k,i)=>{try{before[i]===null?localStorage.removeItem(k):localStorage.setItem(k,before[i]);}catch{}});throw Error('Browser storage is unavailable or full. Nothing was saved; allow local storage and try again.');}
    state=next;requests=nextRequests;profile=nextProfile;bridge.setRequests(nextRequests);bridge.setProfile(nextProfile);updateCount();
  }
  function requireStaff(){if(mode!=='staff')throw Error('Switch to the clearly labeled sample staff view for this action.');}
  function requireCustomer(){if(mode!=='customer'||client!==PRIMARY)throw Error('The sample customer must make this choice in customer view.');}
  function closeMeasurements(s,rs,p,o){
    const ids=['order:'+o.id,'request:'+o.requestId];
    const removed=s.measurements.filter(m=>m.customerId===o.customerId&&m.permission==='no'&&ids.includes(m.jobId));
    s.measurements=s.measurements.filter(m=>!removed.includes(m));
    // New records reference canonical measurements; purge any legacy snapshots on this job too.
    const request=rs.find(r=>r.id===o.requestId);if(request){scrubRequest(request);if(removed.length&&request.kind==='catalog')delete request.fit;}
    stripMeasurements(o);
    for(const a of s.appointments.filter(a=>ids.includes(a.jobId)))stripMeasurements(a);
    if(o.customerId===PRIMARY){stripMeasurements(p);const reusable=s.measurements.find(m=>m.customerId===PRIMARY&&m.permission==='yes');if(reusable)p.measurementId=reusable.id;}
    s.appointments.filter(a=>ids.includes(a.jobId)&&a.status==='booked').forEach(a=>{a.status='canceled';a.cancelReason='Job closed';});
  }
  function dispatch(action,data={}){
    syncSharedRecords();
    const jobId=data.jobId;
    if(action==='contact'){
      if(!data.name?.trim()||!data.email?.trim())throw Error('Enter a name and email address.');
      transaction((s,rs,p)=>{const c=s.customers.find(c=>c.id===client);Object.assign(c,{name:data.name.trim(),email:data.email.trim(),phone:data.phone.trim()});if(client===PRIMARY)Object.assign(p,{customerId:PRIMARY,name:c.name,email:c.email,phone:c.phone});});
    }else if(action==='appointment'){
      if(!typeLabels[data.type])throw Error('Choose a fitting type.');
      const job=jobId?getJob(jobId):null;
      if(jobId&&!job)throw Error('Choose an active request or order belonging to this customer.');
      if(data.type==='final'&&(!job||job.kind!=='order'||job.record.status!=='ready for check up'||!active(job.record)))throw Error('A final fit check must belong to this customer and an order ready for customer review.');
      if(!data.description?.trim())throw Error('Describe the clothing and requested changes.');
      if(data.type==='adjustment'&&!['Bought from CraftNDetail','Bought from another brand'].includes(data.origin))throw Error('Choose where the garment was bought.');
      if(!availableSlots(data.date,data.tailor,editAppointment).includes(data.time))throw Error('Choose a future, available sample time for that tailor.');
      const start=new Date(data.date+'T'+data.time),end=new Date(+start+45*60000);
      const previous=editAppointment?state.appointments.find(a=>a.id===editAppointment&&a.customerId===client&&a.status==='booked'):null;
      if(editAppointment&&!previous)throw Error('That appointment cannot be rescheduled.');
      transaction(s=>{const record={id:previous?.id||uid(),customerId:client,type:data.type,jobId:jobId||'',tailor:data.tailor,start:start.toISOString(),end:end.toISOString(),description:data.description.trim(),origin:data.type==='adjustment'?data.origin:'',status:'booked'};s.appointments=s.appointments.filter(a=>a.id!==record.id);s.appointments.push(record);});
      editAppointment=null;selectedJob='';selectedType='initial';
    }else if(action==='cancel-appointment'){
      const a=state.appointments.find(a=>a.id===data.id&&a.customerId===client);if(!a||a.status!=='booked')throw Error('Choose a booked appointment.');
      transaction(s=>{s.appointments.find(x=>x.id===a.id).status='canceled';});
    }else if(action==='measurements'){
      const job=getJob(jobId);if(!job)throw Error('Select the active request or order these measurements are for.');
      if(!['yes','no'].includes(data.permission))throw Error('Please choose “I allow” or “No, I do not allow.”');
      if(!needs[data.garment])throw Error('Choose a garment or service.');
      if(!data.date||data.date>today()||!data.by?.trim())throw Error('Enter who took the measurements and a measurement date that is not in the future.');
      if(data.source==='staff')requireStaff();
      for(const k of needs[data.garment])if(!Number.isFinite(data.valuesCm[k])||data.valuesCm[k]<=0||data.valuesCm[k]>400)throw Error(`Enter a valid ${fields[k][0].toLowerCase()} (above zero and no more than 400 cm).`);
      if(Object.keys(data.valuesCm).some(k=>!lengths.includes(k)))throw Error('Use the six supported body measurement fields.');
      for(const value of Object.values(data.valuesCm))if(!Number.isFinite(value)||value<=0||value>400)throw Error('All entered measurements must be above zero and no more than 400 cm.');
      const record={id:uid(),customerId:client,jobId,garment:data.garment,valuesCm:data.valuesCm,date:data.date,by:data.by.trim(),source:data.source==='staff'?'staff':'home',checked:data.source==='staff'&&data.checked===true,permission:data.permission};
      transaction((s,rs,p)=>{
        s.measurements=s.measurements.filter(m=>!(m.customerId===client&&m.jobId===jobId));
        if(data.permission==='no'){
          const activeJobs=new Set(jobs().map(j=>j.id));
          s.measurements=s.measurements.filter(m=>m.customerId!==client||m.permission!=='yes'||activeJobs.has(m.jobId));
          s.measurements.forEach(m=>{if(m.customerId===client&&m.permission==='yes')m.permission='no';});
        }
        s.measurements.push(record);
        if(client===PRIMARY){stripMeasurements(p);if(data.permission==='yes')p.measurementId=record.id;}
        const r=rs.find(r=>'request:'+r.id===jobId);if(r)scrubRequest(r);
      });measureDraft={};
    }else if(action==='proposal'){
      requireStaff();const r=ownRequest(data.requestId);if(!r||state.orders.some(o=>o.requestId===r.id))throw Error('Choose an unconverted request for this customer.');
      const q=quotes.find(q=>q.id===data.quoteId&&q.status==='confirmed'&&q.approvedAt&&q.tailor);
      if(!q||!Number.isFinite(q.values?.price)||q.values.price<0)throw Error('Confirm a quote with tailor approval in Service quotes first.');
      if(!data.accepted||!data.garment?.trim()||!data.changes?.trim())throw Error('Describe the garment and agreed work, then confirm studio acceptance.');
      transaction(s=>{s.proposals=s.proposals.filter(p=>p.requestId!==r.id);s.proposals.push({id:uid(),customerId:client,requestId:r.id,garment:data.garment.trim(),changes:data.changes.trim(),quote:{id:q.id,service:q.service,price:q.values.price,approvedAt:q.approvedAt,tailor:q.tailor},studioAccepted:true,createdAt:new Date().toISOString()});});
    }else if(action==='agree'){
      requireCustomer();const p=state.proposals.find(p=>p.id===data.id&&p.customerId===client);
      if(!p||!data.agreed||!p.studioAccepted||state.orders.some(o=>o.requestId===p.requestId))throw Error('Review the studio proposal and explicitly agree to its service and price.');
      const q=quotes.find(q=>q.id===p.quote.id&&q.status==='confirmed'&&q.approvedAt===p.quote.approvedAt&&q.values.price===p.quote.price&&q.service===p.quote.service);
      if(!q)throw Error('The quote was changed or removed. Ask staff for a fresh proposal.');
      transaction(s=>{
        const o={id:uid(),customerId:client,requestId:p.requestId,garment:p.garment,changes:p.changes,quote:clone(p.quote),studioAccepted:true,customerAgreement:{at:new Date().toISOString(),name:customer(client).name},status:'on going',canceled:false,checks:Object.fromEntries(checks.map(k=>[k,'Not checked'])),problems:[],fitApproval:null,pickup:{status:'Awaiting pickup',date:null}};
        s.orders.push(o);s.proposals=s.proposals.filter(x=>x.id!==p.id);
        s.measurements.filter(m=>m.jobId==='request:'+p.requestId).forEach(m=>m.jobId='order:'+o.id);
        s.appointments.filter(a=>a.jobId==='request:'+p.requestId).forEach(a=>a.jobId='order:'+o.id);
        s.questions.filter(q=>q.link==='request:'+p.requestId).forEach(q=>q.link='order:'+o.id);
      });
    }else if(['status','checklist','problem','resolve','approve','pickup','cancel-order'].includes(action)){
      const o=ownOrder(data.id);if(!o)throw Error('Choose an order belonging to this customer.');
      if(o.canceled)throw Error('This order is canceled.');
      if(action!=='problem'&&action!=='pickup'&&o.status==='complete')throw Error('This order is already complete.');
      if(['status','checklist','resolve','pickup','cancel-order'].includes(action))requireStaff();else requireCustomer();
      transaction((s,rs,p)=>{
        const order=s.orders.find(x=>x.id===o.id);
        if(action==='status'){
          if(!['on going','ready for check up','complete'].includes(data.status))throw Error('Choose a work status.');
          if(data.status==='complete'){const why=blockers(order);if(why.length)throw Error('Cannot complete: '+why.join(' '));closeMeasurements(s,rs,p,order);}
          order.status=data.status;
          if(data.status==='on going')order.fitApproval=null;
        }
        if(action==='checklist'){
          if(!checks.every(k=>['Passed','Needs adjustment','Not checked'].includes(data.results[k])))throw Error('Complete each checklist choice.');
          order.checks=data.results;order.followUp=data.followUp?.trim()||'';
          // Any new staff check needs a fresh customer approval.
          order.fitApproval=null;if(checks.some(k=>data.results[k]!=='Passed'))order.status='on going';
        }
        if(action==='problem'){
          if(!data.description?.trim())throw Error('Describe what does not fit.');
          order.problems.push({id:uid(),description:data.description.trim(),nextStep:data.nextStep?.trim()||'Studio to review and plan an adjustment.',state:'open',createdAt:new Date().toISOString()});order.status='on going';order.fitApproval=null;order.pickup={status:'Awaiting pickup',date:null};
          order.checks['Garment fit and movement']='Needs adjustment';
        }
        if(action==='resolve'){
          const problem=order.problems.find(x=>x.id===data.problemId);if(!problem||problem.state!=='open'||!data.nextStep?.trim())throw Error('Record the follow-up work before resolving the problem.');
          problem.nextStep=data.nextStep.trim();problem.state='resolved';problem.resolvedAt=new Date().toISOString();order.fitApproval=null;
        }
        if(action==='approve'){
          if(order.status!=='ready for check up'||order.problems.some(p=>p.state==='open')||checks.some(k=>order.checks[k]!=='Passed')||!data.approved)throw Error('Staff must mark the order ready, resolve all problems, and pass all checks before you explicitly approve the fit.');
          order.fitApproval={at:new Date().toISOString(),name:customer(client).name};
        }
        if(action==='pickup'){
          if(order.status!=='complete'||!data.date||data.date>today())throw Error('Only a completed order can be picked up. Enter a pickup date that is not in the future.');
          order.pickup={status:'Picked up',date:data.date};
        }
        if(action==='cancel-order'){
          closeMeasurements(s,rs,p,order);order.canceled=true;order.canceledAt=new Date().toISOString();order.fitApproval=null;order.pickup={status:'Awaiting pickup',date:null};
        }
      });
    }else if(action==='question'){
      const link=data.link;
      const valid=mine(state.orders).some(o=>'order:'+o.id===link)||mine(state.appointments).some(a=>'appointment:'+a.id===link);
      if(!valid||!data.text?.trim())throw Error('Choose your appointment or order and enter a question.');
      transaction(s=>s.questions.push({id:uid(),customerId:client,link,text:data.text.trim(),reply:'',nextStep:'',createdAt:new Date().toISOString()}));
    }else if(action==='question-problem'){
      requireStaff();const q=state.questions.find(q=>q.id===data.id&&q.customerId===client);
      let link=q?.link;
      if(link?.startsWith('appointment:'))link=state.appointments.find(a=>'appointment:'+a.id===link&&a.customerId===client)?.jobId;
      const o=state.orders.find(o=>'order:'+o.id===link&&o.customerId===client&&!o.canceled);
      if(!q||!o||q.problemId)throw Error('This question needs an active related order and must not already be recorded as a fit problem.');
      transaction(s=>{const order=s.orders.find(x=>x.id===o.id),question=s.questions.find(x=>x.id===q.id),id=uid();order.problems.push({id,description:q.text,nextStep:q.nextStep||'Studio to investigate the fit and plan follow-up.',state:'open',createdAt:new Date().toISOString()});order.status='on going';order.fitApproval=null;order.checks['Garment fit and movement']='Needs adjustment';order.pickup={status:'Awaiting pickup',date:null};question.problemId=id;});
    }else if(action==='reply'){
      requireStaff();const q=state.questions.find(q=>q.id===data.id&&q.customerId===client);if(!q||!data.reply?.trim()||!data.nextStep?.trim())throw Error('Enter the reply and next step.');
      transaction(s=>Object.assign(s.questions.find(x=>x.id===q.id),{reply:data.reply.trim(),nextStep:data.nextStep.trim()}));
    }else throw Error('That action is unavailable.');
    render();if(!field('requests-page').hidden)renderMyRequests();
    notify(action==='cancel-appointment'?'Appointment canceled. The clothing order stays active.':action==='measurements'?'Measurements saved with your chosen storage permission.':action==='agree'?'Service and price agreed. Your alteration order is now on going.':action==='status'&&data.status==='complete'?'Order complete. Current-job-only measurements have been removed. Pickup is recorded separately.':'Saved in this browser. No message or email was sent.');
  }
  function notify(message){field('fit-message').textContent=message;toast(message);}
  function fail(error,form){const target=form?.querySelector('[role=alert]')||field('fit-error');target.textContent=error.message;target.tabIndex=-1;target.focus();}
  function availableDates(){const result=[];for(let n=1;n<=35;n++){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+n);if(d.getDay()!==0&&d.getDay()!==1)result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);}return result;}
  function availableSlots(date,tailor,exclude){
    if(!availableDates().includes(date)||!['Alex Rivera','Sam Taylor'].includes(tailor))return [];
    return ['10:00','11:00','14:00','15:00'].filter(time=>{const start=+new Date(date+'T'+time),end=start+45*60000;return start>Date.now()&&!state.appointments.some(a=>a.id!==exclude&&a.status==='booked'&&a.tailor===tailor&&start<Date.parse(a.end)&&Date.parse(a.start)<end);});
  }
  const options=(arr,value)=>arr.map(([v,label])=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(label)}</option>`).join('');
  const jobOptions=(value,final=false)=>`<option value="">${final?'Select a ready order':'No linked job (initial consultation)'}</option>`+options(jobs().filter(j=>!final||(j.kind==='order'&&j.record.status==='ready for check up')).map(j=>[j.id,j.label]),value);
  const alertHTML='<p class="fit-error" role="alert"></p>';
  function appointmentHTML(){
    const a=state.appointments.find(a=>a.id===editAppointment&&a.customerId===client);
    const type=a?.type||selectedType;
    const date=a&&availableDates().includes(localDate(a.start))?localDate(a.start):availableDates()[0];
    return `<div class="fit-layout"><form id="fit-appointment-form" class="panel fit-panel"><p class="eyebrow">01 · PLAN YOUR VISIT</p><h2>${a?'Reschedule appointment':'Book a fitting'}</h2><p class="fit-muted">Sample studio schedule: Tuesday–Saturday, 10 am, 11 am, 2 pm and 3 pm. Each visit takes 45 minutes. Times use this device’s local time zone (${e(Intl.DateTimeFormat().resolvedOptions().timeZone)}). No real studio reservation is made.</p>
      <label for="fit-type">Fitting type</label><select id="fit-type" name="type">${options(Object.entries(typeLabels),type)}</select>
      <label for="fit-job">Connect to a request or order</label><select id="fit-job" name="jobId">${jobOptions(a?.jobId||selectedJob,type==='final')}</select><p class="fit-muted" id="fit-job-help">Final checks are available only for your orders marked ready for check up.</p>
      <div id="fit-origin-wrap" ${type!=='adjustment'?'hidden':''}><label for="fit-origin">Where was it bought?</label><select id="fit-origin" name="origin">${options([['','Choose one'],['Bought from CraftNDetail','Bought from CraftNDetail'],['Bought from another brand','Bought from another brand']],a?.origin||'')}</select></div>
      <label for="fit-description">Clothing and requested changes</label><textarea id="fit-description" name="description" required maxlength="700" rows="3">${e(a?.description||'')}</textarea>
      <label for="fit-tailor">Tailor</label><select id="fit-tailor" name="tailor">${options([['Alex Rivera','Alex Rivera'],['Sam Taylor','Sam Taylor']],a?.tailor||'Alex Rivera')}</select>
      <label for="fit-date">Available future date</label><select id="fit-date" name="date">${options(availableDates().map(d=>[d,new Date(d+'T12:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'})]),date)}</select>
      <label for="fit-time">Available time (45 minutes)</label><select id="fit-time" name="time" required></select>${alertHTML}<div class="fit-actions"><button class="primary">${a?'Save rescheduled appointment':'Book sample appointment'}</button>${a?'<button type="button" class="secondary" data-fit-action="stop-edit">Keep current appointment</button>':''}</div><p class="fit-muted">Booking is separate from studio acceptance, price agreement, and order approval.</p></form>
      <section class="panel fit-panel"><h2>${mode==='staff'?e(customer(client)?.name)+'’s appointments':'My appointments'}</h2>${mine(state.appointments).length?mine(state.appointments).sort((a,b)=>a.start.localeCompare(b.start)).map(a=>`<article class="fit-record"><span class="fit-tag">${e(a.status)}</span><h3>${typeLabels[a.type]}</h3><p>${e(showTime(a))} · ${e(a.tailor)}<br>${e(a.description)}</p><p class="fit-muted">${e(linkLabel(a.jobId)||'Initial consultation — no linked order')}${a.origin?'<br>'+e(a.origin):''}</p>${a.status==='booked'?`<div class="fit-actions"><button class="secondary" data-fit-action="reschedule" data-id="${a.id}">Reschedule</button><button class="text-button" data-fit-action="cancel-appointment" data-id="${a.id}">Cancel appointment only</button></div>`:''}</article>`).join(''):'<p>No appointments yet. Choose a future sample time to begin.</p>'}</section></div>`;
  }
  function localDate(s){const d=new Date(s);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function linkLabel(id){if(!id)return '';const [kind,key]=id.split(':');if(kind==='request'){const r=requests.find(r=>r.id===key&&owner(r)===client);return r?`Request · ${r.garment||r.serviceName||'Skirt alteration'}`:'Linked request removed';}if(kind==='order'){const o=ownOrder(key);return o?`Order · ${o.garment}`:'Order unavailable';}const a=state.appointments.find(a=>a.id===key&&a.customerId===client);return a?`${typeLabels[a.type]} · ${showTime(a)}`:'Appointment unavailable';}
  function refreshSlots(){const time=field('fit-time');if(!time)return;const old=time.value,slots=availableSlots(field('fit-date').value,field('fit-tailor').value,editAppointment);time.innerHTML=slots.length?options(slots.map(t=>[t,new Date(field('fit-date').value+'T'+t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})]),old):'<option value="">No times left — choose another day or tailor</option>';}
  function svgGuide(key){
    const lines={arm:'<path d="M91 67 L62 116 L48 159"/><circle cx="91" cy="67" r="4"/><circle cx="48" cy="159" r="4"/><text x="3" y="62">Start: shoulder</text><text x="3" y="178">End: wrist</text>',torso:'<path d="M120 58 V129"/><circle cx="120" cy="58" r="4"/><circle cx="120" cy="129" r="4"/><text x="5" y="42">Start: back neck bone</text><text x="128" y="141">End: waist</text>',chest:'<ellipse cx="120" cy="91" rx="34" ry="9"/><text x="15" y="36">Fullest chest, under arms</text>',inseam:'<path d="M118 160 L105 223"/><circle cx="118" cy="160" r="4"/><circle cx="105" cy="223" r="4"/><text x="131" y="171">Start: crotch</text><text x="3" y="244">End: ankle bone</text>',hips:'<ellipse cx="120" cy="148" rx="36" ry="9"/><text x="16" y="36">Fullest hips and seat</text>',waist:'<ellipse cx="120" cy="129" rx="25" ry="7"/><text x="20" y="36">Natural waist crease</text>'};
    return `<svg viewBox="0 0 250 260" role="img" aria-label="${e(fields[key][0]+': '+fields[key][1])}"><path d="M109 53 L91 67 L70 100 L60 125 L78 133 L95 103 L96 125 L86 157 L100 226 L116 226 L120 170 L124 226 L140 226 L154 157 L144 125 L145 103 L162 133 L180 125 L170 100 L149 67 L131 53Z" fill="#e3e9e3" stroke="#79948a" stroke-width="2"/><circle cx="120" cy="36" r="16" fill="#e3e9e3" stroke="#79948a"/><g fill="none" stroke="#ad5339" stroke-width="4">${lines[key].replaceAll('<text','<text fill="#733820" stroke="none" font-size="11" font-family="sans-serif"')}</g></svg>`;
  }
  function guideHTML(){return `<details id="fit-guide"><summary>How to measure at home · illustrated guide</summary><p>Use a soft tape over light clothing. Stand naturally, keep the tape snug without squeezing, and ask a helper for length measurements. These are body measurements; staff will confirm garment ease and finished lengths at a fitting.</p><div class="fit-guide-grid">${Object.entries(fields).map(([key,[label,description]])=>`<article class="fit-guide"><h3>${label}</h3>${svgGuide(key)}<ol><li>${e(description)}</li><li>${['chest','hips','waist'].includes(key)?'Keep the tape level all the way around. Breathe normally.':'Follow the illustrated start and end points without stretching the tape.'}</li><li>Read the tape in your selected unit. Repeat once and enter the result below.</li></ol></article>`).join('')}</div><button class="secondary" type="button" data-fit-action="enter-measurements">Enter measurements below ↓</button></details>`;}
  function measurementHTML(){
    const recent=mine(state.measurements).filter(m=>m.jobId===selectedMeasureJob||m.permission==='yes').at(-1);
    if(!Object.keys(measureDraft).length&&recent)measureDraft=clone(recent.valuesCm);
    return `<div class="fit-callout"><strong>Your existing customer profile</strong> · ${e(customer(client)?.name)} · ${e(customer(client)?.email)} · ${e(customer(client)?.phone||'No phone entered')}<br><button class="text-button" type="button" data-fit-action="profile">Edit contact details</button><p class="fit-small">Contact details and measurements belong to the same customer. Home measurements are not staff verified; they do not reshape the mannequin.</p></div>${guideHTML()}
      <div class="fit-layout"><form id="fit-measure-form" class="panel fit-panel"><p class="eyebrow">02 · YOUR MEASUREMENTS</p><h2>Measure for this job</h2>
      <label for="fit-measure-job">Current request or order</label><select id="fit-measure-job" name="jobId" required><option value="">Choose an active job</option>${options(jobs().map(j=>[j.id,j.label]),selectedMeasureJob)}</select><p class="fit-muted">Save a fitting request in Design studio or Services first. A job is required even if you decline future storage.</p>
      <label for="fit-garment">Garment or service</label><select id="fit-garment" name="garment">${options([['skirt','Skirt alteration'],['trousers','Trousers alteration'],['top','Top / sleeve alteration'],['repair','Repair only — no body measurements needed']],garment)}</select><p class="fit-muted">Only the marked measurements are required for this sample service. Staff can confirm any additional needs at your fitting.</p>
      <label for="fit-unit">Measurement unit</label><select id="fit-unit">${options([['in','Inches'],['cm','Centimeters']],unit)}</select><p class="fit-muted" id="fit-conversion" role="status">Values are converted using exactly 2.54 cm per inch.</p>
      <div class="fit-inline" id="fit-measure-inputs">${measurementInputs()}</div><label for="fit-measured-date">Measurement date</label><input id="fit-measured-date" name="date" type="date" max="${today()}" value="${today()}" required/>
      <label for="fit-measured-by">Who took these measurements?</label><input id="fit-measured-by" name="by" required maxlength="100" value="${e(mode==='customer'?customer(client)?.name:'')}"/>
      ${mode==='staff'?'<label for="fit-source">Measurement entry</label><select id="fit-source" name="source"><option value="staff">Staff measured in studio</option><option value="home">Customer-provided at home</option></select><label class="fit-check"><input id="fit-checked" name="checked" type="checkbox"/> I manually checked these measurements in this sample staff view.</label>':'<input type="hidden" name="source" value="home"/><p class="fit-callout">Customer-provided — not checked by staff.</p>'}
      <fieldset><legend>Measurement storage permission</legend><p>I allow CraftNDetail to have my measurements for future alterations.</p><label class="fit-radio"><input type="radio" name="permission" value="yes" required/> I allow</label><label class="fit-radio"><input type="radio" name="permission" value="no" required/> No, I do not allow</label><p class="fit-muted">Yes means the measurements can be kept for future services. No means they are used only for the current order and deleted when that order is completed or canceled. Name, phone number, and email remain on record. Saying no does not prevent you from receiving service. Choosing no also stops future reuse of earlier saved measurements; measurements needed for another active job are kept for that job only. Staff must record the customer’s answer too.</p></fieldset>
      ${alertHTML}<button class="primary">Save measurements and permission</button></form>
      <section class="panel fit-panel"><h2>Saved measurement records</h2><p class="fit-muted">Values below use ${unit==='in'?'inches':'centimeters'}. Older unconsented profile notes are not automatically reused. Save a fresh permission choice for this job.</p>${mine(state.measurements).length?mine(state.measurements).map(m=>`<article class="fit-record"><span class="fit-tag">${m.permission==='yes'?'Allowed for future services':'Current job only'}</span><h3>${e(linkLabel(m.jobId))}</h3><p>${m.source==='home'?'Customer-provided — not checked by staff.':m.checked?'Staff-entered — manually checked in sample staff view.':'Staff-entered — not yet checked.'}</p><dl>${Object.entries(m.valuesCm).map(([k,v])=>`<dt>${fields[k][0]}</dt><dd>${displayMeasure(v)} ${unit}</dd>`).join('')}</dl><p>${e(m.date)} · Taken by ${e(m.by)}</p></article>`).join(''):'<p>No consented measurements saved yet.</p>'}</section></div>`;
  }
  function displayMeasure(cm){return Number((unit==='cm'?cm:cm/2.54).toFixed(4)).toString();}
  function measurementInputs(){return Object.entries(fields).map(([key,[label,description]])=>`<div><label for="fit-m-${key}">${label} (${unit})${needs[garment].includes(key)?' · required':''}</label><input id="fit-m-${key}" data-measure="${key}" type="number" min="0.01" max="${unit==='cm'?400:157.4804}" step="any" ${needs[garment].includes(key)?'required':''} value="${measureDraft[key]?displayMeasure(measureDraft[key]):''}" aria-describedby="fit-help-${key}"/><p class="fit-muted fit-small" id="fit-help-${key}">${description}</p></div>`).join('');}
  function ordersHTML(){
    const rs=requests.filter(r=>owner(r)===client&&!state.orders.some(o=>o.requestId===r.id));
    const confirmed=quotes.filter(q=>q.status==='confirmed');
    return `<p class="fit-callout">An appointment or request is not an approved alteration order. First staff accept the work and attach a confirmed Service quote. Then the customer explicitly agrees to that exact service and price. Work statuses are <strong>on going</strong>, <strong>ready for check up</strong>, and <strong>complete</strong>. Cancellation and pickup are tracked separately.</p>
    ${mode==='staff'?`<form class="panel fit-panel" id="fit-proposal-form"><h2>Accept work and propose an order</h2><p class="fit-muted">This records studio acceptance. Only the customer can agree to the price and create the order in customer view.</p><label for="fit-proposal-request">Existing customer request</label><select id="fit-proposal-request" name="requestId" required><option value="">Select a request</option>${options(rs.map(r=>[r.id,r.garment||r.serviceName||'Skirt alteration']))}</select><label for="fit-proposal-garment">Clothing item</label><input id="fit-proposal-garment" name="garment" required maxlength="160"/><label for="fit-proposal-changes">Work offered for customer agreement</label><textarea id="fit-proposal-changes" name="changes" required maxlength="1000" rows="3"></textarea><label for="fit-proposal-quote">Confirmed Service quote</label><select id="fit-proposal-quote" name="quoteId" required><option value="">Select a confirmed quote</option>${options(confirmed.map(q=>[q.id,`${q.service} · ${money(q.values.price)} · ${q.tailor}`]))}</select><p class="fit-muted">No confirmed quote? Use the existing <button type="button" class="text-button" data-page="quotes">Service quotes</button> calculator and its tailor review. Prices are copied as an agreed reference, so later quote edits do not rewrite an approved order.</p><label class="fit-check"><input type="checkbox" name="accepted" required/> The studio accepts this work, subject to the customer agreeing to the service and price.</label>${alertHTML}<button class="primary">Save studio proposal</button></form>`:''}
    <section class="panel fit-panel"><h2>Awaiting customer agreement</h2>${mine(state.proposals).length?mine(state.proposals).map(p=>`<article class="fit-record"><h3>${e(p.garment)}</h3><p>${e(p.changes)}</p><p><strong>${money(p.quote.price)}</strong> · ${e(p.quote.service)}<br>Quote reference: ${e(p.quote.id)}<br>Studio accepted · not yet an alteration order.</p>${mode==='customer'?`<form data-fit-form="agree" data-id="${p.id}"><label class="fit-check"><input type="checkbox" name="agreed" required/> I agree to this service and price of ${money(p.quote.price)}.</label>${alertHTML}<button class="primary">Agree and create alteration order</button></form>`:'<p class="fit-next">Switch to customer view for the customer’s own agreement. Staff cannot agree on their behalf in this demo.</p>'}</article>`).join(''):'<p>No proposals awaiting agreement.</p>'}</section>
    <section><h2>${mode==='customer'?'My orders':e(customer(client)?.name)+'’s orders'}</h2>${mine(state.orders).length?mine(state.orders).map(orderHTML).join(''):'<div class="panel fit-panel"><p>No approved alteration orders yet. Start with a fitting request, studio acceptance, and a confirmed quote.</p></div>'}</section>`;
  }
  function orderHTML(o){
    const why=blockers(o), apps=upcoming('order:'+o.id);
    return `<article class="panel fit-panel" id="fit-order-${o.id}" data-order-id="${o.id}"><p class="eyebrow">ORDER · ${e(o.id.slice(0,8))}</p><h2>${e(o.garment)}</h2><span class="fit-tag">${o.canceled?'Canceled · not successfully completed':e(o.status)}</span>${!o.canceled?`<span class="fit-tag">${e(o.pickup.status)}</span>`:''}<div class="fit-summary"><p><strong>Agreed changes:</strong> ${e(o.changes)}</p><p><strong>Agreed price:</strong> ${money(o.quote.price)} · ${e(o.quote.service)}</p><p class="fit-small">Quote reference: ${e(o.quote.id)} · Approved ${e(o.quote.approvedAt)}<br>Customer service/price agreement: ${e(o.customerAgreement.name)} · ${e(o.customerAgreement.at)}</p><p><strong>Upcoming appointment:</strong> ${apps.length?e(showTime(apps[0]))+' · '+e(typeLabels[apps[0].type]):'None booked'}</p><p><strong>Open fit problems:</strong> ${o.problems.filter(p=>p.state==='open').length}</p><p><strong>Customer fit approval:</strong> ${o.fitApproval?'Recorded by '+e(o.fitApproval.name):'Not recorded'}</p>${o.pickup.date?`<p>Pickup date: ${e(o.pickup.date)}</p>`:''}</div>
    ${o.status==='ready for check up'&&!o.canceled?`<div class="fit-email"><h3>Sample email preview — not sent</h3><p>To: ${e(customer(o.customerId)?.email)}<br>Subject: Your ${e(o.garment)} is ready for a fit check</p><p>Hello ${e(customer(o.customerId)?.name)}, your alteration is ready for customer review. Please book a final fit check so we can review the fit together.</p><button class="secondary" data-fit-action="book-final" data-id="${o.id}">Book final fit check for this order</button><p class="fit-muted">Demonstration only. No email has been sent, and no reminder service is connected.</p></div>`:''}
    <h3>Required fit checks</h3><ul>${checks.map(k=>`<li>${e(k)}: <strong>${e(o.checks[k])}</strong></li>`).join('')}</ul>
    ${!o.canceled&&o.status!=='complete'?`<p class="fit-next">${why.length?'Before completion: '+e(why.join(' ')):'All completion requirements met. Staff can now mark the order complete.'}</p>`:''}
    <h3>Fit problems and follow-up</h3>${o.problems.length?o.problems.map(p=>`<section class="fit-record"><strong>${e(p.state)} · ${e(p.description)}</strong><p>Next step / follow-up: ${e(p.nextStep)}</p>${mode==='staff'&&p.state==='open'&&!o.canceled?`<form data-fit-form="resolve" data-id="${o.id}" data-problem-id="${p.id}"><label for="fit-follow-${p.id}">Follow-up work completed</label><textarea id="fit-follow-${p.id}" name="nextStep" required maxlength="800"></textarea>${alertHTML}<button class="secondary">Record work and resolve problem</button></form>`:''}</section>`).join(''):'<p>No fit problems reported.</p>'}
    ${mode==='customer'&&!o.canceled?`<details><summary>Report a fit problem</summary><form data-fit-form="problem" data-id="${o.id}"><label for="fit-problem-${o.id}">What does not fit?</label><textarea id="fit-problem-${o.id}" name="description" maxlength="800" required placeholder="For example, the waist feels too tight when I sit."></textarea><label for="fit-next-${o.id}">Requested next step (optional)</label><input id="fit-next-${o.id}" name="nextStep" maxlength="500"/>${alertHTML}<button class="secondary">Report fit problem</button><p class="fit-muted">A new problem returns this order to on going, clears prior fit approval, and requires another passed fit check.</p></form></details>`:''}
    ${mode==='customer'&&active(o)?`<form data-fit-form="approve" data-id="${o.id}"><label class="fit-check"><input type="checkbox" name="approved" required/> I have checked the garment and approve its fit.</label>${alertHTML}<button class="primary" ${o.status!=='ready for check up'||o.problems.some(p=>p.state==='open')||checks.some(k=>o.checks[k]!=='Passed')?'disabled':''}>Record my fit approval</button><p class="fit-muted">Fit approval is separate from agreeing to the service price. Resolving a problem never supplies your approval.</p></form>`:''}
    ${mode==='staff'&&active(o)?`<details><summary>Sample staff · checks and order progress</summary><form data-fit-form="checklist" data-id="${o.id}">${checks.map((k,i)=>`<label for="fit-check-${o.id}-${i}">${e(k)}</label><select id="fit-check-${o.id}-${i}" name="check${i}">${options(['Not checked','Needs adjustment','Passed'].map(s=>[s,s]),o.checks[k])}</select>`).join('')}<label for="fit-staff-note-${o.id}">Staff-only work notes</label><textarea id="fit-staff-note-${o.id}" name="followUp" maxlength="1000">${e(o.followUp||'')}</textarea>${alertHTML}<button class="secondary">Save checklist and staff notes</button><p class="fit-muted">Rechecking clears previous customer fit approval. These internal notes are hidden in customer view.</p></form><form data-fit-form="status" data-id="${o.id}"><label for="fit-status-${o.id}">Work status</label><select id="fit-status-${o.id}" name="status">${options(['on going','ready for check up','complete'].map(s=>[s,s]),o.status)}</select>${alertHTML}<button class="primary">Save work status</button><p class="fit-muted">Selecting complete is checked again in saved order logic. ${e(why.join(' '))}</p></form><button class="text-button" data-fit-action="cancel-order" data-id="${o.id}">Cancel order separately…</button></details>`:''}
    ${mode==='staff'&&o.status==='complete'&&!o.canceled&&o.pickup.status!=='Picked up'?`<form data-fit-form="pickup" data-id="${o.id}"><label for="fit-pickup-${o.id}">Pickup date</label><input id="fit-pickup-${o.id}" name="date" type="date" max="${today()}" value="${today()}" required/>${alertHTML}<button class="secondary">Record picked up</button></form>`:''}
    ${o.canceled?'<p>Work was canceled separately from its last work status. Current-job-only measurements were removed; contact details remain.</p>':''}</article>`;
  }
  function questionsHTML(){
    const links=[...mine(state.appointments).map(a=>['appointment:'+a.id,`${typeLabels[a.type]} · ${showTime(a)}`]),...mine(state.orders).map(o=>['order:'+o.id,`Order · ${o.garment}${o.canceled?' (canceled)':''}`])];
    return `<section class="panel fit-panel"><h2>Customer questions</h2><p class="fit-muted">Ask about an appointment or order. General questions do not block completion. If the garment does not fit, use “Report a fit problem” on the order so it is recorded as an open fit problem.</p><form id="fit-question-form"><label for="fit-question-link">Related appointment or order</label><select id="fit-question-link" name="link" required><option value="">Choose one of your records</option>${options(links)}</select><label for="fit-question-text">Your question</label><textarea id="fit-question-text" name="text" required maxlength="1000" rows="2"></textarea>${alertHTML}<button class="secondary">Save question</button></form>
    ${mine(state.questions).map(q=>`<article class="fit-record"><h3>${e(q.text)}</h3><p class="fit-muted">${e(linkLabel(q.link))}</p><p><strong>Staff reply:</strong> ${e(q.reply||'Awaiting reply')}<br><strong>Next step:</strong> ${e(q.nextStep||'Studio to review')}</p>${mode==='staff'?`<form data-fit-form="reply" data-id="${q.id}"><label for="fit-reply-${q.id}">Reply visible to customer</label><textarea id="fit-reply-${q.id}" name="reply" required maxlength="1000">${e(q.reply)}</textarea><label for="fit-qstep-${q.id}">Next step visible to customer</label><input id="fit-qstep-${q.id}" name="nextStep" required maxlength="500" value="${e(q.nextStep)}"/>${alertHTML}<button class="secondary">Save staff reply</button></form>${!q.problemId?`<button class="text-button" data-fit-action="question-problem" data-id="${q.id}">Record this question as a fit problem</button><p class="fit-muted">Use only when this question identifies a fit issue on its linked order. This creates an open problem and blocks completion.</p>`:'<p>Linked fit problem recorded on the order.</p>'}`:''}</article>`).join('')}</section>`;
  }
  function render(){
    syncSharedRecords();
    if(!state.customers.some(c=>c.id===client))client=PRIMARY;
    field('fit-mode').value=mode;field('fit-customer-select').innerHTML=options(state.customers.map(c=>[c.id,customer(c.id)?.name]));field('fit-customer-select').hidden=mode!=='staff';field('fit-customer-select').value=client;
    field('fit-view-label').textContent=mode==='customer'?`Sample customer view · ${customer(PRIMARY).name}`:`Sample staff view · managing ${customer(client)?.name}`;
    document.querySelectorAll('[data-fit-tab]').forEach(b=>{const on=b.dataset.fitTab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    const body=field('fit-body');body.setAttribute('aria-labelledby','fit-tab-'+tab);
    body.innerHTML=(tab==='appointments'?appointmentHTML():tab==='measurements'?measurementHTML():ordersHTML())+questionsHTML();
    if(tab==='appointments'){
      refreshSlots();const a=state.appointments.find(a=>a.id===editAppointment);if(a){const d=new Date(a.start);field('fit-time').value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
      field('fit-type').onchange=()=>{const type=field('fit-type').value,old=field('fit-job').value;field('fit-origin-wrap').hidden=type!=='adjustment';field('fit-origin').required=type==='adjustment';field('fit-job').innerHTML=jobOptions(old,type==='final');field('fit-job').required=type==='final';};
      for(const id of ['fit-date','fit-tailor'])field(id).onchange=refreshSlots;
      field('fit-job').onchange=()=>{const j=getJob(field('fit-job').value);if(j&&!field('fit-description').value)field('fit-description').value=j.record.garment?`${j.record.garment}: ${j.record.changes||j.record.notes||j.record.change||''}`:`Skirt alteration: ${j.record.change||j.record.notes||''}`;};
      field('fit-job').dispatchEvent(new Event('change'));
    }
    if(tab==='measurements'){
      field('fit-unit').onchange=()=>{captureMeasurements();unit=field('fit-unit').value;field('fit-measure-inputs').innerHTML=measurementInputs();field('fit-conversion').textContent=`Converted to ${unit==='cm'?'centimeters':'inches'}. Existing values use exactly 2.54 cm per inch.`;const panel=field('fit-measure-form').nextElementSibling;panel.querySelector('.fit-muted').textContent=`Values below use ${unit==='cm'?'centimeters':'inches'}. Save a fresh permission choice for each job.`;panel.querySelectorAll('.fit-record').forEach((article,i)=>{const values=Object.values(mine(state.measurements)[i].valuesCm);article.querySelectorAll('dd').forEach((dd,j)=>dd.textContent=displayMeasure(values[j])+' '+unit);});};
      field('fit-garment').onchange=()=>{captureMeasurements();garment=field('fit-garment').value;field('fit-measure-inputs').innerHTML=measurementInputs();};
      field('fit-measure-job').onchange=()=>{selectedMeasureJob=field('fit-measure-job').value;measureDraft={};const m=mine(state.measurements).filter(m=>m.jobId===selectedMeasureJob||m.permission==='yes').at(-1);if(m)measureDraft=clone(m.valuesCm);field('fit-measure-inputs').innerHTML=measurementInputs();field('fit-measure-form').querySelectorAll('[name=permission]').forEach(r=>r.checked=false);};
      if(field('fit-source'))field('fit-source').onchange=()=>{if(field('fit-source').value==='home')field('fit-checked').checked=false;field('fit-checked').disabled=field('fit-source').value==='home';};
    }
    if(field('fit-proposal-request'))field('fit-proposal-request').onchange=()=>{const r=ownRequest(field('fit-proposal-request').value);if(r){field('fit-proposal-garment').value=r.garment||'Terracotta midi skirt';field('fit-proposal-changes').value=r.notes||r.change||r.serviceName;}};
  }
  function captureMeasurements(){document.querySelectorAll('[data-measure]').forEach(input=>{if(input.value==='')delete measureDraft[input.dataset.measure];else{const v=Number(input.value);const existing=measureDraft[input.dataset.measure];if(existing===undefined||Number(displayMeasure(existing))!==v)measureDraft[input.dataset.measure]=unit==='cm'?v:v*2.54;}});}
  function openProfile(){
    const c=customer(client);const old=field('profile-form'),newForm=document.createElement('form');newForm.id='profile-form';
    newForm.innerHTML=`<button type="button" class="close" data-close aria-label="Close profile">×</button><p class="eyebrow">EXISTING SAMPLE CUSTOMER PROFILE</p><h2>Contact & measurements</h2><p class="fit-muted">Fictional details only. Contact information stays on record when current-job measurements are deleted.</p><label for="customer-name">Customer name</label><input id="customer-name" name="name" value="${e(c.name)}" required maxlength="80"/><label for="customer-phone">Phone number</label><input id="customer-phone" name="phone" type="tel" value="${e(c.phone||'')}" maxlength="40"/><label for="customer-email">Email</label><input id="customer-email" name="email" type="email" value="${e(c.email)}" required maxlength="120"/><p class="fit-muted">Arm length, torso length, chest, inseam, hips and waist are managed in this profile’s Measurements tab with a guide, units, date, source, and explicit storage permission.</p>${alertHTML}<button class="primary">Save sample profile</button><button class="secondary" type="button" id="fit-profile-measure">Open measurements and home guide</button>`;
    old.replaceWith(newForm);
    newForm.onsubmit=event=>{event.preventDefault();try{dispatch('contact',Object.fromEntries(new FormData(newForm)));field('profile-dialog').close();}catch(error){fail(error,newForm);}};
    field('fit-profile-measure').onclick=()=>{field('profile-dialog').close();tab='measurements';page('fitting');};
    if(!field('profile-dialog').open)field('profile-dialog').showModal();
  }
  document.querySelector('nav').insertAdjacentHTML('beforeend','<button class="nav-link" data-page="fitting">Customer fitting</button>');
  document.querySelector('main').insertAdjacentHTML('beforeend',`<section id="fitting-page" hidden><div class="intro"><div><p class="eyebrow">FROM FIRST FITTING TO FINAL STITCH</p><h1 tabindex="-1">Customer fitting</h1><p>Plan a visit, share measurements, and follow the fit of your garment.</p></div></div><div class="fit-callout"><strong>Local classroom demonstration</strong><p>Use fictional information. All records stay in this browser. Sample staff access and customer switching are demonstrations, not secure accounts. This file makes no real bookings and sends no emails. Anyone with this file and browser can inspect stored data.</p><div class="fit-mode"><label for="fit-mode">Demo view</label><select id="fit-mode"><option value="customer">Sample customer view</option><option value="staff">Sample staff view</option></select><select id="fit-customer-select" aria-label="Customer managed by sample staff" hidden>${options(state.customers.map(c=>[c.id,c.name]))}</select><strong id="fit-view-label"></strong></div></div><p id="fit-message" class="fit-status" role="status" aria-live="polite"></p><p id="fit-error" class="fit-error" role="alert"></p><div class="fit-tabs" role="tablist" aria-label="Customer fitting sections">${[['appointments','Appointments'],['measurements','Measurements'],['orders','Orders and fit checks']].map(([key,label])=>`<button type="button" class="secondary" role="tab" id="fit-tab-${key}" data-fit-tab="${key}" aria-controls="fit-body" aria-selected="${key==='appointments'}" tabindex="${key==='appointments'?0:-1}">${label}</button>`).join('')}</div><div id="fit-body" role="tabpanel" aria-labelledby="fit-tab-appointments" tabindex="0"></div></section>`);
  field('fit-mode').onchange=()=>{mode=field('fit-mode').value;client=PRIMARY;editAppointment=null;measureDraft={};selectedMeasureJob='';render();notify(mode==='staff'?'Sample staff view. This switch is not authentication.':'Sample customer view. Only this customer’s fitting records are shown.');};
  field('fit-customer-select').onchange=()=>{client=field('fit-customer-select').value;editAppointment=null;selectedJob='';selectedMeasureJob='';measureDraft={};render();};
  document.querySelector('.fit-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[data-fit-tab]')],index=tabs.indexOf(event.target);const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;tabs[next].click();tabs[next].focus();});
  document.querySelector('.fit-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-fit-tab]');if(b){if(tab==='measurements')captureMeasurements();tab=b.dataset.fitTab;render();}});
  field('fit-body').addEventListener('submit',event=>{
    event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form));
    if(form.dataset.id)data.id=form.dataset.id;
    for(const name of ['accepted','agreed','approved','checked'])data[name]=form.querySelector(`[name="${name}"]`)?.checked===true;
    try{
      if(form.id==='fit-appointment-form')dispatch('appointment',data);
      else if(form.id==='fit-measure-form'){captureMeasurements();dispatch('measurements',{...data,valuesCm:clone(measureDraft)});}
      else if(form.id==='fit-proposal-form')dispatch('proposal',data);
      else if(form.id==='fit-question-form')dispatch('question',data);
      else if(form.dataset.fitForm==='checklist')dispatch('checklist',{...data,results:Object.fromEntries(checks.map((k,i)=>[k,data['check'+i]]))});
      else if(form.dataset.fitForm==='resolve')dispatch('resolve',{...data,problemId:form.dataset.problemId});
      else dispatch(form.dataset.fitForm,data);
    }catch(error){fail(error,form);}
  });
  field('fit-body').addEventListener('click',event=>{
    const b=event.target.closest('[data-fit-action]');if(!b)return;
    try{
      const action=b.dataset.fitAction;
      if(action==='reschedule'){editAppointment=b.dataset.id;tab='appointments';render();field('fit-appointment-form').scrollIntoView({behavior:'smooth'});}
      else if(action==='stop-edit'){editAppointment=null;render();}
      else if(action==='profile')openProfile();
      else if(action==='enter-measurements')field('fit-measure-job').focus();
      else if(action==='book-final'){selectedJob='order:'+b.dataset.id;selectedType='final';editAppointment=null;tab='appointments';render();field('fit-description').focus();}
      else if(action==='cancel-order'){
        const o=ownOrder(b.dataset.id);if(!o)return;
        const box=document.createElement('div');box.className='fit-callout';box.innerHTML=`<p>Cancel this clothing order? It will not count as completed. Current-job-only measurements and linked future appointments will be removed or canceled. Other active jobs remain.</p><button class="secondary" type="button" id="fit-confirm-cancel">Yes, cancel this order</button> <button class="text-button" type="button" id="fit-keep-order">Keep order</button>`;b.replaceWith(box);
        field('fit-keep-order').onclick=()=>render();field('fit-confirm-cancel').onclick=()=>{try{dispatch('cancel-order',{id:o.id});}catch(error){fail(error);}};field('fit-keep-order').focus();
      }else dispatch(action,{id:b.dataset.id});
    }catch(error){fail(error);}
  });
  // Original request records remain the shared source; use IDs rather than filtered array positions.
  function renderMyRequests(){
    syncSharedRecords();
    const visible=requests.filter(r=>owner(r)===PRIMARY);
    field('requests-list').innerHTML=visible.length?visible.map(r=>{
      const order=state.orders.find(o=>o.requestId===r.id&&o.customerId===PRIMARY),apps=state.appointments.filter(a=>a.customerId===PRIMARY&&a.status==='booked'&&(a.jobId==='request:'+r.id||a.jobId==='order:'+order?.id));
      return `<article class="panel request-card" data-request-id="${e(r.id)}"><span class="pill">${order?(order.canceled?'Canceled · not successfully completed':e(order.status)):e(r.status)}</span><h3>${e(r.kind==='catalog'?r.serviceName:'Skirt alteration')} · ${e(new Date(r.createdAt).toLocaleDateString())}</h3>${requestSummary(r)}${order?`<p>Agreed price: ${money(order.quote.price)} · Open fit problems: ${order.problems.filter(p=>p.state==='open').length} · ${e(order.pickup.status)}</p>`:''}<p>Linked appointments: ${apps.length?apps.map(a=>e(showTime(a))).join(', '):'None booked'}</p><div class="fit-actions"><button class="secondary" data-fit-open-request="${e(r.id)}">Open fitting and order details</button><button class="text-button" data-fit-remove-request="${e(r.id)}">Remove demo request</button></div></article>`;
    }).join(''):'<div class="empty-state"><h2>Every great fit starts with an idea.</h2><p>Your saved demonstration requests will appear here.</p><button class="secondary" data-page="design">Explore the skirt example →</button></div>';
    field('clear-requests').hidden=!visible.length;
  };
  function removeRequest(id){
    if(state.orders.some(o=>o.requestId===id)||state.measurements.some(m=>m.jobId==='request:'+id)||state.appointments.some(a=>a.jobId==='request:'+id&&a.status==='booked')){toast('This request is linked to fitting records. Keep it for its order and measurement history.');return;}
    transaction((s,rs)=>{const index=rs.findIndex(r=>r.id===id&&owner(r)===PRIMARY);if(index>=0)rs.splice(index,1);s.proposals=s.proposals.filter(p=>p.requestId!==id);});renderMyRequests();
  }
  field('requests-list').addEventListener('click',event=>{
    const open=event.target.closest('[data-fit-open-request]'),remove=event.target.closest('[data-fit-remove-request]');
    if(open)openRequest(open.dataset.fitOpenRequest);
    if(remove)try{removeRequest(remove.dataset.fitRemoveRequest);}catch(error){toast(error.message);}
  });
  field('clear-requests').addEventListener('click',()=>{for(const r of [...requests].filter(r=>owner(r)===PRIMARY))removeRequest(r.id);});
  function openRequest(id,{book=false}={}) {
    syncSharedRecords();
    const r=requests.find(r=>r.id===id&&owner(r)===PRIMARY);
    if(!r)return;
    mode='customer';client=PRIMARY;
    const order=state.orders.find(o=>o.requestId===id&&o.customerId===PRIMARY);
    selectedJob=order?'order:'+order.id:'request:'+id;
    selectedMeasureJob=selectedJob;selectedType='initial';editAppointment=null;
    tab=order&&!book?'orders':'appointments';page('fitting');
    if(order&&!book)field('fit-order-'+order.id)?.scrollIntoView({behavior:'smooth'});
  }
  // Assign stable ownership to legacy snapshots before contact details can change.
  try {
    transaction((s,rs,p)=>{p.customerId=PRIMARY;rs.forEach(r=>{if(!r.customerId)r.customerId=owner(r);if(!s.customers.some(c=>c.id===r.customerId))s.customers.push({id:r.customerId,name:r.customer?.name||'Legacy sample customer',email:r.customer?.email||'',phone:r.customer?.phone||''});});});
  } catch(error) {
    // A storage restriction must not prevent the other sections from starting.
    field('fit-error').textContent=error.message;
  }
  updateCount();render();
  return {render,openProfile,openRequest,renderRequests:renderMyRequests,customerRequests:()=>{syncSharedRecords();return requests.filter(r=>owner(r)===PRIMARY);}};
}
