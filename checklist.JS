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

const headers = document.querySelectorAll('.list-header');

headers.forEach(header => {
  header.addEventListener('click', () => {
    const id = header.dataset.toggle;
    const list = document.getElementById('items-' + id);
    list.classList.toggle('collapsed');
    header.classList.toggle('open');
  });
});

function updateGlobalProgress(){
  const allItems = document.querySelectorAll('.item input[type="checkbox"]');
  const doneItems = document.querySelectorAll('.item input[type="checkbox"]:checked');
  const total = allItems.length;
  const done = doneItems.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('progress-text').textContent = done + ' de ' + total + ' itens concluídos';
  document.getElementById('progress-label').textContent = percent + '% completo';
  document.getElementById('progress-fill').style.width = percent + '%';
}

document.querySelectorAll('.item').forEach(item => {
  const checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    item.classList.toggle('done', checkbox.checked);

    const list = item.closest('.item-list');
    const listItems = list.querySelectorAll('.item input[type="checkbox"]');
    const listDone = list.querySelectorAll('.item input[type="checkbox"]:checked');
    const card = item.closest('.list-card');
    const count = card.querySelector('.list-count');
    const miniFill = card.querySelector('.mini-progress-fill');
    const percent = listItems.length ? Math.round((listDone.length / listItems.length) * 100) : 0;

    count.textContent = listDone.length + '/' + listItems.length;
    miniFill.style.width = percent + '%';

    updateGlobalProgress();
  });
});

document.getElementById('btn-new-list').addEventListener('click', () => {
  alert('Aqui vai abrir o formulário de nova lista. Podemos criar essa tela depois.');
});

document.getElementById('btn-add-list').addEventListener('click', () => {
  alert('Aqui vai abrir o formulário de nova lista.');
});