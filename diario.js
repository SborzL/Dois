let currentUser = null;
let coupleId = null;
let editingId = null;
let selectedMood = '😊';
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;
  setupModal();
  await loadEntries();
}

async function loadEntries() {
  const { data: entries } = await supabaseClient
    .from('diary_entries')
    .select('*, profiles(name)')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  const list = document.getElementById('entries-list');
  const empty = document.getElementById('empty-state');
  if (!entries?.length) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  const cards = entries.map(e => entryCard(e)).join('');
  list.innerHTML = cards + (empty.outerHTML);
  document.getElementById('empty-state').style.display = 'none';
  list.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
  list.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => deleteEntry(b.dataset.id)));
}

function entryCard(e) {
  const d = new Date(e.created_at);
  const date = `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isMe = e.author_id === currentUser.id;
  const author = e.profiles?.name || 'Você';
  const actions = isMe ? `<div class="entry-actions"><button class="btn-xs btn-edit" data-id="${e.id}">Editar</button><button class="btn-xs danger btn-delete" data-id="${e.id}">Excluir</button></div>` : '';
  return `<div class="entry-card">
    <div class="entry-top">
      <span class="entry-mood">${e.mood || '📓'}</span>
      <span class="entry-author">${esc(author)}</span>
      <span class="entry-meta">${date} · ${time}</span>
    </div>
    <p class="entry-text">${esc(e.content)}</p>
    ${actions}
  </div>`;
}

function setupModal() {
  const modal = document.getElementById('modal-entrada');
  const close = () => { modal.classList.remove('open'); editingId = null; document.getElementById('entry-content').value = ''; document.getElementById('entry-error').textContent = ''; };
  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('cancel-entry-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('btn-nova-entrada').addEventListener('click', () => openNew());
  document.getElementById('btn-nova-entrada-2')?.addEventListener('click', () => openNew());
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selectedMood = b.dataset.mood;
    });
  });
  document.getElementById('save-entry-btn').addEventListener('click', saveEntry);
}

function openNew() {
  editingId = null;
  selectedMood = '😊';
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('active', b.dataset.mood === '😊'));
  document.getElementById('entry-content').value = '';
  document.getElementById('modal-titulo').textContent = 'Nova entrada';
  document.getElementById('entry-error').textContent = '';
  document.getElementById('modal-entrada').classList.add('open');
}

async function openEdit(id) {
  const { data: e } = await supabaseClient.from('diary_entries').select('*').eq('id', id).maybeSingle();
  if (!e) return;
  editingId = id;
  selectedMood = e.mood || '😊';
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('active', b.dataset.mood === selectedMood));
  document.getElementById('entry-content').value = e.content;
  document.getElementById('modal-titulo').textContent = 'Editar entrada';
  document.getElementById('entry-error').textContent = '';
  document.getElementById('modal-entrada').classList.add('open');
}

async function saveEntry() {
  const content = document.getElementById('entry-content').value.trim();
  const errEl = document.getElementById('entry-error');
  if (!content) { errEl.textContent = 'Escreva algo antes de salvar.'; return; }
  const btn = document.getElementById('save-entry-btn');
  btn.disabled = true; btn.textContent = 'Salvando...';
  let error;
  if (editingId) {
    ({ error } = await supabaseClient.from('diary_entries').update({ content, mood: selectedMood }).eq('id', editingId));
  } else {
    ({ error } = await supabaseClient.from('diary_entries').insert({ couple_id: coupleId, author_id: currentUser.id, content, mood: selectedMood }));
  }
  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { errEl.textContent = 'Erro: ' + error.message; return; }
  document.getElementById('modal-entrada').classList.remove('open');
  showToast(editingId ? 'Entrada editada!' : 'Entrada salva!');
  editingId = null;
  await loadEntries();
}

async function deleteEntry(id) {
  if (!confirm('Excluir esta entrada?')) return;
  await supabaseClient.from('diary_entries').delete().eq('id', id);
  showToast('Entrada excluída.');
  await loadEntries();
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
init();
