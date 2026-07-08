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

const filters = document.querySelectorAll('.filter');
const cards = document.querySelectorAll('.place-card');
const btnAdd = document.getElementById('btn-add-place');

filters.forEach(filter => {
  filter.addEventListener('click', () => {
    filters.forEach(f => f.classList.remove('active'));
    filter.classList.add('active');

    const value = filter.dataset.filter;

    cards.forEach(card => {
      if(value === 'todos' || card.dataset.category === value){
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

btnAdd.addEventListener('click', () => {
  alert('Aqui vai abrir o formulário de adicionar lugar. Podemos criar essa tela depois.');
});