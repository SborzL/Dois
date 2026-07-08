let currentUser = null;
let coupleId = null;
let activeListId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).single();
  if (!m) { window.location.href = 'perfil.html'; return; }
  coupleId = m.couple_id;
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
  wrap.innerHTML = lists.map(l => `
    <div class="list-card ${l.id === activeListId ? 'active' : ''}" data-id="${l.id}">
      <span class="list-title">${esc(l.title)}</span>
      <button class="btn-icon del-list" data-id="${l.id}" aria-label="Remover lista">×</button>
    </div>`).join('');

  wrap.querySelectorAll('.list-card').forEach(c => {
    c.addEventListener('click', e => { if (e.target.classList.contains('del-list')) return; openList(c.dataset.id); });
  });
  wrap.querySelectorAll('.del-list').forEach(b => {
    b.addEventListener('click', () => deleteList(b.dataset.id));
  });

  if (!activeListId || !lists.find(l => l.id === activeListId)) {
    openList(lists[0].id);
  }
}

async function openList(id) {
  activeListId = id;
  document.querySelectorAll('.list-card').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  await loadItems(id);
  document.getElementById('items-section').style.display = 'block';
}

async function loadItems(listId) {
  const { data: items } = await supabaseClient.from('checklist_items').select('*').eq('checklist_id', listId).order('created_at', { ascending: true });
  renderItems(items || []);
}

function renderItems(items) {
  const ul = document.getElementById('items-list');
  if (!items.length) {
    ul.innerHTML = `<div class="empty-state small"><p>Lista vazia. Adicione um item!</p></div>`;
    return;
  }
  ul.innerHTML = items.map(item => `
    <li class="checklist-item ${item.done ? 'done' : ''}" data-id="${item.id}">
      <button class="check-btn" data-id="${item.id}" data-done="${item.done}" aria-label="Marcar">
        ${item.done ? '✅' : '○'}
      </button>
      <span class="item-text">${esc(item.title)}</span>
      <button class="btn-icon del-item" data-id="${item.id}" aria-label="Remover">×</button>
    </li>`).join('');

  ul.querySelectorAll('.check-btn').forEach(b => b.addEventListener('click', () => toggleItem(b.dataset.id, b.dataset.done === 'true')));
  ul.querySelectorAll('.del-item').forEach(b => b.addEventListener('click', () => deleteItem(b.dataset.id)));
}

async function toggleItem(id, done) {
  await supabaseClient.from('checklist_items').update({ done: !done }).eq('id', id);
  loadItems(activeListId);
}

async function deleteItem(id) {
  await supabaseClient.from('checklist_items').delete().eq('id', id);
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
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  document.getElementById('list-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('list-title-input').value.trim();
    if (!title) return;
    await supabaseClient.from('checklists').insert({ couple_id: coupleId, title });
    modal.classList.remove('open');
    document.getElementById('list-form').reset();
    await loadLists();
  });
}

function setupItemModal() {
  const modal = document.getElementById('item-modal');
  document.getElementById('add-item-btn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('item-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  document.getElementById('item-form').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('item-title-input').value.trim();
    if (!title || !activeListId) return;
    await supabaseClient.from('checklist_items').insert({ checklist_id: activeListId, title, done: false });
    modal.classList.remove('open');
    document.getElementById('item-form').reset();
    loadItems(activeListId);
  });
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

init();
