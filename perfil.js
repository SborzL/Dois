let currentUser = null;
let coupleId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: member } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  coupleId = member?.couple_id || null;

  await renderAll();
  setupAccount();
  setupSecurity();
  setupLogout();
  setupDesconectar();
}

async function renderAll() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('state-account').style.display = 'block';

  // Carrega perfil do usuário logado
  const { data: myProfile } = await supabaseClient
    .from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
  const myName = myProfile?.name || currentUser.email.split('@')[0];
  const myInitial = myName.charAt(0).toUpperCase();

  document.getElementById('profile-name').value = myName;
  document.getElementById('account-name').textContent = myName;
  document.getElementById('account-email').textContent = currentUser.email;
  document.getElementById('account-avatar').textContent = myInitial;

  if (coupleId) {
    await renderConnected(myName, myInitial);
  } else {
    document.getElementById('state-no-couple').style.display = 'block';
  }
}

async function renderConnected(myName, myInitial) {
  document.getElementById('state-connected').style.display = 'block';

  // Busca código do casal
  const { data: couple } = await supabaseClient
    .from('couples').select('invite_code').eq('id', coupleId).maybeSingle();
  const code = couple?.invite_code || '------';
  document.getElementById('invite-code-display').textContent = code;

  // Avatar e nome próprio
  document.getElementById('avatar-me').textContent = myInitial;
  document.getElementById('name-me').textContent = myName.split(' ')[0];

  // Busca o parceiro
  const { data: members } = await supabaseClient
    .from('couple_members').select('user_id').eq('couple_id', coupleId);

  const partnerId = members?.find(m => m.user_id !== currentUser.id)?.user_id;

  if (partnerId) {
    const { data: partnerProfile } = await supabaseClient
      .from('profiles').select('name').eq('id', partnerId).maybeSingle();
    const partnerName = partnerProfile?.name || 'Parceiro(a)';
    document.getElementById('avatar-partner').textContent = partnerName.charAt(0).toUpperCase();
    document.getElementById('name-partner').textContent = partnerName.split(' ')[0];
  } else {
    document.getElementById('avatar-partner').textContent = '?';
    document.getElementById('name-partner').textContent = 'Aguardando...';
  }

  // Botão copiar código
  document.getElementById('copy-code-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Código copiado!');
    } catch {
      showToast('Código: ' + code);
    }
  });
}

function setupAccount() {
  document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const { error } = await supabaseClient
      .from('profiles').upsert({ id: currentUser.id, name }, { onConflict: 'id' });

    btn.disabled = false;
    btn.textContent = 'Salvar';

    if (error) {
      showToast('Erro: ' + error.message);
    } else {
      document.getElementById('account-name').textContent = name;
      // Atualiza inicial dos avatares
      const initial = name.charAt(0).toUpperCase();
      document.getElementById('account-avatar').textContent = initial;
      document.getElementById('avatar-me').textContent = initial;
      document.getElementById('name-me').textContent = name.split(' ')[0];
      showToast('Nome salvo!');
    }
  });
}

function setupSecurity() {
  const btn = document.getElementById('btn-reset-senha');
  const hint = document.getElementById('reset-hint');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    hint.textContent = '';

    const { error } = await supabaseClient.auth.resetPasswordForEmail(currentUser.email, {
      redirectTo: window.location.origin + '/login.html'
    });

    btn.disabled = false;
    btn.textContent = '🔐 Enviar link de redefinição de senha';

    if (error) {
      hint.textContent = 'Erro: ' + error.message;
    } else {
      hint.textContent = 'Email enviado para ' + currentUser.email;
      showToast('Email de redefinição enviado!');
    }
  });
}

function setupLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });
}

function setupDesconectar() {
  const btnAbrir = document.getElementById('btn-desconectar');
  const modal = document.getElementById('modal-desconectar');
  const btnCancelar = document.getElementById('btn-cancel-desconectar');
  const btnConfirmar = document.getElementById('btn-confirm-desconectar');

  if (!btnAbrir) return;

  btnAbrir.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  btnCancelar.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  btnConfirmar.addEventListener('click', async () => {
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Desconectando...';

    // Remove o usuário do couple_members
    const { error } = await supabaseClient
      .from('couple_members').delete().eq('user_id', currentUser.id);

    if (error) {
      showToast('Erro ao desconectar: ' + error.message);
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Desconectar';
      modal.style.display = 'none';
      return;
    }

    // Se o casal ficou vazio, apaga o casal também
    if (coupleId) {
      const { data: restantes } = await supabaseClient
        .from('couple_members').select('id').eq('couple_id', coupleId);
      if (!restantes || restantes.length === 0) {
        await supabaseClient.from('couples').delete().eq('id', coupleId);
      }
    }

    window.location.href = 'conectar.html';
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
