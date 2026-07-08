const tabEntrar = document.getElementById('tab-entrar');
const tabCriar = document.getElementById('tab-criar');
const linkCriar = document.getElementById('link-criar');
const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const emailError = document.getElementById('email-error');
const senhaError = document.getElementById('senha-error');

function setActiveTab(entrar) {
  tabEntrar.classList.toggle('active', entrar);
  tabCriar.classList.toggle('active', !entrar);
  tabEntrar.setAttribute('aria-selected', String(entrar));
  tabCriar.setAttribute('aria-selected', String(!entrar));
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = entrar ? 'Entrar' : 'Criar conta';
}

tabEntrar.addEventListener('click', () => setActiveTab(true));
tabCriar.addEventListener('click', () => setActiveTab(false));
linkCriar.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(false); });

// Login com Google
const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
  btnGoogle.addEventListener('click', async () => {
    btnGoogle.disabled = true;
    btnGoogle.textContent = 'Redirecionando...';
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/index.html' }
    });
    if (error) {
      alert('Erro ao entrar com Google: ' + error.message);
      btnGoogle.disabled = false;
      btnGoogle.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11.2-3.9-13-9.3l-6.6 5.1C7.7 37.5 15.2 42 24 42c9.9 0 18.3-6.7 20.7-15.8.3-1.2.5-2.5.5-3.8 0-1.3-.2-2.6-.6-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 19 13 24 13c3 0 5.7 1 7.8 2.8l6-6C34.4 6.9 29.5 5 24 5c-7.7 0-14.3 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 42c5.2 0 9.9-1.7 13.5-4.7l-6.2-5.1c-2 1.4-4.6 2.2-7.3 2.2-5.3 0-9.7-2.6-11.6-6.9l-6.6 5.1C9.5 37.6 16.1 42 24 42z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.7-2.9 4.9-5.4 6.2l6.2 5.1C39.9 36.2 44 30.8 44 24c0-1.3-.2-2.6-.4-3.5z"/></svg> Continuar com Google`;
    }
  });
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  let valid = true;

  const emailVal = emailInput.value.trim();
  if (!emailVal.includes('@') || !emailVal.includes('.')) {
    emailError.classList.add('show');
    valid = false;
  } else {
    emailError.classList.remove('show');
  }

  if (senhaInput.value.length < 6) {
    senhaError.classList.add('show');
    valid = false;
  } else {
    senhaError.classList.remove('show');
  }

  if (!valid) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Aguarde...';

  const isCriarConta = tabCriar.classList.contains('active');

  if (isCriarConta) {
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailVal,
      password: senhaInput.value
    });

    if (error) {
      alert('Erro ao criar conta: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    if (data?.user) {
      await supabaseClient.from('profiles').upsert({
        id: data.user.id,
        name: emailVal.split('@')[0]
      }, { onConflict: 'id' });
    }

    window.location.href = 'conectar.html';
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailVal,
      password: senhaInput.value
    });

    if (error) {
      alert('Erro ao entrar: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    const { data: memberData } = await supabaseClient
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    window.location.href = memberData?.couple_id ? 'index.html' : 'conectar.html';
  }
});
