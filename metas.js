let currentUser = null;
let coupleId = null;
let editingId = null;
let currentTab = 'ativas';
let progGoalId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;
  setupTabs();
  setupModal();
  setupProgModal();
  await loadGoals();
}

async function loadGoals() {
  const done = currentTab === 'concluidas';
  const { data: goals } = await supabaseClient.from('goals').select('*').eq('couple_id', coupleId).eq('done', done).order('created_at', { ascending: false });
  const list = document.getElementById('goals-list');
  const empty = document.getElementById('empty-state');
  if (!goals?.length) { list.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  list.innerHTML = goals.map(g => goalCard(g)).join('');
  list.querySelectorAll('.btn-prog').forEach(b => b.addEventListener('click', () => openProg(b.dataset.id, b.dataset.title, b.dataset.current)));
  list.querySelectorAll('.btn-edit-goal').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
  list.querySelectorAll('.btn-del-goal').forEach(b => b.addEventListener('click', () => deleteGoal(b.dataset.id)));
  list.querySelectorAll('.btn-done-goal').forEach(b => b.addEventListener('click', () => toggleDone(b.dataset.id, done)));
}

function goalCard(g) {
  const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  const numLabel = g.target > 0 ? `${g.current}${g.unit ? ' ' + g.unit : ''} de ${g.target}${g.unit ? ' ' + g.unit : ''} · ${pct}%` : (g.current > 0 ? `${g.current}${g.unit ? ' ' + g.unit : ''}` : '');
  const doneClass = g.done ? 'done' : '';
  const fillClass = pct >= 100 ? 'full' : '';
  const doneBtn = g.done
    ? `<button class="btn-xs btn-done-goal" data-id="${g.id}">↩ Reabrir</button>`
    : `<button class="btn-xs primary btn-prog" data-id="${g.id}" data-title="${esc(g.title)}" data-current="${g.current}">📈 Progresso</button>
       <button class="btn-xs btn-done-goal" data-id="${g.id}">✅ Concluir</button>`;
  return `<div class="goal-card ${doneClass}">
    <div class="goal-top">
      <span class="goal-emoji">${g.emoji || '🎯'}</span>
      <span class="goal-title ${g.done ? 'done-title' : ''}">${esc(g.title)}</span>
    </div>
    ${numLabel ? `<p class="goal-numbers">${numLabel}</p>` : ''}
    ${g.target > 0 ? `<div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>` : ''}
    <div class="goal-actions">
      ${doneBtn}
      <button class="btn-xs btn-edit-goal" data-id="${g.id}">Editar</button>
      <button class="btn-xs danger btn-del-goal" data-id="${g.id}">Excluir</button>
    </div>
  </div>`;
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    currentTab = t.dataset.tab;
    loadGoals();
  }));
}

function setupModal() {
  const modal = document.getElementById('modal-meta');
  const closeModal = () => { modal.classList.remove('open'); editingId = null; resetForm(); };
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-meta-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.getElementById('btn-nova-meta').addEventListener('click', openNew);
  document.getElementById('btn-nova-meta-2')?.addEventListener('click', openNew);
  document.getElementById('save-meta-btn').addEventListener('click', saveMeta);
}

function setupProgModal() {
  const modal = document.getElementById('modal-progresso');
  const close = () => modal.classList.remove('open');
  document.getElementById('prog-close').addEventListener('click', close);
  document.getElementById('cancel-prog-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('save-prog-btn').addEventListener('click', saveProg);
}

function openNew() {
  editingId = null;
  resetForm();
  document.getElementById('modal-titulo').textContent = 'Nova meta';
  document.getElementById('modal-meta').classList.add('open');
}

async function openEdit(id) {
  const { data: g } = await supabaseClient.from('goals').select('*').eq('id', id).maybeSingle();
  if (!g) return;
  editingId = id;
  document.getElementById('meta-title').value = g.title;
  document.getElementById('meta-emoji').value = g.emoji || '';
  document.getElementById('meta-unit').value = g.unit || '';
  document.getElementById('meta-target').value = g.target ?? '';
  document.getElementById('meta-current').value = g.current ?? 0;
  document.getElementById('modal-titulo').textContent = 'Editar meta';
  document.getElementById('modal-meta').classList.add('open');
}

function openProg(id, title, current) {
  progGoalId = id;
  document.getElementById('prog-goal-title').textContent = title;
  document.getElementById('prog-value').value = current;
  document.getElementById('prog-error').textContent = '';
  document.getElementById('modal-progresso').classList.add('open');
}

async function saveProg() {
  const val = parseFloat(document.getElementById('prog-value').value);
  if (isNaN(val) || val < 0) { document.getElementById('prog-error').textContent = 'Valor inválido.'; return; }
  const btn = document.getElementById('save-prog-btn');
  btn.disabled = true; btn.textContent = 'Salvando...';
  const { error } = await supabaseClient.from('goals').update({ current: val }).eq('id', progGoalId);
  btn.disabled = false; btn.textContent = 'Atualizar';
  if (error) { document.getElementById('prog-error').textContent = 'Erro: ' + error.message; return; }
  document.getElementById('modal-progresso').classList.remove('open');
  showToast('Progresso atualizado!');
  await loadGoals();
}

async function saveMeta() {
  const title = document.getElementById('meta-title').value.trim();
  const errEl = document.getElementById('meta-error');
  if (!title) { errEl.textContent = 'O título é obrigatório.'; return; }
  const payload = {
    couple_id: coupleId,
    title,
    emoji: document.getElementById('meta-emoji').value.trim() || null,
    unit: document.getElementById('meta-unit').value.trim() || null,
    target: parseFloat(document.getElementById('meta-target').value) || null,
    current: parseFloat(document.getElementById('meta-current').value) || 0,
  };
  const btn = document.getElementById('save-meta-btn');
  btn.disabled = true; btn.textContent = 'Salvando...';
  let error;
  if (editingId) {
    ({ error } = await supabaseClient.from('goals').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabaseClient.from('goals').insert(payload));
  }
  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { errEl.textContent = 'Erro: ' + error.message; return; }
  document.getElementById('modal-meta').classList.remove('open');
  showToast(editingId ? 'Meta atualizada!' : 'Meta criada!');
  editingId = null;
  await loadGoals();
}

async function deleteGoal(id) {
  if (!confirm('Excluir esta meta?')) return;
  await supabaseClient.from('goals').delete().eq('id', id);
  showToast('Meta excluída.');
  await loadGoals();
}

async function toggleDone(id, currentlyDone) {
  await supabaseClient.from('goals').update({ done: !currentlyDone }).eq('id', id);
  showToast(!currentlyDone ? '🎉 Meta concluída!' : 'Meta reaberta.');
  await loadGoals();
}

function resetForm() {
  ['meta-title','meta-emoji','meta-unit','meta-target','meta-current'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('meta-error').textContent = '';
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
init();
