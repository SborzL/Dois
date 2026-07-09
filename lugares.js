let currentUser = null;
let coupleId = null;
let editingId = null;
let detailId = null;
let allPlaces = [];
let activeStatus = '';
let activeCat = '';
let searchQuery = '';

const categorias = [
  'Restaurante','Café','Cinema','Parque','Barzinho','Viagem',
  'Praia','Museu','Show / Evento','Doces & Sobremesas',
  'Lanchonete','Pizzaria','Sushi','Churrascaria',
  'Sorveteria','Padaria','Mercado','Shopping','Spa / Bem-estar','Outro'
];
const statusOpts = ['quero ir','agendado','já fomos'];
const statusLabels = { 'quero ir': '📌 Quero ir', 'agendado': '🗓️ Agendado', 'já fomos': '✅ Já fomos' };
const statusColors = { 'quero ir': 'status-quero', 'agendado': 'status-agendado', 'já fomos': 'status-fomos' };
const RATING_FIELDS = [
  { key: 'rating_ambiente',     label: '🏡 Ambiente' },
  { key: 'rating_comida',       label: '🍽️ Comida' },
  { key: 'rating_atendimento',  label: '🤝 Atendimento' },
  { key: 'rating_custo',        label: '💰 Custo-benefício' },
];

// ── INIT ──────────────────────────────────────────────────────────────
async function waitForSession(ms = 8000) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return session;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_, s) => {
      if (s) { clearTimeout(timer); subscription.unsubscribe(); resolve(s); }
    });
  });
}

async function init() {
  const session = await waitForSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;
  buildCategoryFilter();
  setupStatusFilter();
  setupSearch();
  await loadPlaces();
  setupModal();
  document.getElementById('back-btn').addEventListener('click', showListScreen);
  document.getElementById('detail-edit-btn').addEventListener('click', () => openEdit(detailId));
}

// ── TELAS ──────────────────────────────────────────────────────────────
function showListScreen() {
  document.getElementById('screen-list').classList.remove('hidden');
  document.getElementById('screen-detail').classList.add('hidden');
  detailId = null;
}
function showDetailScreen(id) {
  const p = allPlaces.find(x => x.id === id); if (!p) return;
  detailId = id;
  document.getElementById('screen-list').classList.add('hidden');
  document.getElementById('screen-detail').classList.remove('hidden');
  renderDetail(p);
}

// ── FILTROS ────────────────────────────────────────────────────────────
function applyFilters() {
  let list = allPlaces;
  if (activeStatus) list = list.filter(p => p.status === activeStatus);
  if (activeCat)    list = list.filter(p => p.category === activeCat);
  if (searchQuery)  list = list.filter(p =>
    p.name.toLowerCase().includes(searchQuery) ||
    (p.address || '').toLowerCase().includes(searchQuery) ||
    (p.category || '').toLowerCase().includes(searchQuery)
  );
  renderPlaces(list);
}

function setupStatusFilter() {
  const wrap = document.getElementById('status-filters');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    wrap.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    applyFilters();
  });
}

function buildCategoryFilter() {
  const wrap = document.getElementById('cat-filters');
  if (!wrap) return;
  wrap.innerHTML =
    `<button class="chip active" data-cat="">Todas</button>` +
    categorias.map(c => `<button class="chip" data-cat="${c}">${c}</button>`).join('');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    wrap.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    applyFilters();
  });
}

function setupSearch() {
  const input = document.getElementById('places-search');
  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase();
    applyFilters();
  });
}

// ── LISTA ──────────────────────────────────────────────────────────────
async function loadPlaces() {
  const { data } = await supabaseClient.from('places').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  allPlaces = data || [];
  applyFilters();
}

function renderPlaces(places) {
  const lista = document.getElementById('places-list');
  if (!places.length) {
    const msg = (activeStatus || activeCat || searchQuery)
      ? 'Nenhum lugar encontrado com esses filtros.'
      : 'Nenhum lugar salvo ainda.';
    lista.innerHTML = `<div class="empty-state"><p class="empty-icon">📍</p><p>${msg}</p>${!activeStatus && !activeCat && !searchQuery ? '<p class="empty-hint">Toque em + para adicionar o primeiro!</p>' : ''}</div>`;
    return;
  }
  lista.innerHTML = places.map(p => {
    const vals = RATING_FIELDS.map(f => p[f.key]).filter(v => v > 0);
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null;
    return `<div class="place-card" data-id="${p.id}">
      <div class="place-info">
        <p class="place-name">${esc(p.name)}</p>
        ${p.address ? `<p class="place-addr">📍 ${esc(p.address)}</p>` : ''}
        <div class="place-meta">
          ${p.category ? `<span class="chip-sm">${esc(p.category)}</span>` : ''}
          <span class="status-badge ${statusColors[p.status]||'status-quero'}">${statusLabels[p.status]||p.status}</span>
          ${avg ? `<span class="avg-badge">⭐ ${avg}</span>` : ''}
        </div>
      </div>
      <span class="place-arrow">›</span>
    </div>`;
  }).join('');
  lista.querySelectorAll('.place-card').forEach(card => {
    card.addEventListener('click', () => showDetailScreen(card.dataset.id));
  });
}

// ── DETALHE ────────────────────────────────────────────────────────────
function renderDetail(p) {
  document.getElementById('detail-name').textContent = p.name;
  const catBadge = document.getElementById('detail-category-badge');
  catBadge.textContent = p.category || '';
  catBadge.className = p.category ? 'chip-sm' : '';

  const vals = RATING_FIELDS.map(f => p[f.key]).filter(v => v != null && v > 0);
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;

  let html = '';
  html += `<div class="detail-top">`;
  html += `<span class="status-badge ${statusColors[p.status] || 'status-quero'}">${statusLabels[p.status] || p.status}</span>`;
  if (avg !== null) html += `<span class="avg-badge">⭐ ${avg.toFixed(1)}</span>`;
  html += `</div>`;

  if (p.address || p.maps_url) {
    html += `<div class="detail-section">`;
    if (p.address) html += `<div class="detail-addr">📍 ${esc(p.address)}</div>`;
    if (p.maps_url) html += `<a href="${esc(p.maps_url)}" target="_blank" rel="noopener" class="maps-btn">🗺️ Abrir no Google Maps</a>`;
    html += `</div>`;
  }

  const hasAny = RATING_FIELDS.some(f => p[f.key] > 0);
  if (hasAny) {
    html += `<div class="detail-section">`;
    html += `<div class="detail-section-title">Avaliações</div>`;
    html += `<div class="detail-ratings">`;
    RATING_FIELDS.forEach(f => {
      const val = p[f.key] || 0;
      if (!val) return;
      html += `<div class="detail-rating-row">
        <span class="detail-rating-label">${f.label}</span>
        <span class="detail-stars">${starsHtml(val)}</span>
      </div>`;
    });
    html += `</div></div>`;
  }

  if (p.notes) {
    html += `<div class="detail-section">`;
    html += `<div class="detail-section-title">Observações</div>`;
    html += `<div class="detail-notes">${esc(p.notes).replace(/\n/g, '<br>')}</div>`;
    html += `</div>`;
  }

  document.getElementById('detail-body').innerHTML = html;
}

function starsHtml(val) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="star-d ${i <= val ? 'on' : ''}">★</span>`;
  return s;
}

// ── MODAL ──────────────────────────────────────────────────────────────
function setupModal() {
  const modal  = document.getElementById('place-modal');
  const form   = document.getElementById('place-form');
  const catSel = document.getElementById('place-category');
  const statusSel = document.getElementById('place-status');

  catSel.innerHTML = `<option value="">Sem categoria</option>` + categorias.map(c => `<option value="${c}">${c}</option>`).join('');
  statusSel.innerHTML = statusOpts.map(s => `<option value="${s}">${statusLabels[s]}</option>`).join('');

  document.querySelectorAll('.star-group').forEach(group => {
    const field = group.dataset.field;
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-btn';
      btn.dataset.val = i;
      btn.textContent = '★';
      btn.addEventListener('click', () => setStars(group, i));
      group.appendChild(btn);
    }
  });

  document.getElementById('add-place-btn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title-text').textContent = 'Novo lugar';
    form.reset();
    document.querySelectorAll('.star-group').forEach(g => setStars(g, 0));
    document.getElementById('delete-btn').style.display = 'none';
    openModal();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!editingId || !confirm('Remover este lugar?')) return;
    await supabaseClient.from('places').delete().eq('id', editingId);
    closeModal(); showListScreen(); loadPlaces();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nameVal = document.getElementById('place-name').value.trim();
    if (!nameVal) return;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;

    const ratingVals = {};
    document.querySelectorAll('.star-group').forEach(g => {
      ratingVals[g.dataset.field] = getStars(g) || null;
    });

    const payload = {
      couple_id: coupleId,
      name: nameVal,
      address: document.getElementById('place-address').value.trim() || null,
      category: document.getElementById('place-category').value || null,
      status: document.getElementById('place-status').value,
      maps_url: document.getElementById('place-maps-url').value.trim() || null,
      notes: document.getElementById('place-notes').value.trim() || null,
      ...ratingVals
    };

    if (editingId) {
      await supabaseClient.from('places').update(payload).eq('id', editingId);
    } else {
      await supabaseClient.from('places').insert(payload);
    }
    btn.disabled = false;
    closeModal();
    await loadPlaces();
    if (editingId && detailId) {
      const updated = allPlaces.find(x => x.id === editingId);
      if (updated) renderDetail(updated);
      showDetailScreen(editingId);
    }
  });
}

function openEdit(id) {
  const p = allPlaces.find(x => x.id === id); if (!p) return;
  editingId = id;
  document.getElementById('modal-title-text').textContent = 'Editar lugar';
  document.getElementById('place-name').value = p.name;
  document.getElementById('place-address').value = p.address || '';
  document.getElementById('place-maps-url').value = p.maps_url || '';
  document.getElementById('place-category').value = p.category || '';
  document.getElementById('place-status').value = p.status || 'quero ir';
  document.getElementById('place-notes').value = p.notes || '';
  RATING_FIELDS.forEach(f => {
    const g = document.querySelector(`.star-group[data-field="${f.key}"]`);
    if (g) setStars(g, p[f.key] || 0);
  });
  document.getElementById('delete-btn').style.display = 'block';
  openModal();
}

function setStars(group, val) {
  group.dataset.value = val;
  group.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('on', parseInt(btn.dataset.val) <= val);
  });
}
function getStars(group) { return parseInt(group.dataset.value) || 0; }

function openModal()  { document.getElementById('place-modal').classList.add('open'); }
function closeModal() { document.getElementById('place-modal').classList.remove('open'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.addEventListener('DOMContentLoaded', init);
