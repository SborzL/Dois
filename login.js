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
  tabEntrar.setAttribute('aria-selected', entrar);
  tabCriar.setAttribute('aria-selected', !entrar);
}

tabEntrar.addEventListener('click', () => setActiveTab(true));
tabCriar.addEventListener('click', () => setActiveTab(false));
linkCriar.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(false); });

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  let valid = true;

  if (!emailInput.value.includes('@')) {
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
      email: emailInput.value,
      password: senhaInput.value
    });

    if (error) {
      alert('Erro ao criar conta: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    // Cria perfil automaticamente apos o cadastro
    if (data?.user) {
      await supabaseClient.from('profiles').upsert({
        id: data.user.id,
        name: emailInput.value.split('@')[0]
      });
    }

    // Redireciona direto — Supabase nao exige confirmacao por padrao
    window.location.href = 'conectar.html';
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailInput.value,
      password: senhaInput.value
    });

    if (error) {
      alert('Erro ao entrar: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    // Verifica se o usuario ja tem casal vinculado
    const { data: memberData } = await supabaseClient
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (memberData?.couple_id) {
      window.location.href = 'index.html';
    } else {
      window.location.href = 'conectar.html';
    }
  }
});
