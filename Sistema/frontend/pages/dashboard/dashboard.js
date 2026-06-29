import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Session }       from '../../components/api.js';

const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)',  duration: 600 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

let _siteId = null;

/* ── INIT ────────────────────────────────────────────────── */
async function init() {
  await injectSidebar('sidebar-root');

  _siteId = Session.getSiteId();
  if (!_siteId) {
    Toast.warning('Nenhum site vinculado. Configure em Configurações.');
  }

  _setPageDate();
  await carregarDados();

  document.getElementById('btn-refresh').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    anime({ targets: btn.querySelector('.ti'), rotate: [0, 360], duration: 600, easing: 'easeInOutQuad' });
    await carregarDados();
    btn.disabled = false;
    Toast.success('Dados atualizados!');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ── DATA DA PÁGINA ──────────────────────────────────────── */
function _setPageDate() {
  const hoje = new Date();
  const label = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const el = document.getElementById('page-date');
  if (el) el.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

/* ── INTERVALOS DE DATA ──────────────────────────────────── */
function _ranges() {
  const agora  = new Date();
  const ano    = agora.getFullYear();
  const mes    = agora.getMonth();
  const dia    = agora.getDate();
  const dow    = agora.getDay(); // 0 = domingo

  const inicioDia    = new Date(ano, mes, dia).toISOString();
  const fimDia       = new Date(ano, mes, dia + 1).toISOString();
  const inicioOntem  = new Date(ano, mes, dia - 1).toISOString();

  const inicioSemana     = new Date(ano, mes, dia - dow).toISOString();
  const fimSemana        = new Date(ano, mes, dia - dow + 7).toISOString();
  const inicioSemPassada = new Date(ano, mes, dia - dow - 7).toISOString();

  return { agora: agora.toISOString(), inicioDia, fimDia, inicioOntem, inicioSemana, fimSemana, inicioSemPassada };
}

/* ── CARREGAR DADOS ──────────────────────────────────────── */
async function carregarDados() {
  if (!_siteId) {
    _renderMetricas(0, 0, 0, 0, 0);
    _renderLista([]);
    return;
  }

  const r = _ranges();

  const [resHoje, resOntem, resSemana, resSemPassada, resClientes, resProximos] = await Promise.all([

    // Agendamentos hoje
    supabase
      .from('agendamentos_confirmados')
      .select('id', { count: 'exact', head: true })
      .eq('id_site', _siteId)
      .gte('data_hora', r.inicioDia)
      .lt('data_hora', r.fimDia),

    // Agendamentos ontem (trend de hoje)
    supabase
      .from('agendamentos_confirmados')
      .select('id', { count: 'exact', head: true })
      .eq('id_site', _siteId)
      .gte('data_hora', r.inicioOntem)
      .lt('data_hora', r.inicioDia),

    // Agendamentos desta semana
    supabase
      .from('agendamentos_confirmados')
      .select('id', { count: 'exact', head: true })
      .eq('id_site', _siteId)
      .gte('data_hora', r.inicioSemana)
      .lt('data_hora', r.fimSemana),

    // Agendamentos semana passada (trend da semana)
    supabase
      .from('agendamentos_confirmados')
      .select('id', { count: 'exact', head: true })
      .eq('id_site', _siteId)
      .gte('data_hora', r.inicioSemPassada)
      .lt('data_hora', r.inicioSemana),

    // Total de clientes do site
    supabase
      .from('clientes_do_site')
      .select('id_cliente', { count: 'exact', head: true })
      .eq('id_site', _siteId),

    // Próximos 5 agendamentos de hoje (a partir de agora)
    supabase
      .from('agendamentos_confirmados')
      .select(`
        id,
        data_hora,
        clientes_do_site ( nome_cliente ),
        servicos ( nome_servico )
      `)
      .eq('id_site', _siteId)
      .gte('data_hora', r.agora)
      .lt('data_hora', r.fimDia)
      .order('data_hora', { ascending: true })
      .limit(5),
  ]);

  if (resHoje.error || resSemana.error || resClientes.error || resProximos.error) {
    Toast.error('Erro ao carregar dados. Tente novamente.');
  }

  _renderMetricas(
    resHoje.count       ?? 0,
    resOntem.count      ?? 0,
    resClientes.count   ?? 0,
    resSemana.count     ?? 0,
    resSemPassada.count ?? 0,
  );

  _renderLista(resProximos.data ?? []);
}

/* ── RENDERIZAR MÉTRICAS ─────────────────────────────────── */
function _renderMetricas(hoje, ontem, totalClientes, semana, semPassada) {
  _setVal('val-hoje',     hoje);
  _setVal('val-clientes', totalClientes);
  _setVal('val-semana',   semana);

  _setSub('sub-hoje',     ontem > 0 ? `${ontem} ontem` : 'Sem dados de ontem');
  _setSub('sub-clientes', 'Total cadastrado');
  _setSub('sub-semana',   semPassada > 0 ? `${semPassada} semana passada` : 'Sem dados anteriores');

  _setTrend('trend-hoje',   _pct(hoje, ontem));
  _setTrend('trend-clientes', null);
  _setTrend('trend-semana', _pct(semana, semPassada));

  document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('skeleton-card'));

  anime({
    targets: '.metric-card',
    opacity: [0, 1],
    translateY: [16, 0],
    delay: anime.stagger(80),
    ...SPRING_ENTRADA,
  });
}

function _pct(atual, anterior) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _setSub(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function _setTrend(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;

  if (pct === null || pct === undefined) {
    el.className = 'metric-trend trend--neutral';
    el.innerHTML = '<i class="ti ti-minus" aria-hidden="true"></i> —';
    return;
  }
  if (pct > 0) {
    el.className = 'metric-trend trend--up';
    el.innerHTML = `<i class="ti ti-trending-up" aria-hidden="true"></i> +${pct}%`;
  } else if (pct < 0) {
    el.className = 'metric-trend trend--down';
    el.innerHTML = `<i class="ti ti-trending-down" aria-hidden="true"></i> ${pct}%`;
  } else {
    el.className = 'metric-trend trend--neutral';
    el.innerHTML = '<i class="ti ti-minus" aria-hidden="true"></i> 0%';
  }
}

/* ── RENDERIZAR LISTA ────────────────────────────────────── */
function _renderLista(proximos) {
  const lista = document.getElementById('lista-proximos');
  const badge = document.getElementById('appt-badge');
  lista.innerHTML = '';

  if (!proximos.length) {
    lista.innerHTML = `
      <li class="appt-empty" role="listitem">
        <i class="ti ti-calendar-off" aria-hidden="true"></i>
        <p>Sem agendamentos pendentes para hoje.</p>
      </li>`;
    if (badge) {
      badge.className = 'metric-trend trend--neutral';
      badge.innerHTML = '<i class="ti ti-minus" aria-hidden="true"></i> Nenhum';
    }
    return;
  }

  if (badge) {
    badge.className = 'metric-trend trend--up';
    badge.innerHTML = `<i class="ti ti-clock" aria-hidden="true"></i> ${proximos.length} próximo${proximos.length > 1 ? 's' : ''}`;
  }

  proximos.forEach((a, idx) => {
    const nome    = a.clientes_do_site?.nome_cliente || 'Cliente';
    const servico = a.servicos?.nome_servico         || 'Serviço';
    const hora    = new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    const inicial = nome[0].toUpperCase();

    const li = document.createElement('li');
    li.className = 'appt-item';
    li.setAttribute('role', 'listitem');
    li.style.opacity = '0';
    li.innerHTML = `
      <span class="appt-time" aria-label="Horário: ${hora}">${hora}</span>
      <div class="appt-avatar" aria-hidden="true">${_esc(inicial)}</div>
      <div class="appt-info">
        <span class="appt-nome">${_esc(nome)}</span>
        <span class="appt-servico">${_esc(servico)}</span>
      </div>`;

    lista.appendChild(li);
    anime({ targets: li, opacity: [0, 1], translateX: [-10, 0], delay: idx * 60, ...SPRING_ENTRADA });
  });
}

/* ── HELPERS ─────────────────────────────────────────────── */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
