let currentUser = null;
let coupleId = null;
let selectedDate = null;
let allEvents = [];
let viewYear, viewMonth;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;
  const today = new Date();
  viewYear = today.getFullYear(); viewMonth = today.getMonth();
  selectedDate = today.toISOString().split('T')[0];
  await loadEvents();
  setupModal();
  setupNav();
}

async function loadEvents() {
  const { data } = await supabaseClient.from('events').select('*').eq('couple_id', coupleId).order('event_date').order('event_time');
  allEvents = data || [];
  renderCalendar();
  renderUpcoming();
  renderDayEvents();
}

function renderCalendar() {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  document.getElementById('cal-month-label').textContent = `${meses[viewMonth]} ${viewYear}`;
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const eventDays = new Set(allEvents
    .filter(e => { const d = new Date(e.event_date + 'T12:00:00'); return d.getFullYear() === viewYear && d.getMonth() === viewMonth; })
    .map(e => new Date(e.event_date + 'T12:00:00').getDate()));

  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cls = ['cal-day', iso === today ? 'today' : '', iso === selectedDate ? 'selected' : '', eventDays.has(d) ? 'has-event' : ''].filter(Boolean).join(' ');
    html += `<button class="${cls}" data-date="${iso}">${d}</button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day').forEach(b => b.addEventListener('click', () => { selectedDate = b.dataset.date; renderCalendar(); renderDayEvents(); }));
}

function renderDayEvents() {
  const section = document.getElementById('day-events');
  const title = document.getElementById('day-events-title');
  const list = document.getElementById('day-events-list');
  const d = new Date(selectedDate + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  title.textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;

  const evs = allEvents.filter(e => e.event_date === selectedDate);
  if (!evs.length) {
    list.innerHTML = `<div class="empty-state small"><p>Nenhum evento neste dia.</p><button class="link-sm" id="add-from-day">Adicionar evento →</button></div>`;
    document.getElementById('add-from-day')?.addEventListener('click', () => openModal(selectedDate));
  } else {
    list.innerHTML = evs.map(e => eventCard(e)).join('');
    attachEventActions(list, evs);
  }
  section.style.display = 'block';
}

function renderUpcoming() {
  const hoje = new Date().toISOString().split('T')[0];
  const upcoming = allEvents.filter(e => e.event_date >= hoje).slice(0, 5);
  const list = document.getElementById('upcoming-list');
  const counter = document.getElementById('month-counter');

  const thisMonth = allEvents.filter(e => {
    const d = new Date(e.event_date + 'T12:00:00');
    const now = new Date(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  if (counter) counter.textContent = `${thisMonth} evento${thisMonth !== 1 ? 's' : ''} este mês`;

  if (!upcoming.length) {
    list.innerHTML = `<div class="empty-state small"><p>Nenhum evento futuro agendado.</p></div>`;
    return;
  }
  // data-id no event-row garante que long-press e botao de deletar funcionem aqui tambem
  list.innerHTML = upcoming.map(e => eventCard(e)).join('');
  attachEventActions(list, upcoming);
}

// Gera o card HTML de um evento — data-id no wrapper garante que o long-press funcione
function eventCard(e) {
  const d = new Date(e.event_date + 'T12:00:00');
  const sem = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const hora = e.event_time ? e.event_time.slice(0, 5).replace(':', 'h') : '';
  const sub = [hora, e.place].filter(Boolean).join(' · ');
  return `<div class="event-row" data-id="${e.id}">
    <div class="event-date-sm"><span>${sem[d.getDay()]}</span><span>${d.getDate()}</span></div>
    <div class="event-info"><p class="event-title">${esc(e.title)}</p>${sub ? `<p class="event-sub">${esc(sub)}</p>` : ''}</div>
    <button class="btn-icon del-event-btn" data-id="${e.id}" aria-label="Remover evento">×</button>
  </div>`;
}

function attachEventActions(container, events) {
  container.querySelectorAll('.del-event-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmDeleteEvent(btn.dataset.id);
    });
  });
  // Long press como alternativa (mobile)
  container.querySelectorAll('.event-row').forEach(row => {
    let t;
    row.addEventListener('touchstart', () => { t = setTimeout(() => confirmDeleteEvent(row.dataset.id), 700); }, { passive: true });
    row.addEventListener('touchend', () => clearTimeout(t));
    row.addEventListener('touchcancel', () => clearTimeout(t));
    row.addEventListener('touchmove', () => clearTimeout(t), { passive: true });
  });
}

async function confirmDeleteEvent(id) {
  if (!id) return;
  if (!confirm('Remover este evento?')) return;
  const { error } = await supabaseClient.from('events').delete().eq('id', id);
  if (error) { alert('Erro ao remover: ' + error.message); return; }
  loadEvents();
}

function setupNav() {
  document.getElementById('cal-prev').addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCalendar(); });
  document.getElementById('add-event-btn').addEventListener('click', () => openModal(selectedDate));
}

function openModal(preDate = '') {
  document.getElementById('event-form').reset();
  if (preDate) document.getElementById('event-date').value = preDate;
  document.getElementById('event-modal').classList.add('open');
}

function setupModal() {
  const modal = document.getElementById('event-modal');
  document.getElementById('event-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  document.getElementById('event-form').addEventListener('submit', async e => {
    e.preventDefault();
    const titleVal = document.getElementById('event-title').value.trim();
    const dateVal = document.getElementById('event-date').value;
    if (!titleVal || !dateVal) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const payload = {
      couple_id: coupleId,
      title: titleVal,
      event_date: dateVal,
      event_time: document.getElementById('event-time').value || null,
      place: document.getElementById('event-place').value.trim() || null,
      notes: document.getElementById('event-notes').value.trim() || null
    };
    await supabaseClient.from('events').insert(payload);
    btn.disabled = false;
    modal.classList.remove('open');
    loadEvents();
  });
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

init();
