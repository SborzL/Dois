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

const items = document.querySelectorAll('.today-item');

items.forEach(item => {
  const checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    item.classList.toggle('done', checkbox.checked);
  });
});