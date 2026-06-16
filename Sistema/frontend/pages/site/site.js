/**
 * pages/site/site.js
 * Hub de personalização do site: cores (principal e fundo), fontes,
 * regras de horário, serviços e preview ao vivo.
 */

import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Session }       from '../../components/api.js';

/* ── SPRINGS ─────────────────────────────────────────────── */
const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_MODAL   = { easing: 'spring(1,60,10,0)', duration: 700 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

/* ── CONSTANTES ──────────────────────────────────────────── */
const LS_KEY    = 'apex_site_appearance_draft';
const DIAS      = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

/* ── ESTADO LOCAL ────────────────────────────────────────── */
const state = {
  siteId:   null,
  siteName: '',
  servicos: [],
  horarios: DIAS.map((_, i) => ({
    dia:       i,
    ativo:     i >= 1 && i <= 5,
    abertura:  '09:00',
    fechamento:'18:00',
  })),
};

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
async function init() {
  await injectSidebar('sidebar-root');
  await _carregarSite();
  await _carregarServicos();
  _buildHorarios();
  _carregarDraft();
  _setupEventos();
  _renderPreview(false);

  anime({
    targets: ['#col-dados','#col-servicos','#col-preview'],
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(80),
    ...SPRING_ENTRADA,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ── CARREGAR SITE ───────────────────────────────────────── */
async function _carregarSite() {
  const siteId = Session.getSiteId();
  const userId = Session.getUsuarioId();

  if (!userId) {
    Toast.warning('Sessão expirada. Faça login novamente.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('site')
      .select('*')
      .eq('id_usuario', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      Toast.info('Nenhum site configurado ainda. Preencha as configurações.');
      return;
    }

    state.siteId   = data.id_site;
    state.siteName = data.nome_site;

    /* Preencher cores */
    document.getElementById('cfg-cor').value        = data.cor_site || '#5C6AC4';
    document.getElementById('cfg-cor-picker').value = data.cor_site || '#5C6AC4';

    /* Preencher layout (fundo e fonte) */
    let layoutObj = {};
    try {
      layoutObj = JSON.parse(data.layout || '{}');
    } catch (e) {}

    const bgColor = layoutObj.bg_color || '#0C0C0E';
    const fontFamily = layoutObj.font_family || 'DM Sans';

    document.getElementById('cfg-bg-color').value        = bgColor;
    document.getElementById('cfg-bg-color-picker').value = bgColor;
    document.getElementById('cfg-font-family').value     = fontFamily;

    if (data.link) {
      const linkReal = `${window.location.origin}/pages/agendamento/agendamento.html?link=${data.link}`;
      document.getElementById('url-display').textContent = linkReal;
    }

    /* Carregar horários do banco */
    const { data: horariosDB } = await supabase
      .from('regras_de_horarios')
      .select('*')
      .eq('id_site', data.id_site);

    if (horariosDB?.length) {
      horariosDB.forEach(h => {
        const idx = h.dia_semana;
        if (idx >= 0 && idx <= 6) {
          state.horarios[idx].ativo     = true;
          state.horarios[idx].abertura  = h.abertura.slice(0,5);
          state.horarios[idx].fechamento= h.fechamento.slice(0,5);
        }
      });
      _buildHorarios();
    }

  } catch (_) {
    Toast.warning('Não foi possível carregar os dados do site.');
  }
}

/* ── CARREGAR SERVIÇOS ───────────────────────────────────── */
async function _carregarServicos() {
  if (!state.siteId) {
    state.servicos = [];
    _renderServicos();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('id_site', state.siteId)
      .order('id_servico');

    if (error) throw error;
    state.servicos = data ?? [];
  } catch (_) {
    state.servicos = [];
    Toast.error('Erro ao carregar serviços.');
  }

  _renderServicos();
}

/* ── RENDER SERVIÇOS ─────────────────────────────────────── */
function _renderServicos() {
  const list = document.getElementById('servicos-list');
  list.innerHTML = '';

  if (!state.servicos.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:12px;color:var(--text-secondary);display:flex;flex-direction:column;align-items:center;gap:8px">
        <p style="font-size:0.8125rem;color:var(--text-muted)">Nenhum serviço cadastrado. Importe sugestões:</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn--ghost btn--sm btn-import-preset" data-preset="salao" style="padding:4px 8px;font-size:0.75rem">Salão/Barbearia</button>
          <button class="btn btn--ghost btn--sm btn-import-preset" data-preset="clinica" style="padding:4px 8px;font-size:0.75rem">Clínica</button>
          <button class="btn btn--ghost btn--sm btn-import-preset" data-preset="bemestar" style="padding:4px 8px;font-size:0.75rem">Estética</button>
        </div>
      </div>`;
    
    list.querySelectorAll('.btn-import-preset').forEach(btn => {
      btn.addEventListener('click', () => _importarSugestoes(btn.dataset.preset));
    });
    return;
  }

  state.servicos.forEach((s, idx) => {
    const id   = s.id_servico ?? s.id;
    const item = document.createElement('div');
    item.className    = 'servico-item';
    item.dataset.id   = id;
    item.style.opacity = '0';
    item.innerHTML = `
      <div class="servico-color"></div>
      <div class="servico-info">
        <div class="servico-nome">${_esc(s.nome_servico)}</div>
        <div class="servico-meta">
          <i class="ti ti-clock" style="font-size:0.7rem" aria-hidden="true"></i>
          ${_esc(s.duracao)} min${s.descricao ? ` · ${_esc(s.descricao)}` : ''}
        </div>
      </div>
      <div class="servico-preco">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</div>
      <button class="btn-icon servico-del" data-id="${id}" aria-label="Remover serviço ${_esc(s.nome_servico)}" style="color:var(--danger)">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>`;

    item.querySelector('.servico-del').addEventListener('click', e => {
      e.stopPropagation();
      _deletarServico(id, item);
    });

    list.appendChild(item);

    anime({ targets: item, opacity: [0,1], translateX: [-12,0], delay: idx * 60, ...SPRING_ENTRADA });
  });
}

/* ── DELETAR SERVIÇO ─────────────────────────────────────── */
async function _deletarServico(id, itemEl) {
  const prev = [...state.servicos];
  state.servicos = state.servicos.filter(s => (s.id_servico ?? s.id) !== id);

  anime({
    targets: itemEl,
    opacity: [1, 0],
    translateX: [0, 20],
    ...SPRING_MICRO,
    complete: () => {
      itemEl.remove();
      if (!state.servicos.length) _renderServicos();
    },
  });

  const { error } = await supabase
    .from('servicos')
    .delete()
    .eq('id_servico', id);

  if (error) {
    state.servicos = prev;
    _renderServicos();
    _renderPreview(false);
    Toast.error('Erro ao remover serviço.');
  } else {
    Toast.success('Serviço removido.');
    _renderPreview(false);
  }
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
  if (!state.siteId) {
    Toast.error('Nenhum site vinculado.');
    return;
  }

  const items = PRESETS[categoria];
  if (!items) return;

  Toast.info('Importando serviços sugeridos...');

  const payload = items.map(p => ({
    id_site: state.siteId,
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

    state.servicos = data ?? [];
    _renderServicos();
    _renderPreview(false);
    Toast.success('Sugestões importadas com sucesso!');
  } catch (err) {
    Toast.error('Erro ao importar sugestões.');
  }
}

/* ── ADICIONAR SERVIÇO ───────────────────────────────────── */
async function _adicionarServico() {
  const nome    = document.getElementById('ns-nome').value.trim();
  const preco   = parseFloat(document.getElementById('ns-preco').value)  || 0;
  const duracao = document.getElementById('ns-duracao').value             || '30';
  const desc    = document.getElementById('ns-desc').value.trim();

  if (!nome) {
    Toast.warning('O nome do serviço é obrigatório.');
    document.getElementById('ns-nome').focus();
    return;
  }

  if (!state.siteId) {
    Toast.error('Nenhum site vinculado.');
    return;
  }

  const tempId     = Date.now();
  const novoItem   = { id_servico: tempId, nome_servico: nome, preco, duracao, descricao: desc };

  /* Optimistic update */
  state.servicos.push(novoItem);
  _renderServicos();
  _fecharFormServico();
  _renderPreview(false);
  Toast.success(`"${nome}" adicionado!`);

  /* Persistir */
  const { data, error } = await supabase
    .from('servicos')
    .insert({ id_site: state.siteId, nome_servico: nome, preco, duracao, descricao: desc })
    .select()
    .single();

  if (error) {
    state.servicos = state.servicos.filter(s => s.id_servico !== tempId);
    _renderServicos();
    _renderPreview(false);
    Toast.error('Erro ao salvar serviço no banco.');
  } else {
    const idx = state.servicos.findIndex(s => s.id_servico === tempId);
    if (idx >= 0) state.servicos[idx] = data;
    _renderPreview(false);
  }
}

/* ── HORÁRIOS ────────────────────────────────────────────── */
function _buildHorarios() {
  const grid = document.getElementById('horarios-grid');
  grid.innerHTML = '';

  state.horarios.forEach((h, idx) => {
    const row = document.createElement('div');
    row.className  = `horario-row${h.ativo ? ' active' : ''}`;
    row.dataset.dia = idx;
    row.innerHTML = `
      <input type="checkbox" class="horario-check" id="hcheck-${idx}" ${h.ativo ? 'checked' : ''} aria-label="${DIAS[idx]}">
      <label class="horario-dia" for="hcheck-${idx}">${DIAS[idx]}</label>
      <div class="horario-times">
        <input type="time" class="horario-input h-aber" value="${h.abertura}"   ${h.ativo ? '' : 'disabled'} aria-label="Abertura ${DIAS[idx]}">
        <span class="horario-sep" aria-hidden="true">–</span>
        <input type="time" class="horario-input h-fech" value="${h.fechamento}" ${h.ativo ? '' : 'disabled'} aria-label="Fechamento ${DIAS[idx]}">
      </div>`;

    const check = row.querySelector('.horario-check');
    check.addEventListener('change', () => {
      state.horarios[idx].ativo = check.checked;
      row.classList.toggle('active', check.checked);
      row.querySelectorAll('.horario-input').forEach(i => { i.disabled = !check.checked; });
      anime({ targets: row, scale: check.checked ? [0.98,1] : [1.01,1], ...SPRING_MICRO });
      _salvarDraft();
    });

    row.querySelector('.h-aber').addEventListener('change', e => { state.horarios[idx].abertura  = e.target.value; _salvarDraft(); });
    row.querySelector('.h-fech').addEventListener('change', e => { state.horarios[idx].fechamento = e.target.value; _salvarDraft(); });

    grid.appendChild(row);
  });
}

/* ── SALVAR CONFIGURADOR DE APARÊNCIA ────────────────────── */
async function _salvarConfig() {
  const btn = document.getElementById('btn-salvar-config');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 spin" aria-hidden="true"></i> Salvando...';

  const corSite = document.getElementById('cfg-cor').value.trim();
  const bgColor = document.getElementById('cfg-bg-color').value.trim();
  const fontFamily = document.getElementById('cfg-font-family').value;

  try {
    if (!state.siteId) throw new Error('Nenhum site configurado ainda.');

    // 1. Obter layout atual para preservar outros campos (ex: whatsapp)
    let layoutObj = {};
    const { data: currentSite } = await supabase
      .from('site')
      .select('layout')
      .eq('id_site', state.siteId)
      .single();
    
    if (currentSite) {
      try {
        layoutObj = JSON.parse(currentSite.layout || '{}');
      } catch (e) {}
    }

    // 2. Mesclar novas propriedades visuais
    layoutObj.bg_color = bgColor;
    layoutObj.font_family = fontFamily;

    const payload = {
      cor_site: corSite,
      layout: JSON.stringify(layoutObj)
    };

    const { data: updatedSite, error: siteErr } = await supabase
      .from('site')
      .update(payload)
      .eq('id_site', state.siteId)
      .select()
      .single();

    if (siteErr) throw siteErr;

    /* Salvar horários: delete + insert */
    await supabase.from('regras_de_horarios').delete().eq('id_site', state.siteId);

    const horariosAtivos = state.horarios
      .filter(h => h.ativo)
      .map(h => ({
        id_site:    state.siteId,
        dia_semana: h.dia,
        abertura:   h.abertura,
        fechamento: h.fechamento,
        duracao:    '30',
      }));

    if (horariosAtivos.length) {
      const { error: hErr } = await supabase.from('regras_de_horarios').insert(horariosAtivos);
      if (hErr) throw hErr;
    }

    // Atualiza a sessão local
    const sess = Session.ler() || {};
    sess.site = updatedSite;
    Session.salvar(sess);

    localStorage.removeItem(LS_KEY);
    Toast.success('Aparência e funcionamento salvos!');

  } catch (err) {
    console.error(err);
    Toast.error('Erro ao salvar no banco. Salvando rascunho localmente.');
    _salvarDraft();
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy" aria-hidden="true"></i> Salvar alterações';
  }
}

/* ── AUTO-SAVE DRAFT ─────────────────────────────────────── */
function _salvarDraft() {
  const draft = {
    cor:      document.getElementById('cfg-cor')?.value      ?? '',
    bgColor:  document.getElementById('cfg-bg-color')?.value  ?? '',
    font:     document.getElementById('cfg-font-family')?.value ?? '',
    horarios: state.horarios,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(draft));
}

function _carregarDraft() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.cor) {
      document.getElementById('cfg-cor').value        = d.cor;
      document.getElementById('cfg-cor-picker').value = d.cor;
    }
    if (d.bgColor) {
      document.getElementById('cfg-bg-color').value        = d.bgColor;
      document.getElementById('cfg-bg-color-picker').value = d.bgColor;
    }
    if (d.font) {
      document.getElementById('cfg-font-family').value = d.font;
    }
    if (d.horarios?.length) {
      state.horarios = d.horarios;
      _buildHorarios();
    }
  } catch (_) { /* ignore */ }
}

/* ── PREVIEW AO VIVO ─────────────────────────────────────── */
function _renderPreview(showToast = false) {
  const screen  = document.getElementById('device-screen');
  const nome    = state.siteName || 'Meu Negócio';
  const cor     = document.getElementById('cfg-cor').value || '#5C6AC4';
  const bgColor = document.getElementById('cfg-bg-color').value || '#0C0C0E';
  const font    = document.getElementById('cfg-font-family').value || 'DM Sans';

  // Carrega fonte dinamicamente para o preview
  const linkId = 'preview-font-link';
  let fontLink = document.getElementById(linkId);
  if (!fontLink) {
    fontLink = document.createElement('link');
    fontLink.id = linkId;
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }
  fontLink.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;

  const servicosHtml = state.servicos.slice(0,6).map(s => `
    <div class="preview-service-card" style="border-bottom:1px solid ${cor}18">
      <div>
        <div class="preview-service-name" style="color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#1d1d1f' : '#F0EFE8'}">${_esc(s.nome_servico)}</div>
        <div class="preview-service-meta" style="color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#6e6e73' : '#8A8A96'}">
          <i class="ti ti-clock" style="font-size:0.65rem"></i> ${_esc(s.duracao)} min
        </div>
      </div>
      <div class="preview-service-price" style="color:${_esc(cor)}">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</div>
    </div>`).join('');

  screen.innerHTML = `
    <div style="height:28px; width:100%; background:${bgColor}; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; padding:0 16px; box-sizing:border-box; font-size:0.65rem; font-weight:600; color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#1d1d1f' : '#ffffff'}; z-index:1;">
      <span>09:41</span>
      <div style="display:flex; gap:4px; align-items:center;">
        <i class="ti ti-cell-signal-5" style="font-size:0.75rem"></i>
        <i class="ti ti-wifi" style="font-size:0.75rem"></i>
        <i class="ti ti-battery-filled" style="font-size:0.8rem"></i>
      </div>
    </div>
    <div class="preview-content" style="background:${bgColor}; color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#1d1d1f' : '#F0EFE8'}; font-family:'${font}', sans-serif;">
      <div class="preview-header" style="background:${cor}12; border-bottom:1px solid ${cor}22; padding:14px 14px 12px;">
        <div class="preview-logo-area">
          <div class="preview-logo-circle" style="background:${cor}">
            <i class="ti ti-calendar-bolt"></i>
          </div>
          <div>
            <div class="preview-biz-name" style="color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#1d1d1f' : '#F0EFE8'}">${_esc(nome)}</div>
            <div class="preview-subtitle" style="color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#6e6e73' : '#8A8A96'}">Agende seu horário</div>
          </div>
        </div>
      </div>
      <div class="preview-section-title" style="color:${bgColor === '#ffffff' || bgColor === '#f5f5f7' ? '#1d1d1f' : '#F0EFE8'}">Nossos Serviços</div>
      ${servicosHtml || '<p style="padding:10px 14px;color:var(--text-muted);font-size:0.75rem">Nenhum serviço configurado.</p>'}
      <div class="preview-cta" style="background:${cor}; color:#ffffff; margin:14px; padding:10px; border-radius:var(--r-md); text-align:center; font-size:0.8rem; font-weight:600;">
        <i class="ti ti-calendar-plus" style="margin-right:4px"></i> Agendar Agora
      </div>
    </div>`;

  anime({ targets: screen, opacity: [0,1], scale: [0.97,1], ...SPRING_MODAL });
  if (showToast) {
    Toast.success('Preview atualizado!');
  }
}

/* ── FORM SERVIÇO: ABRIR / FECHAR ────────────────────────── */
function _abrirFormServico() {
  const form = document.getElementById('form-novo-servico');
  form.classList.remove('hidden');
  anime({ targets: form, opacity: [0,1], translateY: [10,0], ...SPRING_MODAL });
  document.getElementById('ns-nome').focus();
}

function _fecharFormServico() {
  const form = document.getElementById('form-novo-servico');
  anime({
    targets: form,
    opacity: [1,0],
    translateY: [0,8],
    ...SPRING_MICRO,
    complete: () => form.classList.add('hidden'),
  });
  ['ns-nome','ns-preco','ns-duracao','ns-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('#ns-duration-presets .preset-pill').forEach(p => p.classList.remove('active'));
}

/* ── EVENTOS ─────────────────────────────────────────────── */
function _setupEventos() {
  /* Abrir/fechar form serviço */
  document.getElementById('btn-novo-servico').addEventListener('click', _abrirFormServico);
  document.getElementById('btn-fechar-form-servico').addEventListener('click', _fecharFormServico);
  document.getElementById('btn-confirmar-servico').addEventListener('click', _adicionarServico);

  /* Auto-save a cada input + Auto Preview reativo */
  ['cfg-cor','cfg-bg-color'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      _salvarDraft();
      _renderPreview(false);
    });
  });

  document.getElementById('cfg-font-family')?.addEventListener('change', () => {
    _salvarDraft();
    _renderPreview(false);
  });

  /* Color picker sincronizado + Auto Preview reativo (Principal) */
  const colorInput  = document.getElementById('cfg-cor');
  const colorPicker = document.getElementById('cfg-cor-picker');
  colorInput.addEventListener('input', e => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
      colorPicker.value = e.target.value;
      _renderPreview(false);
    }
    _salvarDraft();
  });
  colorPicker.addEventListener('input', e => {
    colorInput.value = e.target.value;
    _salvarDraft();
    _renderPreview(false);
  });

  /* Color picker sincronizado + Auto Preview reativo (Background) */
  const bgInput  = document.getElementById('cfg-bg-color');
  const bgPicker = document.getElementById('cfg-bg-color-picker');
  bgInput.addEventListener('input', e => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
      bgPicker.value = e.target.value;
      _renderPreview(false);
    }
    _salvarDraft();
  });
  bgPicker.addEventListener('input', e => {
    bgInput.value = e.target.value;
    _salvarDraft();
    _renderPreview(false);
  });

  /* Copiar URL */
  document.getElementById('btn-copy-url').addEventListener('click', () => {
    const url = document.getElementById('url-display').textContent;
    navigator.clipboard.writeText(url)
      .then(() => {
        Toast.success('Link copiado!');
        anime({ targets: '#btn-copy-url i', rotate: [0,360], duration: 400, easing: 'easeInOutQuad' });
      })
      .catch(() => Toast.error('Não foi possível copiar.'));
  });

  /* Salvar */
  document.getElementById('btn-salvar-config').addEventListener('click', _salvarConfig);

  /* Preview (Manual) */
  document.getElementById('btn-play-preview').addEventListener('click', () => _renderPreview(true));

  /* Pills de duração inline */
  const durationInput = document.getElementById('ns-duracao');
  const pills = document.querySelectorAll('#ns-duration-presets .preset-pill');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      durationInput.value = pill.dataset.value;
    });
  });

  durationInput.addEventListener('input', () => {
    pills.forEach(p => p.classList.remove('active'));
  });
}

/* ── HELPERS ─────────────────────────────────────────────── */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
