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

let regrasDeFuncionamento = [];

async function init() {
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

  // Eventos do Modal do Dia
  document.getElementById('btn-fechar-modal-dia').addEventListener('click', _fecharModalDia);
  document.getElementById('modal-dia').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-dia')) _fecharModalDia();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('modal-dia').classList.contains('hidden')) {
      _fecharModalDia();
    }
  });

  // Evento de Bloquear Dia
  document.getElementById('btn-bloquear-dia').addEventListener('click', async () => {
    const modal = document.getElementById('modal-dia');
    const activeDateStr = modal.dataset.date;
    if (!activeDateStr) return;

    const availableButtons = document.querySelectorAll('#slots-timeline .slot--disponivel .btn-bloquear-slot');
    if (!availableButtons.length) {
      Toast.info('Não há horários disponíveis para bloquear.');
      return;
    }

    if (!confirm('Deseja realmente bloquear todos os horários livres deste dia?')) return;

    Toast.info('Bloqueando o dia...');

    const siteId = Session.getSiteId();
    const payloads = [];

    availableButtons.forEach(btn => {
      const hora = btn.dataset.hora;
      payloads.push({
        id_site: siteId,
        id_cliente: null,
        id_servico: null,
        data_hora: `${activeDateStr}T${hora}:00Z`
      });
    });

    try {
      const { error } = await supabase
        .from('agendamentos_confirmados')
        .insert(payloads);

      if (error) throw error;

      Toast.success('Dia bloqueado com sucesso!');
      await _carregarAgendamentos();
      _renderCalendario();
      
      // Recarrega o modal para exibir os slots bloqueados
      const dObj = new Date(`${activeDateStr}T00:00:00Z`);
      const y = dObj.getUTCFullYear();
      const m = dObj.getUTCMonth();
      const d = dObj.getUTCDate();
      
      const eventosHoje = agendamentos.filter(a => {
        if (!a.data_hora) return false;
        const dVal = new Date(a.data_hora);
        return dVal.getUTCFullYear() === y && dVal.getUTCMonth() === m && dVal.getUTCDate() === d;
      });
      _abrirModalDia(d, m, y, eventosHoje);
    } catch (err) {
      Toast.error('Erro ao bloquear o dia.');
    }
  });

  anime({ targets: '.main-content', opacity: [0,1], translateY: [8,0], ...SPRING_ENTRADA });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function _carregarAgendamentos() {
  const siteId = Session.getSiteId();
  if (!siteId) {
    agendamentos = [];
    regrasDeFuncionamento = [];
    Toast.warning('Nenhum site vinculado. Configure em Configurações.');
    return;
  }

  try {
    // 1. Buscar agendamentos com dados completos (clientes e servicos)
    const { data, error } = await supabase
      .from('agendamentos_confirmados')
      .select(`
        id,
        data_hora,
        clientes_do_site ( nome_cliente, email_cliente, telefone_cliente ),
        servicos ( nome_servico, preco, duracao )
      `)
      .eq('id_site', siteId)
      .order('data_hora');
    if (error) throw error;
    agendamentos = data ?? [];

    // 2. Buscar regras de funcionamento do site
    const { data: regras, error: errorRegras } = await supabase
      .from('regras_de_horarios')
      .select('*')
      .eq('id_site', siteId);
    if (!errorRegras) {
      regrasDeFuncionamento = regras ?? [];
    }
  } catch (_) {
    agendamentos = [];
    regrasDeFuncionamento = [];
    Toast.error('Erro ao carregar dados da agenda.');
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
    const isHoje  = !outroMes && dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

    // Filtra agendamentos comparando ano, mês e dia em UTC (evita timezone shift)
    const eventosHoje = agendamentos.filter(a => {
      if (!a.data_hora) return false;
      const d = new Date(a.data_hora);
      return d.getUTCFullYear() === ano && d.getUTCMonth() === cellMes && d.getUTCDate() === dia;
    });

    const agendamentosReais = eventosHoje.filter(ev => ev.clientes_do_site && ev.clientes_do_site.nome_cliente);
    const bloqueios = eventosHoje.filter(ev => !ev.clientes_do_site || !ev.clientes_do_site.nome_cliente);

    const cell = document.createElement('div');
    cell.className = `cal-cell${outroMes ? ' outro-mes' : ''}${isHoje ? ' hoje' : ''}`;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `${dia} de ${MESES[cellMes < 0 ? 11 : cellMes % 12]}`);

    // Aplicar estilo visual se houver bloqueios
    if (bloqueios.length > 0) {
      if (agendamentosReais.length === 0) {
        // Apenas bloqueios: dia bloqueado (cinza/vermelho)
        cell.style.background = 'rgba(224, 82, 82, 0.06)';
        cell.style.borderColor = 'rgba(224, 82, 82, 0.18)';
      } else {
        // Misto: agendamento + bloqueio (borda de aviso)
        cell.style.borderLeft = '3px solid var(--warning)';
      }
    }

    const numEl = document.createElement('div');
    numEl.className = 'cal-num';
    numEl.textContent = dia;
    cell.appendChild(numEl);

    // Mostra até 2 agendamentos reais
    agendamentosReais.slice(0, 2).forEach(ev => {
      const tag = document.createElement('div');
      tag.className = 'cal-evento cal-evento--confirmado';
      
      const d = new Date(ev.data_hora);
      const hh = d.getUTCHours().toString().padStart(2, '0');
      const mm = d.getUTCMinutes().toString().padStart(2, '0');

      tag.textContent = `${hh}:${mm} ${ev.clientes_do_site.nome_cliente}`;
      tag.title = `${hh}:${mm} - ${ev.clientes_do_site.nome_cliente} — ${ev.servicos?.nome_servico}`;
      cell.appendChild(tag);
    });

    // Mostra indicador de bloqueio se houver
    if (bloqueios.length > 0) {
      const tag = document.createElement('div');
      tag.className = 'cal-evento';
      tag.style.cssText = 'background: var(--surface-alt); border: 1px solid var(--border); color: var(--text-secondary); font-weight: 500; display: flex; align-items: center; gap: 4px;';
      tag.innerHTML = `<i class="ti ti-lock" style="font-size: 0.7rem;"></i> ${bloqueios.length} Bloqueado${bloqueios.length > 1 ? 's' : ''}`;
      cell.appendChild(tag);
    }

    const totalItensMostrados = agendamentosReais.slice(0, 2).length + (bloqueios.length > 0 ? 1 : 0);
    if (eventosHoje.length > totalItensMostrados) {
      const more = document.createElement('div');
      more.className = 'cal-evento';
      more.style.color = 'var(--text-muted)';
      more.textContent = `+${eventosHoje.length - totalItensMostrados} mais`;
      cell.appendChild(more);
    }

    cell.addEventListener('click', () => {
      _abrirModalDia(dia, cellMes, ano, eventosHoje);
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

/* ── MODAL DE DETALHES DO DIA (TIPO TRELLO) ──────────────── */
function _abrirModalDia(dia, cellMes, ano, eventosHoje) {
  const modal = document.getElementById('modal-dia');
  const titulo = document.getElementById('modal-dia-titulo');
  const timeline = document.getElementById('slots-timeline');

  // Ajustar data UTC para obter o dia correto da semana
  const dataObj = new Date(Date.UTC(ano, cellMes, dia));
  const diaSemana = dataObj.getUTCDay();

  const formattedDate = dataObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

  const dataStr = `${ano}-${String(cellMes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  modal.dataset.date = dataStr;

  titulo.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  timeline.innerHTML = '';

  // Buscar regra de funcionamento para o dia da semana
  const regra = regrasDeFuncionamento.find(r => r.dia_semana === diaSemana);

  if (!regra) {
    if (!eventosHoje.length) {
      timeline.innerHTML = `
        <div style="text-align:center;padding:32px 12px;color:var(--text-muted)">
          <i class="ti ti-calendar-off" style="font-size:2.5rem;display:block;margin-bottom:8px;opacity:0.3" aria-hidden="true"></i>
          <p style="font-size:0.875rem;font-weight:500">Estabelecimento Fechado</p>
          <p style="font-size:0.75rem;margin-top:2px">Nenhuma regra de funcionamento para este dia.</p>
        </div>`;
    } else {
      // Se houver agendamentos mesmo sem regra, listar todos
      eventosHoje.forEach(ev => {
        timeline.appendChild(_criarCardOcupado(ev, dataStr));
      });
    }
  } else {
    // Gerar slots de horários com base nas regras do estabelecimento
    const step = parseInt(regra.duracao, 10) || 30;
    const aberturaMin = paraMinutos(regra.abertura);
    const fechamentoMin = paraMinutos(regra.fechamento);

    let slotsStandard = [];
    let atual = aberturaMin;
    while (atual + step <= fechamentoMin) {
      slotsStandard.push(paraTexto(atual));
      atual += step;
    }

    let eventosRestantes = [...eventosHoje];
    let itensTimeline = [];

    slotsStandard.forEach(slotTime => {
      // Achar agendamento que inicia nesse horário (UTC)
      const matches = eventosRestantes.filter(ev => {
        const d = new Date(ev.data_hora);
        const evTime = d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0');
        return evTime === slotTime;
      });

      if (matches.length > 0) {
        matches.forEach(ev => {
          itensTimeline.push({ tipo: 'ocupado', hora: slotTime, dados: ev });
          eventosRestantes = eventosRestantes.filter(x => x.id !== ev.id);
        });
      } else {
        itensTimeline.push({ tipo: 'disponivel', hora: slotTime });
      }
    });

    // Adiciona eventos em horários fora do padrão (avulsos)
    eventosRestantes.forEach(ev => {
      const d = new Date(ev.data_hora);
      const evTime = d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0');
      itensTimeline.push({ tipo: 'ocupado', hora: evTime, dados: ev });
    });

    // Ordenar cronologicamente
    itensTimeline.sort((a, b) => paraMinutos(a.hora) - paraMinutos(b.hora));

    // Renderizar itens na lista (tipo Trello)
    itensTimeline.forEach(item => {
      if (item.tipo === 'ocupado') {
        timeline.appendChild(_criarCardOcupado(item.dados, dataStr));
      } else {
        timeline.appendChild(_criarCardDisponivel(item.hora, dataStr));
      }
    });
  }

  modal.classList.remove('hidden');
  anime({ targets: modal, opacity: [0,1], easing: 'easeOutQuad', duration: 250 });
  anime({ targets: '#modal-dia-card', scale: [0.94,1], translateY: [16,0], easing: 'spring(1,80,12,0)', duration: 600 });
}

function _criarCardOcupado(ev, dataStr) {
  const d = new Date(ev.data_hora);
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  
  const isBloqueio = !ev.clientes_do_site || !ev.clientes_do_site.nome_cliente;
  const card = document.createElement('div');
  
  if (isBloqueio) {
    card.className = 'slot-row slot--bloqueado';
    card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface-alt);box-shadow:var(--shadow-sm);';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-family:var(--font-mono);font-size:0.875rem;font-weight:700;color:var(--text-muted);min-width:48px;margin-top:2px">${hh}:${mm}</span>
        <span style="font-size:0.8125rem;font-weight:600;color:var(--text-secondary)"><i class="ti ti-lock" aria-hidden="true"></i> Horário Bloqueado</span>
      </div>
      <button class="btn btn--ghost btn--sm btn-desbloquear" data-id="${ev.id}" style="padding:4px 8px;font-size:0.75rem;color:var(--danger)">Desbloquear</button>`;
    
    card.querySelector('.btn-desbloquear').addEventListener('click', () => _desbloquearSlot(ev.id, dataStr));
    return card;
  }

  const preco = ev.servicos?.preco ? Number(ev.servicos.preco).toFixed(2).replace('.', ',') : '0,00';
  card.className = 'slot-row slot--ocupado';
  card.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--accent);border-radius:var(--r-md);background:var(--accent-subtle);box-shadow:var(--shadow-sm);';
  
  card.innerHTML = `
    <span style="font-family:var(--font-mono);font-size:0.875rem;font-weight:700;color:var(--accent);min-width:48px;margin-top:2px">${hh}:${mm}</span>
    <div style="display:flex;flex-direction:column;gap:2px;flex:1">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:0.875rem;font-weight:600;color:var(--text-primary)">${_esc(ev.clientes_do_site.nome_cliente)}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:0.8125rem;font-weight:700;color:var(--accent);white-space:nowrap">R$ ${preco}</span>
          <button class="btn btn--ghost btn--sm btn-cancelar-agendamento" data-id="${ev.id}" style="padding:3px 6px;font-size:0.7rem;color:var(--danger)">Desmarcar</button>
        </div>
      </div>
      <span style="font-size:0.75rem;color:var(--text-secondary)">${_esc(ev.servicos?.nome_servico || 'Serviço')} (${_esc(ev.servicos?.duracao || '30')} min)</span>
      <div style="display:flex;flex-wrap:wrap;row-gap:2px;column-gap:12px;margin-top:4px;font-size:0.7rem;color:var(--text-muted)">
        ${ev.clientes_do_site.email_cliente ? `<span><i class="ti ti-mail" aria-hidden="true"></i> ${_esc(ev.clientes_do_site.email_cliente)}</span>` : ''}
        ${ev.clientes_do_site.telefone_cliente ? `<span><i class="ti ti-phone" aria-hidden="true"></i> ${_esc(ev.clientes_do_site.telefone_cliente)}</span>` : ''}
      </div>
    </div>`;

  card.querySelector('.btn-cancelar-agendamento').addEventListener('click', () => _cancelarAgendamento(ev.id, dataStr));
  return card;
}

function _criarCardDisponivel(hora, dataStr) {
  const card = document.createElement('div');
  card.className = 'slot-row slot--disponivel';
  card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface);box-shadow:var(--shadow-sm);';
  
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-family:var(--font-mono);font-size:0.875rem;font-weight:600;color:var(--text-secondary);min-width:48px">${hora}</span>
      <span style="font-size:0.8125rem;color:var(--text-muted)">Disponível</span>
    </div>
    <button class="btn btn--ghost btn--sm btn-bloquear-slot" data-hora="${hora}" style="padding:4px 8px;font-size:0.75rem">Bloquear</button>`;

  card.querySelector('.btn-bloquear-slot').addEventListener('click', () => _bloquearSlot(hora, dataStr));
  return card;
}

async function _bloquearSlot(hora, dataStr) {
  const siteId = Session.getSiteId();
  if (!siteId) return;

  const dataHoraIso = `${dataStr}T${hora}:00Z`;
  Toast.info('Bloqueando horário...');

  try {
    const { data, error } = await supabase
      .from('agendamentos_confirmados')
      .insert([{
        id_site: siteId,
        id_cliente: null,
        id_servico: null,
        data_hora: dataHoraIso
      }])
      .select();

    if (error) throw error;

    Toast.success('Horário bloqueado!');
    await _carregarAgendamentos();
    _renderCalendario();
    
    // Atualizar o modal atual
    const dObj = new Date(dataHoraIso);
    const d = dObj.getUTCDate();
    const m = dObj.getUTCMonth();
    const y = dObj.getUTCFullYear();
    
    const eventosHoje = agendamentos.filter(a => {
      if (!a.data_hora) return false;
      const dVal = new Date(a.data_hora);
      return dVal.getUTCFullYear() === y && dVal.getUTCMonth() === m && dVal.getUTCDate() === d;
    });
    _abrirModalDia(d, m, y, eventosHoje);

  } catch (err) {
    Toast.error('Erro ao bloquear horário.');
  }
}

async function _desbloquearSlot(id, dataStr) {
  Toast.info('Desbloqueando horário...');

  try {
    const { error } = await supabase
      .from('agendamentos_confirmados')
      .delete()
      .eq('id', id);

    if (error) throw error;

    Toast.success('Horário desbloqueado!');
    await _carregarAgendamentos();
    _renderCalendario();
    
    // Atualizar modal
    const dObj = new Date(`${dataStr}T00:00:00Z`);
    const y = dObj.getUTCFullYear();
    const m = dObj.getUTCMonth();
    const d = dObj.getUTCDate();
    
    const eventosHoje = agendamentos.filter(a => {
      if (!a.data_hora) return false;
      const dVal = new Date(a.data_hora);
      return dVal.getUTCFullYear() === y && dVal.getUTCMonth() === m && dVal.getUTCDate() === d;
    });
    _abrirModalDia(d, m, y, eventosHoje);
  } catch (err) {
    Toast.error('Erro ao desbloquear horário.');
  }
}

async function _cancelarAgendamento(id, dataStr) {
  if (!confirm('Deseja realmente desmarcar este agendamento?')) return;
  Toast.info('Cancelando agendamento...');

  try {
    const { error } = await supabase
      .from('agendamentos_confirmados')
      .delete()
      .eq('id', id);

    if (error) throw error;

    Toast.success('Agendamento desmarcado!');
    await _carregarAgendamentos();
    _renderCalendario();
    
    // Atualizar modal
    const dObj = new Date(`${dataStr}T00:00:00Z`);
    const y = dObj.getUTCFullYear();
    const m = dObj.getUTCMonth();
    const d = dObj.getUTCDate();
    
    const eventosHoje = agendamentos.filter(a => {
      if (!a.data_hora) return false;
      const dVal = new Date(a.data_hora);
      return dVal.getUTCFullYear() === y && dVal.getUTCMonth() === m && dVal.getUTCDate() === d;
    });
    _abrirModalDia(d, m, y, eventosHoje);
  } catch (err) {
    Toast.error('Erro ao cancelar agendamento.');
  }
}

function _fecharModalDia() {
  const modal = document.getElementById('modal-dia');
  anime({
    targets: modal,
    opacity: [1,0],
    duration: 200,
    easing: 'easeInQuad',
    complete: () => {
      modal.classList.add('hidden');
    }
  });
}

/* ── HELPERS ─────────────────────────────────────────────── */
const paraMinutos = (texto) => {
  const [horas, minutos] = texto.split(':').map(Number);
  return horas * 60 + minutos;
};

const paraTexto = (minutos) => {
  const h = Math.floor(minutos / 60).toString().padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
