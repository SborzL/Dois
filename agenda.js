let currentUser = null;
let coupleId = null;
let selectedDate = null;
let allEvents = [];
let viewYear, viewMonth;
let editingEventId = null;
let activeCatFilter = '';
let openedDetailEventId = null;

const CAT_ICONS = { encontro: '💑', aniversario: '🎂', viagem: '✈️', saida: '🍽️', outro: '📌' };
const CAT_LABELS = { encontro: 'Encontro', aniversario: 'Aniversário', viagem: 'Viagem', saida: 'Saída', outro: 'Outro' };
const REC_LABELS = { none: 'Não repetir', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };

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
  buildCatFilter();
  await loadEvents();
  setupModal();
  setupDetailSheet();
  setupNav();
  requestNotifPermission();
}

function buildCatFilter() {
  const row = document.getElementById('cat-filter-row');
  row.innerHTML = `<button class="chip active" data-cat="">Todos</button>` +
    Object.entries(CAT_ICONS).map(([k, ic]) => `<button class="chip" data-cat="${k}">${ic} ${CAT_LABELS[k]}</button>`).join('');
  row.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    row.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCatFilter = btn.dataset.cat;
    renderCalendar();
    renderUpcoming();
    renderDayEvents();
  });
}

async function loadEvents() {
  const { data } = await supabaseClient.from('events').select('*').eq('couple_id', coupleId).order('event_date').order('event_time');
  allEvents = data || [];
  renderCalendar();
  renderUpcoming();
  renderDayEvents();
}

function filteredEvents() {
  return activeCatFilter ? allEvents.filter(e => e.category === activeCatFilter) : allEvents;
}

function renderCalendar() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('cal-month-label').textContent = `${meses[viewMonth]} ${viewYear}`;
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];
  const evs = filteredEvents();
  const eventDayMap = {};
  evs.filter(e => {
    const d = new Date(e.event_date + 'T12:00:00');
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  }).forEach(e => {
    const day = new Date(e.event_date + 'T12:00:00').getDate();
    if (!eventDayMap[day]) eventDayMap[day] = [];
    eventDayMap[day].push(e.category || 'outro');
  });
  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cats = eventDayMap[d] || [];
    const dots = cats.slice(0,3).map(c => `<span class="cal-dot cat-${c}"></span>`).join('');
    const cls = ['cal-day', iso===today?'today':'', iso===selectedDate?'selected':'', cats.length?'has-event':''].filter(Boolean).join(' ');
    html += `<button class="${cls}" data-date="${iso}">${d}${dots?`<span class="cal-dots">${dots}</span>`:''}</button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day').forEach(b => b.addEventListener('click', () => {
    selectedDate = b.dataset.date; renderCalendar(); renderDayEvents();
  }));
}

function renderDayEvents() {
  const section = document.getElementById('day-events');
  const title = document.getElementById('day-events-title');
  const list = document.getElementById('day-events-list');
  const d = new Date(selectedDate + 'T12:00:00');
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  title.textContent = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  const evs = filteredEvents().filter(e => e.event_date === selectedDate);
  if (!evs.length) {
    list.innerHTML = `<div class="empty-state small"><p>Nenhum evento neste dia.</p><button class="link-sm" id="add-from-day">Adicionar evento →</button></div>`;
    document.getElementById('add-from-day')?.addEventListener('click', () => openModal(null, selectedDate));
  } else {
    list.innerHTML = evs.map(e => eventCard(e)).join('');
    attachEventActions(list, evs);
  }
  section.style.display = 'block';
}

function renderUpcoming() {
  const hoje = new Date().toISOString().split('T')[0];
  const upcoming = filteredEvents().filter(e => e.event_date >= hoje).slice(0,5);
  const list = document.getElementById('upcoming-list');
  const counter = document.getElementById('month-counter');
  const thisMonth = filteredEvents().filter(e => {
    const d = new Date(e.event_date + 'T12:00:00'), now = new Date();
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  }).length;
  if (counter) counter.textContent = `${thisMonth} evento${thisMonth!==1?'s':''} este mês`;
  if (!upcoming.length) {
    list.innerHTML = `<div class="empty-state small"><p>Nenhum evento futuro agendado.</p></div>`; return;
  }
  list.innerHTML = upcoming.map(e => eventCard(e)).join('');
  attachEventActions(list, upcoming);
}

function eventCard(e) {
  const d = new Date(e.event_date + 'T12:00:00');
  const sem = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const hora = e.event_time ? e.event_time.slice(0,5).replace(':','h') : '';
  const sub = [hora, e.place].filter(Boolean).join(' · ');
  const cat = e.category || 'outro';
  const rec = e.recurrence && e.recurrence !== 'none' ? `<span class="rec-badge">🔁 ${REC_LABELS[e.recurrence]}</span>` : '';
  return `<div class="event-row" data-id="${e.id}" role="button" tabindex="0">
    <div class="event-date-sm cat-border-${cat}"><span>${sem[d.getDay()]}</span><span>${d.getDate()}</span></div>
    <div class="event-info">
      <p class="event-title">${CAT_ICONS[cat]} ${esc(e.title)}</p>
      ${sub?`<p class="event-sub">${esc(sub)}</p>`:''}
      ${rec}
    </div>
    <button class="btn-icon edit-event-btn" data-id="${e.id}" aria-label="Editar">✏️</button>
  </div>`;
}

function attachEventActions(container, events) {
  container.querySelectorAll('.edit-event-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openModal(events.find(ev=>ev.id===btn.dataset.id)); });
  });
  container.querySelectorAll('.event-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.edit-event-btn')) return;
      openDetail(events.find(ev => ev.id === row.dataset.id));
    });
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(events.find(ev => ev.id === row.dataset.id));
      }
    });
  });
}

function openDetail(event) {
  if (!event) return;
  openedDetailEventId = event.id;
  const d = new Date(event.event_date + 'T12:00:00');
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const when = `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}${event.event_time ? ` às ${event.event_time.slice(0,5)}` : ''}`;
  const cat = event.category || 'outro';
  document.getElementById('detail-category').textContent = `${CAT_ICONS[cat]} ${CAT_LABELS[cat]}`;
  document.getElementById('detail-title').textContent = event.title || 'Evento';
  document.getElementById('detail-when').textContent = when;
  document.getElementById('detail-place').textContent = event.place || 'Local não informado';
  document.getElementById('detail-recurrence').textContent = event.recurrence && event.recurrence !== 'none' ? REC_LABELS[event.recurrence] : 'Não repete';
  document.getElementById('detail-notes').textContent = event.notes || 'Sem observações';
  const mapsWrap = document.getElementById('detail-maps-wrap');
  const mapsLink = document.getElementById('detail-maps-link');
  if (event.maps_url) {
    mapsLink.href = event.maps_url;
    mapsWrap.style.display = 'flex';
  } else {
    mapsWrap.style.display = 'none';
  }
  document.getElementById('event-detail-sheet').classList.add('open');
}

function closeDetail() {
  document.getElementById('event-detail-sheet').classList.remove('open');
  openedDetailEventId = null;
}

function setupDetailSheet() {
  const sheet = document.getElementById('event-detail-sheet');
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  sheet.addEventListener('click', e => { if (e.target === sheet) closeDetail(); });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    const event = allEvents.find(e => e.id === openedDetailEventId);
    closeDetail();
    openModal(event);
  });
  document.getElementById('detail-delete-btn').addEventListener('click', async () => {
    if (!openedDetailEventId || !confirm('Excluir este evento?')) return;
    await supabaseClient.from('events').delete().eq('id', openedDetailEventId);
    closeDetail();
    loadEvents();
  });
}

function openModal(event = null, preDate = '') {
  editingEventId = event ? event.id : null;
  const form = document.getElementById('event-form');
  form.reset();
  document.getElementById('event-modal-title').textContent = event ? 'Editar evento' : 'Novo evento';
  document.getElementById('delete-event-btn').style.display = event ? 'block' : 'none';
  document.getElementById('event-submit-btn').textContent = event ? 'Salvar alterações' : 'Salvar evento';
  if (event) {
    document.getElementById('event-title').value = event.title || '';
    document.getElementById('event-category').value = event.category || 'outro';
    document.getElementById('event-date').value = event.event_date || '';
    document.getElementById('event-time').value = event.event_time ? event.event_time.slice(0,5) : '';
    document.getElementById('event-place').value = event.place || '';
    document.getElementById('event-maps-url').value = event.maps_url || '';
    document.getElementById('event-recurrence').value = event.recurrence || 'none';
    document.getElementById('event-recurrence-end').value = event.recurrence_end || '';
    document.getElementById('event-notes').value = event.notes || '';
    toggleRecEnd(event.recurrence || 'none');
  } else {
    if (preDate) document.getElementById('event-date').value = preDate;
    toggleRecEnd('none');
  }
  document.getElementById('event-modal').classList.add('open');
}

function toggleRecEnd(val) {
  document.getElementById('rec-end-field').style.display = val !== 'none' ? 'block' : 'none';
}

function setupModal() {
  const modal = document.getElementById('event-modal');
  document.getElementById('event-modal-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target===modal) modal.classList.remove('open'); });
  document.getElementById('event-recurrence').addEventListener('change', e => toggleRecEnd(e.target.value));
  document.getElementById('delete-event-btn').addEventListener('click', async () => {
    if (!editingEventId || !confirm('Excluir este evento?')) return;
    await supabaseClient.from('events').delete().eq('id', editingEventId);
    modal.classList.remove('open');
    loadEvents();
  });
  document.getElementById('event-form').addEventListener('submit', async e => {
    e.preventDefault();
    const titleVal = document.getElementById('event-title').value.trim();
    const dateVal = document.getElementById('event-date').value;
    if (!titleVal || !dateVal) return;
    const btn = e.target.querySelector('#event-submit-btn');
    btn.disabled = true;
    const payload = {
      couple_id: coupleId,
      title: titleVal,
      category: document.getElementById('event-category').value || 'outro',
      event_date: dateVal,
      event_time: document.getElementById('event-time').value || null,
      place: document.getElementById('event-place').value.trim() || null,
      maps_url: document.getElementById('event-maps-url').value.trim() || null,
      recurrence: document.getElementById('event-recurrence').value || 'none',
      recurrence_end: document.getElementById('event-recurrence-end').value || null,
      notes: document.getElementById('event-notes').value.trim() || null
    };
    if (editingEventId) {
      await supabaseClient.from('events').update(payload).eq('id', editingEventId);
    } else {
      await supabaseClient.from('events').insert(payload);
    }
    btn.disabled = false;
    modal.classList.remove('open');
    loadEvents();
  });
}

function setupNav() {
  document.getElementById('cal-prev').addEventListener('click', () => { viewMonth--; if(viewMonth<0){viewMonth=11;viewYear--;} renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { viewMonth++; if(viewMonth>11){viewMonth=0;viewYear++;} renderCalendar(); });
  document.getElementById('add-event-btn').addEventListener('click', () => openModal(null, selectedDate));
}

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

init();
