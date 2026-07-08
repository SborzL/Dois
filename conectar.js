let currentUserId = null;
let myCoupleId = null; // casal criado por este usuário enquanto aguarda
let pollingTimer = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  // Se já tem casal, vai direto para o app
  const { data: member } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUserId).single();
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
    // Para o polling se trocar de aba
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

    // Inicia polling: verifica a cada 3s se o par entrou
    startPolling(myCoupleId);
  });
}

function startPolling(coupleId) {
  stopPolling(); // garante que não haja dois timers
  pollingTimer = setInterval(async () => {
    const { data: members } = await supabaseClient
      .from('couple_members').select('user_id').eq('couple_id', coupleId);

    if (members && members.length >= 2) {
      stopPolling();
      // Par conectado! Vai para o app
      window.location.href = 'index.html';
    }
  }, 3000);
}

function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

function setupEntrarCodigo() {
  const btn = document.getElementById('btn-entrar-codigo');
  const input = document.getElementById('input-codigo');
  const errorEl = document.getElementById('codigo-error');

  btn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    errorEl.classList.remove('show');

    if (code.length < 4) {
      errorEl.textContent = 'Digite o código completo.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true; btn.textContent = 'Conectando...';

    // Busca o casal pelo código
    const { data: couple, error: findError } = await supabaseClient
      .from('couples').select('id').eq('invite_code', code).single();

    if (findError || !couple) {
      errorEl.textContent = 'Código inválido. Verifique e tente novamente.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Conectar';
      return;
    }

    // Verifica se este usuário já é membro deste casal
    const { data: jaMembro } = await supabaseClient
      .from('couple_members').select('id')
      .eq('couple_id', couple.id).eq('user_id', currentUserId).single();

    if (jaMembro) {
      // Já é membro, vai direto
      window.location.href = 'index.html';
      return;
    }

    // Verifica se casal já tem 2 membros
    const { data: existingMembers } = await supabaseClient
      .from('couple_members').select('id').eq('couple_id', couple.id);

    if (existingMembers && existingMembers.length >= 2) {
      errorEl.textContent = 'Este casal já está completo.';
      errorEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Conectar';
      return;
    }

    // Entra no casal
    const { error: memberError } = await supabaseClient
      .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

    if (memberError) {
      errorEl.textContent = 'Erro ao conectar: ' + memberError.message;
      errorEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Conectar';
      return;
    }

    // Sucesso — vai para o app
    window.location.href = 'index.html';
  });
}

function showError(msg) {
  const el = document.getElementById('codigo-error');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

init();
