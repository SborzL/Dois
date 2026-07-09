/* desejos.js — Lista de Desejos do Casal */
let USER_ID = null;
let COUPLE_ID = null;
let desejos = [];
let filtroAtual = 'todos';
let verDesejoId = null;

const CAT_EMOJI = {
  viagem:'✈️', restaurante:'🍽️', experiencia:'🎢',
  compra:'🛍️', filme:'🎬', outro:'💫'
};
const CAT_LABEL = {
  viagem:'Viagem', restaurante:'Restaurante', experiencia:'Experiência',
  compra:'Compra', filme:'Filme/Série', outro:'Outro'
};
const PRIO_EMOJI = { alta:'🔴', media:'🟡', baixa:'🟢' };

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  USER_ID = session.user.id;

  const { data: m } = await supabaseClient
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (!m?.couple_id) { window.location.href = 'conectar.html'; return; }
  COUPLE_ID = m.couple_id;

  await carregar();
  bindEvents();
}

async function carregar() {
  const { data } = await supabaseClient
    .from('lista_desejos')
    .select('*')
    .eq('couple_id', COUPLE_ID)
    .order('created_at', { ascending: false });

  desejos = data || [];
  renderLista();
}

function renderLista() {
  const el = document.getElementById('desejos-list');

  let lista = desejos;
  if (filtroAtual === 'pendente') lista = desejos.filter(d => !d.concluido);
  if (filtroAtual === 'concluido') lista = desejos.filter(d => d.concluido);

  if (!lista.length) {
    const msgs = {
      todos: ['💝', 'Nenhum desejo ainda', 'Adicionem coisas que querem fazer, comprar ou viver juntos!'],
      pendente: ['⏳', 'Tudo realizado!', 'Que casal produtivo — sem desejos pendentes.'],
      concluido: ['✨', 'Nenhum desejo realizado ainda', 'Quando marcarem um como realizado, vai aparecer aqui.']
    };
    const [icon, title, sub] = msgs[filtroAtual];
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div><p class="empty-title">${title}</p><p class="empty-sub">${sub}</p></div>`;
    return;
  }

  const realizados = lista.filter(d => d.concluido).length;
  const bannerHtml = filtroAtual !== 'pendente' && realizados > 0
    ? `<div class="realizados-banner">✨ ${realizados} desejo${realizados>1?'s':''} realizado${realizados>1?'s':''}!</div>`
    : '';

  el.innerHTML = bannerHtml + lista.map(d => {
    const cat = CAT_EMOJI[d.categoria] || '💫';
    const catLabel = CAT_LABEL[d.categoria] || 'Outro';
    const data = new Date(d.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const checkIcon = d.concluido ? '✓' : '';
    return `
      <div class="desejo-card ${d.concluido?'concluido':''} prio-${d.prioridade}" data-id="${d.id}">
        <button class="desejo-check" data-check="${d.id}" aria-label="${d.concluido?'Marcar pendente':'Marcar realizado'}">${checkIcon}</button>
        <div class="desejo-info">
          <div class="desejo-top">
            <span class="desejo-cat">${cat} ${catLabel}</span>
            <span style="font-size:.72rem;color:var(--color-text-muted)">${PRIO_EMOJI[d.prioridade]||''}</span>
          </div>
          <span class="desejo-titulo">${esc(d.titulo)}</span>
          ${d.descricao ? `<p class="desejo-desc">${esc(d.descricao)}</p>` : ''}
          <p class="desejo-meta">${data}${d.concluido && d.concluido_em ? ' · ✨ realizado em '+new Date(d.concluido_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : ''}</p>
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('.desejo-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-check]')) return;
      abrirVer(card.dataset.id);
    });
  });
  document.querySelectorAll('[data-check]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleConcluido(btn.dataset.check); });
  });
}

function abrirVer(id) {
  const d = desejos.find(x => x.id === id);
  if (!d) return;
  verDesejoId = id;

  const cat = CAT_EMOJI[d.categoria] || '💫';
  const catLabel = CAT_LABEL[d.categoria] || 'Outro';
  const dataCriado = new Date(d.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('ver-title').textContent = d.titulo;

  let body = `<span class="ver-cat-badge">${cat} ${catLabel} · ${PRIO_EMOJI[d.prioridade]} ${d.prioridade.charAt(0).toUpperCase()+d.prioridade.slice(1)} prioridade</span>`;

  if (d.concluido && d.concluido_em) {
    const dataReal = new Date(d.concluido_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
    body += `<div class="realizado-banner">✨ Realizado em ${dataReal}</div>`;
  }

  if (d.descricao) body += `<p class="ver-desc">${esc(d.descricao)}</p>`;
  body += `<p class="ver-meta">Adicionado em ${dataCriado}</p>`;

  document.getElementById('ver-body').innerHTML = body;

  const btnRealizar = document.getElementById('ver-realizar');
  btnRealizar.textContent = d.concluido ? 'Marcar como Pendente' : 'Marcar como Realizado ✨';
  btnRealizar.style.background = d.concluido ? 'var(--color-text-muted)' : '';

  document.getElementById('modal-ver').classList.add('open');
}

async function toggleConcluido(id) {
  const d = desejos.find(x => x.id === id);
  if (!d) return;
  const novoConcluido = !d.concluido;
  const { error } = await supabaseClient.from('lista_desejos').update({
    concluido: novoConcluido,
    concluido_em: novoConcluido ? new Date().toISOString() : null
  }).eq('id', id);
  if (!error) {
    toast(novoConcluido ? '✨ Desejo realizado!' : 'Marcado como pendente');
    await carregar();
  }
}

function bindEvents() {
  document.getElementById('btn-nova').addEventListener('click', abrirModal);
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
  document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
  document.getElementById('modal-novo').addEventListener('click', e => { if(e.target===e.currentTarget) fecharModal(); });

  document.getElementById('ver-fechar').addEventListener('click', () => document.getElementById('modal-ver').classList.remove('open'));
  document.getElementById('modal-ver').addEventListener('click', e => { if(e.target===e.currentTarget) document.getElementById('modal-ver').classList.remove('open'); });

  document.getElementById('ver-realizar').addEventListener('click', async () => {
    if (!verDesejoId) return;
    await toggleConcluido(verDesejoId);
    document.getElementById('modal-ver').classList.remove('open');
  });

  document.getElementById('ver-deletar').addEventListener('click', deletar);
  document.getElementById('btn-salvar').addEventListener('click', salvar);

  document.querySelectorAll('.filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtual = btn.dataset.filtro;
      renderLista();
    });
  });
}

function abrirModal() {
  document.getElementById('inp-titulo').value = '';
  document.getElementById('inp-desc').value = '';
  document.getElementById('inp-cat').value = 'outro';
  document.getElementById('inp-prio').value = 'media';
  document.getElementById('modal-erro').textContent = '';
  document.getElementById('modal-titulo-label').textContent = 'Novo Desejo';
  document.getElementById('btn-salvar').textContent = 'Adicionar Desejo 💝';
  document.getElementById('modal-novo').classList.add('open');
  setTimeout(() => document.getElementById('inp-titulo').focus(), 150);
}

function fecharModal() {
  document.getElementById('modal-novo').classList.remove('open');
}

async function salvar() {
  const titulo = document.getElementById('inp-titulo').value.trim();
  const descricao = document.getElementById('inp-desc').value.trim();
  const categoria = document.getElementById('inp-cat').value;
  const prioridade = document.getElementById('inp-prio').value;
  const erro = document.getElementById('modal-erro');

  if (!titulo) { erro.textContent = 'Adicione um título.'; return; }

  const btn = document.getElementById('btn-salvar');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  const { error } = await supabaseClient.from('lista_desejos').insert({
    couple_id: COUPLE_ID,
    criado_por: USER_ID,
    titulo,
    descricao: descricao || null,
    categoria,
    prioridade
  });

  btn.textContent = 'Adicionar Desejo 💝';
  btn.disabled = false;

  if (error) { erro.textContent = 'Erro ao salvar. Tente novamente.'; return; }

  fecharModal();
  toast('Desejo adicionado! 💝');
  await carregar();
}

async function deletar() {
  if (!verDesejoId) return;
  if (!confirm('Excluir este desejo?')) return;
  await supabaseClient.from('lista_desejos').delete().eq('id', verDesejoId);
  document.getElementById('modal-ver').classList.remove('open');
  toast('Desejo excluído.');
  await carregar();
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
