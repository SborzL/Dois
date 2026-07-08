let currentUser = null;
let coupleId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: m } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUser.id).single();
  coupleId = m?.couple_id || null;

  await loadProfile();
  setupSaveProfile();

  if (coupleId) {
    await loadCoupleInfo();
    document.getElementById('couple-section').style.display = 'block';
    document.getElementById('no-couple-section').style.display = 'none';
  } else {
    document.getElementById('no-couple-section').style.display = 'block';
    document.getElementById('couple-section').style.display = 'none';
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}

async function loadProfile() {
  const { data: p } = await supabaseClient
    .from('profiles').select('name').eq('id', currentUser.id).single();
  document.getElementById('profile-name').value = p?.name || '';
  document.getElementById('profile-email').textContent = currentUser.email;
}

function setupSaveProfile() {
  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) return;
    const { data: existing } = await supabaseClient
      .from('profiles').select('id').eq('id', currentUser.id).single();
    if (existing) {
      await supabaseClient.from('profiles').update({ name }).eq('id', currentUser.id);
    } else {
      await supabaseClient.from('profiles').insert({ id: currentUser.id, name });
    }
    showToast('Nome salvo!');
  });
}

async function loadCoupleInfo() {
  const { data: couple } = await supabaseClient
    .from('couples').select('invite_code').eq('id', coupleId).single();
  const { data: members } = await supabaseClient
    .from('couple_members').select('user_id').eq('couple_id', coupleId);

  document.getElementById('invite-code-display').textContent = couple?.invite_code || '---';
  const n = members?.length || 1;
  document.getElementById('member-count').textContent =
    `${n} membro${n !== 1 ? 's' : ''} conectado${n !== 1 ? 's' : ''}`;

  document.getElementById('copy-code-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(couple?.invite_code || '')
      .then(() => showToast('Código copiado!'));
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
