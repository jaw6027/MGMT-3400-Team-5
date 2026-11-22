import { serviceGroups, services } from './catalog-data.js';

const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function catalogRequestSummary(request) {
  const fields = [
    ['Service',request.serviceName],['Garment',request.garment],['Condition, fabric & previous changes',request.condition],
    ['Your idea',request.notes],['Details to preserve',request.preserve],['Preferred fit & measurements',request.fit],
    ['Inspiration references',request.inspiration],['Budget range',request.budget],['Requested date',request.requestedDate],['Leftover fabric',request.leftovers],
  ];
  return `<div class="summary"><strong>${safe(request.customer.name)}</strong> · ${safe(request.customer.email)}<br>${fields.map(([label,value])=>`<strong>${label}:</strong> ${safe(value || 'Not provided')}`).join('<br>')}<br><br>Garment review required. Feasibility, price, and timing are unconfirmed.<br>Saved in this browser only. Nothing is sent or booked.</div>`;
}

export function initializeCatalog({reviewRequest, getProfile}) {
  document.querySelector('nav').insertAdjacentHTML('afterbegin','<button class="nav-link" data-page="catalog">Services</button>');
  document.querySelector('main').insertAdjacentHTML('afterbegin',`<section id="catalog-page" hidden>
    <div class="catalog-hero"><div><p class="eyebrow">CRAFTNDETAIL SERVICE CATALOG</p><h1>Love the piece.<br><em>Imagine the possibilities.</em></h1><p>A thrift-store find. A well-loved favorite. An idea you can’t stop thinking about. Explore ways to make it yours.</p><button class="primary catalog-start" id="catalog-unsure">Describe my own idea <span aria-hidden="true">↗</span></button></div><aside class="catalog-note"><span class="eyebrow">FROM FOUND TO FAVORITE</span><h2>“I love this piece—<br>here’s what it could become.”</h2><p>Start with the change you have in mind. We’ll help you put the details into words.</p><p class="field-note">Potential services · Every garment needs review before feasibility, price, or timing can be confirmed.</p></aside></div>
    <div class="catalog-controls"><label for="catalog-search">Find a service or an idea</label><input type="search" id="catalog-search" maxlength="120" placeholder="Try denim, pockets, vintage, or a shorter hem…"/><div class="catalog-filters" role="group" aria-label="Filter services by category"><button class="filter-btn selected" data-category="all" aria-pressed="true">All services</button>${serviceGroups.map(g=>`<button class="filter-btn" data-category="${g.id}" aria-pressed="false">${safe(g.name)}</button>`).join('')}</div><div class="catalog-results-bar"><p id="catalog-count" role="status" aria-live="polite"></p><button class="text-button" id="catalog-reset">Clear filters</button></div></div>
    <div id="catalog-results"></div>
    <div class="quick-links"><button class="secondary" data-page="design">See the skirt example →</button><p>Explore a prepared before-and-after concept, or describe a different project from the catalog.</p></div>
  </section>`);
  document.querySelector('#design-page .quick-links').insertAdjacentHTML('beforebegin','<div class="catalog-design-link"><button class="secondary" data-page="catalog">Browse all 48 services →</button></div>');
  document.body.insertAdjacentHTML('beforeend',`<dialog id="catalog-idea-dialog" aria-labelledby="catalog-idea-title"><form id="catalog-idea-form">
    <button class="close" type="button" data-close aria-label="Close service idea">×</button><p class="eyebrow">YOUR NEXT FAVORITE PIECE</p><h2 id="catalog-idea-title">Tell us what you imagine.</h2><p class="muted">Class prototype: use fictional details. Review and save your idea in this browser; nothing is sent to the studio or booked.</p>
    <label for="idea-service">Service to explore</label><select id="idea-service" name="serviceId"><option value="">Not sure yet / my own idea</option>${serviceGroups.map(g=>`<optgroup label="${safe(g.name)}">${services.filter(s=>s.category===g.id).map(s=>`<option value="${s.id}">${safe(s.name)}</option>`).join('')}</optgroup>`).join('')}</select><p class="field-note" id="idea-service-note"></p>
    <label for="idea-garment">Describe your garment or starting material <span>(required)</span></label><input id="idea-garment" name="garment" maxlength="150" required placeholder="An oversized striped shirt from a thrift store"/>
    <label for="idea-notes">What would you like done? <span>(required)</span></label><textarea id="idea-notes" name="notes" maxlength="1500" rows="4" required placeholder="I’d love a tie-front top, keeping the collar and striped pocket…"></textarea>
    <details class="idea-details"><summary>Add garment details, inspiration & preferences</summary>
      <label for="idea-condition">Condition, fabric label & previous alterations</label><textarea id="idea-condition" name="condition" maxlength="700" rows="2" placeholder="Cotton label; small tear near the hem; no known alterations"></textarea>
      <label for="idea-preserve">What should we preserve?</label><input id="idea-preserve" name="preserve" maxlength="400" placeholder="Original buttons, embroidery, pockets, or sentimental details"/>
      <label for="idea-fit">Preferred fit & measurements</label><textarea id="idea-fit" name="fit" maxlength="700" rows="2" placeholder="Relaxed fit; waist-length hem. Include units for any measurements."></textarea>
      <label for="idea-inspiration">Inspiration links or descriptions</label><textarea id="idea-inspiration" name="inspiration" maxlength="1000" rows="2" placeholder="A reference link, photo description, or the details you like"></textarea>
      <div class="form-row"><div><label for="idea-budget">Budget range <span>(optional)</span></label><input id="idea-budget" name="budget" maxlength="100" placeholder="e.g., $40–$70; flexible"/></div><div><label for="idea-date">Requested date <span>(optional)</span></label><input type="date" id="idea-date" name="requestedDate" min="2000-01-01" max="2100-12-31"/></div></div><p class="field-note">Your preferences help start the conversation; they are not a quote or promised completion date.</p>
      <label for="idea-leftovers">Leftover fabric preference</label><select id="idea-leftovers" name="leftovers"><option>Discuss with me</option><option>Return leftover fabric to me</option><option>Explore a matching accessory</option></select>
    </details><p class="field-note" id="idea-profile-note"></p><button class="primary" type="submit">Review my idea <span aria-hidden="true">→</span></button><p class="field-note">Draft fields stay while you browse this page. Review and save to keep a request after reloading.</p>
  </form></dialog>`);

  const search = document.querySelector('#catalog-search');
  const results = document.querySelector('#catalog-results');
  const dialog = document.querySelector('#catalog-idea-dialog');
  const form = document.querySelector('#catalog-idea-form');
  const selection = document.querySelector('#idea-service');
  let category = 'all';

  function render() {
    const query = search.value.trim().toLowerCase();
    const matches = services.filter(s=>(category==='all'||s.category===category) && `${s.name} ${s.need} ${s.options} ${s.review} ${s.categoryName}`.toLowerCase().includes(query));
    document.querySelector('#catalog-count').textContent = `${matches.length} of ${services.length} services${query ? ` matching “${search.value.trim()}”` : ''}`;
    results.innerHTML = matches.length ? serviceGroups.map(g=>{
      const groupMatches = matches.filter(s=>s.category===g.id);
      return groupMatches.length ? `<section class="catalog-group" aria-labelledby="catalog-${g.id}"><div class="catalog-group-heading"><h2 id="catalog-${g.id}">${safe(g.name)}</h2><p>${safe(g.description)}</p></div><div class="catalog-grid">${groupMatches.map(s=>`<article class="panel service-card"><p class="service-need">“${safe(s.need)}”</p><h3>${safe(s.name)}</h3><p>${safe(s.options)}.</p><details><summary>What to consider</summary><p>${safe(s.review)}</p></details><button class="secondary" data-idea="${s.id}" aria-label="Describe my idea: ${safe(s.name)}">Describe my idea <span aria-hidden="true">↗</span></button></article>`).join('')}</div></section>` : '';
    }).join('') : '<div class="empty-state"><h2>Your idea can still start here.</h2><p>No services match these filters. Try fewer words, clear the filters, or describe your own idea.</p><button class="secondary" id="catalog-empty-idea">Describe my own idea</button></div>';
  }
  function refreshServiceNote() {
    const service = services.find(s=>s.id===selection.value);
    document.querySelector('#idea-service-note').textContent = service ? `${service.options}. ${service.review}` : 'You don’t need the tailoring term. Describe the piece and the change you have in mind.';
  }
  function openIdea(id) {
    if (id !== undefined) selection.value = id;
    refreshServiceNote();
    document.querySelector('#idea-profile-note').textContent = `Saved under your sample profile: ${getProfile().name}. You can update contact details from the profile button in the header.`;
    dialog.showModal();
  }
  search.addEventListener('input',render);
  document.querySelector('.catalog-filters').addEventListener('click',event=>{
    const button = event.target.closest('[data-category]'); if (!button) return;
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});render();
  });
  document.querySelector('#catalog-reset').addEventListener('click',()=>{search.value='';document.querySelector('[data-category="all"]').click();search.focus();});
  document.querySelector('#catalog-unsure').addEventListener('click',()=>openIdea(''));
  results.addEventListener('click',event=>{const button=event.target.closest('[data-idea]');if(button)openIdea(button.dataset.idea);if(event.target.closest('#catalog-empty-idea'))openIdea('');});
  selection.addEventListener('change',refreshServiceNote);
  for (const id of ['idea-garment','idea-notes']) document.querySelector(`#${id}`).addEventListener('input',event=>event.target.setCustomValidity(''));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    for (const id of ['idea-garment','idea-notes']) {const field=document.querySelector(`#${id}`);if(!field.value.trim()){field.setCustomValidity('Please describe this in a few words.');field.reportValidity();return;}}
    const fields=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,value.trim()]));
    const service=services.find(s=>s.id===fields.serviceId);
    const request={...fields,id:crypto.randomUUID(),createdAt:new Date().toISOString(),kind:'catalog',serviceName:service?.name||'My own clothing idea',category:service?.category||'custom-idea',customer:{...getProfile()},change:service?.name||'Discuss my clothing idea',status:'Demo — awaiting garment review'};
    dialog.close();
    reviewRequest(request,{edit:()=>openIdea(),saved:()=>form.reset()});
  });
  render();
}
