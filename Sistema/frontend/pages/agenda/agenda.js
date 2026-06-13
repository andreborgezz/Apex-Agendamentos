/**
 * pages/agenda/agenda.js
 * Calendário mensal de agendamentos_confirmados.
 */

import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Session }       from '../../components/api.js';

const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_NAV     = { easing: 'spring(1,90,14,0)', duration: 500 };

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let viewDate      = new Date();
let agendamentos  = [];

document.addEventListener('DOMContentLoaded', async () => {
  await injectSidebar('sidebar-root');
  await _carregarAgendamentos();
  _renderCalendario();

  document.getElementById('btn-mes-prev').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    _renderCalendario('prev');
  });
  document.getElementById('btn-mes-next').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    _renderCalendario('next');
  });

  anime({ targets: '.main-content', opacity: [0,1], translateY: [8,0], ...SPRING_ENTRADA });
});

async function _carregarAgendamentos() {
  const siteId = Session.getSiteId();
  if (!siteId) {
    agendamentos = [];
    Toast.warning('Nenhum site vinculado. Configure em Configurações.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('agendamentos_confirmados')
      .select('id, data_hora, clientes_do_site(nome_cliente), servicos(nome_servico)')
      .eq('id_site', siteId)
      .order('data_hora');
    if (error) throw error;
    agendamentos = data ?? [];
  } catch (_) {
    agendamentos = [];
    Toast.error('Erro ao carregar agendamentos. Verifique sua conexão.');
  }
}

function _renderCalendario(dir) {
  const grid  = document.getElementById('cal-grid');
  const label = document.getElementById('mes-label');

  label.textContent = `${MESES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const hoje       = new Date();
  const ano        = viewDate.getFullYear();
  const mes        = viewDate.getMonth();
  const primeiroDia= new Date(ano, mes, 1).getDay();
  const totalDias  = new Date(ano, mes + 1, 0).getDate();

  const cells = [];

  // Dias do mês anterior
  const diasAntes = new Date(ano, mes, 0).getDate();
  for (let i = primeiroDia - 1; i >= 0; i--) {
    cells.push({ dia: diasAntes - i, mes: mes - 1, outroMes: true });
  }
  // Dias do mês atual
  for (let d = 1; d <= totalDias; d++) {
    cells.push({ dia: d, mes, outroMes: false });
  }
  // Dias do mês seguinte
  const resto = 42 - cells.length;
  for (let d = 1; d <= resto; d++) {
    cells.push({ dia: d, mes: mes + 1, outroMes: true });
  }

  const oldGrid = grid.cloneNode(true);
  grid.innerHTML = '';

  cells.forEach(({ dia, mes: cellMes, outroMes }) => {
    const dataStr = `${ano}-${String(cellMes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const isHoje  = !outroMes && dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

    const eventosHoje = agendamentos.filter(a => a.data_hora?.startsWith(dataStr));

    const cell = document.createElement('div');
    cell.className = `cal-cell${outroMes ? ' outro-mes' : ''}${isHoje ? ' hoje' : ''}`;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `${dia} de ${MESES[cellMes < 0 ? 11 : cellMes % 12]}`);

    const numEl = document.createElement('div');
    numEl.className = 'cal-num';
    numEl.textContent = dia;
    cell.appendChild(numEl);

    eventosHoje.slice(0, 3).forEach(ev => {
      const tag = document.createElement('div');
      tag.className = 'cal-evento cal-evento--confirmado';
      tag.textContent = ev.clientes_do_site?.nome_cliente || 'Agendamento';
      tag.title = `${ev.clientes_do_site?.nome_cliente} — ${ev.servicos?.nome_servico}`;
      cell.appendChild(tag);
    });

    if (eventosHoje.length > 3) {
      const more = document.createElement('div');
      more.className = 'cal-evento';
      more.style.color = 'var(--text-muted)';
      more.textContent = `+${eventosHoje.length - 3} mais`;
      cell.appendChild(more);
    }

    cell.addEventListener('click', () => {
      if (eventosHoje.length) {
        Toast.info(`${eventosHoje.length} agendamento(s) em ${dia}/${cellMes + 1}`);
      }
    });

    grid.appendChild(cell);
  });

  anime({
    targets: grid.querySelectorAll('.cal-cell'),
    opacity: [0,1],
    scale: [0.96,1],
    delay: anime.stagger(8),
    ...SPRING_NAV,
  });
}
