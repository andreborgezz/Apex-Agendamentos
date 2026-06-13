/**
 * pages/servicos/servicos.js
 * CRUD completo de serviços com optimistic update.
 * Dados reais — sem mock.
 */

import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Session }       from '../../components/api.js';

const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_MODAL   = { easing: 'spring(1,60,10,0)', duration: 700 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

let servicos = [];
let siteId   = null;

document.addEventListener('DOMContentLoaded', async () => {
  await injectSidebar('sidebar-root');
  _carregarSiteId();
  await _carregarServicos();
  _setupEventos();
  anime({ targets: '.main-content', opacity: [0,1], translateY: [8,0], ...SPRING_ENTRADA });
});

function _carregarSiteId() {
  siteId = Session.getSiteId();
}

async function _carregarServicos() {
  const grid = document.getElementById('servicos-grid');

  if (!siteId) {
    servicos = [];
    Toast.warning('Nenhum site vinculado. Configure em Configurações.');
    _renderGrid();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('servicos').select('*').eq('id_site', siteId).order('id_servico');
    if (error) throw error;
    servicos = data ?? [];
  } catch (err) {
    servicos = [];
    Toast.error('Erro ao carregar serviços. Verifique sua conexão.');
  }
  _renderGrid();
}

function _renderGrid() {
  const grid = document.getElementById('servicos-grid');
  grid.innerHTML = '';

  if (!servicos.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 24px;color:var(--text-muted)">
        <i class="ti ti-scissors" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:0.3"></i>
        <p style="font-size:0.9375rem;font-weight:500">Nenhum serviço cadastrado.</p>
        <p style="font-size:0.875rem;margin-top:4px">Clique em "Novo Serviço" para começar.</p>
      </div>`;
    return;
  }

  servicos.forEach((s, idx) => {
    const id   = s.id_servico ?? s.id;
    const card = document.createElement('div');
    card.className    = 'servico-card';
    card.style.opacity = '0';
    card.innerHTML = `
      <div class="servico-card-header">
        <div>
          <div class="servico-card-nome">${_esc(s.nome_servico)}</div>
        </div>
        <button class="btn-icon btn-del" data-id="${id}" aria-label="Remover ${_esc(s.nome_servico)}" style="color:var(--danger);flex-shrink:0">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
      ${s.descricao ? `<p class="servico-card-desc">${_esc(s.descricao)}</p>` : ''}
      <div class="servico-card-footer">
        <span class="servico-card-preco">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</span>
        <span class="servico-card-duracao">
          <i class="ti ti-clock" aria-hidden="true"></i> ${_esc(s.duracao)} min
        </span>
      </div>`;

    card.querySelector('.btn-del').addEventListener('click', () => _deletar(id, card));
    grid.appendChild(card);

    anime({ targets: card, opacity: [0,1], translateY: [20,0], delay: idx * 60, ...SPRING_ENTRADA });
  });
}

async function _deletar(id, cardEl) {
  const prev = [...servicos];
  servicos   = servicos.filter(s => (s.id_servico ?? s.id) !== id);

  anime({
    targets: cardEl,
    opacity: [1,0],
    scale: [1, 0.94],
    ...SPRING_MICRO,
    complete: () => { cardEl.remove(); if (!servicos.length) _renderGrid(); },
  });

  const { error } = await supabase.from('servicos').delete().eq('id_servico', id);
  if (error) {
    servicos = prev;
    _renderGrid();
    Toast.error('Erro ao remover serviço.');
  } else {
    Toast.success('Serviço removido.');
  }
}

async function _salvarServico() {
  const nome    = document.getElementById('ms-nome').value.trim();
  const preco   = parseFloat(document.getElementById('ms-preco').value)  || 0;
  const duracao = document.getElementById('ms-duracao').value             || '30';
  const desc    = document.getElementById('ms-desc').value.trim();

  if (!nome) {
    Toast.warning('Nome obrigatório.');
    document.getElementById('ms-nome').focus();
    return;
  }

  if (!siteId) {
    Toast.error('Nenhum site vinculado. Configure em Configurações primeiro.');
    return;
  }

  const tempId = Date.now();
  const novo   = { id_servico: tempId, nome_servico: nome, preco, duracao, descricao: desc };

  /* Optimistic update */
  servicos.push(novo);
  _renderGrid();
  _fecharModal();
  Toast.success(`"${nome}" adicionado!`);

  /* Persistir */
  const { data, error } = await supabase
    .from('servicos')
    .insert({ id_site: siteId, nome_servico: nome, preco, duracao, descricao: desc })
    .select().single();

  if (error) {
    servicos = servicos.filter(s => s.id_servico !== tempId);
    _renderGrid();
    Toast.error('Erro ao salvar no banco.');
  } else {
    const idx = servicos.findIndex(s => s.id_servico === tempId);
    if (idx >= 0) servicos[idx] = data;
  }
}

function _abrirModal() {
  const modal = document.getElementById('modal-servico');
  modal.classList.remove('hidden');
  anime({ targets: modal, opacity: [0,1], ...SPRING_MICRO });
  anime({ targets: '#modal-card', scale: [0.94,1], translateY: [16,0], ...SPRING_MODAL });
  document.getElementById('ms-nome').focus();
}

function _fecharModal() {
  const modal = document.getElementById('modal-servico');
  anime({
    targets: modal,
    opacity: [1,0],
    ...SPRING_MICRO,
    complete: () => {
      modal.classList.add('hidden');
      ['ms-nome','ms-preco','ms-duracao','ms-desc'].forEach(id => {
        document.getElementById(id).value = '';
      });
    },
  });
}

function _setupEventos() {
  document.getElementById('btn-novo-servico').addEventListener('click', _abrirModal);
  document.getElementById('btn-fechar-modal').addEventListener('click', _fecharModal);
  document.getElementById('btn-salvar-servico').addEventListener('click', _salvarServico);

  document.getElementById('modal-servico').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-servico')) _fecharModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modal-servico').classList.contains('hidden')) {
      _fecharModal();
    }
  });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
