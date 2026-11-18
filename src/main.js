import './style.css';
import teePhoto from './assets/tee.png';
import trousersPhoto from './assets/trousers.png';
import shirtPhoto from './assets/shirt.png';
import leggingsPhoto from './assets/leggings.png';
import styledOutfitsPhoto from './assets/styled-outfits.png';
import styledSinglesPhoto from './assets/styled-singles.png';
const samplePhotos = {'sample-top':teePhoto,'sample-bottom':trousersPhoto,'sample-work':shirtPhoto,'sample-athletic':leggingsPhoto};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const defaultProfile = {name:'Jamie Lee',email:'jamie@example.com',waist:'29',hips:'39',source:'Customer — unverified'};
let profile = {...defaultProfile, ...read('cnd-profile', {})};
let requests = read('cnd-requests', []);
if (!Array.isArray(requests)) requests = [];
let length = 'short';
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').style.display = 'none', 4000); }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('Browser storage is full or unavailable. Your changes were not saved.'); return false; } }
function page(name) {
  for (const id of ['design','requests','wardrobe']) $(`#${id}-page`).hidden = id !== name;
  $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.page === name));
  if (name === 'requests') renderRequests();
  if (name === 'wardrobe') renderWardrobe();
  window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-page]');
  if (target) page(target.dataset.page);
  if (event.target.closest('[data-close]')) event.target.closest('dialog').close();
});
$('.brand').addEventListener('click', event => { event.preventDefault(); page('design'); });
$$('[data-length]').forEach(button => button.addEventListener('click', () => {
  length = button.dataset.length;
  $$('[data-length]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  $('.after').classList.toggle('original', length === 'original');
  $('#after-label').textContent = length === 'original' ? 'Original length retained' : 'Knee length';
  $('.after img').alt = length === 'original' ? 'AI sample: original midi skirt on a dressmaker mannequin' : 'AI concept: terracotta skirt shortened to knee length on a dressmaker mannequin';
}));
$$('[data-view]').forEach(button => button.addEventListener('click', () => {
  $('#comparison').classList.toggle('single', button.dataset.view === 'after');
  $$('[data-view]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
}));
function openProfile() {
  Object.entries(profile).forEach(([name,value]) => { const input = $(`[name="${name}"]`, $('#profile-form')); if (input) input.value = value; });
  $('#profile-dialog').showModal();
}
$('#open-profile').addEventListener('click',openProfile);
$('#measurements-link').addEventListener('click',openProfile);
$('#profile-form').addEventListener('submit', event => {
  event.preventDefault(); const next = Object.fromEntries(new FormData(event.target));
  if (!next.name.trim()) { $('#customer-name').setCustomValidity('Please enter a sample customer name.'); $('#customer-name').reportValidity(); return; }
  if (!save('cnd-profile', next)) return;
  profile = next; $('#profile-dialog').close(); toast('Sample profile saved in this browser.');
});
$('#customer-name').addEventListener('input', () => $('#customer-name').setCustomValidity(''));
function requestSummary(request) {
  return `<div class="summary"><strong>${escape(request.customer.name)}</strong> · ${escape(request.customer.email)}<br>Terracotta midi skirt · ${escape(request.change)}<br>Waist: ${escape(request.customer.waist || 'Not provided')} in · Hips: ${escape(request.customer.hips || 'Not provided')} in<br>Source: ${escape(request.customer.source)}<br><br>${escape(request.notes || 'No additional notes.')}<br><br>Price & timing: to be confirmed at a fitting.<br>Preview: prepared AI illustration, not a fit guarantee.</div>`;
}
$('#request-fitting').addEventListener('click', () => {
  const request = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), customer:{...profile}, change: length === 'short' ? 'Shorten to knee length' : 'Keep original length; discuss options', notes:$('#notes').value.trim(),status:'Demo — awaiting fitting' };
  $('#request-content').innerHTML = `<p class="eyebrow">LET’S TALK ABOUT YOUR FIT</p><h2>Review your fitting request.</h2><p class="muted">This is a presentation example. Saving it does not contact the studio or book an appointment.</p>${requestSummary(request)}<button class="primary" id="confirm-request">Save demo request <span>↗</span></button>`;
  $('#confirm-request').addEventListener('click', () => {
    const next = [request,...requests]; if (!save('cnd-requests', next)) return; requests = next; updateCount();
    $('#request-content').innerHTML = '<div class="success-mark">✓</div><p class="eyebrow">A POSSIBILITY, SAVED</p><h2>Your idea has a starting point.</h2><p class="muted">Your sample request is saved in this browser. In a future version, the studio would review it and contact you to arrange a fitting. No appointment has been booked.</p><button class="primary" id="see-requests">View my requests <span>→</span></button>';
    $('#see-requests').addEventListener('click', () => { $('#request-dialog').close(); page('requests'); });
  });
  $('#request-dialog').showModal();
});
function updateCount() { $('#request-count').textContent = requests.length; }
function renderRequests() {
  $('#requests-list').innerHTML = requests.length ? requests.map((r,i) => `<article class="panel request-card"><span class="pill">${escape(r.status)}</span><h3>Skirt alteration · ${new Date(r.createdAt).toLocaleDateString()}</h3>${requestSummary(r)}<button class="text-button" data-delete-request="${i}">Remove demo request</button></article>`).join('') : '<div class="empty-state"><h2>Every great fit starts with an idea.</h2><p>Your saved demonstration requests will appear here.</p><button class="secondary" data-page="design">Explore the skirt example →</button></div>';
  $('#clear-requests').hidden = !requests.length;
}
$('#requests-list').addEventListener('click', event => { const button = event.target.closest('[data-delete-request]'); if (!button) return; const next = requests.filter((_,i) => i !== +button.dataset.deleteRequest); if (save('cnd-requests', next)) { requests = next; updateCount(); renderRequests(); } });
$('#clear-requests').addEventListener('click', () => { if (save('cnd-requests', [])) { requests = []; renderRequests(); updateCount(); } });

// Wardrobe data uses IndexedDB so photographs do not fill the small localStorage quota.
const wardrobeHTML = `<section id="wardrobe-page" hidden><div class="intro"><div><p class="eyebrow">YOUR WARDROBE, REIMAGINED</p><h1>My wardrobe</h1><p>Pick your pieces. Put together a look for your day.</p></div><button class="secondary" id="add-garment">+ Add clothing</button></div><p class="upload-note">Drag a clothing photo onto the mannequin, or use “Add to outfit.” Your wardrobe and saved looks stay in this browser.</p><div class="wardrobe-layout"><div><div class="wardrobe-tools" role="group" aria-label="Filter by activity">${['All','Lounge','Athletic','Work','Everyday'].map((s,i) => `<button class="filter-btn ${i===0?'selected':''}" data-filter="${s}" aria-pressed="${i===0}">${s}</button>`).join('')}</div><p class="wardrobe-count" id="wardrobe-count"></p><div class="wardrobe-grid" id="wardrobe-grid"></div><div id="saved-outfits"></div></div><aside class="panel outfit-panel"><p class="eyebrow">THE OUTFIT BOARD</p><h2>Build an outfit</h2><p class="muted">Drop a piece onto the mannequin to try a combination.</p><div class="mannequin-stage" id="outfit-drop-zone" role="region" aria-label="Drop clothing here to build an outfit"><svg viewBox="0 0 250 350" role="img" aria-label="Neutral dressmaker mannequin outfit board"><defs><linearGradient id="cloth"><stop stop-color="#d7c9b3"/><stop offset=".5" stop-color="#f7efdf"/><stop offset="1" stop-color="#d9cbb4"/></linearGradient></defs><ellipse cx="125" cy="332" rx="53" ry="7" fill="#c9b9a0"/><path d="M125 40V327M91 327H159" stroke="#8e7353" stroke-width="5"/><path d="M108 42L108 57Q89 63 76 81L90 147L85 205Q125 225 165 205L160 147L174 81Q161 63 142 57L142 42Z" fill="url(#cloth)" stroke="#b6a28a"/><path d="M125 44V214M90 147Q125 155 160 147" stroke="#b6a28a" fill="none" stroke-dasharray="3 4"/><ellipse cx="125" cy="42" rx="17" ry="5" fill="#a98e6b"/></svg><div id="outfit-layers"></div><div id="styled-look" class="styled-look" hidden><img src="${styledOutfitsPhoto}" alt="Prepared AI styling of the selected sample outfit on a neutral mannequin"/></div><span class="drop-hint" aria-hidden="true">Drop clothing here</span></div><label for="outfit-activity">Plan for</label><select id="outfit-activity"><option>Everyday</option><option>Lounge</option><option>Athletic</option><option>Work</option></select><p id="preview-type" class="field-note" aria-live="polite">Choose a top and bottom for a dressed sample preview.</p><details id="placement-controls"><summary>Adjust photo placement</summary><label for="top-scale">Top size</label><input id="top-scale" type="range" min="60" max="150" value="100"/><label for="top-offset">Top height</label><input id="top-offset" type="range" min="-40" max="40" value="0"/><label for="bottom-scale">Bottom size</label><input id="bottom-scale" type="range" min="60" max="150" value="100"/><label for="bottom-offset">Bottom height</label><input id="bottom-offset" type="range" min="-40" max="40" value="0"/></details><div id="outfit-slots"></div><label for="outfit-name">Outfit name</label><input id="outfit-name" maxlength="80" placeholder="Monday at the studio"/><button class="primary" id="save-outfit">Save outfit <span>+</span></button><button class="text-button" id="clear-outfit">Clear outfit board</button><p class="field-note">Sample combinations use prepared dressed previews. Uploaded clothing uses adjustable photo placement; body fit is not calculated.</p></aside></div></section>`;
$('main').insertAdjacentHTML('beforeend',wardrobeHTML);
$('nav').insertAdjacentHTML('beforeend','<button class="nav-link" data-page="wardrobe">My wardrobe</button>');
document.body.insertAdjacentHTML('beforeend',`<dialog id="garment-dialog"><form id="garment-form"><button type="button" class="close" data-close aria-label="Close clothing form">×</button><p class="eyebrow">BUILD YOUR CLOSET</p><h2>A place for every piece.</h2><p class="muted">Upload one or several clothing photos. Each photo becomes a separate inventory item you can rename.</p><label for="garment-files">Clothing photos</label><input id="garment-files" type="file" accept="image/jpeg,image/png,image/webp" multiple required/><p class="field-note">JPEG, PNG or WebP · Up to 12 photos per upload · 8 MB each. Images are resized for browser storage.</p><label for="garment-name">Item name (one photo) / collection name (multiple)</label><input id="garment-name" maxlength="80" placeholder="Cream work shirt"/><label for="garment-category">Type</label><select id="garment-category"><option value="top">Top</option><option value="bottom">Bottom</option><option value="shoes">Shoes</option></select><label for="garment-activity">Activity</label><select id="garment-activity"><option>Everyday</option><option>Lounge</option><option>Athletic</option><option>Work</option></select><button class="primary" id="upload-submit">Add to my wardrobe <span>+</span></button><p id="upload-error" class="field-note" role="alert"></p></form></dialog>`);
let db, items = [], outfits = [], filter = 'All', slots = {top:null,bottom:null,shoes:null};
let fit = {topScale:100,topY:0,bottomScale:100,bottomY:0};
const databaseReady = new Promise((resolve,reject) => {
  const req = indexedDB.open('craftndetail-wardrobe',1);
  req.onupgradeneeded = () => { req.result.createObjectStore('items',{keyPath:'id'}); req.result.createObjectStore('outfits',{keyPath:'id'}); };
  req.onsuccess = () => { db = req.result; resolve(); }; req.onerror = () => reject(req.error);
});
async function storeRead(store) { await databaseReady; return new Promise((resolve,reject) => { const req = db.transaction(store).objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function writeRecords(store, records, operation = 'put') { await databaseReady; return new Promise((resolve,reject) => { const tx = db.transaction(store,'readwrite'); records.forEach(record => tx.objectStore(store)[operation](record)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
async function initializeWardrobe() {
  try {
    items = await storeRead('items'); outfits = await storeRead('outfits');
    if (!items.length && !read('cnd-wardrobe-seeded',false)) {
      items = [{id:'sample-top',name:'Cream everyday tee',category:'top',activity:'Everyday',image:samplePhotos['sample-top']},{id:'sample-bottom',name:'Terracotta lounge trousers',category:'bottom',activity:'Lounge',image:samplePhotos['sample-bottom']},{id:'sample-work',name:'Studio work shirt',category:'top',activity:'Work',image:samplePhotos['sample-work']},{id:'sample-athletic',name:'Athletic leggings',category:'bottom',activity:'Athletic',image:samplePhotos['sample-athletic']}];
      await writeRecords('items',items); save('cnd-wardrobe-seeded',true);
    }
    // Refresh only built-in sample imagery; keep names, tags, uploads and saved looks.
    const refreshed = items.filter(item => samplePhotos[item.id]).map(item => ({...item,image:samplePhotos[item.id]}));
    if (refreshed.length) {
      await writeRecords('items',refreshed);
      items = items.map(item => refreshed.find(updated => updated.id === item.id) || item);
    }
    items = await Promise.all(items.map(async item => ({...item,displayImage:await trimTransparent(item.image)})));
    renderWardrobe();
  } catch { $('#wardrobe-grid').innerHTML = '<p class="upload-note">Wardrobe storage is unavailable in this browser. Allow site storage and reload to use this section.</p>'; $('#add-garment').disabled = true; }
}
function renderWardrobe() {
  const visible = items.filter(item => filter === 'All' || item.activity === filter);
  $('#wardrobe-count').textContent = `${visible.length} shown · ${items.length} pieces in your wardrobe · AI sample photos included`;
  $('#wardrobe-grid').innerHTML = visible.length ? visible.map(item => `<article class="panel wardrobe-item"><div class="garment-photo" draggable="false" data-drag-item="${escape(item.id)}" aria-label="Drag ${escape(item.name)} onto the mannequin"><img src="${escape(item.image)}" alt="${escape(item.name)}" draggable="false"/><span class="drag-label" aria-hidden="true">⠿ Drag to mannequin</span></div><button class="remove-item" data-remove-item="${escape(item.id)}" aria-label="Remove ${escape(item.name)}">×</button><h3>${escape(item.name)}</h3><p>${escape(item.activity)} · ${escape(item.category)}</p><button class="secondary" data-wear="${escape(item.id)}">${slots[item.category]===item.id?'✓ On outfit board':'Add to outfit'}</button><button class="text-button" data-edit="${escape(item.id)}">Edit details</button></article>`).join('') : '<div class="empty-state"><h3>Room for something you love.</h3><p>Add a clothing photo or choose another activity.</p></div>';
  renderOutfit();
  $('#saved-outfits').innerHTML = `<h2>Saved outfits</h2>${outfits.length ? outfits.map(o => `<article class="panel outfit-card"><h3>${escape(o.name)}</h3><p>${escape(o.activity)} · ${Object.values(o.slots).filter(Boolean).length} pieces</p><button class="secondary" data-load-outfit="${escape(o.id)}">Open outfit</button> <button class="text-button" data-remove-outfit="${escape(o.id)}">Remove</button></article>`).join('') : '<p class="upload-note">Your saved outfits will appear here.</p>'}`;
}
function renderOutfit() {
  const row = slots.top === 'sample-top' ? 0 : slots.top === 'sample-work' ? 1 : -1;
  const col = slots.bottom === 'sample-bottom' ? 0 : slots.bottom === 'sample-athletic' ? 1 : -1;
  const pair = row >= 0 && col >= 0 && !slots.shoes;
  const singleKey = !slots.bottom && row >= 0 ? slots.top : !slots.top && col >= 0 ? slots.bottom : null;
  const single = !slots.shoes && singleKey ? {'sample-top':[0,0],'sample-work':[0,1],'sample-bottom':[1,0],'sample-athletic':[1,1]}[singleKey] : null;
  const styled = pair || Boolean(single);
  $('#styled-look').hidden = !styled;
  $('#outfit-drop-zone').classList.toggle('has-styled',styled);
  $('#outfit-drop-zone').classList.toggle('wearing-top',Boolean(slots.top));
  $('#outfit-drop-zone').classList.toggle('wearing-bottom',Boolean(slots.bottom));
  $('#placement-controls').hidden = styled;
  $('#preview-type').textContent = styled ? 'Prepared dressed preview · AI styling illustration, not a fit guarantee.' : 'Photo placement · choose a sample top and bottom for a dressed preview. Adjust uploaded photos below.';
  if (styled) { const image = $('#styled-look img'); const sheet = pair ? styledOutfitsPhoto : styledSinglesPhoto; if (image.getAttribute('src') !== sheet) image.src = sheet; image.style.left = `${-(pair?col:single[1])*100}%`; image.style.top = `${-(pair?row:single[0])*100}%`; }
  $('#outfit-drop-zone').style.setProperty('--top-scale',fit.topScale/100);
  $('#outfit-drop-zone').style.setProperty('--top-offset',`${fit.topY}px`);
  $('#outfit-drop-zone').style.setProperty('--bottom-scale',fit.bottomScale/100);
  $('#outfit-drop-zone').style.setProperty('--bottom-offset',`${fit.bottomY}px`);
  for (const [id,key] of [['top-scale','topScale'],['top-offset','topY'],['bottom-scale','bottomScale'],['bottom-offset','bottomY']]) $(`#${id}`).value = fit[key];

  $('#outfit-layers').innerHTML = Object.entries(slots).map(([category,id]) => { const item = items.find(i => i.id===id); return item ? `<img class="outfit-piece ${category}" src="${escape(item.displayImage || item.image)}" alt="${escape(item.name)} on mannequin board"/>` : ''; }).join('');
  $('#outfit-slots').innerHTML = Object.entries(slots).map(([category,id]) => `<div class="slot-row"><span>${category[0].toUpperCase()+category.slice(1)}: ${escape(items.find(i => i.id===id)?.name || 'Choose a piece')}</span>${id?`<button data-clear-slot="${category}" aria-label="Remove ${category} from outfit">×</button>`:''}</div>`).join('');
}
$$('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; $$('[data-filter]').forEach(b => { b.classList.toggle('selected',b===button); b.setAttribute('aria-pressed',String(b===button)); }); renderWardrobe(); }));
$('#add-garment').addEventListener('click', () => { $('#garment-form').reset(); $('#upload-error').textContent = ''; $('#garment-dialog').showModal(); });
async function resizePhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8*1024*1024) throw new Error('Choose JPEG, PNG or WebP photos under 8 MB each.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
  return canvas.toDataURL('image/webp',.8);
}
$('#garment-form').addEventListener('submit', async event => {
  event.preventDefault(); const files = [...$('#garment-files').files]; const button = $('#upload-submit');
  if (!files.length || files.length > 12) { $('#upload-error').textContent = 'Choose between 1 and 12 photos.'; return; }
  button.disabled = true; $('#upload-error').textContent = '';
  try {
    const records = [];
    for (const [index,file] of files.entries()) records.push({id:crypto.randomUUID(),name:($('#garment-name').value.trim() || file.name.replace(/\.[^.]+$/,'')) + (files.length>1?` ${index+1}`:''),category:$('#garment-category').value,activity:$('#garment-activity').value,image:await resizePhoto(file)});
    await writeRecords('items',records); for (const record of records) record.displayImage = await trimTransparent(record.image); items.push(...records); renderWardrobe(); $('#garment-dialog').close(); toast(`${records.length} clothing ${records.length===1?'item':'items'} added.`);
  } catch(error) { $('#upload-error').textContent = error.message || 'Photos could not be saved. Try smaller files or allow browser storage.'; }
  finally { button.disabled = false; }
});
$('#wardrobe-grid').addEventListener('click', async event => {
  const wear = event.target.closest('[data-wear]'), remove = event.target.closest('[data-remove-item]'), edit = event.target.closest('[data-edit]');
  if (wear) wearItem(wear.dataset.wear);
  if (remove) { try { const id = remove.dataset.removeItem; await writeRecords('items',[id],'delete'); items = items.filter(i => i.id!==id); Object.keys(slots).forEach(key => { if (slots[key]===id) slots[key]=null; }); renderWardrobe(); } catch { toast('Could not remove this item.'); } }
  if (edit) openEdit(items.find(i => i.id === edit.dataset.edit));
});
function openEdit(item) {
  let dialog = $('#edit-dialog');
  if (!dialog) { document.body.insertAdjacentHTML('beforeend','<dialog id="edit-dialog"></dialog>'); dialog = $('#edit-dialog'); }
  dialog.innerHTML = `<form id="edit-form"><button type="button" class="close" data-close aria-label="Close edit item">×</button><h2>Edit clothing details</h2><label for="edit-name">Item name</label><input id="edit-name" required maxlength="80" value="${escape(item.name)}"/><label for="edit-category">Type</label><select id="edit-category">${['top','bottom','shoes'].map(c=>`<option ${c===item.category?'selected':''}>${c}</option>`).join('')}</select><label for="edit-activity">Activity</label><select id="edit-activity">${['Everyday','Lounge','Athletic','Work'].map(c=>`<option ${c===item.activity?'selected':''}>${c}</option>`).join('')}</select><button class="primary">Save item</button></form>`;
  $('#edit-form').addEventListener('submit', async event => { event.preventDefault(); if (!$('#edit-name').value.trim()) return; const updated = {...item,name:$('#edit-name').value.trim(),category:$('#edit-category').value,activity:$('#edit-activity').value}; try { await writeRecords('items',[updated]); items = items.map(i=>i.id===item.id?updated:i); if(updated.category!==item.category && slots[item.category]===item.id) slots[item.category]=null; renderWardrobe(); dialog.close(); } catch { toast('Could not save this item.'); } });
  dialog.showModal();
}
$('#outfit-slots').addEventListener('click', event => { const button = event.target.closest('[data-clear-slot]'); if (button) { slots[button.dataset.clearSlot]=null; renderWardrobe(); } });
$('#save-outfit').addEventListener('click', async () => {
  if (!Object.values(slots).some(Boolean)) { toast('Add at least one clothing item to your outfit.'); return; }
  const outfit = {id:crypto.randomUUID(),name:$('#outfit-name').value.trim()||'My everyday look',activity:$('#outfit-activity').value,slots:{...slots},fit:{...fit}};
  try { await writeRecords('outfits',[outfit]); outfits.push(outfit); renderWardrobe(); toast('Outfit saved in this browser.'); } catch { toast('Could not save your outfit.'); }
});
$('#saved-outfits').addEventListener('click', async event => {
  const load = event.target.closest('[data-load-outfit]'), remove = event.target.closest('[data-remove-outfit]');
  if (load) { const outfit = outfits.find(o=>o.id===load.dataset.loadOutfit); slots = Object.fromEntries(Object.entries(outfit.slots).map(([key,id])=>[key,items.some(i=>i.id===id)?id:null])); fit = {topScale:100,topY:0,bottomScale:100,bottomY:0,...outfit.fit}; $('#outfit-name').value=outfit.name; $('#outfit-activity').value=outfit.activity; renderWardrobe(); toast('Saved outfit opened. Removed clothing is left out.'); }
  if (remove) { try { await writeRecords('outfits',[remove.dataset.removeOutfit],'delete'); outfits=outfits.filter(o=>o.id!==remove.dataset.removeOutfit); renderWardrobe(); } catch { toast('Could not remove outfit.'); } }
});
function wearItem(id) {
  const item = items.find(piece => piece.id === id);
  if (!item) return false;
  slots[item.category] = item.id;
  renderWardrobe();
  toast(`${item.name} added to your outfit.`);
  return true;
}
// Pointer capture handles mouse, pen and touch without native HTML drag behavior.
const dropZone = $('#outfit-drop-zone');
let pointerDrag = null;
let dragFrame = 0;
function endDrag() {
  if (pointerDrag?.source.hasPointerCapture?.(pointerDrag.pointerId)) pointerDrag.source.releasePointerCapture(pointerDrag.pointerId);
  pointerDrag?.ghost?.remove();
  pointerDrag?.dock?.remove();
  pointerDrag?.source.classList.remove('dragging');
  pointerDrag = null;
  cancelAnimationFrame(dragFrame);
  document.body.classList.remove('dragging-outfit');
  dropZone.classList.remove('drag-ready','drag-over');
}
function overDropTarget(x,y) {
  const target = document.elementFromPoint(x,y);
  return Boolean(target?.closest('#outfit-drop-zone, .floating-drop-zone'));
}
function moveGhost(x,y) {
  if (!pointerDrag?.ghost) return;
  pointerDrag.ghost.style.left = `${x+15}px`;
  pointerDrag.ghost.style.top = `${y-35}px`;
  const over = overDropTarget(x,y);
  dropZone.classList.toggle('drag-over',over);
  pointerDrag.dock?.classList.toggle('drag-over',over);
}
function autoScrollDrag() {
  if (!pointerDrag?.active) return;
  const y = pointerDrag.y;
  if (!pointerDrag.dock) {
    const speed = y < 65 ? -12 : y > innerHeight-65 ? 12 : 0;
    if (speed) window.scrollBy(0,speed);
  }
  moveGhost(pointerDrag.x,y);
  dragFrame = requestAnimationFrame(autoScrollDrag);
}
$('#wardrobe-grid').addEventListener('dragstart',event => event.preventDefault());
$('#wardrobe-grid').addEventListener('pointerdown',event => {
  const source = event.target.closest('[data-drag-item]');
  if (!source || !event.isPrimary || event.button !== 0) return;
  endDrag();
  pointerDrag = {source,pointerId:event.pointerId,id:source.dataset.dragItem,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false};
  source.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event => {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  pointerDrag.x = event.clientX; pointerDrag.y = event.clientY;
  if (!pointerDrag.active && Math.hypot(event.clientX-pointerDrag.startX,event.clientY-pointerDrag.startY) < 6) return;
  event.preventDefault();
  if (!pointerDrag.active) {
    pointerDrag.active = true;
    pointerDrag.source.classList.add('dragging');
    document.body.classList.add('dragging-outfit');
    dropZone.classList.add('drag-ready');
    const ghost = document.createElement('div'); ghost.className = 'garment-drag-ghost';
    ghost.append(pointerDrag.source.querySelector('img').cloneNode());
    document.body.append(ghost); pointerDrag.ghost = ghost;
    const rect = dropZone.getBoundingClientRect();
    if (innerWidth <= 760 || rect.bottom < 0 || rect.top > innerHeight-80) {
      const dock = document.createElement('div'); dock.className = 'floating-drop-zone';
      dock.setAttribute('role','region'); dock.setAttribute('aria-label','Drop clothing here');
      const current = $('#styled-look').hidden ? dropZone.querySelector('svg').cloneNode(true) : $('#styled-look').cloneNode(true);
      dock.append(current);
      dock.insertAdjacentHTML('beforeend','<strong>Drop here to dress</strong>');
      document.body.append(dock); pointerDrag.dock = dock;
    }
    dragFrame = requestAnimationFrame(autoScrollDrag);
  }
  moveGhost(event.clientX,event.clientY);
},{passive:false});
document.addEventListener('pointerup',event => {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const id = pointerDrag.active && overDropTarget(event.clientX,event.clientY) ? pointerDrag.id : null;
  endDrag();
  if (id) wearItem(id);
});
document.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',event => { if(event.key === 'Escape') endDrag(); });
window.addEventListener('blur',endDrag);
for (const [id,key] of [['top-scale','topScale'],['top-offset','topY'],['bottom-scale','bottomScale'],['bottom-offset','bottomY']]) {
  $(`#${id}`).addEventListener('input',event => { fit[key] = Number(event.target.value); renderOutfit(); });
}
// Crop only transparent margins, keeping opaque uploaded backgrounds intact.
const trimmedImages = new Map();
function trimTransparent(src) {
  if (trimmedImages.has(src)) return trimmedImages.get(src);
  const result = new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1,700/Math.max(image.naturalWidth,image.naturalHeight));
        canvas.width = Math.max(1,Math.round(image.naturalWidth*ratio)); canvas.height = Math.max(1,Math.round(image.naturalHeight*ratio));
        const context = canvas.getContext('2d'); context.drawImage(image,0,0,canvas.width,canvas.height);
        const pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
        let left=canvas.width,top=canvas.height,right=0,bottom=0;
        for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(pixels[(y*canvas.width+x)*4+3]>80) {left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        if(left>right || top>bottom) {resolve(src);return;}
        const cropped=document.createElement('canvas');cropped.width=right-left+1;cropped.height=bottom-top+1;
        cropped.getContext('2d').drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
        resolve(cropped.toDataURL('image/webp',.9));
      } catch {resolve(src);}
    };
    image.onerror = () => resolve(src); image.src = src;
  });
  trimmedImages.set(src,result); return result;
}
$('#clear-outfit').addEventListener('click', () => {
  slots = {top:null,bottom:null,shoes:null};
  fit = {topScale:100,topY:0,bottomScale:100,bottomY:0};
  renderWardrobe();
  toast('Outfit board cleared. Your saved looks are unchanged.');
});
updateCount(); initializeWardrobe();
