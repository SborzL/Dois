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

let currentUser = null;
let coupleId    = null;
let myHumorEmoji = null;

async function waitForSession(maxWaitMs = 8000) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return session;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), maxWaitMs);
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session) { clearTimeout(timer); subscription.unsubscribe(); resolve(session); }
    });
  });
}

async function init() {
  const session = await waitForSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  const { data: m } = await supabaseClient.from('couple_members').select('couple_id').eq('user_id', currentUser.id).maybeSingle();
  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  coupleId = m.couple_id;
  await Promise.all([
    loadHero(), loadHumorDia(), loadRecado(), loadNextEvents(),
    loadWishesPreview(), loadGoalsPreview(),
    loadLastPlace(), loadListsSummary(), loadCounts()
  ]);
  setupRecado();
  setupHumor();
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

/* ─────────────────── HUMOR DO DIA ─────────────────── */
async function loadHumorDia() {
  const hoje = new Date().toISOString().split('T')[0];
  // busca membros do casal para pegar o parceiro
  const { data: members } = await supabaseClient
    .from('couple_members').select('user_id').eq('couple_id', coupleId);
  const partnerId = members?.find(m => m.user_id !== currentUser.id)?.user_id;

  // busca humores de hoje para o casal
  const { data: humores } = await supabaseClient
    .from('humor_dia')
    .select('user_id, emoji, texto')
    .eq('couple_id', coupleId)
    .eq('data', hoje);

  const meuHumor      = humores?.find(h => h.user_id === currentUser.id);
  const partnerHumor  = humores?.find(h => h.user_id === partnerId);

  // nome do parceiro
  if (partnerId) {
    const { data: pp } = await supabaseClient.from('profiles').select('name').eq('id', partnerId).maybeSingle();
    if (pp?.name) document.getElementById('humor-partner-name').textContent = pp.name.split(' ')[0];
  }

  // exibe meu humor
  if (meuHumor) {
    myHumorEmoji = meuHumor.emoji;
    const el = document.getElementById('humor-me-display');
    el.innerHTML = `<span class="humor-emoji-big">${meuHumor.emoji}</span>${meuHumor.texto ? `<span class="humor-texto">${esc(meuHumor.texto)}</span>` : ''}`;
    // marca o botão selecionado
    document.querySelectorAll('#humor-me-emojis .humor-emoji-btn').forEach(btn => {
      if (btn.dataset.emoji === meuHumor.emoji) btn.classList.add('selected');
    });
    document.getElementById('humor-me-save').classList.remove('show');
    document.getElementById('humor-me-text').classList.remove('show');
  }

  // exibe humor do parceiro
  if (partnerHumor) {
    const el = document.getElementById('humor-partner-display');
    el.innerHTML = `<span class="humor-emoji-big">${partnerHumor.emoji}</span>${partnerHumor.texto ? `<span class="humor-texto">${esc(partnerHumor.texto)}</span>` : ''}`;
  }
}

function setupHumor() {
  const emojiBtns = document.querySelectorAll('#humor-me-emojis .humor-emoji-btn');
  const textInput = document.getElementById('humor-me-text');
  const saveBtn   = document.getElementById('humor-me-save');

  emojiBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      emojiBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      myHumorEmoji = btn.dataset.emoji;
      textInput.classList.add('show');
      saveBtn.classList.add('show');
    });
  });

  saveBtn.addEventListener('click', async () => {
    if (!myHumorEmoji) return;
    const hoje = new Date().toISOString().split('T')[0];
    const texto = textInput.value.trim() || null;
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...';
    const { error } = await supabaseClient.from('humor_dia').upsert({
      couple_id: coupleId,
      user_id: currentUser.id,
      data: hoje,
      emoji: myHumorEmoji,
      texto
    }, { onConflict: 'couple_id,user_id,data' });
    saveBtn.disabled = false; saveBtn.textContent = 'Salvar';
    if (error) { showToast('Erro: ' + error.message); return; }
    showToast('Humor salvo! 🌡️');
    await loadHumorDia();
  });
}

/* ─────────────────── RECADO ─────────────────── */
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
    const reactions = m.reactions || {};
    // botões de reação existentes
    const EMOJIS = ['❤️','😍','😂','🥹'];
    const reactionHtml = EMOJIS.map(emoji => {
      const r = reactions[emoji] || { count: 0, users: [] };
      const reacted = r.users?.includes(currentUser.id);
      const count = r.count || 0;
      if (count === 0 && !reacted) return ''; // só mostra se houver reações
      return `<button class="reaction-btn ${reacted ? 'reacted' : ''}" data-msg-id="${m.id}" data-emoji="${emoji}">
        ${emoji}<span class="r-count">${count}</span>
      </button>`;
    }).filter(Boolean).join('');
    // botões rápidos para adicionar
    const quickHtml = EMOJIS.map(emoji => {
      const r = reactions[emoji] || { count: 0, users: [] };
      const reacted = r.users?.includes(currentUser.id);
      if (reacted) return ''; // já reagiu, não mostra de novo
      return `<button class="reaction-quick-btn" data-msg-id="${m.id}" data-emoji="${emoji}">${emoji}</button>`;
    }).filter(Boolean).join('');
    return `<div class="recado-card ${isMe ? 'mine' : 'theirs'}" id="msg-${m.id}">
      <p class="recado-text">${esc(m.content)}</p>
      <p class="recado-meta">${esc(nome)} · ${hora}</p>
      ${reactionHtml ? `<div class="recado-reactions">${reactionHtml}</div>` : ''}
      ${quickHtml ? `<div class="reaction-quick">${quickHtml}</div>` : ''}
    </div>`;
  }).join('');

  // bind reaction buttons
  document.querySelectorAll('.reaction-btn, .reaction-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => handleReaction(btn.dataset.msgId, btn.dataset.emoji));
  });
}

async function handleReaction(msgId, emoji) {
  // busca reações atuais
  const { data: msg } = await supabaseClient.from('daily_messages').select('reactions').eq('id', msgId).maybeSingle();
  const reactions = msg?.reactions || {};
  const r = reactions[emoji] || { count: 0, users: [] };
  const users = r.users || [];
  const idx = users.indexOf(currentUser.id);
  if (idx >= 0) {
    // toggle off
    users.splice(idx, 1);
    r.count = Math.max(0, (r.count || 1) - 1);
  } else {
    users.push(currentUser.id);
    r.count = (r.count || 0) + 1;
  }
  reactions[emoji] = { count: r.count, users };
  await supabaseClient.from('daily_messages').update({ reactions }).eq('id', msgId);
  await loadRecado();
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

async function loadWishesPreview() {
  const { data: wishes } = await supabaseClient
    .from('lista_desejos').select('*').eq('couple_id', coupleId)
    .eq('concluido', false).order('created_at', { ascending: false }).limit(3);
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
  document.getElementById('last-place-block').innerHTML = `<div class="place-mini-card"><div class="place-mini-info"><p class="place-mini-name">${esc(p.name)}</p>${p.address ? `<p class="place-mini-addr">${esc(p.address)}</p>` : ''}<div class="place-mini-meta">${stars}${p.category ? `<span class="chip-sm">${esc(p.category)}</span>` : ''}${mapsBtn}</div></div></div>`;
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

function diffDays(dateStr) {
  const start = new Date(String(dateStr).includes('T') ? dateStr : dateStr + 'T12:00:00');
  return Math.max(0, Math.floor((new Date() - start) / 86400000));
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }

document.addEventListener('DOMContentLoaded', init);
