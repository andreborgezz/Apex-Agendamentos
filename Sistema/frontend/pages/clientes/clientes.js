/**
 * pages/clientes/clientes.js
 * Listagem de clientes_do_site com busca e paginação.
 * Dados reais — sem mock.
 */

import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Session }       from '../../components/api.js';

const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };

let clientes     = [];
let searchQuery  = '';
let currentPage  = 1;
const pageSize   = 10;

async function init() {
  await injectSidebar('sidebar-root');
  await _carregarClientes();
  _setupEventos();
  anime({ targets: '.main-content', opacity: [0,1], translateY: [8,0], ...SPRING_ENTRADA });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function _carregarClientes() {
  const siteId = Session.getSiteId();
  if (!siteId) {
    clientes = [];
    Toast.warning('Nenhum site vinculado. Configure em Configurações.');
    _renderTabela();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('clientes_do_site')
      .select(`
        id_cliente,
        nome_cliente,
        email_cliente,
        telefone_cliente,
        agendamentos_confirmados(count)
      `)
      .eq('id_site', siteId)
      .order('id_cliente');

    if (error) throw error;
    clientes = data ?? [];

  } catch (err) {
    clientes = [];
    Toast.error('Erro ao carregar clientes. Verifique sua conexão.');
  }

  _renderTabela();
}

function _renderTabela() {
  const q        = searchQuery.toLowerCase();
  const filtrado = clientes.filter(c =>
    c.nome_cliente.toLowerCase().includes(q)  ||
    c.email_cliente.toLowerCase().includes(q) ||
    (c.telefone_cliente || '').includes(q)
  );

  const total = Math.ceil(filtrado.length / pageSize);
  const start = (currentPage - 1) * pageSize;
  const slice = filtrado.slice(start, start + pageSize);

  const tbody = document.getElementById('tbody-clientes');
  tbody.innerHTML = '';

  if (!slice.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">
          <i class="ti ti-users-off" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.4" aria-hidden="true"></i>
          Nenhum cliente encontrado.
        </td>
      </tr>`;
  } else {
    slice.forEach((c, idx) => {
      const nAgend = c.agendamentos_confirmados?.[0]?.count ?? 0;
      const tr = document.createElement('tr');
      tr.style.opacity = '0';
      tr.innerHTML = `
        <td style="color:var(--text-muted);font-size:0.8125rem;font-family:var(--font-mono)">#${c.id_cliente}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--accent-subtle);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0" aria-hidden="true">
              ${c.nome_cliente[0].toUpperCase()}
            </div>
            <span style="font-weight:500">${_esc(c.nome_cliente)}</span>
          </div>
        </td>
        <td style="color:var(--text-secondary)">${_esc(c.email_cliente)}</td>
        <td style="color:var(--text-secondary);font-family:var(--font-mono)">${_esc(c.telefone_cliente || '—')}</td>
        <td>
          <span style="font-size:0.875rem;font-weight:600;color:var(--accent)">${nAgend}</span>
          <span style="font-size:0.8125rem;color:var(--text-muted)"> agendamento${nAgend !== 1 ? 's' : ''}</span>
        </td>`;
      tbody.appendChild(tr);
      anime({ targets: tr, opacity: [0,1], translateX: [-8,0], delay: idx * 30, ...SPRING_ENTRADA });
    });
  }

  document.getElementById('table-count').textContent       = `${filtrado.length} clientes`;
  document.getElementById('table-count-footer').textContent = `${filtrado.length} cliente${filtrado.length !== 1 ? 's' : ''}`;
  _renderPaginacao(total);
}

function _renderPaginacao(total) {
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  if (total <= 1) return;

  [
    { lbl: '‹', dis: currentPage === 1,     fn: () => { currentPage--; _renderTabela(); } },
    ...Array.from({ length: total }, (_, i) => ({ lbl: i+1, dis: false, fn: () => { currentPage = i+1; _renderTabela(); }, active: i+1 === currentPage })),
    { lbl: '›', dis: currentPage === total, fn: () => { currentPage++; _renderTabela(); } },
  ].forEach(({ lbl, dis, fn, active }) => {
    const btn = document.createElement('button');
    btn.className = `page-btn${active ? ' active' : ''}`;
    btn.textContent = lbl;
    btn.disabled    = dis;
    btn.addEventListener('click', fn);
    pag.appendChild(btn);
  });
}

function _setupEventos() {
  document.getElementById('search-clientes').addEventListener('input', e => {
    searchQuery  = e.target.value;
    currentPage  = 1;
    _renderTabela();
  });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
