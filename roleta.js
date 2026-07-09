const COLORS = ['#1f7a5c','#2ecc71','#27ae60','#16a085','#1abc9c','#0e6655','#117a65','#148f77','#0b5345','#1d8348','#52be80','#45b39d'];
const CAT_EMOJI = { restaurante:'🍽️', bar:'🍻', barzinho:'🍻', café:'☕', parque:'🌳', praia:'🏖️', museu:'🏛️', cinema:'🎬', show:'🎵', viagem:'✈️', doces:'🍰', sobremesas:'🍰', sorveteria:'🍦', padaria:'🥐', pizzaria:'🍕', sushi:'🍣', churrascaria:'🥩', lanchonete:'🥪', mercado:'🛒', shopping:'🛍️', spa:'🛆', outro:'📍' };

let coupleId = null;
let places = [];
let spinning = false;
let angle = 0;
let activeStatus = 'quero ir';
let history = JSON.parse(localStorage.getItem('roleta_history') || '[]');

async function waitForSession(ms = 8000) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return session;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_, s) => {
      if (s) { clearTimeout(timer); subscription.unsubscribe(); resolve(s); }
    });
  });
}

async function init() {
  const session = await waitForSession();
  if (!session) { window.location.href = 'login.html'; return; }
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', session.user.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;

  document.getElementById('status-filter').addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    document.querySelectorAll('#status-filter .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    loadPlaces();
  });

  document.getElementById('spin-btn').addEventListener('click', spin);
  await loadPlaces();
  renderHistory();
}

async function loadPlaces() {
  let q = supabaseClient.from('places').select('id, name, category').eq('couple_id', coupleId);
  if (activeStatus !== 'todos') q = q.eq('status', activeStatus);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(16);
  if (error) { console.error(error); return; }
  places = (data || []).map(p => ({
    ...p,
    emoji: getEmoji(p.category)
  }));
  const empty = document.getElementById('empty-state');
  const wrap  = document.getElementById('wheel-wrap');
  const lt    = document.getElementById('list-title');
  if (!places.length) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    lt.style.display = 'none';
    document.getElementById('places-chips').innerHTML = '';
    return;
  }
  empty.classList.add('hidden');
  wrap.classList.remove('hidden');
  lt.style.display = '';
  drawWheel(angle);
  renderPills();
}

function getEmoji(cat) {
  if (!cat) return '📍';
  const key = cat.toLowerCase().split(' ')[0].replace(/[&]/g,'').trim();
  return CAT_EMOJI[key] || CAT_EMOJI[cat.toLowerCase()] || '📍';
}

function drawWheel(startAngle) {
  const canvas = document.getElementById('roleta-canvas');
  const ctx = canvas.getContext('2d');
  const n = places.length;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r  = cx - 4;
  const slice = (2 * Math.PI) / n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  places.forEach((p, i) => {
    const s = startAngle + i * slice;
    const e = s + slice;
    // Setor
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s, e);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    // Borda
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Texto
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Work Sans, sans-serif';
    ctx.shadowColor = '#0006';
    ctx.shadowBlur = 3;
    const label = p.emoji + ' ' + truncate(p.name, n > 8 ? 8 : 12);
    ctx.fillText(label, r - 10, 4);
    ctx.restore();
  });

  // Centro
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#0d1117';
  ctx.fill();
  ctx.strokeStyle = '#1f7a5c';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Emoji centro
  ctx.font = '16px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎉', cx, cy);
  ctx.textBaseline = 'alphabetic';
}

function spin() {
  if (spinning || !places.length) return;
  spinning = true;
  document.getElementById('spin-btn').disabled = true;
  document.getElementById('result-box').textContent = '';
  // Limpa highlight anterior
  document.querySelectorAll('.place-pill').forEach(p => p.classList.remove('winner'));

  const extra    = Math.random() * Math.PI * 2;
  const rounds   = (6 + Math.floor(Math.random() * 5)) * Math.PI * 2;
  const total    = rounds + extra;
  const duration = 4000;
  const from     = angle;
  const start    = performance.now();

  function step(now) {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 4); // ease out quart
    angle = from + total * ease;
    drawWheel(angle);
    if (t < 1) { requestAnimationFrame(step); return; }

    spinning = false;
    document.getElementById('spin-btn').disabled = false;

    // Calcula vencedor
    const n      = places.length;
    const slice  = (2 * Math.PI) / n;
    const norm   = ((-Math.PI / 2 - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const idx    = Math.floor(norm / slice) % n;
    const winner = places[idx];

    // Resultado
    const box = document.getElementById('result-box');
    box.innerHTML = `${winner.emoji} <span>${esc(winner.name)}</span>`;

    // Destaca pill
    const pills = document.querySelectorAll('.place-pill');
    if (pills[idx]) pills[idx].classList.add('winner');

    // Histórico
    history.unshift({ name: winner.name, emoji: winner.emoji, time: Date.now() });
    if (history.length > 10) history.pop();
    localStorage.setItem('roleta_history', JSON.stringify(history));
    renderHistory();

    showToast(`🎉 Que tal ir: ${winner.name}?`);
  }
  requestAnimationFrame(step);
}

function renderPills() {
  document.getElementById('places-chips').innerHTML = places.map((p, i) =>
    `<div class="place-pill" data-idx="${i}">${p.emoji} ${esc(p.name)}</div>`
  ).join('');
}

function renderHistory() {
  const list  = document.getElementById('history-list');
  const title = document.getElementById('history-title');
  if (!history.length) { title.style.display = 'none'; list.innerHTML = ''; return; }
  title.style.display = '';
  list.innerHTML = history.map(h => {
    const d = new Date(h.time);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `<div class="history-item">
      <span class="history-emoji">${h.emoji}</span>
      <span class="history-name">${esc(h.name)}</span>
      <span class="history-time">${date} · ${time}</span>
    </div>`;
  }).join('');
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', init);
