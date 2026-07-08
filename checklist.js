let currentUser = null;
let coupleId = null;
let partnerUser = null;
let activeListId = null;
let activeListTitle = '';
let allItems = [];
let allLists = [];

const LIST_COLORS = ['#2d9e73','#e91e8c','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#0ea5e9','#10b981'];

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;

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

  document.getElementById('back-btn').addEventListener('click', showListsScreen);
  document.getElementById('del-list-btn').addEventListener('click', deleteActiveList);
  document.getElementById('add-item-btn').addEventListener('click', () => document.getElementById('item-modal').classList.add('open'));
}

// ─── TELAS ───────────────────────────────────────────────────────────────────

function showListsScreen() {
  document.getElementById('screen-lists').classList.remove('hidden');
  document.getElementById('screen-detail').classList.add('hidden');
  activeListId = null;
  loadLists();
}

function showDetailScreen(listId, listTitle) {
  activeListId = listId;
  activeListTitle = listTitle;
  document.getElementById('detail-list-title').textContent = listTitle;
  document.getElementById('screen-lists').classList.add('hidden');
  document.getElementById('screen-detail').classList.remove('hidden');
  loadItems(listId);
}

// ─── LISTAS ──────────────────────────────────────────────────────────────────

async function loadLists() {
  const { data: lists } = await supabaseClient
    .from('checklists').select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  allLists = lists || [];

  const { data: allItemsFlat } = await supabaseClient
    .from('checklist_items').select('checklist_id, done')
    .in('checklist_id', allLists.map(l => l.id));

  const countMap = {};
  (allItemsFlat || []).forEach(item => {
    if (!countMap[item.checklist_id]) countMap[item.checklist_id] = { total: 0, done: 0 };
    countMap[item.checklist_id].total++;
    if (item.done) countMap[item.checklist_id].done++;
  });

  renderListsGrid(allLists, countMap);
}

function renderListsGrid(lists, countMap) {
  const grid = document.getElementById('lists-grid');
  if (!lists.length) {
    grid.innerHTML = `<div class="empty-full"><div class="empty-icon">✅</div><p>Nenhuma lista ainda</p><p class="empty-hint">Toque em + para criar a primeira!</p></div>`;
    return;
  }
  grid.innerHTML = lists.map((l, i) => {
    const color = LIST_COLORS[i % LIST_COLORS.length];
    const counts = countMap[l.id] || { total: 0, done: 0 };
    const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
    const emoji = l.emoji || '📋';
    const doneText = counts.total ? `${counts.done}/${counts.total}` : 'Vazia';
    return `<div class="list-card-big" data-id="${l.id}" style="--card-color:${color}">
      <div class="list-card-emoji">${emoji}</div>
      <div class="list-card-name">${esc(l.title)}</div>
      <div class="list-card-count">${doneText}</div>
      <div class="list-mini-bar"><div class="list-mini-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.list-card-big').forEach(card => {
    const list = lists.find(l => l.id === card.dataset.id);
    card.addEventListener('click', () => showDetailScreen(list.id, `${list.emoji ? list.emoji + ' ' : ''}${list.title}`));
  });
}

// ─── ITEMS ───────────────────────────────────────────────────────────────────

async function loadItems(listId) {
  const { data: items } = await supabaseClient
    .from('checklist_items')
    .select('*, checklist_subitems(*)')
    .eq('checklist_id', listId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  allItems = items || [];
  renderItems(allItems);
}

function renderItems(items) {
  const ul = document.getElementById('items-list');
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? (done / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('detail-progress').textContent = total ? `${done} de ${total} feito${done !== 1 ? 's' : ''}` : '';

  if (!items.length) {
    ul.innerHTML = `<li class="empty-items"><p>Nenhum item ainda.<br>Toque em "+ Adicionar item" abaixo.</p></li>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const pending = items.filter(i => !i.done);
  const done_items = items.filter(i => i.done);

  let html = '';
  if (pending.length) html += pending.map(i => itemRow(i, today)).join('');
  if (done_items.length) {
    html += `<li class="done-divider"><span>✓ Concluídos (${done_items.length})</span></li>`;
    html += done_items.map(i => itemRow(i, today)).join('');
  }
  ul.innerHTML = html;

  ul.querySelectorAll('.check-circle').forEach(btn => {
    btn.addEventListener('click', () => toggleItem(btn.dataset.id, btn.dataset.done === 'true'));
  });
  ul.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(btn.dataset.id));
  });
  ul.querySelectorAll('.add-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => addSubitem(btn.dataset.id));
  });
  ul.querySelectorAll('.sub-check').forEach(btn => {
    btn.addEventListener('click', () => toggleSubitem(btn.dataset.id, btn.dataset.done === 'true'));
  });
  ul.querySelectorAll('.del-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSubitem(btn.dataset.id));
  });
}

function itemRow(item, today) {
  const due = item.due_date;
  let dueBadge = '';
  if (due) {
    if (due < today) dueBadge = `<span class="badge badge-overdue">⚠️ ${fmtDate(due)}</span>`;
    else if (due === today) dueBadge = `<span class="badge badge-today">📅 Hoje</span>`;
    else dueBadge = `<span class="badge badge-due">${fmtDate(due)}</span>`;
  }
  const assignBadge = item.assigned_to
    ? `<span class="badge badge-assign">${item.assigned_to === currentUser.id ? '🙋 Eu' : `👫 ${partnerUser?.name || 'Parceiro(a)'}`}</span>`
    : '';
  const subitems = (item.checklist_subitems || []).sort((a, b) => a.position - b.position);
  const subDone = subitems.filter(s => s.done).length;
  const subBadge = subitems.length ? `<span class="badge badge-sub">${subDone}/${subitems.length}</span>` : '';

  const subsHtml = subitems.map(s => `
    <li class="subitem-row ${s.done ? 'done' : ''}">
      <button class="sub-check" data-id="${s.id}" data-done="${s.done}">${s.done ? '✅' : '○'}</button>
      <span>${esc(s.title)}</span>
      <button class="del-sub-btn btn-icon" data-id="${s.id}">×</button>
    </li>`).join('');

  return `<li class="item-row ${item.done ? 'done' : ''}" data-id="${item.id}">
    <button class="check-circle ${item.done ? 'checked' : ''}" data-id="${item.id}" data-done="${item.done}" aria-label="${item.done ? 'Desmarcar' : 'Marcar'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>
    <div class="item-content">
      <span class="item-text">${esc(item.title)}</span>
      ${(dueBadge || assignBadge || subBadge) ? `<div class="badges-row">${dueBadge}${assignBadge}${subBadge}</div>` : ''}
      ${subitems.length ? `<ul class="subitems-list">${subsHtml}</ul>` : ''}
    </div>
    <div class="item-btns">
      <button class="add-sub-btn btn-icon" data-id="${item.id}" title="Subtarefa">＋</button>
      <button class="del-item-btn btn-icon" data-id="${item.id}">×</button>
    </div>
  </li>`;
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-');
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

async function deleteActiveList() {
  if (!activeListId || !confirm('Excluir esta lista e todos os itens?')) return;
  await supabaseClient.from('checklist_items').delete().eq('checklist_id', activeListId);
  await supabaseClient.from('checklists').delete().eq('id', activeListId);
  showListsScreen();
}

// ─── MODAIS ──────────────────────────────────────────────────────────────────

function setupListModal() {
  const modal = document.getElementById('list-modal');
  document.getElementById('add-list-btn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('list-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  document.getElementById('list-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('list-title-input').value.trim();
    const emoji = document.getElementById('list-emoji-input').value.trim() || null;
    if (!title) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    await supabaseClient.from('checklists').insert({ couple_id: coupleId, title, emoji });
    btn.disabled = false;
    modal.classList.remove('open');
    document.getElementById('list-form').reset();
    await loadLists();
  });
}

function setupItemModal() {
  const modal = document.getElementById('item-modal');
  const assignSel = document.getElementById('item-assign');
  const myName = currentUser.email.split('@')[0];
  assignSel.innerHTML = `<option value="">Ninguém</option>
    <option value="${currentUser.id}">🙋 Eu (${myName})</option>
    ${partnerUser ? `<option value="${partnerUser.id}">👫 ${partnerUser.name}</option>` : ''}`;
  document.getElementById('item-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
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

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

init();
