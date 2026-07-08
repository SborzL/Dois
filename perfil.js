let currentUser = null;
let coupleId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).single();
  coupleId = m?.couple_id || null;

  await loadProfile();
  setupSaveProfile();
  if (coupleId) {
    await loadCoupleInfo();
    document.getElementById('no-couple-section').style.display = 'none';
    document.getElementById('couple-section').style.display = 'block';
  } else {
    document.getElementById('no-couple-section').style.display = 'block';
    document.getElementById('couple-section').style.display = 'none';
    setupCoupleActions();
  }
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}

async function loadProfile() {
  const { data: p } = await supabaseClient.from('profiles').select('name').eq('id', currentUser.id).single();
  document.getElementById('profile-name').value = p?.name || '';
  document.getElementById('profile-email').textContent = currentUser.email;
}

function setupSaveProfile() {
  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    const { data: existing } = await supabaseClient.from('profiles').select('id').eq('id', currentUser.id).single();
    if (existing) {
      await supabaseClient.from('profiles').update({ name }).eq('id', currentUser.id);
    } else {
      await supabaseClient.from('profiles').insert({ id: currentUser.id, name });
    }
    showToast('Nome salvo!');
  });
}

async function loadCoupleInfo() {
  const { data: couple } = await supabaseClient.from('couples').select('invite_code').eq('id', coupleId).single();
  const { data: members } = await supabaseClient.from('couple_members').select('user_id').eq('couple_id', coupleId);
  document.getElementById('invite-code-display').textContent = couple?.invite_code || '---';
  document.getElementById('member-count').textContent = `${members?.length || 1} membro${(members?.length || 1) !== 1 ? 's' : ''} no casal`;

  document.getElementById('copy-code-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(couple?.invite_code || '').then(() => showToast('Código copiado!'));
  });
}

function setupCoupleActions() {
  document.getElementById('create-couple-btn').addEventListener('click', async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: c } = await supabaseClient.from('couples').insert({ invite_code: code }).select().single();
    await supabaseClient.from('couple_members').insert({ couple_id: c.id, user_id: currentUser.id });
    showToast('Casal criado! Compartilhe o código.');
    window.location.reload();
  });

  document.getElementById('join-couple-btn').addEventListener('click', async () => {
    const code = document.getElementById('invite-code-input').value.trim().toUpperCase();
    if (!code) return;

    const { data: c } = await supabaseClient.from('couples').select('id').eq('invite_code', code).single();
    if (!c) { showToast('Código inválido.'); return; }

    // Verifica se o casal já tem 2 membros
    const { data: existingMembers } = await supabaseClient
      .from('couple_members')
      .select('id')
      .eq('couple_id', c.id);

    if (existingMembers && existingMembers.length >= 2) {
      showToast('Este casal já está completo.');
      return;
    }

    await supabaseClient.from('couple_members').insert({ couple_id: c.id, user_id: currentUser.id });
    showToast('Você entrou no casal!');
    window.location.reload();
  });
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
