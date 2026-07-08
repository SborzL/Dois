let currentUser = null;
let coupleId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  // maybeSingle evita erro 406 se nao houver registro
  const { data: m } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
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
    .from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
  document.getElementById('profile-name').value = p?.name || '';
  document.getElementById('profile-email').textContent = currentUser.email;
}

function setupSaveProfile() {
  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const { error } = await supabaseClient
      .from('profiles')
      .upsert({ id: currentUser.id, name }, { onConflict: 'id' });

    btn.disabled = false;
    btn.textContent = 'Salvar';

    if (error) {
      showToast('Erro ao salvar: ' + error.message);
    } else {
      showToast('Nome salvo!');
    }
  });
}

async function loadCoupleInfo() {
  const { data: couple } = await supabaseClient
    .from('couples').select('invite_code').eq('id', coupleId).maybeSingle();
  const { data: members } = await supabaseClient
    .from('couple_members').select('user_id').eq('couple_id', coupleId);

  const codeEl = document.getElementById('invite-code-display');
  if (codeEl) codeEl.textContent = couple?.invite_code || '---';

  const n = members?.length || 1;
  const countEl = document.getElementById('member-count');
  if (countEl) countEl.textContent =
    `${n} membro${n !== 1 ? 's' : ''} conectado${n !== 1 ? 's' : ''}`;

  const copyBtn = document.getElementById('copy-code-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(couple?.invite_code || '');
        showToast('Código copiado!');
      } catch {
        // fallback para dispositivos sem clipboard API
        showToast('Código: ' + (couple?.invite_code || '---'));
      }
    });
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
