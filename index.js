// ─── Auth guard + home dinâmica ───────────────────────────────────────────
let currentUser = null;
let coupleId    = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = session.user;

  const { data: member } = await supabaseClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', currentUser.id)
    .single();

  // sem casal ainda → vai para perfil completar convite
  if (!member) {
    window.location.href = 'perfil.html';
    return;
  }

  coupleId = member.couple_id;

  await Promise.all([
    loadHeroDate(),
    loadNextEvent(),
    loadCounts()
  ]);
}

// ─── Hero: data de hoje ────────────────────────────────────────────────────
async function loadHeroDate() {
  const weekdays = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const months   = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const now = new Date();
  const label = `${weekdays[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
  document.getElementById('hero-date').textContent = label;

  // busca nome do usuário no perfil
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('name')
    .eq('id', currentUser.id)
    .single();

  const name = profile?.name || currentUser.email.split('@')[0];
  document.getElementById('hero-greeting').textContent = `Olá, ${name} 💚`;
}

// ─── Próximo evento ───────────────────────────────────────────────────────────
async function loadNextEvent() {
  const today = new Date().toISOString().split('T')[0];

  const { data: events } = await supabaseClient
    .from('events')
    .select('*')
    .eq('couple_id', coupleId)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true })
    .limit(1);

  const eventBlock = document.getElementById('next-event-block');

  if (!events || events.length === 0) {
    eventBlock.innerHTML = `
      <div class="event-empty">
        <p>Nenhum evento agendado.</p>
        <a href="agenda.html" class="link-sm">Adicionar evento →</a>
      </div>`;
    return;
  }

  const ev = events[0];
  const d  = new Date(ev.event_date + 'T12:00:00');
  const weekdays = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const timeStr  = ev.event_time ? ev.event_time.slice(0,5).replace(':','h') : '';
  const sub = [timeStr, ev.place].filter(Boolean).join(' · ');

  eventBlock.innerHTML = `
    <div class="event-card">
      <div class="event-date">
        <span class="event-day">${weekdays[d.getDay()]}</span>
        <span class="event-num">${d.getDate()}</span>
      </div>
      <div class="event-info">
        <p class="event-title">${escHtml(ev.title)}</p>
        ${sub ? `<p class="event-sub">${escHtml(sub)}</p>` : ''}
      </div>
      <span class="event-icon">🗓️</span>
    </div>`;
}

// ─── Contadores do acesso rápido ─────────────────────────────────────────────
async function loadCounts() {
  const [{ count: placesCount }, { count: listsCount }, { count: eventsCount }] = await Promise.all([
    supabaseClient.from('places').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('checklists').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('events').select('*', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .gte('event_date', new Date().toISOString().split('T')[0])
  ]);

  document.getElementById('count-lugares').textContent   = (placesCount || 0) + ' salvo' + (placesCount !== 1 ? 's' : '');
  document.getElementById('count-listas').textContent    = (listsCount  || 0) + ' lista'  + (listsCount  !== 1 ? 's' : '');
  document.getElementById('count-eventos').textContent   = (eventsCount || 0) + ' futuro' + (eventsCount !== 1 ? 's' : '');
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
