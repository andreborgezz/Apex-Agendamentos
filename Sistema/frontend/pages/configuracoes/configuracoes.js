/**
 * pages/configuracoes/configuracoes.js
 * Hub de configuração: dados do site, horários de funcionamento,
 * gerenciamento de serviços e preview ao vivo.
 *
 * Regras da skill:
 *  ✅ supabase de components/supabase.js
 *  ✅ Toast, Sidebar importados dos components
 *  ✅ anime.js com SPRING_* fixos
 *  ✅ Optimistic update + rollback em todas as mutações
 *  ✅ Auto-save no localStorage a cada input (formulários críticos)
 *  ✅ Dados reais — sem mock
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
const LS_KEY    = 'apex_config_draft';
const DIAS      = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

/* ── ESTADO LOCAL ────────────────────────────────────────── */
const state = {
  siteId:   null,
  servicos: [],
  horarios: DIAS.map((_, i) => ({
    dia:       i,
    ativo:     i >= 1 && i <= 5,
    abertura:  '09:00',
    fechamento:'18:00',
  })),
};

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await injectSidebar('sidebar-root');
  await _carregarSite();
  await _carregarServicos();
  _buildHorarios();
  _carregarDraft();
  _setupEventos();

  anime({
    targets: ['#col-dados','#col-servicos','#col-preview'],
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(80),
    ...SPRING_ENTRADA,
  });
});

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
      Toast.info('Nenhum site configurado ainda. Preencha os dados e salve.');
      return;
    }

    state.siteId = data.id_site;

    /* Preencher campos */
    document.getElementById('cfg-nome').value     = data.nome_site     || '';
    document.getElementById('cfg-cor').value      = data.cor_site      || '#0071e3';
    document.getElementById('cfg-cor-picker').value = data.cor_site   || '#0071e3';

    if (data.link) {
      document.getElementById('url-display').textContent = `apex.com/${data.link}`;
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
    Toast.warning('Não foi possível carregar dados do site. Verifique sua conexão.');
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
    list.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:0.875rem;padding:20px">Nenhum serviço cadastrado.</p>`;
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
    Toast.error('Erro ao remover serviço. Dados restaurados.');
  } else {
    Toast.success('Serviço removido.');
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
    anime({ targets: '#ns-nome', translateX: [-6,6,-4,4,0], duration: 300, easing: 'easeInOutSine' });
    return;
  }

  if (!state.siteId) {
    Toast.error('Nenhum site vinculado. Salve as configurações primeiro.');
    return;
  }

  const tempId     = Date.now();
  const novoItem   = { id_servico: tempId, nome_servico: nome, preco, duracao, descricao: desc };

  /* Optimistic update */
  state.servicos.push(novoItem);
  _renderServicos();
  _fecharFormServico();
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
    Toast.error('Erro ao salvar serviço no banco.');
  } else {
    const idx = state.servicos.findIndex(s => s.id_servico === tempId);
    if (idx >= 0) state.servicos[idx] = data;
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

/* ── SALVAR CONFIG ───────────────────────────────────────── */
async function _salvarConfig() {
  const btn = document.getElementById('btn-salvar-config');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 spin" aria-hidden="true"></i> Salvando...';

  const payload = {
    nome_site:      document.getElementById('cfg-nome').value.trim(),
    cor_site:       document.getElementById('cfg-cor').value.trim(),
  };

  try {
    if (state.siteId) {
      const { error: siteErr } = await supabase
        .from('site')
        .update(payload)
        .eq('id_site', state.siteId);
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
    } else {
      // Criação do Site
      const userId = Session.getUsuarioId();
      if (!userId) throw new Error('Usuário não logado');

      // Gera um link simples a partir do nome
      const linkBase = payload.nome_site.toLowerCase().replace(/[^a-z0-9]/g, '');
      const linkFinal = linkBase + '-' + Math.floor(Math.random() * 1000);

      const newSite = {
        id_usuario: userId,
        id_tipo: 1, // Default para o primeiro tipo (ex: loja/barbearia)
        nome_site: payload.nome_site,
        link: linkFinal,
        cor_site: payload.cor_site || '#0071e3',
        calendario_id: 'interno'
      };

      const { data: createdSite, error: createErr } = await supabase
        .from('site')
        .insert(newSite)
        .select()
        .single();
      
      if (createErr) throw createErr;
      state.siteId = createdSite.id_site;

      // Atualiza a sessão para refletir o novo site
      const sess = Session.ler() || {};
      sess.site = createdSite;
      Session.salvar(sess);

      // Salvar horários (como é novo, apenas insert)
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
        await supabase.from('regras_de_horarios').insert(horariosAtivos);
      }
    }

    localStorage.removeItem(LS_KEY);
    Toast.success('Configurações salvas com sucesso!');

  } catch (err) {
    Toast.error('Erro ao salvar. Dados preservados localmente.');
    _salvarDraft();
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy" aria-hidden="true"></i> Salvar alterações';
  }
}

/* ── AUTO-SAVE DRAFT ─────────────────────────────────────── */
function _salvarDraft() {
  const draft = {
    nome:     document.getElementById('cfg-nome')?.value     ?? '',
    whatsapp: document.getElementById('cfg-whatsapp')?.value ?? '',
    cor:      document.getElementById('cfg-cor')?.value      ?? '',
    horarios: state.horarios,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(draft));
}

function _carregarDraft() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.nome)     document.getElementById('cfg-nome').value     = d.nome;
    if (d.whatsapp) document.getElementById('cfg-whatsapp').value = d.whatsapp;
    if (d.cor) {
      document.getElementById('cfg-cor').value        = d.cor;
      document.getElementById('cfg-cor-picker').value = d.cor;
    }
    if (d.horarios?.length) {
      state.horarios = d.horarios;
      _buildHorarios();
    }
  } catch (_) { /* ignore */ }
}

/* ── PREVIEW AO VIVO ─────────────────────────────────────── */
function _renderPreview() {
  const screen = document.getElementById('device-screen');
  const nome   = document.getElementById('cfg-nome').value || 'Meu Negócio';
  const cor    = document.getElementById('cfg-cor').value  || '#0071e3';

  const servicosHtml = state.servicos.slice(0,6).map(s => `
    <div class="preview-service-card">
      <div>
        <div class="preview-service-name">${_esc(s.nome_servico)}</div>
        <div class="preview-service-meta"><i class="ti ti-clock" style="font-size:0.65rem"></i> ${_esc(s.duracao)} min</div>
      </div>
      <div class="preview-service-price" style="color:${_esc(cor)}">R$ ${Number(s.preco).toFixed(2).replace('.',',')}</div>
    </div>`).join('');

  screen.innerHTML = `
    <div class="preview-content">
      <div class="preview-header" style="background:${cor}18;border-bottom:1px solid ${cor}28">
        <div class="preview-logo-area">
          <div class="preview-logo-circle" style="background:${cor}">
            <i class="ti ti-calendar-bolt"></i>
          </div>
          <div>
            <div class="preview-biz-name">${_esc(nome)}</div>
            <div class="preview-subtitle">Agende seu horário</div>
          </div>
        </div>
      </div>
      <div class="preview-section-title">Nossos Serviços</div>
      ${servicosHtml || '<p style="padding:10px 14px;color:var(--text-muted);font-size:0.75rem">Nenhum serviço configurado.</p>'}
      <div class="preview-cta" style="background:${cor}">
        <i class="ti ti-calendar-plus" style="margin-right:4px"></i> Agendar Agora
      </div>
    </div>`;

  anime({ targets: screen, opacity: [0,1], scale: [0.97,1], ...SPRING_MODAL });
  Toast.success('Preview atualizado!');
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
}

/* ── EVENTOS ─────────────────────────────────────────────── */
function _setupEventos() {
  /* Abrir/fechar form serviço */
  document.getElementById('btn-novo-servico').addEventListener('click', _abrirFormServico);
  document.getElementById('btn-fechar-form-servico').addEventListener('click', _fecharFormServico);
  document.getElementById('btn-confirmar-servico').addEventListener('click', _adicionarServico);

  /* Auto-save a cada input */
  ['cfg-nome','cfg-whatsapp','cfg-cor'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _salvarDraft);
  });

  /* Color picker sincronizado */
  const colorInput  = document.getElementById('cfg-cor');
  const colorPicker = document.getElementById('cfg-cor-picker');
  colorInput.addEventListener('input', e => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) colorPicker.value = e.target.value;
    _salvarDraft();
  });
  colorPicker.addEventListener('input', e => {
    colorInput.value = e.target.value;
    _salvarDraft();
  });

  /* Copiar URL */
  document.getElementById('btn-copy-url').addEventListener('click', () => {
    const url = document.getElementById('url-display').textContent;
    navigator.clipboard.writeText(url)
      .then(() => {
        Toast.success('Link copiado!');
        anime({ targets: '#btn-copy-url i', rotate: [0,360], duration: 400, easing: 'easeInOutQuad' });
      })
      .catch(() => Toast.error('Não foi possível copiar. Copie manualmente.'));
  });

  /* Salvar */
  document.getElementById('btn-salvar-config').addEventListener('click', _salvarConfig);

  /* Preview */
  document.getElementById('btn-play-preview').addEventListener('click', _renderPreview);
}

/* ── HELPERS ─────────────────────────────────────────────── */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
