// ─── Auth guard ───────────────────────────────────────────────
let currentUser = null;
let coupleId    = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  currentUser = session.user;

  // busca couple_id do usuário
  const { data: member } = await supabaseClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', currentUser.id)
    .single();

  if (!member) { window.location.href = 'perfil.html'; return; }
  coupleId = member.couple_id;

  await loadPlaces();
  setupFilters();
  setupAddButton();
}

// ─── Carregar lugares ──────────────────────────────────────────
const list        = document.getElementById('place-list');
const countEl     = document.getElementById('places-count');
const numQuero    = document.querySelector('.status-chip.quero-ir  .status-num');
const numAgendado = document.querySelector('.status-chip.agendado  .status-num');
const numFomos    = document.querySelector('.status-chip.fomos     .status-num');

let allPlaces    = [];
let activeFilter = 'todos';

async function loadPlaces() {
  list.innerHTML = '<li class="place-card loading"><span>Carregando...</span></li>';

  const { data, error } = await supabaseClient
    .from('places')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  allPlaces = data || [];
  renderPlaces();
}

// ─── Render ────────────────────────────────────────────────────
const categoryEmoji = {
  restaurantes: '🍽️',
  cafes:        '☕',
  passeios:     '🌳',
  outros:       '📍'
};

const statusLabel = {
  'quero-ir':  'Quero ir',
  'agendado':  'Agendado',
  'fomos':     'Já fomos'
};

function renderPlaces() {
  const filtered = activeFilter === 'todos'
    ? allPlaces
    : allPlaces.filter(p => p.category === activeFilter);

  // atualiza contadores
  const q = allPlaces.filter(p => p.status === 'quero-ir').length;
  const a = allPlaces.filter(p => p.status === 'agendado').length;
  const f = allPlaces.filter(p => p.status === 'fomos').length;
  numQuero.textContent    = q;
  numAgendado.textContent = a;
  numFomos.textContent    = f;
  countEl.textContent     = allPlaces.length + ' lugar' + (allPlaces.length !== 1 ? 'es' : '') + ' salvo' + (allPlaces.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    list.innerHTML = `
      <li class="empty-state">
        <p>Nenhum lugar aqui ainda.</p>
        <p>Toque em + para adicionar!</p>
      </li>`;
    return;
  }

  list.innerHTML = filtered.map(p => `
    <li class="place-card" data-id="${p.id}" data-category="${p.category}" data-status="${p.status}">
      <span class="place-emoji">${categoryEmoji[p.category] || '📍'}</span>
      <div class="place-info">
        <div class="place-top">
          <p class="place-name">${escHtml(p.name)}</p>
          <span class="badge badge-${p.status}">${statusLabel[p.status] || p.status}</span>
        </div>
        ${p.address ? `<p class="place-address">${escHtml(p.address)}</p>` : ''}
        <p class="place-rating">${p.category.charAt(0).toUpperCase() + p.category.slice(1)}</p>
      </div>
    </li>
  `).join('');

  // toque longo para deletar
  list.querySelectorAll('.place-card').forEach(card => {
    let timer;
    card.addEventListener('touchstart', () => {
      timer = setTimeout(() => openDeleteConfirm(card.dataset.id, card.querySelector('.place-name').textContent), 600);
    });
    card.addEventListener('touchend', () => clearTimeout(timer));
    card.addEventListener('touchmove', () => clearTimeout(timer));
  });
}

// ─── Filtros ───────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderPlaces();
    });
  });
}

// ─── Modal: adicionar lugar ────────────────────────────────────
function setupAddButton() {
  document.getElementById('btn-add-place').addEventListener('click', openModal);
}

function openModal() {
  // cria modal se não existir
  if (!document.getElementById('place-modal')) buildModal();
  document.getElementById('place-modal').classList.add('open');
  document.getElementById('pm-name').focus();
}

function closeModal() {
  document.getElementById('place-modal').classList.remove('open');
  document.getElementById('pm-form').reset();
}

function buildModal() {
  const m = document.createElement('div');
  m.id = 'place-modal';
  m.className = 'modal-backdrop';
  m.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="pm-title">
      <div class="modal-handle"></div>
      <h2 id="pm-title">Novo lugar</h2>
      <form id="pm-form" novalidate>
        <label for="pm-name">Nome *</label>
        <input id="pm-name" type="text" placeholder="Ex: Café Madeleine" required>

        <label for="pm-address">Endereço</label>
        <input id="pm-address" type="text" placeholder="Ex: Av. Paulista, 900">

        <label for="pm-category">Categoria</label>
        <select id="pm-category">
          <option value="restaurantes">🍽️ Restaurante</option>
          <option value="cafes">☕ Café</option>
          <option value="passeios">🌳 Passeio</option>
          <option value="outros">📍 Outros</option>
        </select>

        <label for="pm-status">Status</label>
        <select id="pm-status">
          <option value="quero-ir">Quero ir</option>
          <option value="agendado">Agendado</option>
          <option value="fomos">Já fomos</option>
        </select>

        <p id="pm-error" class="form-error hidden"></p>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="pm-cancel">Cancelar</button>
          <button type="submit" class="btn-primary" id="pm-save">Salvar</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  document.getElementById('pm-cancel').addEventListener('click', closeModal);
  document.getElementById('pm-form').addEventListener('submit', submitPlace);
}

async function submitPlace(e) {
  e.preventDefault();
  const name    = document.getElementById('pm-name').value.trim();
  const address = document.getElementById('pm-address').value.trim();
  const category= document.getElementById('pm-category').value;
  const status  = document.getElementById('pm-status').value;
  const errEl   = document.getElementById('pm-error');
  const saveBtn = document.getElementById('pm-save');

  if (!name) { showError(errEl, 'O nome é obrigatório.'); return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  const { error } = await supabaseClient.from('places').insert({
    couple_id: coupleId,
    name,
    address: address || null,
    category,
    status,
    created_by: currentUser.id
  });

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar';

  if (error) { showError(errEl, 'Erro ao salvar. Tente novamente.'); return; }

  closeModal();
  await loadPlaces();
}

// ─── Deletar ───────────────────────────────────────────────────
function openDeleteConfirm(id, name) {
  if (!confirm(`Remover "${name}"?`)) return;
  deletaPlace(id);
}

async function deletaPlace(id) {
  await supabaseClient.from('places').delete().eq('id', id);
  allPlaces = allPlaces.filter(p => p.id !== id);
  renderPlaces();
}

// ─── Utils ─────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── Start ─────────────────────────────────────────────────────
init();
