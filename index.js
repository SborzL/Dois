let currentUser = null;
let coupleId = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  const { data: member } = await supabaseClient
    .from('couple_members').select('couple_id').eq('user_id', currentUser.id).single();

  if (!member) { window.location.href = 'perfil.html'; return; }
  coupleId = member.couple_id;

  await Promise.all([loadHero(), loadNextEvent(), loadCounts()]);
}

async function loadHero() {
  const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const now = new Date();
  document.getElementById('hero-date').textContent = `${dias[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]}`;

  const { data: profile } = await supabaseClient.from('profiles').select('name').eq('id', currentUser.id).single();
  const nome = profile?.name?.split(' ')[0] || currentUser.email.split('@')[0];
  document.getElementById('hero-greeting').textContent = `Olá, ${nome} 💚`;
}

async function loadNextEvent() {
  const hoje = new Date().toISOString().split('T')[0];
  const { data: evs } = await supabaseClient.from('events').select('*')
    .eq('couple_id', coupleId).gte('event_date', hoje)
    .order('event_date', { ascending: true }).order('event_time', { ascending: true }).limit(1);

  const bloco = document.getElementById('next-event-block');
  if (!evs || !evs.length) {
    bloco.innerHTML = `<div class="event-empty"><p>Nenhum evento agendado ainda.</p><a href="agenda.html" class="link-sm">Adicionar evento →</a></div>`;
    return;
  }
  const ev = evs[0];
  const d = new Date(ev.event_date + 'T12:00:00');
  const sem = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const hora = ev.event_time ? ev.event_time.slice(0,5).replace(':','h') : '';
  const sub = [hora, ev.place].filter(Boolean).join(' · ');
  bloco.innerHTML = `
    <div class="event-card">
      <div class="event-date"><span class="event-day">${sem[d.getDay()]}</span><span class="event-num">${d.getDate()}</span></div>
      <div class="event-info"><p class="event-title">${esc(ev.title)}</p>${sub ? `<p class="event-sub">${esc(sub)}</p>` : ''}</div>
      <span class="event-icon">🗓️</span>
    </div>`;
}

async function loadCounts() {
  const hoje = new Date().toISOString().split('T')[0];
  const [{ count: pl }, { count: li }, { count: ev }] = await Promise.all([
    supabaseClient.from('places').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('checklists').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('events').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId).gte('event_date', hoje)
  ]);
  document.getElementById('count-lugares').textContent = `${pl||0} salvo${pl!==1?'s':''}`;
  document.getElementById('count-listas').textContent = `${li||0} lista${li!==1?'s':''}`;
  document.getElementById('count-eventos').textContent = `${ev||0} futuro${ev!==1?'s':''}`;
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

init();
