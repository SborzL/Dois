const FRASES = [
  '"O amor não é olhar um para o outro, é olhar juntos na mesma direção."',
  '"Você é a minha parte favorita de todos os meus dias."',
  '"Com você, até o cotidiano vira uma aventura."',
  '"Ser amado por você é a minha maior alegria."',
  '"Juntos somos mais do que a soma de nossas partes."',
  '"Você me faz querer ser uma versão melhor de mim."',
  '"Em cada momento, escolho você."',
  '"O lar não é um lugar, é uma pessoa — e essa pessoa é você."',
  '"Nosso amor é feito de pequenos momentos que duram para sempre."',
  '"Obrigado(a) por fazer do simples algo extraordinário."',
];
const DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const SEM   = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

// Roleta
const ROLETA_COLORS = ['#1f7a5c','#2ecc71','#27ae60','#16a085','#1abc9c','#0e6655','#117a65','#148f77','#0b5345','#1d8348'];
const CAT_EMOJI = { restaurante:'🍽️', bar:'🍻', cafe:'☕', parque:'🌳', praia:'🏖️', museu:'🏛️', cinema:'🎬', show:'🎵', viagem:'✈️', outro:'📍' };
let roletaPlaces = [];
let roletaSpinning = false;
let roletaAngle = 0;

let currentUser = null;
let coupleId    = null;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;
  await Promise.all([
    loadHero(), loadRecado(), loadNextEvents(),
    loadWishesPreview(), loadRoleta(),
    loadGoalsPreview(), loadLastPlace(), loadListsSummary(), loadCounts()
  ]);
  setupRecado();
}

async function loadHero() {
  const now = new Date();
  document.getElementById('hero-date').textContent = `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES[now.getMonth()]}`;
  const { data: prof } = await supabaseClient.from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
  const nome = prof?.name?.split(' ')[0] || currentUser.email.split('@')[0];
  document.getElementById('hero-greeting').textContent = `Olá, ${nome} 💚`;
  const { data: couple } = await supabaseClient.from('couples').select('created_at, display_name, anniversary_date, custom_phrase').eq('id', coupleId).maybeSingle();
  const daysEl = document.getElementById('hero-days');
  const since  = couple?.anniversary_date || couple?.created_at;
  if (since) {
    const diff = diffDays(since);
    daysEl.innerHTML = `<span class="days-num">${diff}</span><span class="days-label">dias<br>juntos</span>`;
  } else { daysEl.style.display = 'none'; }
  const phraseEl = document.getElementById('hero-frase');
  if (couple?.custom_phrase?.trim()) {
    phraseEl.textContent = couple.custom_phrase.trim();
  } else {
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    phraseEl.textContent = FRASES[dayOfYear % FRASES.length];
  }
  if (couple?.display_name?.trim()) {
    document.getElementById('hero-greeting').textContent = `${couple.display_name.trim()} 💚`;
  }
}

async function loadRecado() {
  const hoje = new Date().toISOString().split('T')[0];
  const { data: msgs } = await supabaseClient
    .from('daily_messages')
    .select('*, profiles(name)')
    .eq('couple_id', coupleId)
    .gte('created_at', hoje + 'T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(3);
  const block = document.getElementById('recado-block');
  if (!msgs?.length) {
    block.innerHTML = '<p class="recado-empty">Nenhum recado hoje. Seja o primeiro! 💌</p>';
    return;
  }
  block.innerHTML = msgs.map(m => {
    const isMe = m.author_id === currentUser.id;
    const nome = m.profiles?.name || (isMe ? 'Você' : 'Parceiro(a)');
    const hora = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<div class="recado-card ${isMe ? 'mine' : 'theirs'}">
      <p class="recado-text">${esc(m.content)}</p>
      <p class="recado-meta">${esc(nome)} · ${hora}</p>
    </div>`;
  }).join('');
}

function setupRecado() {
  const toggle  = document.getElementById('btn-recado-toggle');
  const form    = document.getElementById('recado-form');
  const sendBtn = document.getElementById('btn-recado-send');
  const cancel  = document.getElementById('btn-recado-cancel');
  toggle.addEventListener('click', () => { form.style.display = form.style.display === 'none' ? 'flex' : 'none'; });
  cancel.addEventListener('click', () => { form.style.display = 'none'; document.getElementById('recado-text').value = ''; });
  sendBtn.addEventListener('click', async () => {
    const content = document.getElementById('recado-text').value.trim();
    if (!content) return;
    sendBtn.disabled = true; sendBtn.textContent = 'Enviando...';
    const { error } = await supabaseClient.from('daily_messages').insert({ couple_id: coupleId, author_id: currentUser.id, content });
    sendBtn.disabled = false; sendBtn.textContent = 'Enviar 💌';
    if (error) { showToast('Erro: ' + error.message); return; }
    document.getElementById('recado-text').value = '';
    form.style.display = 'none';
    showToast('Recado enviado! 💌');
    await loadRecado();
  });
}

// ── DESEJOS PREVIEW ──────────────────────────────────────────────
async function loadWishesPreview() {
  const { data: wishes } = await supabaseClient
    .from('lista_desejos')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('concluido', false)
    .order('created_at', { ascending: false })
    .limit(3);
  if (!wishes?.length) return;
  document.getElementById('wishes-section').style.display = '';
  const prioColor = { alta: '#e74c3c', media: '#f39c12', baixa: '#27ae60' };
  document.getElementById('wishes-block').innerHTML = wishes.map(w => {
    const prio = w.prioridade || 'media';
    const cat = w.categoria || 'outro';
    const catEmojis = { viagem:'✈️', restaurante:'🍽️', experiencia:'🎢', compra:'🛍️', filme:'🎬', outro:'💫' };
    return `<div class="wish-mini-row">
      <span class="wish-mini-emoji">${catEmojis[cat] || '💝'}</span>
      <div class="wish-mini-info">
        <p class="wish-mini-title">${esc(w.titulo)}</p>
        ${w.categoria ? `<span class="chip-xs">${esc(w.categoria)}</span>` : ''}
      </div>
      <span class="wish-mini-prio" style="color:${prioColor[prio] || '#888'}">${prio}</span>
    </div>`;
  }).join('');
}

// ── ROLETA ───────────────────────────────────────────────────────
async function loadRoleta() {
  const { data: places, error } = await supabaseClient
    .from('places')
    .select('id, name, category')
    .eq('couple_id', coupleId)
    .eq('status', 'quero ir')
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) { console.error('Roleta erro:', error); return; }
  if (!places?.length) return;
  // Mapeia emoji pela categoria
  roletaPlaces = places.map(p => ({
    ...p,
    emoji: CAT_EMOJI[(p.category || '').toLowerCase()] || '📍'
  }));
  document.getElementById('roleta-section').style.display = '';
  drawRoleta(roletaAngle);
  document.getElementById('roleta-btn').addEventListener('click', spinRoleta);
}

function drawRoleta(startAngle) {
  const canvas = document.getElementById('roleta-canvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const n      = roletaPlaces.length;
  const cx     = canvas.width / 2;
  const cy     = canvas.height / 2;
  const r      = cx - 6;
  const slice  = (2 * Math.PI) / n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  roletaPlaces.forEach((p, i) => {
    const start = startAngle + i * slice;
    const end   = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = ROLETA_COLORS[i % ROLETA_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Texto
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Work Sans, sans-serif';
    const label = p.emoji + ' ' + truncate(p.name, 10);
    ctx.fillText(label, r - 8, 4);
    ctx.restore();
  });
  // Centro
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function spinRoleta() {
  if (roletaSpinning || !roletaPlaces.length) return;
  roletaSpinning = true;
  document.getElementById('roleta-btn').disabled = true;
  document.getElementById('roleta-result').textContent = '';
  const extra   = Math.random() * Math.PI * 2;
  const spins   = (5 + Math.floor(Math.random() * 5)) * Math.PI * 2;
  const total   = spins + extra;
  const duration = 3500;
  const start   = performance.now();
  const from    = roletaAngle;
  function step(now) {
    const elapsed = now - start;
    const t       = Math.min(elapsed / duration, 1);
    const ease    = 1 - Math.pow(1 - t, 3);
    roletaAngle   = from + total * ease;
    drawRoleta(roletaAngle);
    if (t < 1) { requestAnimationFrame(step); return; }
    // Winner
    roletaSpinning = false;
    document.getElementById('roleta-btn').disabled = false;
    const n       = roletaPlaces.length;
    const slice   = (2 * Math.PI) / n;
    const pointer = -Math.PI / 2; // top
    const norm    = ((pointer - roletaAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const winner  = roletaPlaces[Math.floor(norm / slice) % n];
    document.getElementById('roleta-result').textContent =
      `${winner.emoji} ${winner.name}!`;
    showToast(`Que tal ir: ${winner.name}? 🎉`);
  }
  requestAnimationFrame(step);
}

async function loadGoalsPreview() {
  const { data: goals } = await supabaseClient.from('goals').select('*').eq('couple_id', coupleId).eq('done', false).order('created_at', { ascending: false }).limit(2);
  if (!goals?.length) return;
  document.getElementById('goals-preview-section').style.display = '';
  document.getElementById('goals-preview-block').innerHTML = goals.map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `<div class="goal-mini">
      <div class="goal-mini-top"><span>${g.emoji || '🎯'}</span><span class="goal-mini-title">${esc(g.title)}</span><span class="goal-mini-pct">${g.target > 0 ? pct + '%' : ''}</span></div>
      ${g.target > 0 ? `<div class="goal-mini-bar"><div class="goal-mini-fill" style="width:${pct}%"></div></div>` : ''}
    </div>`;
  }).join('');
}

async function loadNextEvents() {
  const hoje = new Date().toISOString().split('T')[0];
  const { data: evs } = await supabaseClient.from('events').select('*').eq('couple_id', coupleId).gte('event_date', hoje).order('event_date', { ascending: true }).order('event_time', { ascending: true }).limit(3);
  const bloco = document.getElementById('next-events-block');
  if (!evs?.length) {
    bloco.innerHTML = `<div class="empty-card"><p>Nenhum evento agendado ainda.</p><a href="agenda.html" class="link-sm">Adicionar evento →</a></div>`;
    return;
  }
  bloco.innerHTML = evs.map(ev => {
    const d   = new Date(ev.event_date + 'T12:00:00');
    const hora = ev.event_time ? ev.event_time.slice(0,5).replace(':','h') : '';
    const sub  = [hora, ev.place].filter(Boolean).join(' · ');
    const isHoje = ev.event_date === hoje;
    return `<div class="event-card ${isHoje ? 'event-today' : ''}"><div class="event-date"><span class="event-day">${SEM[d.getDay()]}</span><span class="event-num">${d.getDate()}</span></div><div class="event-info"><p class="event-title">${esc(ev.title)}</p>${sub ? `<p class="event-sub">${esc(sub)}</p>` : ''}</div>${isHoje ? '<span class="hoje-badge">Hoje</span>' : ''}</div>`;
  }).join('');
}

async function loadLastPlace() {
  const { data: places } = await supabaseClient.from('places').select('*').eq('couple_id', coupleId).eq('status', 'já fomos').order('created_at', { ascending: false }).limit(1);
  if (!places?.length) return;
  const p = places[0];
  document.getElementById('last-place-section').style.display = '';
  const RATING_FIELDS = ['rating_ambiente','rating_comida','rating_atendimento','rating_custo'];
  const vals = RATING_FIELDS.map(k => p[k]).filter(v => v > 0);
  const avg  = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : null;
  const stars   = avg ? `<span class="avg-star">⭐ ${avg}</span>` : '';
  const mapsBtn = p.maps_url ? `<a href="${esc(p.maps_url)}" target="_blank" rel="noopener" class="maps-mini">🗺️ Maps</a>` : '';
  document.getElementById('last-place-block').innerHTML = `<div class="place-mini-card"><div class="place-mini-info"><p class="place-mini-name">${esc(p.name)}</p>${p.address ? `<p class="place-mini-addr">${esc(p.address)}</p>` : ''}<div class="place-mini-meta">${stars}${p.category ? `<span class="chip-xs">${esc(p.category)}</span>` : ''}${mapsBtn}</div></div></div>`;
}

async function loadListsSummary() {
  const { data: lists } = await supabaseClient.from('checklists').select('id, title, emoji').eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(3);
  if (!lists?.length) return;
  const { data: items } = await supabaseClient.from('checklist_items').select('checklist_id, done').in('checklist_id', lists.map(l => l.id));
  const countMap = {};
  (items || []).forEach(i => {
    if (!countMap[i.checklist_id]) countMap[i.checklist_id] = { total: 0, done: 0 };
    countMap[i.checklist_id].total++;
    if (i.done) countMap[i.checklist_id].done++;
  });
  const hasItems = lists.some(l => countMap[l.id]?.total > 0);
  if (!hasItems) return;
  document.getElementById('lists-section').style.display = '';
  document.getElementById('lists-block').innerHTML = lists.map(l => {
    const c = countMap[l.id] || { total: 0, done: 0 };
    if (!c.total) return '';
    const pct   = Math.round((c.done / c.total) * 100);
    const emoji = l.emoji || '📋';
    return `<div class="list-mini-row"><span class="list-mini-emoji">${emoji}</span><div class="list-mini-info"><div class="list-mini-top"><span class="list-mini-name">${esc(l.title)}</span><span class="list-mini-count">${c.done}/${c.total}</span></div><div class="list-mini-track"><div class="list-mini-fill" style="width:${pct}%"></div></div></div></div>`;
  }).filter(Boolean).join('');
}

async function loadCounts() {
  const hoje = new Date().toISOString().split('T')[0];
  const [
    { count: pl }, { count: li }, { count: ev },
    { count: di }, { count: go }, { count: wi }, { count: ca }
  ] = await Promise.all([
    supabaseClient.from('places').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('checklists').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('events').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId).gte('event_date', hoje),
    supabaseClient.from('diary_entries').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
    supabaseClient.from('goals').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('done', false),
    supabaseClient.from('lista_desejos').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('concluido', false),
    supabaseClient.from('capsulas').select('*', { count: 'exact', head: true }).eq('couple_id', coupleId),
  ]);
  document.getElementById('count-lugares').textContent  = `${pl||0} salvo${pl!==1?'s':''}`;
  document.getElementById('count-listas').textContent   = `${li||0} lista${li!==1?'s':''}`;
  document.getElementById('count-eventos').textContent  = `${ev||0} futuro${ev!==1?'s':''}`;
  document.getElementById('count-diario').textContent   = `${di||0} entrada${di!==1?'s':''}`;
  document.getElementById('count-metas').textContent    = `${go||0} ativa${go!==1?'s':''}`;
  document.getElementById('count-desejos').textContent  = `${wi||0} desejo${wi!==1?'s':''}`;
  document.getElementById('count-capsulas').textContent = `${ca||0} cápsula${ca!==1?'s':''}`;
}

function truncate(str, max) { return str.length > max ? str.slice(0, max) + '…' : str; }
function diffDays(dateStr) {
  const start = new Date(String(dateStr).includes('T') ? dateStr : dateStr + 'T12:00:00');
  return Math.max(0, Math.floor((new Date() - start) / 86400000));
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
init();
