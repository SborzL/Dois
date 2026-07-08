let currentUser = null;
let coupleId = null;
let editingId = null;
const categorias = ['Restaurante','Café','Cinema','Parque','Barzinho','Viagem','Outro'];
const statusOpts = ['quero ir','agendado','já fomos'];
const statusLabels = { 'quero ir': '📌 Quero ir', 'agendado': '🗓️ Agendado', 'já fomos': '✅ Já fomos' };

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).single();
  if (!m) { window.location.href = 'perfil.html'; return; }
  coupleId = m.couple_id;
  buildCategoryFilter();
  await loadPlaces();
  setupModal();
}

function buildCategoryFilter() {
  const wrap = document.getElementById('cat-filters');
  if (!wrap) return;
  wrap.innerHTML = `<button class="chip active" data-cat="">Todos</button>` +
    categorias.map(c => `<button class="chip" data-cat="${c}">${c}</button>`).join('');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    wrap.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadPlaces(btn.dataset.cat);
  });
}

async function loadPlaces(cat = '') {
  let q = supabaseClient.from('places').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false });
  if (cat) q = q.eq('category', cat);
  const { data: places } = await q;
  renderPlaces(places || []);
}

function renderPlaces(places) {
  const lista = document.getElementById('places-list');
  if (!places.length) {
    lista.innerHTML = `<div class="empty-state"><p class="empty-icon">📍</p><p>Nenhum lugar salvo ainda.</p><p class="empty-hint">Toque em + para adicionar o primeiro!</p></div>`;
    return;
  }
  lista.innerHTML = places.map(p => `
    <div class="place-card" data-id="${p.id}">
      <div class="place-info">
        <p class="place-name">${esc(p.name)}</p>
        ${p.address ? `<p class="place-addr">${esc(p.address)}</p>` : ''}
        <div class="place-meta">
          ${p.category ? `<span class="chip-sm">${esc(p.category)}</span>` : ''}
          <span class="status-badge status-${(p.status||'quero ir').replace(' ','-')}">${statusLabels[p.status] || p.status}</span>
        </div>
      </div>
      <button class="btn-icon edit-btn" data-id="${p.id}" aria-label="Editar">✏️</button>
    </div>`).join('');

  lista.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEdit(btn.dataset.id, places));
  });

  lista.querySelectorAll('.place-card').forEach(card => {
    let timer;
    card.addEventListener('touchstart', () => { timer = setTimeout(() => confirmDelete(card.dataset.id), 600); });
    card.addEventListener('touchend', () => clearTimeout(timer));
  });
}

function openEdit(id, places) {
  const p = places.find(x => x.id === id); if (!p) return;
  editingId = id;
  document.getElementById('modal-title-text').textContent = 'Editar lugar';
  document.getElementById('place-name').value = p.name;
  document.getElementById('place-address').value = p.address || '';
  document.getElementById('place-category').value = p.category || '';
  document.getElementById('place-status').value = p.status || 'quero ir';
  document.getElementById('delete-btn').style.display = 'block';
  openModal();
}

function setupModal() {
  const modal = document.getElementById('place-modal');
  const form = document.getElementById('place-form');
  const catSel = document.getElementById('place-category');
  const statusSel = document.getElementById('place-status');

  catSel.innerHTML = `<option value="">Categoria</option>` + categorias.map(c => `<option value="${c}">${c}</option>`).join('');
  statusSel.innerHTML = statusOpts.map(s => `<option value="${s}">${statusLabels[s]}</option>`).join('');

  document.getElementById('add-place-btn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title-text').textContent = 'Novo lugar';
    form.reset();
    document.getElementById('delete-btn').style.display = 'none';
    openModal();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!editingId) return;
    await supabaseClient.from('places').delete().eq('id', editingId);
    closeModal(); loadPlaces();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      couple_id: coupleId,
      name: document.getElementById('place-name').value.trim(),
      address: document.getElementById('place-address').value.trim(),
      category: document.getElementById('place-category').value,
      status: document.getElementById('place-status').value
    };
    if (editingId) {
      await supabaseClient.from('places').update(payload).eq('id', editingId);
    } else {
      await supabaseClient.from('places').insert(payload);
    }
    closeModal(); loadPlaces();
  });
}

function confirmDelete(id) {
  if (!confirm('Remover este lugar?')) return;
  supabaseClient.from('places').delete().eq('id', id).then(() => loadPlaces());
}

function openModal() { document.getElementById('place-modal').classList.add('open'); }
function closeModal() { document.getElementById('place-modal').classList.remove('open'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

init();
