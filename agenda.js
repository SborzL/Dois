// ─── Auth guard ───────────────────────────────────────────────────────────────
let currentUser = null;
let coupleId    = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  currentUser = session.user;

  const { data: member } = await supabaseClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', currentUser.id)
    .single();

  if (!member) { window.location.href = 'perfil.html'; return; }
  coupleId = member.couple_id;

  await loadEvents();
  setupNav();
  setupAddButtons();
}

// ─── Estado global ────────────────────────────────────────────────────────────
const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const monthNamesShort = ['JAN','FEV','MAR','ABR','MAI','JUN',
                          'JUL','AGO','SET','OUT','NOV','DEZ'];

let allEvents   = []; // todos os eventos do casal
let currentDate = new Date();
let selectedDay = currentDate.getDate();

// ─── Carregar eventos ─────────────────────────────────────────────────────────
async function loadEvents() {
  const { data, error } = await supabaseClient
    .from('events')
    .select('*')
    .eq('couple_id', coupleId)
    .order('event_date', { ascending: true })
    .order('event_time',  { ascending: true });

  if (error) { console.error(error); return; }
  allEvents = data || [];

  renderCalendar();
  renderDayEvents();
  renderUpcoming();
  updateCount();
}

// ─── Calendário ───────────────────────────────────────────────────────────────
const calTitle    = document.getElementById('cal-title');
const calGrid     = document.getElementById('calendar-grid');

function eventsOnDay(year, month, day) {
  const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return allEvents.filter(e => e.event_date === iso);
}

function renderCalendar() {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calTitle.textContent = monthNames[month] + ' ' + year;
  calGrid.innerHTML = '';

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    calGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = day;

    if (eventsOnDay(year, month, day).length > 0) cell.classList.add('has-event');
    if (day === selectedDay) cell.classList.add('selected');

    cell.addEventListener('click', () => {
      selectedDay = day;
      renderCalendar();
      renderDayEvents();
    });

    calGrid.appendChild(cell);
  }
}

// ─── Eventos do dia selecionado ───────────────────────────────────────────────
const dayTitle  = document.getElementById('day-title');
const emptyDay  = document.getElementById('empty-day');
const dayEvents = document.getElementById('day-events');

function renderDayEvents() {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const events = eventsOnDay(year, month, selectedDay);

  const dayLabel = `Dia ${selectedDay} de ${monthNames[month]}`;

  if (events.length === 0) {
    dayTitle.textContent = dayLabel + ' — Sem eventos';
    emptyDay.classList.remove('hidden');
    dayEvents.classList.add('hidden');
    dayEvents.innerHTML = '';
  } else {
    dayTitle.textContent = dayLabel + ` — ${events.length} evento${events.length > 1 ? 's' : ''}`;
    emptyDay.classList.add('hidden');
    dayEvents.classList.remove('hidden');
    dayEvents.innerHTML = events.map(ev => buildEventItem(ev, month)).join('');

    // toque longo para deletar
    dayEvents.querySelectorAll('.upcoming-item').forEach(item => {
      let timer;
      item.addEventListener('touchstart', () => {
        timer = setTimeout(() => confirmDeleteEvent(item.dataset.id, item.dataset.title), 600);
      });
      item.addEventListener('touchend',  () => clearTimeout(timer));
      item.addEventListener('touchmove', () => clearTimeout(timer));
    });
  }
}

function buildEventItem(ev, month) {
  const day = parseInt(ev.event_date.split('-')[2]);
  const mon = month !== undefined ? month : parseInt(ev.event_date.split('-')[1]) - 1;
  const timeStr = ev.event_time ? ev.event_time.slice(0,5).replace(':','h') : '';
  const sub = [timeStr, ev.place].filter(Boolean).join(' · ');
  return `
    <li class="upcoming-item" data-id="${ev.id}" data-title="${escHtml(ev.title)}">
      <div class="upcoming-date">
        <span class="upcoming-day">${day}</span>
        <span class="upcoming-month">${monthNamesShort[mon]}</span>
      </div>
      <div class="upcoming-info">
        <p class="upcoming-title">${escHtml(ev.title)}</p>
        ${sub ? `<p class="upcoming-sub">${escHtml(sub)}</p>` : ''}
        ${ev.notes ? `<p class="upcoming-sub">${escHtml(ev.notes)}</p>` : ''}
      </div>
    </li>`;
}

// ─── Próximos eventos ─────────────────────────────────────────────────────────
const upcomingList = document.getElementById('upcoming-list');

function renderUpcoming() {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = allEvents
    .filter(e => e.event_date >= today)
    .slice(0, 5);

  if (upcoming.length === 0) {
    upcomingList.innerHTML = '<li class="empty-upcoming"><p>Nenhum evento futuro.</p></li>';
    return;
  }

  upcomingList.innerHTML = upcoming.map(ev => {
    const mon = parseInt(ev.event_date.split('-')[1]) - 1;
    return buildEventItem(ev, mon);
  }).join('');

  // toque longo para deletar também na lista de próximos
  upcomingList.querySelectorAll('.upcoming-item').forEach(item => {
    let timer;
    item.addEventListener('touchstart', () => {
      timer = setTimeout(() => confirmDeleteEvent(item.dataset.id, item.dataset.title), 600);
    });
    item.addEventListener('touchend',  () => clearTimeout(timer));
    item.addEventListener('touchmove', () => clearTimeout(timer));
  });
}

function updateCount() {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const pad = n => String(n).padStart(2,'0');
  const start = `${year}-${pad(month+1)}-01`;
  const end   = `${year}-${pad(month+1)}-${new Date(year, month+1, 0).getDate()}`;
  const count = allEvents.filter(e => e.event_date >= start && e.event_date <= end).length;
  document.getElementById('events-count').textContent =
    `${count} evento${count !== 1 ? 's' : ''} este mês`;
}

// ─── Navegação mês ────────────────────────────────────────────────────────────
function setupNav() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    selectedDay = 1;
    renderCalendar();
    renderDayEvents();
    updateCount();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    selectedDay = 1;
    renderCalendar();
    renderDayEvents();
    updateCount();
  });
}

// ─── Modal: adicionar evento ──────────────────────────────────────────────────
function setupAddButtons() {
  document.getElementById('btn-add-event').addEventListener('click', openModal);
  document.getElementById('btn-add-event-inline').addEventListener('click', openModal);
}

function openModal() {
  if (!document.getElementById('ev-modal')) buildModal();

  // pré-preenche a data com o dia selecionado
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const pad   = n => String(n).padStart(2,'0');
  document.getElementById('ev-date').value =
    `${year}-${pad(month+1)}-${pad(selectedDay)}`;

  document.getElementById('ev-modal').classList.add('open');
  document.getElementById('ev-title').focus();
}

function closeModal() {
  document.getElementById('ev-modal').classList.remove('open');
  document.getElementById('ev-form').reset();
  document.getElementById('ev-error').classList.add('hidden');
}

function buildModal() {
  const m = document.createElement('div');
  m.id = 'ev-modal';
  m.className = 'modal-backdrop';
  m.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="ev-heading">
      <div class="modal-handle"></div>
      <h2 id="ev-heading">Novo evento</h2>
      <form id="ev-form" novalidate>
        <label for="ev-title">Título *</label>
        <input id="ev-title" type="text" placeholder="Ex: Jantar especial" required>

        <label for="ev-date">Data *</label>
        <input id="ev-date" type="date" required>

        <label for="ev-time">Horário</label>
        <input id="ev-time" type="time">

        <label for="ev-place">Local</label>
        <input id="ev-place" type="text" placeholder="Ex: Restaurante Bossa Nova">

        <label for="ev-notes">Observações</label>
        <input id="ev-notes" type="text" placeholder="Opcional">

        <p id="ev-error" class="form-error hidden"></p>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="ev-cancel">Cancelar</button>
          <button type="submit" class="btn-primary"  id="ev-save">Salvar</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  document.getElementById('ev-cancel').addEventListener('click', closeModal);
  document.getElementById('ev-form').addEventListener('submit', submitEvent);
}

async function submitEvent(e) {
  e.preventDefault();
  const title  = document.getElementById('ev-title').value.trim();
  const date   = document.getElementById('ev-date').value;
  const time   = document.getElementById('ev-time').value   || null;
  const place  = document.getElementById('ev-place').value.trim()  || null;
  const notes  = document.getElementById('ev-notes').value.trim()  || null;
  const errEl  = document.getElementById('ev-error');
  const saveBtn= document.getElementById('ev-save');

  if (!title) { showError(errEl, 'O título é obrigatório.'); return; }
  if (!date)  { showError(errEl, 'A data é obrigatória.');   return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  const { error } = await supabaseClient.from('events').insert({
    couple_id:  coupleId,
    title,
    event_date: date,
    event_time: time,
    place,
    notes
  });

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar';

  if (error) { showError(errEl, 'Erro ao salvar. Tente novamente.'); return; }

  closeModal();
  await loadEvents();
}

// ─── Deletar evento ───────────────────────────────────────────────────────────
function confirmDeleteEvent(id, title) {
  if (!confirm(`Remover "${title}"?`)) return;
  deleteEvent(id);
}

async function deleteEvent(id) {
  await supabaseClient.from('events').delete().eq('id', id);
  allEvents = allEvents.filter(e => e.id !== id);
  renderCalendar();
  renderDayEvents();
  renderUpcoming();
  updateCount();
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
