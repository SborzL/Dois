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
  const tabCriar  = document.getElementById('tab-criar-codigo');
  const tabTenho  = document.getElementById('tab-tenho-codigo');
  const panelCriar  = document.getElementById('panel-criar');
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

async function criarCodigoUnico() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    const { data: couple, error } = await supabaseClient
      .from('couples').insert({ invite_code: code }).select().single();
    if (!error && couple) return couple;
    if (error && !error.message.includes('unique')) throw error;
  }
  throw new Error('Nao foi possivel gerar um codigo unico. Tente novamente.');
}

async function limparCasalPendente() {
  if (!myCoupleId) return;
  try {
    await supabaseClient.from('couple_members').delete()
      .eq('couple_id', myCoupleId).eq('user_id', currentUserId);
    const { data: members } = await supabaseClient
      .from('couple_members').select('id').eq('couple_id', myCoupleId);
    if (!members || members.length === 0) {
      await supabaseClient.from('couples').delete().eq('id', myCoupleId);
    }
  } catch (_) {}
  myCoupleId = null;
  stopPolling();
}

function setupCriarCodigo() {
  const btn       = document.getElementById('btn-gerar-codigo');
  const codeBox   = document.getElementById('code-box');
  const codeValue = document.getElementById('code-value');
  const hint      = document.getElementById('code-hint');

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Gerando...';
    showError('');

    await limparCasalPendente();

    let couple;
    try {
      couple = await criarCodigoUnico();
    } catch (err) {
      showError(err.message || 'Erro ao criar codigo.');
      btn.disabled = false;
      btn.textContent = 'Gerar codigo';
      return;
    }

    const { error: memberError } = await supabaseClient
      .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

    if (memberError) {
      await supabaseClient.from('couples').delete().eq('id', couple.id);
      showError('Erro ao registrar: ' + memberError.message);
      btn.disabled = false;
      btn.textContent = 'Gerar codigo';
      return;
    }

    myCoupleId = couple.id;
    codeValue.textContent = couple.invite_code;
    codeBox.classList.remove('hidden');
    btn.textContent = 'Aguardando parceiro(a)...';
    if (hint) hint.textContent = 'Envie este codigo para seu(sua) parceiro(a) entrar.';

    const copyBtn = document.getElementById('btn-copiar-codigo');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(couple.invite_code);
          copyBtn.textContent = 'Copiado!';
          setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
        } catch {
          copyBtn.textContent = couple.invite_code;
        }
      };
    }

    startPolling(myCoupleId);
  });
}

function startPolling(coupleId) {
  stopPolling();
  let tentativas = 0;
  pollingTimer = setInterval(async () => {
    if (isRedirecting) return;
    tentativas++;
    if (tentativas > 200) {
      stopPolling();
      showError('Tempo esgotado. Gere um novo codigo.');
      const btn = document.getElementById('btn-gerar-codigo');
      if (btn) { btn.disabled = false; btn.textContent = 'Gerar novo codigo'; }
      return;
    }
    const { data: members, error } = await supabaseClient
      .from('couple_members').select('user_id').eq('couple_id', coupleId);
    if (error) return;
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

window.addEventListener('pagehide', () => { stopPolling(); });
window.addEventListener('beforeunload', () => { stopPolling(); });

function setupEntrarCodigo() {
  const btn     = document.getElementById('btn-entrar-codigo');
  const input   = document.getElementById('input-codigo');
  const errorEl = document.getElementById('codigo-error');

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    errorEl.classList.remove('show');
  });

  btn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    errorEl.classList.remove('show');

    if (code.length < 6) {
      errorEl.textContent = 'O codigo tem 6 caracteres. Verifique.';
      errorEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Conectando...';

    const { data: couple, error: findError } = await supabaseClient
      .from('couples').select('id').eq('invite_code', code).maybeSingle();

    if (findError || !couple) {
      errorEl.textContent = 'Codigo invalido. Verifique e tente novamente.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    const { data: jaMembro } = await supabaseClient
      .from('couple_members').select('id')
      .eq('couple_id', couple.id).eq('user_id', currentUserId).maybeSingle();
    if (jaMembro) { window.location.href = 'index.html'; return; }

    const { data: existingMembers } = await supabaseClient
      .from('couple_members').select('id').eq('couple_id', couple.id);
    if (existingMembers && existingMembers.length >= 2) {
      errorEl.textContent = 'Este casal ja esta completo.';
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    const { error: memberError } = await supabaseClient
      .from('couple_members').insert({ couple_id: couple.id, user_id: currentUserId });

    if (memberError) {
      if (memberError.code === '23505' || memberError.message.includes('unique')) {
        const { data: retry } = await supabaseClient
          .from('couple_members').select('id')
          .eq('couple_id', couple.id).eq('user_id', currentUserId).maybeSingle();
        if (retry) { window.location.href = 'index.html'; return; }
      }
      errorEl.textContent = 'Erro ao conectar: ' + memberError.message;
      errorEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Conectar';
      return;
    }

    window.location.href = 'index.html';
  });
}

function showError(msg) {
  const el = document.getElementById('codigo-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

init();
