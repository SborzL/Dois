let currentUser = null;
let coupleId = null;
let partnerUser = null;
let activeListId = null;
let allItems = [];

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;

  // Busca parceiro(a)
  const { data: members } = await supabaseClient.from('couple_members').select('user_id').eq('couple_id', coupleId);
  if (members) {
    const partner = members.find(x => x.user_id !== currentUser.id);
    if (partner) {
      const { data: prof } = await supabaseClient.from('profiles').select('name').eq('id', partner.user_id).maybeSingle();
      partnerUser = { id: partner.user_id, name: prof?.name?.split(' ')[0] || 'Parceiro(a)' };
    }
  }

  await loadLists();
  setupListModal();
  setupItemModal();
}

async function loadLists() {
  const { data: lists } = await supabaseClient.from('checklists').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  const wrap = document.getElementById('lists-wrap');
  if (!lists || !lists.length) {
    wrap.innerHTML = `<div class="empty-state"><p class="empty-icon">✅</p><p>Nenhuma lista ainda.</p><p class="empty-hint">Toque em + para criar a primeira!</p></div>`;
    document.getElementById('items-section').style.display = 'none';
    return;
  }
  wrap.innerHTML = lists.map(l => {
    return `<div class="list-card ${l.id===activeListId?'active':''}" data-id="${l.id}">
      <span class="list-title">${esc(l.title)}</span>
      <button class="btn-icon del-list" data-id="${l.id}" aria-label="Remover lista">×</button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.list-card').forEach(c => {
    c.addEventListener('click', e => { if (e.target.classList.contains('del-list')) return; openList(c.dataset.id); });
  });
  wrap.querySelectorAll('.del-list').forEach(b => {
    b.addEventListener('click', () => deleteList(b.dataset.id));
  });
  if (!activeListId || !lists.find(l => l.id === activeListId)) openList(lists[0].id);
}

async function openList(id) {
  activeListId = id;
  document.querySelectorAll('.list-card').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  await loadItems(id);
  document.getElementById('items-section').style.display = 'block';
}

async function loadItems(listId) {
  const { data: items } = await supabaseClient
    .from('checklist_items').select('*, checklist_subitems(*)')
    .eq('checklist_id', listId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  allItems = items || [];
  renderItems(allItems);
}

function renderItems(items) {
  const ul = document.getElementById('items-list');
  if (!items.length) {
    ul.innerHTML = `<div class="empty-state small"><p>Lista vazia. Adicione um item!</p></div>`; return;
  }
  const today = new Date().toISOString().split('T')[0];
  ul.innerHTML = items.map(item => {
    const due = item.due_date;
    let dueBadge = '';
    if (due) {
      if (due < today) dueBadge = `<span class="due-badge overdue">⚠️ ${formatDate(due)}</span>`;
      else if (due === today) dueBadge = `<span class="due-badge today">📅 Hoje</span>`;
      else dueBadge = `<span class="due-badge">${formatDate(due)}</span>`;
    }
    const assignBadge = item.assigned_to
      ? `<span class="assign-badge">${item.assigned_to === currentUser.id ? '🙋 Eu' : `👫 ${partnerUser?.name||'Parceiro(a)'}`}</span>`
      : '';
    const subitems = (item.checklist_subitems || []).sort((a,b) => a.position - b.position);
    const subDone = subitems.filter(s=>s.done).length;
    const subProgress = subitems.length ? `<span class="sub-progress">${subDone}/${subitems.length}</span>` : '';
    const subitmsHtml = subitems.map(s => `
      <li class="subitem ${s.done?'done':''}" data-sub-id="${s.id}">
        <button class="sub-check" data-id="${s.id}" data-done="${s.done}">${s.done?'✅':'○'}</button>
        <span>${esc(s.title)}</span>
        <button class="btn-icon del-sub" data-id="${s.id}">×</button>
      </li>`).join('');
    return `<li class="checklist-item ${item.done?'done':''}" data-id="${item.id}">
      <div class="item-main">
        <button class="check-btn" data-id="${item.id}" data-done="${item.done}">${item.done?'✅':'○'}</button>
        <div class="item-body">
          <span class="item-text">${esc(item.title)}</span>
          <div class="item-badges">${dueBadge}${assignBadge}${subProgress}</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon add-sub-btn" data-id="${item.id}" title="Adicionar subtarefa">＋</button>
          <button class="btn-icon del-item" data-id="${item.id}">×</button>
        </div>
      </div>
      ${subitems.length ? `<ul class="subitems-list">${subitmsHtml}</ul>` : ''}
    </li>`;
  }).join('');

  ul.querySelectorAll('.check-btn').forEach(b => b.addEventListener('click', () => toggleItem(b.dataset.id, b.dataset.done==='true')));
  ul.querySelectorAll('.del-item').forEach(b => b.addEventListener('click', () => deleteItem(b.dataset.id)));
  ul.querySelectorAll('.add-sub-btn').forEach(b => b.addEventListener('click', () => addSubitem(b.dataset.id)));
  ul.querySelectorAll('.sub-check').forEach(b => b.addEventListener('click', () => toggleSubitem(b.dataset.id, b.dataset.done==='true')));
  ul.querySelectorAll('.del-sub').forEach(b => b.addEventListener('click', () => deleteSubitem(b.dataset.id)));
}

function formatDate(iso) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}`;
}

async function toggleItem(id, done) {
  await supabaseClient.from('checklist_items').update({ done: !done }).eq('id', id);
  loadItems(activeListId);
}
async function deleteItem(id) {
  await supabaseClient.from('checklist_items').delete().eq('id', id);
  loadItems(activeListId);
}
async function toggleSubitem(id, done) {
  await supabaseClient.from('checklist_subitems').update({ done: !done }).eq('id', id);
  loadItems(activeListId);
}
async function deleteSubitem(id) {
  await supabaseClient.from('checklist_subitems').delete().eq('id', id);
  loadItems(activeListId);
}
async function addSubitem(itemId) {
  const text = prompt('Nova subtarefa:');
  if (!text?.trim()) return;
  await supabaseClient.from('checklist_subitems').insert({ item_id: itemId, title: text.trim() });
  loadItems(activeListId);
}

async function deleteList(id) {
  if (!confirm('Remover esta lista e todos os itens?')) return;
  await supabaseClient.from('checklist_items').delete().eq('checklist_id', id);
  await supabaseClient.from('checklists').delete().eq('id', id);
  if (activeListId === id) activeListId = null;
  loadLists();
}

function setupListModal() {
  const modal = document.getElementById('list-modal');
  document.getElementById('add-list-btn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('list-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target===modal) modal.classList.remove('open'); });
  document.getElementById('list-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('list-title-input').value.trim();
    if (!title) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    await supabaseClient.from('checklists').insert({ couple_id: coupleId, title });
    btn.disabled = false;
    modal.classList.remove('open');
    document.getElementById('list-form').reset();
    await loadLists();
  });
}

function setupItemModal() {
  const modal = document.getElementById('item-modal');
  const assignSel = document.getElementById('item-assign');

  // Popula o select de responsável
  const myName = currentUser.email.split('@')[0];
  assignSel.innerHTML = `<option value="">Ninguém</option>
    <option value="${currentUser.id}">🙋 Eu (${myName})</option>
    ${partnerUser ? `<option value="${partnerUser.id}">👫 ${partnerUser.name}</option>` : ''}`;

  document.getElementById('add-item-btn').addEventListener('click', () => {
    if (!activeListId) return;
    modal.classList.add('open');
  });
  document.getElementById('item-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target===modal) modal.classList.remove('open'); });
  document.getElementById('item-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('item-title-input').value.trim();
    const due = document.getElementById('item-due-date').value || null;
    const assigned = document.getElementById('item-assign').value || null;
    if (!title || !activeListId) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const pos = allItems.length;
    await supabaseClient.from('checklist_items').insert({ checklist_id: activeListId, title, done: false, due_date: due, assigned_to: assigned, position: pos });
    btn.disabled = false;
    modal.classList.remove('open');
    document.getElementById('item-form').reset();
    loadItems(activeListId);
  });
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

init();
