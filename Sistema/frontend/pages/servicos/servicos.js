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
let editandoId = null;

async function init() {
  await injectSidebar('sidebar-root');
  _carregarSiteId();
  await _carregarServicos();
  _setupEventos();
  anime({ targets: '.main-content', opacity: [0,1], translateY: [8,0], ...SPRING_ENTRADA });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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
      <div style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--text-secondary);display:flex;flex-direction:column;align-items:center;gap:12px">
        <i class="ti ti-scissors" style="font-size:2.5rem;opacity:0.3" aria-hidden="true"></i>
        <div>
          <p style="font-size:0.9375rem;font-weight:600;color:var(--text-primary)">Nenhum serviço cadastrado ainda</p>
          <p style="font-size:0.8125rem;color:var(--text-muted);margin-top:2px">Comece adicionando manualmente ou use uma das sugestões abaixo:</p>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn--ghost btn--sm btn-import-preset" data-preset="salao">
            <i class="ti ti-scissors" aria-hidden="true"></i> Barbearia / Salão
          </button>
          <button class="btn btn--ghost btn--sm btn-import-preset" data-preset="clinica">
            <i class="ti ti-stethoscope" aria-hidden="true"></i> Saúde / Clínica
          </button>
          <button class="btn btn--ghost btn--sm btn-import-preset" data-preset="bemestar">
            <i class="ti ti-spa" aria-hidden="true"></i> Estética / Bem-Estar
          </button>
        </div>
      </div>`;

    grid.querySelectorAll('.btn-import-preset').forEach(btn => {
      btn.addEventListener('click', () => _importarSugestoes(btn.dataset.preset));
    });
    return;
  }

  servicos.forEach((s, idx) => {
    const id   = s.id_servico ?? s.id;
    const card = document.createElement('div');
    card.className    = 'servico-card';
    card.style.opacity = '0';

    const parsedDesc = parseDescricao(s.descricao);
    const hasDiscount = parsedDesc.desconto_pct > 0;
    
    let isDiscountActive = false;
    if (hasDiscount) {
      if (!parsedDesc.desconto_ate) {
        isDiscountActive = true;
      } else {
        const todayStr = new Date().toLocaleDateString('en-CA');
        isDiscountActive = parsedDesc.desconto_ate >= todayStr;
      }
    }

    let precoHtml = '';
    if (isDiscountActive) {
      const precoOriginal = Number(s.preco);
      const precoDesconto = precoOriginal * (1 - parsedDesc.desconto_pct / 100);
      precoHtml = `
        <div style="display:flex; flex-direction:column; gap:2px">
          <span style="font-size:0.75rem; text-decoration:line-through; color:var(--text-muted)">R$ ${precoOriginal.toFixed(2).replace('.', ',')}</span>
          <span class="servico-card-preco" style="color:var(--success)">R$ ${precoDesconto.toFixed(2).replace('.', ',')} <span style="font-size:0.75rem; background:var(--apex-accent-subtle); color:var(--accent); padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:600">-${parsedDesc.desconto_pct}%</span></span>
        </div>
      `;
    } else {
      precoHtml = `<span class="servico-card-preco">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</span>`;
    }

    let discountInfoHtml = '';
    if (hasDiscount) {
      const formattedDate = parsedDesc.desconto_ate 
        ? parsedDesc.desconto_ate.split('-').reverse().join('/') 
        : 'sem expiração';
      if (isDiscountActive) {
        discountInfoHtml = `<div style="font-size:0.75rem; color:var(--success); margin-top:2px;">Desconto: ${parsedDesc.desconto_pct}% até ${formattedDate}</div>`;
      } else {
        discountInfoHtml = `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Desconto expirado: ${parsedDesc.desconto_pct}% em ${formattedDate}</div>`;
      }
    }

    card.innerHTML = `
      <div class="servico-card-header">
        <div>
          <div class="servico-card-nome">${_esc(s.nome_servico)}</div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0">
          <button class="btn-icon btn-edit" data-id="${id}" aria-label="Alterar ${_esc(s.nome_servico)}" style="color:var(--text-secondary)">
            <i class="ti ti-edit" aria-hidden="true"></i>
          </button>
          <button class="btn-icon btn-del" data-id="${id}" aria-label="Remover ${_esc(s.nome_servico)}" style="color:var(--danger)">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      ${parsedDesc.texto ? `<p class="servico-card-desc">${_esc(parsedDesc.texto)}</p>` : ''}
      ${discountInfoHtml}
      <div class="servico-card-footer">
        ${precoHtml}
        <span class="servico-card-duracao">
          <i class="ti ti-clock" aria-hidden="true"></i> ${_esc(s.duracao)} min
        </span>
      </div>`;

    card.querySelector('.btn-edit').addEventListener('click', () => _abrirModal(s));
    card.querySelector('.btn-del').addEventListener('click', () => _deletar(id, card));
    grid.appendChild(card);

    anime({ targets: card, opacity: [0,1], translateY: [20,0], delay: idx * 60, ...SPRING_ENTRADA });
  });
}

const PRESETS = {
  salao: [
    { nome_servico: 'Corte de Cabelo', preco: 45.00, duracao: '30', descricao: 'Corte moderno com lavagem inclusa' },
    { nome_servico: 'Barba Completa', preco: 30.00, duracao: '30', descricao: 'Barboterapia clássica com toalha quente' },
    { nome_servico: 'Corte + Barba', preco: 70.00, duracao: '60', descricao: 'Combo completo para cabelo e barba' }
  ],
  clinica: [
    { nome_servico: 'Consulta Geral', preco: 180.00, duracao: '45', descricao: 'Avaliação clínica inicial completa' },
    { nome_servico: 'Consulta de Retorno', preco: 0.00, duracao: '30', descricao: 'Acompanhamento do tratamento' }
  ],
  bemestar: [
    { nome_servico: 'Massagem Relaxante', preco: 120.00, duracao: '60', descricao: 'Massagem corporal relaxante com óleos essenciais' },
    { nome_servico: 'Limpeza de Pele', preco: 90.00, duracao: '45', descricao: 'Extração de cravos e hidratação profunda' }
  ]
};

async function _importarSugestoes(categoria) {
  if (!siteId) {
    Toast.error('Nenhum site vinculado. Configure em Configurações primeiro.');
    return;
  }

  const items = PRESETS[categoria];
  if (!items) return;

  Toast.info('Importando serviços sugeridos...');

  const payload = items.map(p => ({
    id_site: siteId,
    nome_servico: p.nome_servico,
    preco: p.preco,
    duracao: p.duracao,
    descricao: p.descricao
  }));

  try {
    const { data, error } = await supabase
      .from('servicos')
      .insert(payload)
      .select();

    if (error) throw error;

    servicos = data ?? [];
    _renderGrid();
    Toast.success('Sugestões importadas com sucesso!');
  } catch (err) {
    Toast.error('Erro ao importar sugestões.');
  }
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
  const descTexto = document.getElementById('ms-desc').value.trim();
  const descontoPct = parseFloat(document.getElementById('ms-desconto-pct').value) || 0;
  const descontoAte = document.getElementById('ms-desconto-ate').value || '';

  if (!nome) {
    Toast.warning('Nome obrigatório.');
    document.getElementById('ms-nome').focus();
    return;
  }

  if (!siteId) {
    Toast.error('Nenhum site vinculado. Configure em Configurações primeiro.');
    return;
  }

  const desc = JSON.stringify({ texto: descTexto, desconto_pct: descontoPct, desconto_ate: descontoAte });
  const isEditing = !!editandoId;

  if (isEditing) {
    const prev = [...servicos];
    const idx = servicos.findIndex(s => (s.id_servico ?? s.id) === editandoId);
    if (idx >= 0) {
      servicos[idx] = { ...servicos[idx], nome_servico: nome, preco, duracao, descricao: desc };
    }
    _renderGrid();
    _fecharModal();
    Toast.success(`"${nome}" atualizado!`);

    const { data, error } = await supabase
      .from('servicos')
      .update({ nome_servico: nome, preco, duracao, descricao: desc })
      .eq('id_servico', editandoId)
      .select().single();

    if (error) {
      servicos = prev;
      _renderGrid();
      Toast.error('Erro ao atualizar no banco.');
    } else {
      const currentIdx = servicos.findIndex(s => (s.id_servico ?? s.id) === editandoId);
      if (currentIdx >= 0) servicos[currentIdx] = data;
      _renderGrid();
    }
  } else {
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
      _renderGrid();
    }
  }
}

function _abrirModal(s = null) {
  const modal = document.getElementById('modal-servico');
  const titulo = document.getElementById('modal-titulo');
  const btnSalvar = document.getElementById('btn-salvar-servico');

  if (s) {
    editandoId = s.id_servico ?? s.id;
    titulo.textContent = 'Editar Serviço';
    btnSalvar.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> Salvar Alterações`;

    document.getElementById('ms-nome').value = s.nome_servico || '';
    document.getElementById('ms-preco').value = s.preco || '';
    document.getElementById('ms-duracao').value = s.duracao || '';

    const parsedDesc = parseDescricao(s.descricao);
    document.getElementById('ms-desc').value = parsedDesc.texto || '';
    document.getElementById('ms-desconto-pct').value = parsedDesc.desconto_pct || '';
    document.getElementById('ms-desconto-ate').value = parsedDesc.desconto_ate || '';


  } else {
    editandoId = null;
    titulo.textContent = 'Novo Serviço';
    btnSalvar.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> Salvar Serviço`;

    document.getElementById('ms-nome').value = '';
    document.getElementById('ms-preco').value = '';
    document.getElementById('ms-duracao').value = '';
    document.getElementById('ms-desc').value = '';
    document.getElementById('ms-desconto-pct').value = '';
    document.getElementById('ms-desconto-ate').value = '';


  }

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
      ['ms-nome','ms-preco','ms-duracao','ms-desc', 'ms-desconto-pct', 'ms-desconto-ate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      editandoId = null;
    },
  });
}

function _setupEventos() {
  document.getElementById('btn-novo-servico').addEventListener('click', () => _abrirModal());
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

function parseDescricao(descField) {
  try {
    if (descField && descField.trim().startsWith('{')) {
      const parsed = JSON.parse(descField);
      return {
        texto: parsed.texto || '',
        desconto_pct: parseFloat(parsed.desconto_pct) || 0,
        desconto_ate: parsed.desconto_ate || ''
      };
    }
  } catch (e) {
    // ignore
  }
  return {
    texto: descField || '',
    desconto_pct: 0,
    desconto_ate: ''
  };
}
