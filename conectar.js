let currentUserId = null;
let myCoupleId = null;
let pollingTimer = null;
let isRedirecting = false;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  await supabaseClient.from('profiles').upsert(
    { id: currentUserId, name: session.user.email.split('@')[0] },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  const { data: member } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUserId).maybeSingle();
  if (member?.couple_id) { window.location.href = 'index.html'; return; }

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

async function gerarCodigoUnico() {
  // Tenta até 5 vezes garantir unicidade
  for (let i = 0; i < 5; i++) {
    const code = gerarCodigoAleatorio();
    const { data } = await supabaseClient
      .from('couples').select('id').eq('invite_code', code).maybeSingle();
    if (!data) return code; // não existe, pode usar
  }
  throw new Error('Não foi possível gerar código único. Tente novamente.');
}

async function limparCasalAnterior() {
  if (!myCoupleId) return;
  // Apaga membros ANTES do casal (respeita FK)
  await supabaseClient.from('couple_members').delete()
    .eq('couple_id', myCoupleId).eq('user_id', currentUserId);
  // Só apaga o casal se ficou sem membros
  const { data: restantes } = await supabaseClient
    .from('couple_members').select('id').eq('couple_id', myCoupleId);
  if (!restantes || restantes.length === 0) {
    await supabaseClient.from('couples').delete().eq('id', myCoupleId);
  }
  myCoupleId = null;
  stopPolling();
}

function setupCriarCodigo() {
  const btn = document.getElementById('btn-gerar-codigo');
  const codeBox = document.getElementById('code-box');
  const codeValue = document.getElementById('code-value');
  const codeHint = document.querySelector('.code-hint');
  const errorEl = document.getElementById('gerar-error');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Gerando...';
    if (errorEl) errorEl.classList.remove('show');

    try {
      await limparCasalAnterior();

      const code = await gerarCodigoUnico();

      const { data: couple, error: coupleError } = await supabaseClient
        .from('couples').insert({ invite_code: code }).select().single();

      if (coupleError) throw new Error('Erro ao criar código: ' + coupleError.message);

      const { error: memberError } = await supabaseClient
        .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

      if (memberError) {
        // Limpa o casal recém-criado se falhou ao inserir membro
        await supabaseClient.from('couples').delete().eq('id', couple.id);
        throw new Error('Erro ao registrar: ' + memberError.message);
      }

      myCoupleId = couple.id;
      codeValue.textContent = code;
      codeBox.classList.remove('hidden');
      btn.textContent = 'Gerar novo código';
      btn.disabled = false;
      if (codeHint) codeHint.textContent = 'Aguardando seu par entrar com este código...';

      startPolling(myCoupleId);

    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('show'); }
      btn.disabled = false;
      btn.textContent = 'Gerar código';
    }
  });
}

function startPolling(coupleId) {
  stopPolling();
  let tentativas = 0;
  const MAX = 100; // ~5 minutos

  pollingTimer = setInterval(async () => {
    if (isRedirecting) return;
    if (document.hidden) return; // pausa se app em background (iOS)
    tentativas++;
    if (tentativas > MAX) {
      stopPolling();
      const hint = document.querySelector('.code-hint');
      if (hint) hint.textContent = 'Tempo esgotado. Gere um novo código.';
      return;
    }

    const { data: members, error } = await supabaseClient
      .from('couple_members').select('user_id').eq('couple_id', coupleId);

    if (error) return; // falha de rede, tenta de novo

    if (members && members.length >= 2) {
      stopPolling();
      isRedirecting = true;
      window.location.href = 'index.html';
    }
  }, 3000);
}

function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
}

window.addEventListener('pagehide', stopPolling);
window.addEventListener('beforeunload', stopPolling);

function setupEntrarCodigo() {
  const btn = document.getElementById('btn-entrar-codigo');
  const input = document.getElementById('input-codigo');
  const errorEl = document.getElementById('codigo-error');

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    errorEl.classList.remove('show');
  });

  btn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    errorEl.classList.remove('show');

    if (code.length < 4) {
      errorEl.textContent = 'Digite o código completo.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Conectando...';

    // Busca o casal pelo código
    const { data: couple, error: findError } = await supabaseClient
      .from('couples').select('id').eq('invite_code', code).maybeSingle();

    if (findError || !couple) {
      errorEl.textContent = 'Código inválido. Verifique e tente novamente.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    // Verifica se já é membro deste casal
    const { data: jaMembro } = await supabaseClient
      .from('couple_members').select('id')
      .eq('couple_id', couple.id).eq('user_id', currentUserId).maybeSingle();

    if (jaMembro) {
      window.location.href = 'index.html';
      return;
    }

    // Verifica se o usuário já pertence a OUTRO casal
    const { data: membroOutro } = await supabaseClient
      .from('couple_members').select('couple_id').eq('user_id', currentUserId).maybeSingle();

    if (membroOutro?.couple_id) {
      errorEl.textContent = 'Você já está conectado a um casal. Desconecte-se primeiro no Perfil.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    // Verifica limite de 2 membros
    const { data: existingMembers } = await supabaseClient
      .from('couple_members').select('user_id').eq('couple_id', couple.id);

    if (existingMembers && existingMembers.length >= 2) {
      errorEl.textContent = 'Este casal já está completo.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    // Verifica se não está tentando entrar no próprio casal
    if (existingMembers && existingMembers.some(m => m.user_id === currentUserId)) {
      window.location.href = 'index.html';
      return;
    }

    const { error: memberError } = await supabaseClient
      .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

    if (memberError) {
      errorEl.textContent = 'Erro ao conectar: ' + memberError.message;
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    window.location.href = 'index.html';
  });
}

init();
