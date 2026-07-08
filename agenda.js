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

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let currentDate = new Date(2026, 6, 8);
let selectedDay = 8;

const eventsData = {
  '2026-6-8': [],
  '2026-6-14': [{ title: 'Jantar no Bossa', time: '19h30', place: 'Restaurante Bossa Nova' }],
  '2026-6-18': [{ title: 'Cinema com Ana', time: '20h', place: 'Shopping Iguatemi' }]
};

const calTitle = document.getElementById('cal-title');
const calendarGrid = document.getElementById('calendar-grid');
const dayTitle = document.getElementById('day-title');
const emptyDay = document.getElementById('empty-day');
const dayEvents = document.getElementById('day-events');

function key(year, month, day){
  return year + '-' + month + '-' + day;
}

function renderCalendar(){
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calTitle.textContent = monthNames[month] + ' ' + year;
  calendarGrid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for(let i = 0; i < firstDay; i++){
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    calendarGrid.appendChild(empty);
  }

  for(let day = 1; day <= daysInMonth; day++){
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = day;

    if(eventsData[key(year, month, day)] && eventsData[key(year, month, day)].length > 0){
      cell.classList.add('has-event');
    }

    if(day === selectedDay){
      cell.classList.add('selected');
    }

    cell.addEventListener('click', () => {
      selectedDay = day;
      renderCalendar();
      renderDayEvents();
    });

    calendarGrid.appendChild(cell);
  }
}

function renderDayEvents(){
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const events = eventsData[key(year, month, selectedDay)] || [];

  if(events.length === 0){
    dayTitle.textContent = 'Dia ' + selectedDay + ' — Sem eventos';
    emptyDay.classList.remove('hidden');
    dayEvents.classList.add('hidden');
    dayEvents.innerHTML = '';
  } else {
    dayTitle.textContent = 'Dia ' + selectedDay + ' — ' + events.length + ' evento(s)';
    emptyDay.classList.add('hidden');
    dayEvents.classList.remove('hidden');
    dayEvents.innerHTML = events.map(ev => `
      <li class="upcoming-item">
        <div class="upcoming-date">
          <span class="upcoming-day">${selectedDay}</span>
          <span class="upcoming-month">${monthNames[month].slice(0,3).toUpperCase()}</span>
        </div>
        <div class="upcoming-info">
          <p class="upcoming-title">${ev.title}</p>
          <p class="upcoming-sub">${ev.time} · ${ev.place}</p>
        </div>
      </li>
    `).join('');
  }
}

document.getElementById('prev-month').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  selectedDay = 1;
  renderCalendar();
  renderDayEvents();
});

document.getElementById('next-month').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  selectedDay = 1;
  renderCalendar();
  renderDayEvents();
});

document.getElementById('btn-add-event').addEventListener('click', () => {
  alert('Aqui vai abrir o formulário de novo evento. Podemos criar essa tela depois.');
});

document.getElementById('btn-add-event-inline').addEventListener('click', () => {
  alert('Aqui vai abrir o formulário de novo evento.');
});

renderCalendar();
renderDayEvents();