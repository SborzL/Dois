let currentUser = null;
let coupleId    = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: m } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  coupleId = m?.couple_id || null;

  await loadProfile();
  await loadCoupleSection();

  setupSaveProfile();
  setupLogout();
  setupAlterarSenha();
  setupDesconectar();
}

async function loadProfile() {
  const { data: p } = await supabaseClient
    .from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
  const nome  = p?.name || currentUser.email.split('@')[0];
  const email = currentUser.email || '';
  document.getElementById('hero-name').textContent   = nome;
  document.getElementById('hero-email').textContent  = email;
  document.getElementById('profile-name').value      = nome;
  document.getElementById('profile-email').textContent = email;
  document.getElementById('avatar-me').textContent   = nome.slice(0, 2).toUpperCase();
}

function setupSaveProfile() {
  const btn = document.getElementById('save-profile-btn');
  btn.addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) return;
    btn.disabled = true; btn.textContent = 'Salvando...';
    const { error } = await supabaseClient
      .from('profiles').upsert({ id: currentUser.id, name }, { onConflict: 'id' });
    btn.disabled = false; btn.textContent = 'Salvar';
    if (error) { showToast('Erro: ' + error.message); return; }
    document.getElementById('hero-name').textContent  = name;
    document.getElementById('avatar-me').textContent  = name.slice(0, 2).toUpperCase();
    showToast('Nome salvo!');
  });
}

async function loadCoupleSection() {
  const secCasal    = document.getElementById('section-casal');
  const secSemCasal = document.getElementById('section-sem-casal');

  if (!coupleId) {
    secSemCasal.classList.remove('hidden');
    return;
  }
  secCasal.classList.remove('hidden');

  const { data: couple } = await supabaseClient
    .from('couples').select('invite_code').eq('id', coupleId).maybeSingle();
  const codeEl = document.getElementById('invite-code-display');
  if (codeEl) codeEl.textContent = couple?.invite_code || '------';

  document.getElementById('copy-code-btn').addEventListener('click', async () => {
    const code = couple?.invite_code || '';
    try {
      await navigator.clipboard.writeText(code);
      showToast('Codigo copiado!');
    } catch {
      showToast('Codigo: ' + code);
    }
  });

  const { data: members } = await supabaseClient
    .from('couple_members').select('user_id').eq('couple_id', coupleId);
  const others = (members || []).filter(m => m.user_id !== currentUser.id);

  const partnerEl  = document.getElementById('partner-name');
  const partnerAv  = document.getElementById('avatar-partner');

  if (others.length === 0) {
    partnerEl.textContent = 'Aguardando parceiro(a)...';
    partnerAv.textContent = '?';
    partnerAv.classList.add('muted');
  } else {
    const { data: pp } = await supabaseClient
      .from('profiles').select('name').eq('id', others[0].user_id).maybeSingle();
    const pnome = pp?.name || 'Parceiro(a)';
    partnerEl.textContent = pnome;
    partnerAv.textContent = pnome.slice(0, 2).toUpperCase();
    partnerAv.classList.add('partner-color');
  }
}

function setupDesconectar() {
  const btnDesc    = document.getElementById('btn-desconectar');
  const modal      = document.getElementById('modal-desconectar');
  const btnClose   = document.getElementById('modal-desconectar-close');
  const btnCancel  = document.getElementById('btn-cancelar-desconectar');
  const btnConfirm = document.getElementById('btn-confirmar-desconectar');
  if (!btnDesc) return;
  btnDesc.addEventListener('click', () => modal.classList.add('open'));
  btnClose.addEventListener('click', () => modal.classList.remove('open'));
  btnCancel.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  btnConfirm.addEventListener('click', async () => {
    btnConfirm.disabled = true; btnConfirm.textContent = 'Desconectando...';
    const { error } = await supabaseClient
      .from('couple_members').delete()
      .eq('couple_id', coupleId).eq('user_id', currentUser.id);
    if (error) {
      showToast('Erro: ' + error.message);
      btnConfirm.disabled = false; btnConfirm.textContent = 'Sim, desconectar';
      return;
    }
    modal.classList.remove('open');
    showToast('Desconectado do casal.');
    setTimeout(() => { window.location.href = 'conectar.html'; }, 1200);
  });
}

function setupAlterarSenha() {
  const btn      = document.getElementById('btn-alterar-senha');
  const modal    = document.getElementById('modal-senha');
  const btnClose = document.getElementById('modal-senha-close');
  const form     = document.getElementById('form-senha');
  const errEl    = document.getElementById('senha-error');
  if (!btn) return;
  btn.addEventListener('click', () => { errEl.textContent = ''; modal.classList.add('open'); });
  btnClose.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nova      = document.getElementById('nova-senha').value;
    const confirmar = document.getElementById('confirmar-senha').value;
    errEl.textContent = '';
    if (nova.length < 6) { errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'; return; }
    if (nova !== confirmar) { errEl.textContent = 'As senhas nao coincidem.'; return; }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true; submitBtn.textContent = 'Salvando...';
    const { error } = await supabaseClient.auth.updateUser({ password: nova });
    submitBtn.disabled = false; submitBtn.textContent = 'Salvar nova senha';
    if (error) { errEl.textContent = 'Erro: ' + error.message; return; }
    modal.classList.remove('open');
    form.reset();
    showToast('Senha alterada com sucesso!');
  });
}

function setupLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
