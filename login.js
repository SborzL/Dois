// ── elementos ───────────────────────────────────────────────────────────────
const tabsRow      = document.getElementById('tabs-row');
const tabEntrar    = document.getElementById('tab-entrar');
const tabCriar     = document.getElementById('tab-criar');
const formEntrar   = document.getElementById('form-entrar');
const formCriar    = document.getElementById('form-criar');
const successPanel = document.getElementById('success-panel');
const forgotPanel  = document.getElementById('forgot-panel');

// ── mostrar painel ──────────────────────────────────────────────────────
function showPanel(name) {
  formEntrar.classList.add('hidden');
  formCriar.classList.add('hidden');
  successPanel.classList.add('hidden');
  forgotPanel.classList.add('hidden');
  tabsRow.style.display = (name === 'entrar' || name === 'criar') ? '' : 'none';
  document.getElementById('hero-sub').style.display = (name === 'entrar' || name === 'criar') ? '' : 'none';

  if (name === 'entrar') {
    formEntrar.classList.remove('hidden');
    tabEntrar.classList.add('active'); tabEntrar.setAttribute('aria-selected','true');
    tabCriar.classList.remove('active'); tabCriar.setAttribute('aria-selected','false');
  } else if (name === 'criar') {
    formCriar.classList.remove('hidden');
    tabCriar.classList.add('active'); tabCriar.setAttribute('aria-selected','true');
    tabEntrar.classList.remove('active'); tabEntrar.setAttribute('aria-selected','false');
  } else if (name === 'success') {
    successPanel.classList.remove('hidden');
  } else if (name === 'forgot') {
    forgotPanel.classList.remove('hidden');
  }
}

tabEntrar.addEventListener('click', () => showPanel('entrar'));
tabCriar.addEventListener('click',  () => showPanel('criar'));

// ── helpers ──────────────────────────────────────────────────────────────
function showErr(id, show) {
  document.getElementById(id).classList.toggle('show', show);
}
function setFeedback(id, msg, isError) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'form-feedback ' + (isError ? 'fb-error' : 'fb-ok') + (msg ? ' show' : '');
}
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function setLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Aguarde...' : label;
}

// ── ver/ocultar senha ─────────────────────────────────────────────────────
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = document.getElementById(btn.dataset.target);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.textContent = show ? '🙈' : '👁️';
  });
});

// ── forca da senha ─────────────────────────────────────────────────────────
const STRENGTH = [
  { label: 'Muito fraca', color: '#ef4444', w: 20 },
  { label: 'Fraca',       color: '#f97316', w: 40 },
  { label: 'Média',       color: '#eab308', w: 65 },
  { label: 'Forte',       color: '#22c55e', w: 85 },
  { label: 'Muito forte', color: '#16a34a', w: 100 },
];
function pwScore(pw) {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const cSenha = document.getElementById('c-senha');
cSenha.addEventListener('input', () => {
  const pw = cSenha.value;
  const wrap = document.getElementById('pw-strength');
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const sc = pwScore(pw);
  const st = STRENGTH[sc];
  const fill = document.getElementById('pw-bar-fill');
  fill.style.width = st.w + '%';
  fill.style.background = st.color;
  document.getElementById('pw-label').textContent = st.label;
  document.getElementById('pw-label').style.color = st.color;
});

// ── FORM ENTRAR ────────────────────────────────────────────────────────────
formEntrar.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('e-email').value.trim();
  const senha = document.getElementById('e-senha').value;
  let valid = true;
  if (!validEmail(email)) { showErr('e-email-err', true); valid = false; } else showErr('e-email-err', false);
  if (senha.length < 6)   { showErr('e-senha-err', true); valid = false; } else showErr('e-senha-err', false);
  if (!valid) return;

  const btn = document.getElementById('e-submit');
  setLoading(btn, true, 'Entrar');
  setFeedback('e-feedback', '', false);

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

  if (error) {
    const msg = error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : error.message;
    setFeedback('e-feedback', msg, true);
    setLoading(btn, false, 'Entrar');
    return;
  }

  const { data: memberData } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', data.user.id).maybeSingle();
  window.location.href = memberData?.couple_id ? 'index.html' : 'conectar.html';
});

// ── FORM CRIAR CONTA ─────────────────────────────────────────────────────
formCriar.addEventListener('submit', async e => {
  e.preventDefault();
  const nome     = document.getElementById('c-nome').value.trim();
  const email    = document.getElementById('c-email').value.trim();
  const senha    = document.getElementById('c-senha').value;
  const confirma = document.getElementById('c-confirma').value;
  let valid = true;

  if (nome.length < 2)       { showErr('c-nome-err', true); valid = false; }    else showErr('c-nome-err', false);
  if (!validEmail(email))    { showErr('c-email-err', true); valid = false; }   else showErr('c-email-err', false);
  if (senha.length < 6)      { showErr('c-senha-err', true); valid = false; }   else showErr('c-senha-err', false);
  if (senha !== confirma)    { showErr('c-confirma-err', true); valid = false; } else showErr('c-confirma-err', false);
  if (!valid) return;

  const btn = document.getElementById('c-submit');
  setLoading(btn, true, 'Criar minha conta');
  setFeedback('c-feedback', '', false);

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: senha,
    options: {
      data: { full_name: nome },
      emailRedirectTo: window.location.origin + '/email-confirmado.html'
    }
  });

  if (error) {
    setFeedback('c-feedback', error.message, true);
    setLoading(btn, false, 'Criar minha conta');
    return;
  }

  if (data?.user) {
    await supabaseClient.from('profiles').upsert(
      { id: data.user.id, name: nome },
      { onConflict: 'id' }
    );
  }

  // mostra tela de sucesso
  document.getElementById('success-email').textContent = email;
  showPanel('success');
});

// Voltar para login / reenviar
document.getElementById('success-back-btn').addEventListener('click', () => showPanel('entrar'));
document.getElementById('resend-btn').addEventListener('click', async () => {
  const email = document.getElementById('c-email').value.trim();
  if (!email) return;
  const btn = document.getElementById('resend-btn');
  btn.textContent = 'Enviando...';
  btn.disabled = true;
  await supabaseClient.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin + '/email-confirmado.html' } });
  btn.textContent = 'E-mail reenviado! ✓';
  setTimeout(() => { btn.textContent = 'Não recebi o e-mail — reenviar'; btn.disabled = false; }, 4000);
});

// ── ESQUECI A SENHA ───────────────────────────────────────────────────────────
document.getElementById('btn-forgot').addEventListener('click', () => showPanel('forgot'));
document.getElementById('forgot-back').addEventListener('click', () => showPanel('entrar'));

document.getElementById('f-submit').addEventListener('click', async () => {
  const email = document.getElementById('f-email').value.trim();
  if (!validEmail(email)) { showErr('f-email-err', true); return; }
  showErr('f-email-err', false);
  const btn = document.getElementById('f-submit');
  setLoading(btn, true, 'Enviar link de recuperação');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/email-confirmado.html'
  });
  setLoading(btn, false, 'Enviar link de recuperação');
  if (error) {
    setFeedback('f-feedback', error.message, true);
  } else {
    setFeedback('f-feedback', '✅ Link enviado! Verifique sua caixa de entrada.', false);
    btn.disabled = true;
  }
});

// ── GOOGLE ─────────────────────────────────────────────────────────────────
document.getElementById('btn-google').addEventListener('click', async () => {
  const btn = document.getElementById('btn-google');
  btn.disabled = true;
  btn.textContent = 'Redirecionando...';
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/index.html' }
  });
  if (error) {
    setFeedback('e-feedback', 'Erro ao entrar com Google: ' + error.message, true);
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11.2-3.9-13-9.3l-6.6 5.1C7.7 37.5 15.2 42 24 42c9.9 0 18.3-6.7 20.7-15.8.3-1.2.5-2.5.5-3.8 0-1.3-.2-2.6-.6-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 19 13 24 13c3 0 5.7 1 7.8 2.8l6-6C34.4 6.9 29.5 5 24 5c-7.7 0-14.3 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 42c5.2 0 9.9-1.7 13.5-4.7l-6.2-5.1c-2 1.4-4.6 2.2-7.3 2.2-5.3 0-9.7-2.6-11.6-6.9l-6.6 5.1C9.5 37.6 16.1 42 24 42z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.7-2.9 4.9-5.4 6.2l6.2 5.1C39.9 36.2 44 30.8 44 24c0-1.3-.2-2.6-.4-3.5z"/></svg> Continuar com Google`;
  }
});
