// ─── Auth guard ───────────────────────────────────────────────
let currentUser = null;
let coupleId    = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  currentUser = session.user;

  const { data: member } = await supabaseClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', currentUser.id)
    .single();

  if (!member) { window.location.href = 'perfil.html'; return; }
  coupleId = member.couple_id;

  await loadChecklists();
  setupAddButtons();
}

// ─── Carregar listas + itens ────────────────────────────────────
const listsContainer = document.querySelector('.content');
const progressText   = document.getElementById('progress-text');
const progressFill   = document.getElementById('progress-fill');
const progressLabel  = document.getElementById('progress-label');

let allLists = []; // [{ ...checklist, items: [...] }]

async function loadChecklists() {
  // remove listas mockadas do HTML
  document.querySelectorAll('.list-card').forEach(el => el.remove());
  document.getElementById('btn-new-list')?.remove();

  const { data: lists, error } = await supabaseClient
    .from('checklists')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  // busca todos os itens das listas de uma vez
  const listIds = (lists || []).map(l => l.id);
  let itemsMap = {};

  if (listIds.length > 0) {
    const { data: items } = await supabaseClient
      .from('checklist_items')
      .select('*')
      .in('checklist_id', listIds)
      .order('created_at', { ascending: true });

    (items || []).forEach(item => {
      if (!itemsMap[item.checklist_id]) itemsMap[item.checklist_id] = [];
      itemsMap[item.checklist_id].push(item);
    });
  }

  allLists = (lists || []).map(l => ({ ...l, items: itemsMap[l.id] || [] }));

  renderAll();
}

// ─── Render completo ─────────────────────────────────────────────
const listEmojis = ['✨','💚','🌿','❤️','🌈','⭐','🚀','🍎','🎵','💫'];

function renderAll() {
  // remove listas anteriores renderizadas
  document.querySelectorAll('.list-card').forEach(el => el.remove());
  document.getElementById('btn-new-list')?.remove();

  // progresso global
  const totalItems = allLists.reduce((s, l) => s + l.items.length, 0);
  const doneItems  = allLists.reduce((s, l) => s + l.items.filter(i => i.done).length, 0);
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  progressText.textContent = `${doneItems} de ${totalItems} itens concluídos`;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = pct + '% completo';

  if (allLists.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'cl-empty';
    empty.innerHTML = '<p>Nenhuma lista ainda.</p><p>Toque em + para criar a primeira!</p>';
    listsContainer.appendChild(empty);
  } else {
    document.getElementById('cl-empty')?.remove();
    allLists.forEach(list => listsContainer.appendChild(buildListCard(list)));
  }

  // botão nova lista no final
  const btnNew = document.createElement('button');
  btnNew.className = 'btn-new-list';
  btnNew.id = 'btn-new-list';
  btnNew.textContent = '+ Nova lista';
  btnNew.addEventListener('click', openNewListModal);
  listsContainer.appendChild(btnNew);
}

function buildListCard(list) {
  const total = list.items.length;
  const done  = list.items.filter(i => i.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const emoji = list.emoji || listEmojis[Math.abs(hashStr(list.id)) % listEmojis.length];

  const section = document.createElement('section');
  section.className = 'list-card';
  section.dataset.list = list.id;

  section.innerHTML = `
    <button class="list-header" data-toggle="${list.id}">
      <span class="list-icon">${emoji}</span>
      <div class="list-title-wrap">
        <p class="list-title">${escHtml(list.title)}</p>
        <div class="mini-progress">
          <div class="mini-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <span class="list-count">${done}/${total}</span>
      <span class="chevron">▾</span>
    </button>
    <ul class="item-list" id="items-${list.id}">
      ${list.items.map(item => buildItemHTML(item)).join('')}
      <li class="add-item-row" data-list-id="${list.id}">
        <span class="add-icon">+</span>
        <input type="text" placeholder="Adicionar item...">
      </li>
    </ul>`;

  // colapsar/expandir
  section.querySelector('.list-header').addEventListener('click', () => {
    const ul = section.querySelector('.item-list');
    ul.classList.toggle('collapsed');
    section.querySelector('.list-header').classList.toggle('open');
  });

  // checkboxes
  section.querySelectorAll('.item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => toggleItem(cb.dataset.id, cb.checked, section, list.id));
  });

  // adicionar item inline
  const addRow = section.querySelector('.add-item-row');
  const addInput = addRow.querySelector('input');
  addInput.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const text = addInput.value.trim();
    if (!text) return;
    addInput.value = '';
    await addItem(list.id, text);
  });
  addRow.querySelector('.add-icon').addEventListener('click', async () => {
    const text = addInput.value.trim();
    if (!text) { addInput.focus(); return; }
    addInput.value = '';
    await addItem(list.id, text);
  });

  // toque longo para deletar a lista
  let timer;
  section.querySelector('.list-header').addEventListener('touchstart', () => {
    timer = setTimeout(() => confirmDeleteList(list.id, list.title), 700);
  });
  section.querySelector('.list-header').addEventListener('touchend',  () => clearTimeout(timer));
  section.querySelector('.list-header').addEventListener('touchmove', () => clearTimeout(timer));

  return section;
}

function buildItemHTML(item) {
  return `
    <li class="item${item.done ? ' done' : ''}" data-item-id="${item.id}">
      <input type="checkbox" data-id="${item.id}" ${item.done ? 'checked' : ''}>
      <span>${escHtml(item.text)}</span>
    </li>`;
}

// ─── Toggle item ───────────────────────────────────────────────
async function toggleItem(itemId, done, section, listId) {
  await supabaseClient.from('checklist_items').update({ done }).eq('id', itemId);

  // atualiza allLists em memória
  const list = allLists.find(l => l.id === listId);
  if (list) {
    const item = list.items.find(i => i.id === itemId);
    if (item) item.done = done;
  }

  // atualiza visual do item
  const li = section.querySelector(`[data-item-id="${itemId}"]`);
  if (li) li.classList.toggle('done', done);

  // atualiza contador e barra da lista
  updateListCounter(section, listId);
  updateGlobalProgress();
}

function updateListCounter(section, listId) {
  const list  = allLists.find(l => l.id === listId);
  if (!list) return;
  const total = list.items.length;
  const done  = list.items.filter(i => i.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  section.querySelector('.list-count').textContent = `${done}/${total}`;
  section.querySelector('.mini-progress-fill').style.width = pct + '%';
}

function updateGlobalProgress() {
  const totalItems = allLists.reduce((s, l) => s + l.items.length, 0);
  const doneItems  = allLists.reduce((s, l) => s + l.items.filter(i => i.done).length, 0);
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  progressText.textContent = `${doneItems} de ${totalItems} itens concluídos`;
  progressFill.style.width = pct + '%';
  progressLabel.textContent = pct + '% completo';
}

// ─── Adicionar item inline ─────────────────────────────────────
async function addItem(listId, text) {
  const { data: newItem, error } = await supabaseClient
    .from('checklist_items')
    .insert({ checklist_id: listId, text, done: false, created_by: currentUser.id })
    .select()
    .single();

  if (error) { console.error(error); return; }

  const list = allLists.find(l => l.id === listId);
  if (list) list.items.push(newItem);

  // insere o novo item antes da .add-item-row
  const addRow  = document.querySelector(`[data-list-id="${listId}"]`);
  const li      = document.createElement('li');
  li.className  = 'item';
  li.dataset.itemId = newItem.id;
  li.innerHTML  = buildItemHTML(newItem).replace('<li', '<li').match(/<li[^>]*>([\s\S]*)<\/li>/)?.[1] || '';
  li.innerHTML  = `<input type="checkbox" data-id="${newItem.id}"><span>${escHtml(newItem.text)}</span>`;
  li.querySelector('input').addEventListener('change', cb =>
    toggleItem(newItem.id, cb.target.checked, addRow.closest('.list-card'), listId)
  );
  addRow.parentNode.insertBefore(li, addRow);

  updateListCounter(addRow.closest('.list-card'), listId);
  updateGlobalProgress();
}

// ─── Deletar lista ─────────────────────────────────────────────
function confirmDeleteList(id, title) {
  if (!confirm(`Deletar a lista "${title}" e todos os itens?`)) return;
  deleteList(id);
}

async function deleteList(id) {
  await supabaseClient.from('checklist_items').delete().eq('checklist_id', id);
  await supabaseClient.from('checklists').delete().eq('id', id);
  allLists = allLists.filter(l => l.id !== id);
  renderAll();
}

// ─── Modal: nova lista ─────────────────────────────────────────
function setupAddButtons() {
  document.getElementById('btn-add-list').addEventListener('click', openNewListModal);
}

function openNewListModal() {
  if (!document.getElementById('nl-modal')) buildNewListModal();
  document.getElementById('nl-modal').classList.add('open');
  document.getElementById('nl-title').focus();
}

function closeNewListModal() {
  document.getElementById('nl-modal').classList.remove('open');
  document.getElementById('nl-form').reset();
}

function buildNewListModal() {
  const m = document.createElement('div');
  m.id = 'nl-modal';
  m.className = 'modal-backdrop';
  m.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="nl-heading">
      <div class="modal-handle"></div>
      <h2 id="nl-heading">Nova lista</h2>
      <form id="nl-form" novalidate>
        <label for="nl-title">Nome da lista *</label>
        <input id="nl-title" type="text" placeholder="Ex: Viagem para o litoral" required>

        <label for="nl-emoji">Emoji</label>
        <input id="nl-emoji" type="text" placeholder="Ex: ✈️" maxlength="2">

        <p id="nl-error" class="form-error hidden"></p>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="nl-cancel">Cancelar</button>
          <button type="submit" class="btn-primary" id="nl-save">Criar</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) closeNewListModal(); });
  document.getElementById('nl-cancel').addEventListener('click', closeNewListModal);
  document.getElementById('nl-form').addEventListener('submit', submitNewList);
}

async function submitNewList(e) {
  e.preventDefault();
  const title   = document.getElementById('nl-title').value.trim();
  const emoji   = document.getElementById('nl-emoji').value.trim() || null;
  const errEl   = document.getElementById('nl-error');
  const saveBtn = document.getElementById('nl-save');

  if (!title) { showError(errEl, 'O nome é obrigatório.'); return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Criando...';

  const { data: newList, error } = await supabaseClient
    .from('checklists')
    .insert({ couple_id: coupleId, title, emoji, created_by: currentUser.id })
    .select()
    .single();

  saveBtn.disabled = false;
  saveBtn.textContent = 'Criar';

  if (error) { showError(errEl, 'Erro ao criar. Tente novamente.'); return; }

  closeNewListModal();
  allLists.push({ ...newList, items: [] });
  renderAll();
}

// ─── Utils ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h;
}

// ─── Start ─────────────────────────────────────────────────────
init();
