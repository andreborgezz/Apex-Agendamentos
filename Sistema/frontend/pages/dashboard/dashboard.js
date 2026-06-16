/**
 * pages/dashboard/dashboard.js
 * Dashboard: métricas reais, tabela de agendamentos_confirmados, paginação e busca.
 *
 * Padrão da skill:
 *  ✅ supabase de components/supabase.js
 *  ✅ Toast de components/toast.js
 *  ✅ sidebar de components/sidebar.js
 *  ✅ Skeleton de components/skeleton.js
 *  ✅ anime.js com SPRING_* fixos
 *  ✅ Optimistic update + rollback
 *  ✅ Dados reais — sem mock
 */

import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Skeleton }      from '../../components/skeleton.js';
import { Session }       from '../../components/api.js';

/* ── SPRINGS ─────────────────────────────────────────────── */
const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

/* ── ESTADO LOCAL ────────────────────────────────────────── */
const state = {
  siteId:       null,
  agendamentos: [],
  currentPage:  1,
  pageSize:     8,
  searchQuery:  '',
};

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
async function init() {
  await injectSidebar('sidebar-root');

  state.siteId = Session.getSiteId();
  if (!state.siteId) {
    Toast.warning('Nenhum site vinculado à sua conta. Configure em Configurações.');
  }

  await carregarDados();
  _setupEventos();

  anime({
    targets: '.main-content',
    opacity: [0, 1],
    translateY: [8, 0],
    ...SPRING_ENTRADA,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ── CARREGAR DADOS ──────────────────────────────────────── */
async function carregarDados() {
  if (!state.siteId) {
    state.agendamentos = [];
    _renderMetricas();
    _renderTabela();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('agendamentos_confirmados')
      .select(`
        id,
        data_hora,
        id_servico,
        clientes_do_site ( nome_cliente ),
        servicos ( nome_servico, preco )
      `)
      .eq('id_site', state.siteId)
      .not('id_cliente', 'is', null)
      .order('data_hora', { ascending: false });

    if (error) throw error;

    state.agendamentos = (data ?? []).map(a => ({
      id:       a.id,
      cliente:  a.clientes_do_site?.nome_cliente || '(sem nome)',
      servico:  a.servicos?.nome_servico         || '(sem serviço)',
      preco:    Number(a.servicos?.preco)         || 0,
      data_hora: a.data_hora,
      status:   'confirmado',
    }));

  } catch (err) {
    state.agendamentos = [];
    Toast.error('Erro ao carregar agendamentos. Verifique sua conexão.');
  }

  _renderMetricas();
  _renderTabela();
}

/* ── MÉTRICAS ────────────────────────────────────────────── */
function _renderMetricas() {
  const agora = new Date();
  const anoHoje = agora.getFullYear();
  const mesHoje = agora.getMonth();
  const diaHoje = agora.getDate();

  /* Agendamentos de hoje usando UTC para evitar shift de timezone */
  const agendHoje = state.agendamentos.filter(a => {
    if (a.status === 'cancelado') return false;
    const d = new Date(a.data_hora);
    return d.getUTCFullYear() === anoHoje && d.getUTCMonth() === mesHoje && d.getUTCDate() === diaHoje;
  });

  /* Faturamento real do mês — soma dos preços dos serviços confirmados em UTC */
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  const confirmadosMes = state.agendamentos.filter(a => {
    if (a.status === 'cancelado') return false;
    const d = new Date(a.data_hora);
    return d.getUTCMonth() === mesAtual && d.getUTCFullYear() === anoAtual;
  });

  const fatEstimado = confirmadosMes.reduce((acc, a) => acc + a.preco, 0);

  /* Faturamento do mês anterior para calcular trend */
  const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

  const confirmadosMesAnt = state.agendamentos.filter(a => {
    if (a.status === 'cancelado') return false;
    const d = new Date(a.data_hora);
    return d.getUTCMonth() === mesAnterior && d.getUTCFullYear() === anoAnterior;
  });

  const fatAnterior = confirmadosMesAnt.reduce((acc, a) => acc + a.preco, 0);

  /* Clientes únicos */
  const leads = new Set(state.agendamentos.map(a => a.cliente)).size;

  /* Calcular trends */
  const trendFat = fatAnterior > 0
    ? Math.round(((fatEstimado - fatAnterior) / fatAnterior) * 100)
    : 0;

  const agendMesAtual = confirmadosMes.length;
  const agendMesAnt   = confirmadosMesAnt.length;
  const trendAgend    = agendMesAnt > 0
    ? Math.round(((agendMesAtual - agendMesAnt) / agendMesAnt) * 100)
    : 0;

  /* Atualizar valores */
  _setMetric('val-hoje',  agendHoje.length, 'sub-hoje', `de ${state.agendamentos.length} total`);
  _setMetric('val-fat',   `R$ ${fatEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'sub-fat', 'Mês atual');
  _setMetric('val-leads', leads, 'sub-leads', 'Clientes únicos');

  /* Atualizar trends */
  _setTrend('trend-hoje', trendAgend);
  _setTrend('trend-fat',  trendFat);
  _setTrend('trend-leads', 0); // leads não tem trend simples

  document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('skeleton-card'));

  anime({
    targets: '.metric-card',
    opacity: [0, 1],
    translateY: [16, 0],
    delay: anime.stagger(80),
    ...SPRING_ENTRADA,
  });
}

function _setMetric(valId, val, subId, sub) {
  const elV = document.getElementById(valId);
  const elS = document.getElementById(subId);
  if (elV) elV.textContent = val;
  if (elS) elS.textContent = sub;
}

function _setTrend(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;

  if (pct > 0) {
    el.className = 'metric-trend trend--up';
    el.innerHTML = `<i class="ti ti-trending-up" aria-hidden="true"></i> +${pct}%`;
  } else if (pct < 0) {
    el.className = 'metric-trend trend--down';
    el.innerHTML = `<i class="ti ti-trending-down" aria-hidden="true"></i> ${pct}%`;
  } else {
    el.className = 'metric-trend trend--neutral';
    el.innerHTML = `<i class="ti ti-minus" aria-hidden="true"></i> 0%`;
  }
}

/* ── TABELA ──────────────────────────────────────────────── */
function _renderTabela() {
  const q       = state.searchQuery.toLowerCase();
  const filtrado = state.agendamentos.filter(a =>
    a.cliente.toLowerCase().includes(q) || a.servico.toLowerCase().includes(q)
  );

  const total = Math.ceil(filtrado.length / state.pageSize);
  const start = (state.currentPage - 1) * state.pageSize;
  const slice = filtrado.slice(start, start + state.pageSize);

  const tbody = document.getElementById('tbody-agendamentos');
  tbody.innerHTML = '';

  if (!slice.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
          <i class="ti ti-search-off" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.4" aria-hidden="true"></i>
          Nenhum agendamento encontrado.
        </td>
      </tr>`;
  } else {
    slice.forEach((a, idx) => {
      const tr = document.createElement('tr');
      tr.style.opacity = '0';
      tr.innerHTML = `
        <td style="color:var(--text-muted);font-size:0.8125rem;font-family:var(--font-mono)">#${a.id}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--accent-subtle);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0" aria-hidden="true">
              ${a.cliente[0].toUpperCase()}
            </div>
            <span style="font-weight:500">${_esc(a.cliente)}</span>
          </div>
        </td>
        <td style="color:var(--text-secondary)">${_esc(a.servico)}</td>
        <td style="font-size:0.875rem;font-family:var(--font-mono)">${_formatarData(a.data_hora)}</td>
        <td>
          <span class="status-badge status-${a.status}">
            ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}
          </span>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn-icon btn-ver" data-id="${a.id}" title="Ver detalhes" aria-label="Ver detalhes de ${_esc(a.cliente)}">
              <i class="ti ti-eye" aria-hidden="true"></i>
            </button>
            <button class="btn-icon btn-cancelar" data-id="${a.id}" title="Cancelar" aria-label="Cancelar agendamento de ${_esc(a.cliente)}" style="color:var(--danger)">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          </div>
        </td>`;
      tbody.appendChild(tr);

      // Bind ações (não usa onclick inline)
      tr.querySelector('.btn-ver').addEventListener('click', () => _verDetalhes(a.id));
      tr.querySelector('.btn-cancelar').addEventListener('click', () => _cancelar(a.id, tr));

      anime({ targets: tr, opacity: [0, 1], translateX: [-8, 0], delay: idx * 35, ...SPRING_ENTRADA });
    });
  }

  document.getElementById('table-count').textContent =
    `${filtrado.length} registro${filtrado.length !== 1 ? 's' : ''}`;

  _renderPaginacao(total);
}

/* ── PAGINAÇÃO ───────────────────────────────────────────── */
function _renderPaginacao(total) {
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  if (total <= 1) return;

  const prev = _pgBtn('‹', state.currentPage === 1, () => { state.currentPage--; _renderTabela(); });
  pag.appendChild(prev);

  for (let i = 1; i <= total; i++) {
    const btn = _pgBtn(i, false, () => { state.currentPage = i; _renderTabela(); });
    if (i === state.currentPage) btn.classList.add('active');
    pag.appendChild(btn);
  }

  const next = _pgBtn('›', state.currentPage === total, () => { state.currentPage++; _renderTabela(); });
  pag.appendChild(next);
}

function _pgBtn(label, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'page-btn';
  btn.textContent = label;
  btn.disabled    = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

/* ── AÇÕES LINHA ─────────────────────────────────────────── */
function _verDetalhes(id) {
  const a = state.agendamentos.find(x => x.id === id);
  if (a) Toast.info(`${a.cliente} · ${a.servico} · ${_formatarData(a.data_hora)}`);
}

async function _cancelar(id, trEl) {
  const idx = state.agendamentos.findIndex(a => a.id === id);
  if (idx === -1) return;
  const prev = state.agendamentos[idx].status;

  /* Optimistic update */
  state.agendamentos[idx].status = 'cancelado';
  _renderTabela();

  const { error } = await supabase
    .from('agendamentos_confirmados')
    .delete()
    .eq('id', id);

  if (error) {
    /* Rollback */
    state.agendamentos[idx].status = prev;
    _renderTabela();
    Toast.error('Erro ao cancelar. Tente novamente.');
  } else {
    Toast.success('Agendamento cancelado.');
  }
}

/* ── EVENTOS ─────────────────────────────────────────────── */
function _setupEventos() {
  document.getElementById('search-agendamentos').addEventListener('input', e => {
    state.searchQuery  = e.target.value;
    state.currentPage  = 1;
    _renderTabela();
  });

  document.getElementById('btn-refresh').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh');
    btn.disabled = true;
    anime({ targets: btn.querySelector('.ti'), rotate: [0, 360], duration: 600, easing: 'easeInOutQuad' });
    await carregarDados();
    btn.disabled = false;
    Toast.success('Dados atualizados!');
  });
}

/* ── HELPERS ─────────────────────────────────────────────── */
function _formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC'
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
