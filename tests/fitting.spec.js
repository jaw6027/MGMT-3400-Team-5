import {test,expect} from '@playwright/test';
const url='/';
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('cnd-fitting-v1')));
// Bypass native field constraints through the same submit handler to verify
// that invalid state transitions are rejected before localStorage is changed.
const call=(page,action,data={})=>page.evaluate(({action,data})=>{
 const form=document.createElement('form');
 const ids={appointment:'fit-appointment-form',measurements:'fit-measure-form',proposal:'fit-proposal-form',question:'fit-question-form'};
 if(ids[action])form.id=ids[action];else form.dataset.fitForm=action;
 if(data.id)form.dataset.id=data.id;
 if(data.problemId)form.dataset.problemId=data.problemId;
 const values={...data};
 if(action==='checklist') ['Agreed alteration finished','Garment fit and movement','Seams and finishing'].forEach((key,i)=>values['check'+i]=data.results[key]);
 for(const [name,value] of Object.entries(values)){
  if(value===undefined||value===null||typeof value==='object')continue;
  const input=document.createElement('input');input.name=name;
  if(typeof value==='boolean'){input.type='checkbox';input.checked=value;}else{input.type='hidden';input.value=String(value);}
  form.append(input);
 }
 const error=document.createElement('p');error.setAttribute('role','alert');form.append(error);
 document.querySelector('#fit-body').append(form);
 form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 const result=error.textContent||null;form.remove();return result;
},{action,data});
async function open(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await expect(page.getByRole('button',{name:'Customer fitting',exact:true})).toBeVisible();return errors;}
async function request(page){await page.getByRole('button',{name:'Design studio',exact:true}).click();await page.locator('#request-fitting').click();await page.getByRole('button',{name:'Save demo request',exact:false}).click();await page.getByRole('button',{name:'Schedule a fitting for this request',exact:true}).click();return page.evaluate(()=>JSON.parse(localStorage.getItem('cnd-requests'))[0].id);}
async function staff(page){await page.locator('#fit-mode').selectOption('staff');}
async function customer(page){await page.locator('#fit-mode').selectOption('customer');}
async function orders(page){await page.getByRole('tab',{name:'Orders and fit checks',exact:true}).click();}
async function quote(page){await page.locator('nav').getByRole('button',{name:'Service quotes',exact:true}).click();await page.locator('#quote-tailor').fill('Alex Rivera');await page.locator('#quote-approved').check();await page.getByRole('button',{name:'Confirm approved quote',exact:true}).click();await page.getByRole('button',{name:'Customer fitting',exact:true}).click();}
async function proposal(page){await staff(page);await orders(page);await page.locator('#fit-proposal-request').selectOption({index:1});await page.locator('#fit-proposal-quote').selectOption({index:1});await page.locator('#fit-proposal-form input[name=accepted]').check();await page.getByRole('button',{name:'Save studio proposal',exact:true}).click();}
async function agree(page){await customer(page);await page.locator('[data-fit-form=agree] input').check();await page.getByRole('button',{name:'Agree and create alteration order',exact:true}).click();return (await saved(page)).orders[0].id;}
async function order(page){await request(page);await quote(page);await proposal(page);return agree(page);}
async function checks(page,value='Passed',note='Staff-only: inspect private pinning note'){const d=page.locator('details').filter({has:page.locator('[data-fit-form=checklist]')});await d.locator('summary').click();const form=page.locator('[data-fit-form=checklist]');for(const s of await form.locator('select').all())await s.selectOption(value);await form.locator('textarea').fill(note);await form.getByRole('button',{name:'Save checklist and staff notes',exact:true}).click();}
async function status(page,value){const form=page.locator('[data-fit-form=status]');await form.locator('select').selectOption(value);await form.getByRole('button',{name:'Save work status',exact:true}).click();}
async function measurements(page,permission='no',job){await page.getByRole('tab',{name:'Measurements',exact:true}).click();await page.locator('#fit-measure-job').selectOption(job||{index:1});await page.locator('#fit-m-waist').fill('29');await page.locator('#fit-m-hips').fill('39');if(!await page.locator('#fit-measured-by').inputValue())await page.locator('#fit-measured-by').fill('Alex Rivera');await expect(page.locator('[name=permission]:checked')).toHaveCount(0);await page.locator(`[name=permission][value=${permission}]`).check();await page.getByRole('button',{name:'Save measurements and permission',exact:true}).click();await expect(page.locator('#fit-message')).toContainText('Measurements saved');}

test('application sections and illustrated measurement guide remain available',async({page})=>{
 const net=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5173/'))net.push(r.url());});const errors=await open(page);
 for(const name of ['Services','Design studio','My requests','My wardrobe','Service quotes','Customer fitting']){await page.getByRole('button',{name,exact:name!=='My requests'}).first().click();}
 await page.getByRole('tab',{name:'Measurements',exact:true}).click();await page.locator('#fit-guide summary').click();await expect(page.locator('#fit-guide svg')).toHaveCount(6);
 for(const svg of await page.locator('#fit-guide svg').all())await expect(svg).toHaveAttribute('aria-label',/.+/);
 await page.getByRole('button',{name:'Jamie’s profile',exact:false}).click();await page.locator('#customer-phone').fill('555-0123');await page.getByRole('button',{name:'Save sample profile',exact:true}).click();expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('cnd-profile')))).phone).toBe('555-0123');
 expect(net).toEqual([]);expect(errors).toEqual([]);
});

test('booking, rescheduling and cancellation preserve orders and enforce all-customer conflicts',async({page})=>{
 const errors=await open(page);const id=await order(page);await page.getByRole('tab',{name:'Appointments',exact:true}).click();
 await page.locator('#fit-type').selectOption('adjustment');await page.locator('#fit-job').selectOption('order:'+id);await page.locator('#fit-origin').selectOption('Bought from another brand');await page.locator('#fit-description').fill('Terracotta skirt — loosen waist');await page.getByRole('button',{name:'Book sample appointment',exact:true}).click();
 let s=await saved(page);expect(s.appointments).toHaveLength(1);const first=s.appointments[0];
 await page.getByRole('button',{name:'Reschedule',exact:true}).click();await page.locator('#fit-time').selectOption({index:1});await page.getByRole('button',{name:'Save rescheduled appointment',exact:true}).click();s=await saved(page);expect(s.appointments).toHaveLength(1);expect(s.appointments[0].start).not.toBe(first.start);
 const a=s.appointments[0];await staff(page);await page.locator('#fit-customer-select').selectOption('customer-riley');
 const date=await page.evaluate(start=>{const d=new Date(start);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},a.start);
 const time=await page.evaluate(start=>new Date(start).toTimeString().slice(0,5),a.start);
 await page.locator('#fit-date').selectOption(date);await expect(page.locator(`#fit-time option[value="${time}"]`)).toHaveCount(0);
 const err=await call(page,'appointment',{type:'initial',jobId:'',date,time,tailor:a.tailor,description:'Another customer'});expect(err).toMatch(/available/);expect((await saved(page)).appointments).toHaveLength(1);
 await customer(page);await page.getByRole('button',{name:'Cancel appointment only',exact:true}).click();s=await saved(page);expect(s.appointments[0].status).toBe('canceled');expect(s.orders[0].status).toBe('on going');expect(s.orders[0].canceled).toBe(false);
 expect(errors).toEqual([]);
});

test('measurement conversion, explicit permission, per-job deletion and refresh',async({page})=>{
 const errors=await open(page);const requestId=await request(page);
 await page.getByRole('tab',{name:'Measurements',exact:true}).click();await page.locator('#fit-measure-job').selectOption('request:'+requestId);await page.locator('#fit-m-waist').fill('29');await page.locator('#fit-m-hips').fill('39');
 await page.locator('#fit-unit').selectOption('cm');await expect(page.locator('#fit-m-waist')).toHaveValue('73.66');await expect(page.locator('#fit-m-hips')).toHaveValue('99.06');await page.locator('#fit-unit').selectOption('in');await expect(page.locator('#fit-m-waist')).toHaveValue('29');
 expect(await call(page,'measurements',{jobId:'request:'+requestId,garment:'skirt',date:'2026-01-01',by:'Jamie',source:'home',valuesCm:{waist:73.66,hips:99.06}})).toMatch(/choose/);expect((await saved(page)).measurements).toHaveLength(0);
 await page.locator('[name=permission][value=no]').check();await page.getByRole('button',{name:'Save measurements and permission',exact:true}).click();expect((await saved(page)).measurements[0].permission).toBe('no');
 await quote(page);await proposal(page);const id=await agree(page);expect((await saved(page)).measurements[0].jobId).toBe('order:'+id);
 // A distinct active job must retain its own measurements when the first job is canceled.
 const second=await request(page);await measurements(page,'no','request:'+second);
 await orders(page);await staff(page);await page.locator('summary').filter({hasText:'Sample staff · checks and order progress'}).click();await page.getByRole('button',{name:'Cancel order separately…',exact:true}).click();await page.getByRole('button',{name:'Yes, cancel this order',exact:true}).click();
 let s=await saved(page);expect(s.orders[0].canceled).toBe(true);expect(s.orders[0].status).not.toBe('complete');expect(s.measurements).toHaveLength(1);expect(s.measurements[0].jobId).toBe('request:'+second);
 const contacts=await page.evaluate(()=>JSON.parse(localStorage.getItem('cnd-profile')));expect(contacts.name).toBe('Jamie Lee');expect(contacts.email).toBe('jamie@example.com');expect(contacts.waist).toBeUndefined();
 await page.reload();s=await saved(page);expect(s.measurements).toHaveLength(1);expect(JSON.stringify(s.orders[0])).not.toContain('valuesCm');expect(errors).toEqual([]);
});

test('full fit problem lifecycle enforces saved completion and separate pickup',async({page})=>{
 const errors=await open(page);const id=await order(page);await measurements(page,'no','order:'+id);await orders(page);await staff(page);
 expect(await call(page,'status',{id,status:'complete'})).toMatch(/Pass every required fit check/);expect((await saved(page)).orders[0].status).toBe('on going');
 expect(await call(page,'pickup',{id,date:'2026-01-01'})).toMatch(/completed order/);
 await checks(page);await page.locator('summary').filter({hasText:'Sample staff · checks and order progress'}).click();await status(page,'ready for check up');await expect(page.getByRole('heading',{name:'Sample email preview — not sent'})).toBeVisible();
 await customer(page);await expect(page.locator('#fit-body')).not.toContainText('Staff-only: inspect private pinning note');await page.locator('[data-fit-form=approve] input').check();await page.getByRole('button',{name:'Record my fit approval',exact:true}).click();expect((await saved(page)).orders[0].fitApproval).not.toBeNull();
 await page.getByText('Report a fit problem',{exact:true}).click();await page.locator('[data-fit-form=problem] textarea').fill('Waist is too tight when sitting');await page.getByRole('button',{name:'Report fit problem',exact:true}).click();let s=await saved(page);expect(s.orders[0].status).toBe('on going');expect(s.orders[0].fitApproval).toBeNull();
 await staff(page);expect(await call(page,'status',{id,status:'complete'})).toMatch(/Resolve every open fit problem/);
 const f=page.locator('[data-fit-form=resolve]');await f.locator('textarea').fill('Released waist seam and arranged follow-up fitting');await f.getByRole('button').click();s=await saved(page);expect(s.orders[0].problems[0].state).toBe('resolved');expect(s.orders[0].fitApproval).toBeNull();
 expect(await call(page,'status',{id,status:'complete'})).toMatch(/Pass every required fit check/);
 await checks(page);await page.locator('summary').filter({hasText:'Sample staff · checks and order progress'}).click();await status(page,'ready for check up');
 expect(await call(page,'status',{id,status:'complete'})).toMatch(/customer to approve/);
 await customer(page);await page.locator('[data-fit-form=approve] input').check();await page.getByRole('button',{name:'Record my fit approval',exact:true}).click();await staff(page);
 await page.locator('summary').filter({hasText:'Sample staff · checks and order progress'}).click();await status(page,'complete');s=await saved(page);expect(s.orders[0].status).toBe('complete');expect(s.orders[0].pickup.status).toBe('Awaiting pickup');expect(s.measurements).toHaveLength(0);
 await page.getByRole('button',{name:'Record picked up',exact:true}).click();expect((await saved(page)).orders[0].pickup.status).toBe('Picked up');expect((await saved(page)).orders[0].pickup.date).toBeTruthy();
 await page.getByRole('button',{name:/^My requests/}).click();await expect(page.locator('#requests-list')).toContainText('complete');await expect(page.locator('#requests-list')).toContainText('Picked up');await expect(page.locator('#requests-list')).toContainText('$60.00');
 await page.reload();expect((await saved(page)).measurements).toHaveLength(0);expect((await saved(page)).orders[0].pickup.status).toBe('Picked up');expect(errors).toEqual([]);
});

test('future-storage consent survives job closure and staff must record permission too',async({page})=>{
 await open(page);const id=await order(page);await staff(page);await measurements(page,'yes','order:'+id);let s=await saved(page);expect(s.measurements[0].source).toBe('staff');expect(s.measurements[0].checked).toBe(false);
 await orders(page);expect(await call(page,'checklist',{id,results:{'Agreed alteration finished':'Passed','Garment fit and movement':'Passed','Seams and finishing':'Passed'},followUp:'Passed in studio'})).toBeNull();expect(await call(page,'status',{id,status:'ready for check up'})).toBeNull();
 await customer(page);expect(await call(page,'approve',{id,approved:true})).toBeNull();await staff(page);expect(await call(page,'status',{id,status:'complete'})).toBeNull();s=await saved(page);expect(s.measurements).toHaveLength(1);expect(s.measurements[0].permission).toBe('yes');
 await page.reload();expect((await saved(page)).measurements).toHaveLength(1);
 const next=await request(page);await measurements(page,'no','request:'+next);s=await saved(page);expect(s.measurements).toHaveLength(1);expect(s.measurements[0].jobId).toBe('request:'+next);expect(s.measurements[0].permission).toBe('no');
});

test('customer ownership, final check eligibility, quotes and question separation',async({page})=>{
 const errors=await open(page);const id=await order(page);
 await staff(page);await page.locator('#fit-customer-select').selectOption('customer-riley');
 expect(await call(page,'appointment',{type:'final',jobId:'order:'+id,description:'Unrelated order',date:'2030-01-01',time:'10:00',tailor:'Alex Rivera'})).toMatch(/belonging/);
 expect(await call(page,'status',{id,status:'complete'})).toMatch(/belonging/);
 await customer(page);await page.getByRole('tab',{name:'Appointments',exact:true}).click();await page.locator('#fit-type').selectOption('final');await expect(page.locator('#fit-job option[value="order:'+id+'"]')).toHaveCount(0);
 await orders(page);await page.locator('#fit-question-link').selectOption('order:'+id);await page.locator('#fit-question-text').fill('What should I bring to pickup?');await page.getByRole('button',{name:'Save question',exact:true}).click();let s=await saved(page);expect(s.questions).toHaveLength(1);expect(s.orders[0].problems).toHaveLength(0);
 await staff(page);const f=page.locator('[data-fit-form=reply]');await f.locator('textarea').fill('Bring your demo order reference.');await f.locator('input').fill('Review at pickup');await f.getByRole('button').click();await customer(page);await expect(page.locator('#fit-body')).toContainText('Bring your demo order reference.');
 expect(await call(page,'status',{id,status:'complete'})).toMatch(/sample staff/);
 await staff(page);expect(await call(page,'status',{id,status:'ready for check up'})).toBeNull();await customer(page);await page.getByRole('button',{name:'Book final fit check for this order',exact:true}).click();await expect(page.locator('#fit-job')).toHaveValue('order:'+id);await expect(page.locator('#fit-type')).toHaveValue('final');
 await page.locator('#fit-description').fill('Final skirt fit check');await page.getByRole('button',{name:'Book sample appointment',exact:true}).click();s=await saved(page);expect(s.appointments[0].type).toBe('final');expect(s.orders).toHaveLength(1);expect(errors).toEqual([]);
});

test('phone layout and keyboard tabs remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.getByRole('button',{name:'Customer fitting',exact:true}).click();
 for(const tab of ['Appointments','Measurements','Orders and fit checks']){await page.getByRole('tab',{name:tab,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.getByRole('tab',{name:'Appointments',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Measurements',exact:true})).toBeFocused();await expect(page.getByRole('tab',{name:'Measurements',exact:true})).toHaveAttribute('aria-selected','true');
 await page.screenshot({path:'test-results/customer-fitting-phone.png',fullPage:true});
});

test('legacy ownership is preserved for staff and hidden from the sample customer',async({page})=>{
 await page.goto(url);await page.evaluate(()=>localStorage.setItem('cnd-requests',JSON.stringify([{id:'foreign-request',customer:{name:'Taylor Private',email:'other@example.com'},createdAt:new Date().toISOString(),change:'Private garment repair',notes:'Do not show to Jamie',status:'Demo request'}])));await page.reload();
 await page.getByRole('button',{name:/^My requests/}).click();await expect(page.locator('#requests-list')).not.toContainText('Do not show to Jamie');await expect(page.locator('#request-count')).toHaveText('0');
 await page.getByRole('button',{name:'Customer fitting',exact:true}).click();await staff(page);await page.locator('#fit-customer-select').selectOption('legacy:other@example.com');await orders(page);await expect(page.locator('#fit-proposal-request option[value="foreign-request"]')).toHaveCount(1);
 await customer(page);await expect(page.locator('#fit-body')).not.toContainText('Taylor Private');
});

test('question escalation is explicit and blocks completion as a fit problem',async({page})=>{
 await open(page);const id=await order(page);await page.locator('#fit-question-link').selectOption('order:'+id);await page.locator('#fit-question-text').fill('The hem pulls when I walk. Can you check it?');await page.getByRole('button',{name:'Save question',exact:true}).click();expect((await saved(page)).orders[0].problems).toHaveLength(0);
 await staff(page);await page.getByRole('button',{name:'Record this question as a fit problem',exact:true}).click();let s=await saved(page);expect(s.orders[0].problems).toHaveLength(1);expect(s.orders[0].status).toBe('on going');expect(s.orders[0].fitApproval).toBeNull();expect(s.questions[0].problemId).toBe(s.orders[0].problems[0].id);expect(await call(page,'status',{id,status:'complete'})).toMatch(/Resolve every open fit problem/);
});

test('appointment alone and unapproved or changed quotes cannot create orders',async({page})=>{
 await open(page);const rid=await request(page);await page.locator('#fit-description').fill('Initial skirt consultation');await page.getByRole('button',{name:'Book sample appointment',exact:true}).click();expect((await saved(page)).orders).toHaveLength(0);
 await staff(page);expect(await call(page,'proposal',{requestId:rid,quoteId:'missing',garment:'Skirt',changes:'Shorten hem',accepted:true})).toMatch(/Confirm a quote/);
 await quote(page);await proposal(page);const p=(await saved(page)).proposals[0];await page.locator('nav').getByRole('button',{name:'Service quotes',exact:true}).click();await page.getByRole('button',{name:'Open quote',exact:true}).click();await page.locator('#quote-price').fill('70');await page.getByRole('button',{name:'Save draft quote',exact:true}).click();
 await page.getByRole('button',{name:'Customer fitting',exact:true}).click();await customer(page);expect(await call(page,'agree',{id:p.id,agreed:true})).toMatch(/changed or removed/);expect((await saved(page)).orders).toHaveLength(0);
});


test('unavailable storage reports an error without breaking the existing site',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('storage blocked');};});
  const errors=await open(page);
  await page.getByRole('button',{name:'Services',exact:true}).click();
  await expect(page.locator('.service-card')).toHaveCount(48);
  await page.getByRole('button',{name:'Customer fitting',exact:true}).click();
  await expect(page.locator('#fit-error')).toContainText('Browser storage is unavailable or full');
  await page.getByRole('button',{name:'Service quotes',exact:true}).click();
  await expect(page.locator('#result-cost')).toHaveText('$40.00');
  expect(errors).toEqual([]);
});
