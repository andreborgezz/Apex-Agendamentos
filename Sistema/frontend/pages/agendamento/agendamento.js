/**
 * pages/agendamento/agendamento.js
 * Fluxo de agendamento público para o cliente final.
 */

import { supabase } from '../../components/supabase.js';
import { Toast }    from '../../components/toast.js';
import { API }      from '../../components/api.js';

/* ── SPRINGS ─────────────────────────────────────────────── */
const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };
const SPRING_NAV     = { easing: 'spring(1,90,14,0)', duration: 500 };

/* ── CONSTANTES ──────────────────────────────────────────── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA_NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/* ── ESTADO LOCAL ────────────────────────────────────────── */
const state = {
  site:            null,
  servicos:        [],
  regrasDias:      [], // Dias da semana ativos (0-6)
  selectedServico: null, // { id_servico, nome_servico, preco, duracao }
  selectedData:    null, // 'YYYY-MM-DD'
  selectedHora:    null, // 'HH:mm'
  viewDate:        new Date(), // Mês ativo no calendário
};

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const siteLink = urlParams.get('link');

  if (!siteLink) {
    Toast.error('Estabelecimento não especificado.');
    _mostrarErroTela('Link de agendamento inválido. Solicite o link correto ao estabelecimento.');
    return;
  }

  await _carregarSite(siteLink);
});

/* ── CARREGAR DADOS DO SITE ──────────────────────────────── */
async function _carregarSite(link) {
  try {
    const site = await API.getSite(link);
    if (!site) throw new Error('Site não encontrado');
    state.site = site;

    // Aplicar a cor primária do site dinamicamente nas variáveis
    if (site.cor_site) {
      document.documentElement.style.setProperty('--apex-accent', site.cor_site);
      // Ajustar cor de destaque sutil também
      document.documentElement.style.setProperty('--apex-accent-subtle', `${site.cor_site}1F`); // Hex + 12% alpha
    }

    // Parse do layout JSON
    let layoutObj = {};
    try {
      layoutObj = JSON.parse(site.layout || '{}');
    } catch (e) {}

    // Aplicar customizações de fundo e fonte do site
    if (layoutObj.bg_color) {
      document.documentElement.style.setProperty('--apex-bg', layoutObj.bg_color);
    }
    if (layoutObj.font_family) {
      document.documentElement.style.setProperty('--font', `'${layoutObj.font_family}', sans-serif`);
      document.documentElement.style.setProperty('--font-display', `'${layoutObj.font_family}', sans-serif`);
      
      const linkId = 'dynamic-font-link';
      let fontLink = document.getElementById(linkId);
      if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = linkId;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }
      fontLink.href = `https://fonts.googleapis.com/css2?family=${layoutObj.font_family.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
    }

    // Preencher cabeçalho (Nome do estabelecimento)
    document.getElementById('store-name').textContent = site.nome_site;

    // Aplicar logotipo se houver
    if (site.logo_loja) {
      document.getElementById('store-logo').innerHTML = `<img src="${_esc(site.logo_loja)}" alt="Logo" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
    }
    
    // Obter nicho a partir do tipo + Contato
    if (site.id_tipo) {
      const { data: tipo } = await supabase.from('tipo_estabelecimento').select('nome_tipo').eq('id_tipo', site.id_tipo).single();
      if (tipo) {
        let nicheText = tipo.nome_tipo.toUpperCase();
        if (layoutObj.whatsapp) {
          nicheText += ` &bull; <i class="ti ti-brand-whatsapp" style="color:var(--apex-success); vertical-align:middle; font-size:1.05rem;"></i> ${layoutObj.whatsapp}`;
        }
        document.getElementById('store-niche').innerHTML = nicheText;
      }
    } else if (layoutObj.whatsapp) {
      document.getElementById('store-niche').innerHTML = `<i class="ti ti-brand-whatsapp" style="color:var(--apex-success); vertical-align:middle; font-size:1.05rem;"></i> ${layoutObj.whatsapp}`;
    }

    // Carregar regras de funcionamento do site para saber quais dias da semana habilitar no calendário
    const { data: regras } = await supabase
      .from('regras_de_horarios')
      .select('dia_semana')
      .eq('id_site', site.id_site);
    
    state.regrasDias = regras ? regras.map(r => r.dia_semana) : [1,2,3,4,5]; // default seg-sex se não houver regras

    // Revelar container
    const container = document.getElementById('fluxo-container');
    container.style.opacity = '1';
    anime({
      targets: container,
      opacity: [0, 1],
      translateY: [20, 0],
      ...SPRING_ENTRADA,
    });

    await _carregarServicos(site.id_site);
    _renderCalendario();
    _setupEventos();

  } catch (err) {
    console.error(err);
    Toast.error('Não foi possível carregar as informações do estabelecimento.');
    _mostrarErroTela('Este link de agendamento não está ativo ou não existe.');
  }
}

/* ── CARREGAR SERVIÇOS ───────────────────────────────────── */
async function _carregarServicos(idSite) {
  const list = document.getElementById('services-list');
  
  try {
    const servicos = await API.getServicos(idSite);
    state.servicos = servicos || [];
    list.innerHTML = '';

    if (!state.servicos.length) {
      list.innerHTML = `<p style="text-align:center;color:var(--apex-text-muted);font-size:0.875rem;padding:24px">Nenhum serviço disponível no momento.</p>`;
      return;
    }

    state.servicos.forEach((s, idx) => {
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

      let precoFinal = Number(s.preco);
      let precoHtml = '';
      if (isDiscountActive) {
        precoFinal = precoFinal * (1 - parsedDesc.desconto_pct / 100);
        precoHtml = `
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px">
            <span style="font-size:0.75rem; text-decoration:line-through; color:var(--apex-text-muted)">R$ ${Number(s.preco).toFixed(2).replace('.', ',')}</span>
            <span class="service-option-price" style="color:var(--apex-success)">R$ ${precoFinal.toFixed(2).replace('.', ',')} <span style="font-size:0.7rem; background:var(--apex-accent-subtle); color:var(--apex-accent); padding:1px 4px; border-radius:3px; font-weight:600">-${parsedDesc.desconto_pct}%</span></span>
          </div>
        `;
      } else {
        precoHtml = `<div class="service-option-price">R$ ${precoFinal.toFixed(2).replace('.', ',')}</div>`;
      }

      const option = document.createElement('div');
      option.className = 'service-option';
      option.dataset.id = s.id_servico;
      option.innerHTML = `
        <div class="service-option-details">
          <span class="service-option-name">${_esc(s.nome_servico)}</span>
          <div class="service-option-meta">
            <i class="ti ti-clock" aria-hidden="true"></i>
            <span>${s.duracao} min</span>
            ${parsedDesc.texto ? `<span>·</span> <span class="meta-desc">${_esc(parsedDesc.texto)}</span>` : ''}
          </div>
        </div>
        ${precoHtml}
      `;

      option.addEventListener('click', () => _selecionarServico(s, option));
      list.appendChild(option);

      anime({
        targets: option,
        opacity: [0, 1],
        translateX: [-12, 0],
        delay: idx * 50,
        ...SPRING_ENTRADA
      });
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = `<p style="text-align:center;color:var(--apex-danger);font-size:0.875rem;padding:24px">Erro ao carregar serviços.</p>`;
  }
}

/* ── SELECIONAR SERVIÇO ──────────────────────────────────── */
function _selecionarServico(servico, elemento) {
  // Atualizar visual
  document.querySelectorAll('.service-option').forEach(el => el.classList.remove('selected'));
  elemento.classList.add('selected');
  anime({ targets: elemento, scale: [0.98, 1], ...SPRING_MICRO });

  state.selectedServico = servico;
  
  // Limpar seleção de data/hora caso mude de serviço
  state.selectedData = null;
  state.selectedHora = null;
  document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
  _renderSlots([]);
  
  _atualizarResumo();

  // Scroll suave até o calendário
  document.getElementById('step-data-hora').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── RENDER CALENDÁRIO ───────────────────────────────────── */
function _renderCalendario() {
  const grid = document.getElementById('calendar-days');
  const label = document.getElementById('calendar-label');
  
  grid.innerHTML = '';
  
  const ano = state.viewDate.getFullYear();
  const mes = state.viewDate.getMonth();
  
  label.textContent = `${MESES[mes]} ${ano}`;

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  // Preencher dias vazios do mês anterior
  const totalDiasAnterior = new Date(ano, mes, 0).getDate();
  for (let i = primeiroDia - 1; i >= 0; i--) {
    const dayBtn = document.createElement('button');
    dayBtn.className = 'calendar-day';
    dayBtn.textContent = totalDiasAnterior - i;
    dayBtn.disabled = true;
    grid.appendChild(dayBtn);
  }

  // Preencher dias do mês atual
  for (let d = 1; d <= totalDias; d++) {
    const dataAtual = new Date(ano, mes, d);
    const diaSemana = dataAtual.getDay();
    const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    const dayBtn = document.createElement('button');
    dayBtn.className = 'calendar-day';
    dayBtn.textContent = d;

    // Verificar se o dia é hoje
    const isHoje = dataAtual.getTime() === hoje.getTime();
    if (isHoje) {
      dayBtn.classList.add('hoje');
    }

    // Validações para habilitar o dia:
    // 1. Não pode ser no passado
    // 2. O estabelecimento precisa funcionar nesse dia da semana (regras_de_horarios)
    const noPassado = dataAtual.getTime() < hoje.getTime();
    const diaAtivo = state.regrasDias.includes(diaSemana);
    
    if (noPassado || !diaAtivo) {
      dayBtn.disabled = true;
    }

    // Se já estiver selecionada esta data, marcar como ativo
    if (state.selectedData === dataStr) {
      dayBtn.classList.add('selected');
    }

    dayBtn.addEventListener('click', () => {
      if (!state.selectedServico) {
        Toast.warning('Por favor, selecione primeiro um serviço (Passo 1).');
        document.getElementById('step-servico').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      
      document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
      dayBtn.classList.add('selected');
      anime({ targets: dayBtn, scale: [0.9, 1], ...SPRING_MICRO });

      state.selectedData = dataStr;
      state.selectedHora = null;
      _atualizarResumo();
      _carregarHorariosDisponiveis();
    });

    grid.appendChild(dayBtn);
  }

  // Preencher dias vazios do próximo mês até fechar 42 células
  const totalCelulas = grid.children.length;
  const restante = 42 - totalCelulas;
  for (let d = 1; d <= restante; d++) {
    const dayBtn = document.createElement('button');
    dayBtn.className = 'calendar-day';
    dayBtn.textContent = d;
    dayBtn.disabled = true;
    grid.appendChild(dayBtn);
  }

  // Animação de entrada nas células
  anime({
    targets: grid.querySelectorAll('.calendar-day:not(:disabled)'),
    opacity: [0, 1],
    scale: [0.95, 1],
    delay: anime.stagger(10),
    ...SPRING_NAV,
  });
}

/* ── CARREGAR HORÁRIOS DISPONÍVEIS ───────────────────────── */
async function _carregarHorariosDisponiveis() {
  const grid = document.getElementById('slots-grid');
  grid.innerHTML = `
    <div class="skeleton" style="height:38px; border-radius:var(--r-md)"></div>
    <div class="skeleton" style="height:38px; border-radius:var(--r-md)"></div>
    <div class="skeleton" style="height:38px; border-radius:var(--r-md)"></div>
    <div class="skeleton" style="height:38px; border-radius:var(--r-md)"></div>
  `;

  try {
    const res = await API.getDisponibilidade(
      state.site.id_site,
      state.selectedData,
      state.selectedServico.id_servico
    );

    _renderSlots(res?.horarios_disponiveis || []);

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--apex-danger); font-size:0.8125rem; padding:12px;">Erro ao carregar horários disponíveis.</p>`;
  }
}

/* ── RENDER SLOTS ────────────────────────────────────────── */
function _renderSlots(slots) {
  const grid = document.getElementById('slots-grid');
  grid.innerHTML = '';

  if (!slots.length) {
    grid.innerHTML = `
      <p style="grid-column: 1/-1; text-align: center; color: var(--apex-text-muted); font-size: 0.8125rem; padding: 16px;">
        <i class="ti ti-calendar-off" style="font-size:1.2rem; display:block; margin-bottom:6px; opacity:0.5" aria-hidden="true"></i>
        Nenhum horário disponível para esta data.
      </p>
    `;
    return;
  }

  slots.forEach((hora, idx) => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = hora;
    
    if (state.selectedHora === hora) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => {
      document.querySelectorAll('.slot-btn').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      anime({ targets: btn, scale: [0.93, 1], ...SPRING_MICRO });

      state.selectedHora = hora;
      _atualizarResumo();
      
      // Scroll suave para o formulário
      document.getElementById('step-confirmar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    grid.appendChild(btn);

    anime({
      targets: btn,
      opacity: [0, 1],
      scale: [0.92, 1],
      delay: idx * 20,
      ...SPRING_NAV,
    });
  });
}

/* ── ATUALIZAR RESUMO ────────────────────────────────────── */
function _atualizarResumo() {
  const sServico  = document.getElementById('summary-servico');
  const sDataHora = document.getElementById('summary-data-hora');
  const sPreco    = document.getElementById('summary-preco');
  const btnConf   = document.getElementById('btn-confirmar');

  if (state.selectedServico) {
    sServico.textContent = state.selectedServico.nome_servico;

    // Parse discount
    const parsedDesc = parseDescricao(state.selectedServico.descricao);
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

    let precoFinal = Number(state.selectedServico.preco);
    if (isDiscountActive) {
      precoFinal = precoFinal * (1 - parsedDesc.desconto_pct / 100);
      sPreco.innerHTML = `
        <span style="font-size:0.875rem; text-decoration:line-through; color:var(--apex-text-muted); margin-right:6px">R$ ${Number(state.selectedServico.preco).toFixed(2).replace('.', ',')}</span>
        <span style="color:var(--apex-success)">R$ ${precoFinal.toFixed(2).replace('.', ',')}</span>
      `;
    } else {
      sPreco.textContent = `R$ ${precoFinal.toFixed(2).replace('.', ',')}`;
    }
  } else {
    sServico.textContent = '—';
    sPreco.textContent = 'R$ 0,00';
  }

  if (state.selectedData && state.selectedHora) {
    const [ano, mes, dia] = state.selectedData.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia);
    const diaSemana = DIAS_SEMANA_NOMES[dataObj.getDay()];
    sDataHora.textContent = `${dia}/${String(mes).padStart(2,'0')} (${diaSemana}) às ${state.selectedHora}`;
  } else {
    sDataHora.textContent = '—';
  }

  // Habilitar botão se tudo estiver preenchido
  if (state.selectedServico && state.selectedData && state.selectedHora) {
    btnConf.removeAttribute('disabled');
  } else {
    btnConf.setAttribute('disabled', 'true');
  }
}

/* ── SUBMISSÃO DO AGENDAMENTO ────────────────────────────── */
async function _confirmarAgendamento(e) {
  e.preventDefault();
  
  if (!state.selectedServico || !state.selectedData || !state.selectedHora) {
    Toast.error('Por favor, selecione o serviço, data e horário antes de prosseguir.');
    return;
  }

  const nome = document.getElementById('c-nome').value.trim();
  const email = document.getElementById('c-email').value.trim().toLowerCase();
  const telefone = document.getElementById('c-telefone').value.trim();

  if (!nome || !email || !telefone) {
    Toast.error('Por favor, preencha todos os campos obrigatórios.');
    return;
  }

  const btnConf = document.getElementById('btn-confirmar');
  btnConf.setAttribute('disabled', 'true');
  btnConf.innerHTML = `<i class="ti ti-loader" style="animation: spin 1s linear infinite; margin-right:4px"></i> Confirmando...`;

  try {
    let id_cliente = null;

    // 1. Buscar se o cliente já existe por e-mail para evitar duplicatas
    try {
      const clienteExistente = await API.buscarCliente(email);
      if (clienteExistente && clienteExistente.id_cliente) {
        id_cliente = clienteExistente.id_cliente;
      }
    } catch (errBusca) {
      // Se der 404/erro, significa que o cliente não existe e prosseguiremos para cadastrar
      console.log('Cliente não encontrado por e-mail. Criando novo cliente...');
    }

    // 2. Se o cliente não existir, registrar na base
    if (!id_cliente) {
      const payloadCliente = {
        id_site: state.site.id_site,
        nome_cliente: nome,
        email_cliente: email,
        telefone_cliente: telefone
      };
      
      const novoCliente = await API.registrarCliente(payloadCliente);
      if (novoCliente && novoCliente.length > 0) {
        id_cliente = novoCliente[0].id_cliente;
      } else if (novoCliente && novoCliente.id_cliente) {
        id_cliente = novoCliente.id_cliente;
      } else {
        throw new Error('Falha ao registrar dados do cliente.');
      }
    }

    // 3. Confirmar o agendamento
    // Monta data hora ISO considerando fuso UTC conforme esperado pelo backend
    const dataHoraIso = `${state.selectedData}T${state.selectedHora}:00Z`;

    const payloadConfirmacao = {
      id_site: state.site.id_site,
      id_cliente: id_cliente,
      id_servico: state.selectedServico.id_servico,
      data_hora: dataHoraIso
    };

    const confirmacao = await API.confirmarAgendamento(payloadConfirmacao);

    if (confirmacao) {
      _exibirSucesso();
    } else {
      throw new Error('Não foi possível registrar o horário.');
    }

  } catch (err) {
    console.error(err);
    Toast.error(err.message || 'Ocorreu um erro ao confirmar o agendamento. Tente outro horário.');
    _atualizarResumo(); // Restaura estado do botão
    btnConf.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> Confirmar Agendamento`;
  }
}

/* ── EXIBIR SUCESSO ──────────────────────────────────────── */
function _exibirSucesso() {
  const fluxo = document.getElementById('fluxo-container');
  const sucesso = document.getElementById('success-container');
  
  // Setar resumos na tela de sucesso
  document.getElementById('success-store').textContent = state.site.nome_site;
  document.getElementById('success-summary-servico').textContent = state.selectedServico.nome_servico;
  
  const [ano, mes, dia] = state.selectedData.split('-').map(Number);
  const dataObj = new Date(ano, mes - 1, dia);
  const diaSemana = DIAS_SEMANA_NOMES[dataObj.getDay()];
  document.getElementById('success-summary-data-hora').textContent = `${dia}/${String(mes).padStart(2,'0')} (${diaSemana}) às ${state.selectedHora}`;

  // Rolar para o topo
  window.scrollTo({ top: 0, behavior: 'smooth' });

  anime({
    targets: fluxo,
    opacity: 0,
    translateY: -20,
    ...SPRING_MICRO,
    complete: () => {
      fluxo.style.display = 'none';
      sucesso.style.display = 'flex';
      
      anime({
        targets: sucesso,
        opacity: [0, 1],
        translateY: [20, 0],
        ...SPRING_ENTRADA
      });
    }
  });
}

/* ── CONFIGURAR EVENTOS ──────────────────────────────────── */
function _setupEventos() {
  // Navegação Calendário
  document.getElementById('btn-cal-prev').addEventListener('click', () => {
    state.viewDate.setMonth(state.viewDate.getMonth() - 1);
    _renderCalendario();
  });
  document.getElementById('btn-cal-next').addEventListener('click', () => {
    state.viewDate.setMonth(state.viewDate.getMonth() + 1);
    _renderCalendario();
  });

  // Submissão do Form
  document.getElementById('confirm-form').addEventListener('submit', _confirmarAgendamento);

  // Botão Fazer Outro Agendamento
  document.getElementById('btn-novo-agendamento').addEventListener('click', () => {
    window.location.reload();
  });
}

/* ── HELPERS ─────────────────────────────────────────────── */
function _mostrarErroTela(msg) {
  const fluxo = document.getElementById('fluxo-container');
  fluxo.innerHTML = `
    <div class="step-card" style="text-align: center; padding: 48px 24px; border-color: var(--apex-danger)">
      <i class="ti ti-alert-triangle" style="font-size: 3rem; color: var(--apex-danger); margin-bottom: 16px;"></i>
      <h2 style="font-size: 1.25rem; font-weight:600; color:var(--apex-text-primary); margin-bottom:8px">Ops! Algo deu errado</h2>
      <p style="color:var(--apex-text-secondary); font-size:0.875rem; line-height:1.5">${_esc(msg)}</p>
    </div>
  `;
  fluxo.style.opacity = '1';
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
