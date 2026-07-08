// Redireciona para login se não autenticado
supabaseClient.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = 'login.html';
  }
});

const tabCriarCodigo = document.getElementById('tab-criar-codigo');
const tabTenhoCodigo = document.getElementById('tab-tenho-codigo');
const panelCriar = document.getElementById('panel-criar');
const panelEntrar = document.getElementById('panel-entrar');
const btnGerarCodigo = document.getElementById('btn-gerar-codigo');
const codeBox = document.getElementById('code-box');
const codeValue = document.getElementById('code-value');
const btnEntrarCodigo = document.getElementById('btn-entrar-codigo');
const inputCodigo = document.getElementById('input-codigo');
const codigoError = document.getElementById('codigo-error');

// Troca de abas
tabCriarCodigo.addEventListener('click', () => {
  tabCriarCodigo.classList.add('active');
  tabTenhoCodigo.classList.remove('active');
  tabCriarCodigo.setAttribute('aria-selected', 'true');
  tabTenhoCodigo.setAttribute('aria-selected', 'false');
  panelCriar.classList.remove('hidden');
  panelEntrar.classList.add('hidden');
});

tabTenhoCodigo.addEventListener('click', () => {
  tabTenhoCodigo.classList.add('active');
  tabCriarCodigo.classList.remove('active');
  tabTenhoCodigo.setAttribute('aria-selected', 'true');
  tabCriarCodigo.setAttribute('aria-selected', 'false');
  panelEntrar.classList.remove('hidden');
  panelCriar.classList.add('hidden');
});

// Gera código aleatório de 6 caracteres
function gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Criar casal e gerar código
btnGerarCodigo.addEventListener('click', async () => {
  btnGerarCodigo.disabled = true;
  btnGerarCodigo.textContent = 'Gerando...';

  const { data: userData } = await supabaseClient.auth.getUser();
  const userId = userData.user.id;

  const code = gerarCodigo();

  const { data: couple, error: coupleError } = await supabaseClient
    .from('couples')
    .insert({ invite_code: code })
    .select()
    .single();

  if (coupleError) {
    alert('Erro ao criar código: ' + coupleError.message);
    btnGerarCodigo.disabled = false;
    btnGerarCodigo.textContent = 'Gerar código';
    return;
  }

  const { error: memberError } = await supabaseClient
    .from('couple_members')
    .insert({ couple_id: couple.id, user_id: userId });

  if (memberError) {
    alert('Erro ao entrar no casal: ' + memberError.message);
    btnGerarCodigo.disabled = false;
    btnGerarCodigo.textContent = 'Gerar código';
    return;
  }

  codeValue.textContent = code;
  codeBox.classList.remove('hidden');
  btnGerarCodigo.textContent = 'Aguardando seu par...';
});

// Entrar em um casal usando código
btnEntrarCodigo.addEventListener('click', async () => {
  const code = inputCodigo.value.trim().toUpperCase();
  codigoError.classList.remove('show');

  if (code.length < 4) {
    codigoError.textContent = 'Digite o código completo.';
    codigoError.classList.add('show');
    return;
  }

  btnEntrarCodigo.disabled = true;
  btnEntrarCodigo.textContent = 'Conectando...';

  const { data: userData } = await supabaseClient.auth.getUser();
  const userId = userData.user.id;

  const { data: couple, error: findError } = await supabaseClient
    .from('couples')
    .select('id')
    .eq('invite_code', code)
    .single();

  if (findError || !couple) {
    codigoError.textContent = 'Código inválido. Verifique e tente novamente.';
    codigoError.classList.add('show');
    btnEntrarCodigo.disabled = false;
    btnEntrarCodigo.textContent = 'Conectar';
    return;
  }

  const { error: memberError } = await supabaseClient
    .from('couple_members')
    .insert({ couple_id: couple.id, user_id: userId });

  if (memberError) {
    codigoError.textContent = 'Erro ao conectar: ' + memberError.message;
    codigoError.classList.add('show');
    btnEntrarCodigo.disabled = false;
    btnEntrarCodigo.textContent = 'Conectar';
    return;
  }

  window.location.href = 'index.html';
});
