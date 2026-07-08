const tabEntrar = document.getElementById('tab-entrar');
const tabCriar = document.getElementById('tab-criar');
const linkCriar = document.getElementById('link-criar');
const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const emailError = document.getElementById('email-error');
const senhaError = document.getElementById('senha-error');

function setActiveTab(entrar){
  tabEntrar.classList.toggle('active', entrar);
  tabCriar.classList.toggle('active', !entrar);
  tabEntrar.setAttribute('aria-selected', entrar);
  tabCriar.setAttribute('aria-selected', !entrar);
}

tabEntrar.addEventListener('click', () => setActiveTab(true));
tabCriar.addEventListener('click', () => setActiveTab(false));
linkCriar.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(false); });

form.addEventListener('submit', async function(e){
  e.preventDefault();
  let valid = true;

  if(!emailInput.value.includes('@')){
    emailError.classList.add('show');
    valid = false;
  } else {
    emailError.classList.remove('show');
  }

  if(senhaInput.value.length < 6){
    senhaError.classList.add('show');
    valid = false;
  } else {
    senhaError.classList.remove('show');
  }

  if(!valid) return;

  const isCriarConta = tabCriar.classList.contains('active');

  if(isCriarConta){
    const { data, error } = await supabaseClient.auth.signUp({
      email: emailInput.value,
      password: senhaInput.value
    });

    if(error){
      alert('Erro ao criar conta: ' + error.message);
      return;
    }

    alert('Conta criada! Verifique seu e-mail para confirmar, se necessário.');
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailInput.value,
      password: senhaInput.value
    });

    if(error){
      alert('Erro ao entrar: ' + error.message);
      return;
    }

    window.location.href = 'index.html';
  }
});