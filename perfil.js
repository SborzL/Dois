supabaseClient.auth.getSession().then(({ data }) => {
  if(!data.session){
    window.location.href = 'login.html';
  }
});

const items = document.querySelectorAll('.today-item');

items.forEach(item => {
  const checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    item.classList.toggle('done', checkbox.checked);
  });
});

document.getElementById('item-editar').addEventListener('click', () => {
  alert('Aqui vai abrir a tela de editar perfil.');
});

document.getElementById('item-notificacoes').addEventListener('click', () => {
  alert('Aqui vai abrir as configurações de notificações.');
});

document.getElementById('item-privacidade').addEventListener('click', () => {
  alert('Aqui vai abrir as configurações de privacidade.');
});

document.getElementById('item-parceiro').addEventListener('click', () => {
  alert('Aqui vai abrir os detalhes do parceiro(a) conectado.');
});

document.getElementById('item-data').addEventListener('click', () => {
  alert('Aqui vai abrir a edição da data de início do relacionamento.');
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  const confirmar = confirm('Tem certeza que quer sair da conta?');
  if(confirmar){
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  }
});