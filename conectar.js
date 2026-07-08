let currentUserId = null;
let myCoupleId = null;
let pollingTimer = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  // Garante que o perfil existe
  await supabaseClient.from('profiles').upsert({
    id: currentUserId,
    name: session.user.email.split('@')[0]
  }, { onConflict: 'id', ignoreDuplicates: true });

  // Se ja tem casal, vai direto para o app
  const { data: member } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUserId).maybeSingle();
  if (member?.couple_id) {
    window.location.href = 'index.html';
    return;
  }

  setupTabs();
  setupCriarCodigo();
  setupEntrarCodigo();
}

function setupTabs() {
  const tabCriar = document.getElementById('tab-criar-codigo');
  const tabTenho = document.getElementById('tab-tenho-codigo');
  const panelCriar = document.getElementById('panel-criar');
  const panelEntrar = document.getElementById('panel-entrar');

  tabCriar.addEventListener('click', () => {
    tabCriar.classList.add('active'); tabTenho.classList.remove('active');
    tabCriar.setAttribute('aria-selected', 'true'); tabTenho.setAttribute('aria-selected', 'false');
    panelCriar.classList.remove('hidden'); panelEntrar.classList.add('hidden');
  });

  tabTenho.addEventListener('click', () => {
    tabTenho.classList.add('active'); tabCriar.classList.remove('active');
    tabTenho.setAttribute('aria-selected', 'true'); tabCriar.setAttribute('aria-selected', 'false');
    panelEntrar.classList.remove('hidden'); panelCriar.classList.add('hidden');
    stopPolling();
  });
}

function gerarCodigoAleatorio() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function setupCriarCodigo() {
  const btn = document.getElementById('btn-gerar-codigo');
  const codeBox = document.getElementById('code-box');
  const codeValue = document.getElementById('code-value');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Gerando...';

    // Se ja criou um casal antes nesta sessao, remove-o para evitar duplicatas
    if (myCoupleId) {
      await supabaseClient.from('couple_members').delete().eq('couple_id', myCoupleId).eq('user_id', currentUserId);
      await supabaseClient.from('couples').delete().eq('id', myCoupleId);
      myCoupleId = null;
      stopPolling();
    }

    const code = gerarCodigoAleatorio();

    const { data: couple, error: coupleError } = await supabaseClient
      .from('couples').insert({ invite_code: code }).select().single();

    if (coupleError) {
      showError('Erro ao criar código: ' + coupleError.message);
      btn.disabled = false; btn.textContent = 'Gerar código';
      return;
    }

    const { error: memberError } = await supabaseClient
      .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

    if (memberError) {
      showError('Erro ao registrar membro: ' + memberError.message);
      btn.disabled = false; btn.textContent = 'Gerar código';
      return;
    }

    myCoupleId = couple.id;
    codeValue.textContent = code;
    codeBox.classList.remove('hidden');
    btn.textContent = 'Aguardando seu par...';

    startPolling(myCoupleId);
  });
}

function startPolling(coupleId) {
  stopPolling();
  pollingTimer = setInterval(async () => {
    const { data: members } = await supabaseClient
      .from('couple_members').select('user_id').eq('couple_id', coupleId);

    if (members && members.length >= 2) {
      stopPolling();
      window.location.href = 'index.html';
    }
  }, 3000);
}

function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

// Para o polling se o usuario fechar/sair da pagina
window.addEventListener('pagehide', stopPolling);
window.addEventListener('beforeunload', stopPolling);

function setupEntrarCodigo() {
  const btn = document.getElementById('btn-entrar-codigo');
  const input = document.getElementById('input-codigo');
  const errorEl = document.getElementById('codigo-error');

  // Formata o input automaticamente para maiusculas
  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });

  btn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    errorEl.classList.remove('show');

    if (code.length < 4) {
      errorEl.textContent = 'Digite o código completo.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true; btn.textContent = 'Conectando...';

    const { data: couple, error: findError } = await supabaseClient
      .from('couples').select('id').eq('invite_code', code).maybeSingle();

    if (findError || !couple) {
      errorEl.textContent = 'Código inválido. Verifique e tente novamente.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Conectar';
      return;
    }

    // Verifica se este usuario ja e membro deste casal
    const { data: jaMembro } = await supabaseClient
      .from('couple_members').select('id')
      .eq('couple_id', couple.id).eq('user_id', currentUserId).maybeSingle();

    if (jaMembro) {
      window.location.href = 'index.html';
      return;
    }

    // Verifica se casal ja tem 2 membros
    const { data: existingMembers } = await supabaseClient
      .from('couple_members').select('id').eq('couple_id', couple.id);

    if (existingMembers && existingMembers.length >= 2) {
      errorEl.textContent = 'Este casal já está completo.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Conectar';
      return;
    }

    const { error: memberError } = await supabaseClient
      .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

    if (memberError) {
      errorEl.textContent = 'Erro ao conectar: ' + memberError.message;
      errorEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Conectar';
      return;
    }

    window.location.href = 'index.html';
  });
}

function showError(msg) {
  const el = document.getElementById('codigo-error');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

init();
