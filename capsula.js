/* capsula.js — Cápsula do Tempo */
let USER_ID = null;
let COUPLE_ID = null;
let capsulas = [];
let fotosBase64 = [];
let editandoId = null;

// Aguarda sessão estar disponível antes de inicializar
async function waitForSession(maxWaitMs = 3000) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return session;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), maxWaitMs);
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session) {
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve(session);
      }
    });
  });
}

async function init() {
  const session = await waitForSession();
  if (!session) { window.location.href = 'login.html'; return; }
  USER_ID = session.user.id;

  const { data: m, error: mErr } = await supabaseClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (mErr) {
    console.error('Erro ao buscar couple_members:', mErr);
    mostrarErroGlobal('Erro de conexão. Tente recarregar a página.');
    return;
  }

  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  COUPLE_ID = m.couple_id;

  await carregarCapsulas();
  bindEvents();
}

async function carregarCapsulas() {
  const { data, error } = await supabaseClient
    .from('capsulas')
    .select('*')
    .eq('couple_id', COUPLE_ID)
    .order('abrir_em', { ascending: true });

  if (error) {
    console.error('Erro ao carregar cápsulas:', error);
    mostrarErroGlobal('Não foi possível carregar as cápsulas.');
    return;
  }

  capsulas = data || [];
  renderLista();
}

function mostrarErroGlobal(msg) {
  const el = document.getElementById('capsulas-list');
  if (el) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p class="empty-title">Algo deu errado</p>
        <p class="empty-sub">${msg}</p>
        <button class="btn-primary" style="margin-top:1rem" onclick="location.reload()">Recarregar</button>
      </div>`;
  }
}

function renderLista() {
  const el = document.getElementById('capsulas-list');
  if (!capsulas.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <p class="empty-title">Nenhuma cápsula ainda</p>
        <p class="empty-sub">Criem uma mensagem para vocês do futuro, com uma data para abrir.</p>
      </div>`;
    return;
  }

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  el.innerHTML = capsulas.map(c => {
    const dataAbrir = new Date(c.abrir_em + 'T00:00:00');
    const aberta = dataAbrir <= hoje;
    const diff = Math.ceil((dataAbrir - hoje) / 86400000);
    const fotos = c.fotos ? JSON.parse(c.fotos) : [];
    const statusTxt = aberta ? '📬 Aberta' : '🔒 Selada';
    const countdownHtml = !aberta
      ? `<span class="capsula-countdown">Abre em ${diff} dia${diff===1?'':'s'}</span>`
      : '';
    const fotoHtml = fotos.length
      ? `<p class="capsula-fotos-count">📎 ${fotos.length} foto${fotos.length>1?'s':''}</p>`
      : '';
    const dataFmt = dataAbrir.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
    return `
      <div class="capsula-card ${aberta?'aberta':'selada'}" data-id="${c.id}">
        <div class="capsula-top">
          <p class="capsula-titulo">${esc(c.titulo)}</p>
          <span class="capsula-status">${statusTxt}</span>
        </div>
        <p class="capsula-data">📅 ${aberta?'Abriu em':'Abre em'}: ${dataFmt}</p>
        ${countdownHtml}
        ${aberta ? `<p class="capsula-preview">${esc(c.mensagem)}</p>` : '<p class="capsula-preview" style="font-style:italic;opacity:.6">Mensagem selada 🔐</p>'}
        ${fotoHtml}
      </div>`;
  }).join('');

  document.querySelectorAll('.capsula-card').forEach(card => {
    card.addEventListener('click', () => abrirVer(card.dataset.id));
  });
}

function abrirVer(id) {
  const c = capsulas.find(x => x.id === id);
  if (!c) return;

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dataAbrir = new Date(c.abrir_em + 'T00:00:00');
  const aberta = dataAbrir <= hoje;
  const fotos = c.fotos ? JSON.parse(c.fotos) : [];
  const dataFmt = dataAbrir.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('ver-title').textContent = c.titulo;
  editandoId = id;

  let body = '';
  if (aberta) {
    body += `<p class="ver-meta">📅 Aberta em ${dataFmt}</p>`;
    body += `<p class="ver-mensagem">${esc(c.mensagem)}</p>`;
    if (fotos.length) {
      body += `<div class="ver-fotos">${fotos.map(f=>`<img class="ver-foto" src="${f}" alt="foto da cápsula" loading="lazy">`).join('')}</div>`;
    }
  } else {
    const diff = Math.ceil((dataAbrir - hoje) / 86400000);
    body += `
      <div class="lacre-banner">
        🔐 Esta cápsula ainda está selada<br>
        <strong>Abre em ${diff} dia${diff===1?'':'s'}</strong> — ${dataFmt}
      </div>
      <p style="font-size:.82rem;color:var(--color-text-muted);text-align:center">A mensagem e as fotos aparecerão aqui quando chegar a data ✨</p>`;
  }

  document.getElementById('ver-body').innerHTML = body;
  document.getElementById('modal-ver').classList.add('open');
}

function bindEvents() {
  document.getElementById('btn-nova').addEventListener('click', abrirModal);
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
  document.getElementById('modal-nova').addEventListener('click', e => { if(e.target===e.currentTarget) fecharModal(); });

  document.getElementById('ver-fechar').addEventListener('click', () => document.getElementById('modal-ver').classList.remove('open'));
  document.getElementById('modal-ver').addEventListener('click', e => { if(e.target===e.currentTarget) document.getElementById('modal-ver').classList.remove('open'); });
  document.getElementById('ver-deletar').addEventListener('click', deletarCapsula);

  document.getElementById('btn-salvar').addEventListener('click', salvarCapsula);

  document.getElementById('inp-fotos').addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    fotosBase64 = [];
    document.getElementById('fotos-preview').innerHTML = '';
    for (const f of files.slice(0,5)) {
      const b64 = await toBase64(f);
      fotosBase64.push(b64);
      const img = document.createElement('img');
      img.src = b64; img.className = 'foto-thumb'; img.alt = 'preview';
      document.getElementById('fotos-preview').appendChild(img);
    }
    document.getElementById('upload-txt').textContent = `${fotosBase64.length} foto${fotosBase64.length>1?'s':''} selecionada${fotosBase64.length>1?'s':''}`;
  });

  // data mínima = amanhã
  const amanha = new Date(); amanha.setDate(amanha.getDate()+1);
  document.getElementById('inp-abrir').min = amanha.toISOString().split('T')[0];
}

function abrirModal() {
  document.getElementById('inp-titulo').value = '';
  document.getElementById('inp-mensagem').value = '';
  document.getElementById('inp-abrir').value = '';
  document.getElementById('fotos-preview').innerHTML = '';
  document.getElementById('upload-txt').textContent = 'Toque para adicionar fotos';
  document.getElementById('modal-erro').textContent = '';
  fotosBase64 = [];
  document.getElementById('modal-nova').classList.add('open');
  setTimeout(()=>document.getElementById('inp-titulo').focus(), 150);
}

function fecharModal() {
  document.getElementById('modal-nova').classList.remove('open');
}

async function salvarCapsula() {
  const titulo = document.getElementById('inp-titulo').value.trim();
  const mensagem = document.getElementById('inp-mensagem').value.trim();
  const abrirEm = document.getElementById('inp-abrir').value;
  const erro = document.getElementById('modal-erro');

  if (!titulo) { erro.textContent = 'Adicione um título.'; return; }
  if (!mensagem) { erro.textContent = 'Escreva uma mensagem.'; return; }
  if (!abrirEm) { erro.textContent = 'Escolha quando abrir a cápsula.'; return; }

  const btn = document.getElementById('btn-salvar');
  btn.textContent = 'Selando...';
  btn.disabled = true;

  const { error } = await supabaseClient.from('capsulas').insert({
    couple_id: COUPLE_ID,
    criado_por: USER_ID,
    titulo,
    mensagem,
    abrir_em: abrirEm,
    fotos: fotosBase64.length ? JSON.stringify(fotosBase64) : null
  });

  btn.textContent = 'Selar Cápsula 🔒';
  btn.disabled = false;

  if (error) {
    console.error('Erro ao salvar cápsula:', error);
    erro.textContent = `Erro ao salvar: ${error.message || 'Tente novamente.'}` ;
    return;
  }

  fecharModal();
  toast('Cápsula selada! 🔒');
  await carregarCapsulas();
}

async function deletarCapsula() {
  if (!editandoId) return;
  if (!confirm('Excluir esta cápsula?')) return;

  const { error } = await supabaseClient.from('capsulas').delete().eq('id', editandoId);
  if (error) {
    console.error('Erro ao deletar:', error);
    toast('Erro ao excluir. Tente novamente.');
    return;
  }
  document.getElementById('modal-ver').classList.remove('open');
  toast('Cápsula excluída.');
  await carregarCapsulas();
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

document.addEventListener('DOMContentLoaded', init);
