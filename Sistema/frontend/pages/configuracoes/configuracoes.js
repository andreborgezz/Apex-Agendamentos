/**
 * pages/configuracoes/configuracoes.js
 * Lógica da página de configurações (Perfil, Faturamento, Segurança e Tema).
 */

import { supabase }      from '../../components/supabase.js';
import { Toast }         from '../../components/toast.js';
import { injectSidebar } from '../../components/sidebar.js';
import { Session }       from '../../components/api.js';

/* ── SPRINGS ─────────────────────────────────────────────── */
const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };
const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };

const LS_DRAFT_KEY = 'apex_account_config_draft';

let localState = {
  usuario: null,
  site: null
};

async function init() {
  await injectSidebar('sidebar-root');
  
  // Define a data de cobrança dinâmica
  _setupBillingDate();
  
  // Carrega configurações
  await _carregarConfiguracoes();
  
  // Restaura rascunho temporário
  _carregarDraft();

  // Configura Eventos
  _setupEventos();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ── DEFINIR DATA DE COBRANÇA DINÂMICA ───────────────────── */
function _setupBillingDate() {
  const billingEl = document.getElementById('plan-billing-date');
  if (billingEl) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const d = nextMonth.getDate().toString().padStart(2, '0');
    const m = (nextMonth.getMonth() + 1).toString().padStart(2, '0');
    const y = nextMonth.getFullYear();
    
    billingEl.textContent = `${d}/${m}/${y}`;
  }
}

/* ── CARREGAR DADOS DO SUPABASE ──────────────────────────── */
async function _carregarConfiguracoes() {
  const userId = Session.getUsuarioId();
  const siteId = Session.getSiteId();

  if (!userId) {
    Toast.error('Sessão expirada. Faça login novamente.');
    setTimeout(() => { window.location.href = '/index.html'; }, 1000);
    return;
  }

  try {
    // 1. Carregar dados do usuário
    const { data: usuario, error: uErr } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id_usuario', userId)
      .single();

    if (uErr) throw uErr;
    localState.usuario = usuario;

    // 2. Carregar dados do site
    if (siteId) {
      const { data: site, error: sErr } = await supabase
        .from('site')
        .select('*')
        .eq('id_site', siteId)
        .single();
      
      if (!sErr) localState.site = site;
    }

    // Preencher campos na tela
    if (localState.usuario) {
      document.getElementById('cfg-fiscal-cnpj').value = localState.usuario.cnpj || '';
    }

    if (localState.site) {
      document.getElementById('cfg-est-nome').value = localState.site.nome_site || '';

      // WhatsApp decodificado de layout JSON
      let layoutObj = {};
      try {
        layoutObj = JSON.parse(localState.site.layout || '{}');
      } catch (e) {}
      
      document.getElementById('cfg-est-contato').value = layoutObj.whatsapp || '';
      _atualizarLogoPreview(localState.site.logo_loja);
    }

    // Carregar preferência do tema do painel
    const theme = localStorage.getItem('apex_theme') || 'light';
    _atualizarTemaUI(theme);

  } catch (err) {
    console.error(err);
    Toast.error('Erro ao carregar configurações do servidor.');
  }
}

/* ── ATUALIZAR PREVIEW DO LOGO ───────────────────────────── */
function _atualizarLogoPreview(url) {
  const previewBox = document.getElementById('logo-preview-box');
  if (!previewBox) return;

  if (url && url.startsWith('http')) {
    previewBox.innerHTML = `<img src="${_esc(url)}" alt="Logo" onerror="this.innerHTML='<i class=\'ti ti-alert-triangle\' style=\'color:var(--danger)\'></i>'" />`;
  } else {
    previewBox.innerHTML = `<i class="ti ti-photo" aria-hidden="true"></i>`;
  }
}

/* ── PREFERÊNCIA DE TEMA DO PAINEL ───────────────────────── */
function _atualizarTemaUI(theme) {
  const optLight = document.getElementById('theme-light');
  const optDark  = document.getElementById('theme-dark');
  
  if (theme === 'dark') {
    optDark.classList.add('selected');
    optLight.classList.remove('selected');
    optDark.setAttribute('aria-checked', 'true');
    optLight.setAttribute('aria-checked', 'false');
    document.documentElement.classList.add('dark-theme');
  } else {
    optLight.classList.add('selected');
    optDark.classList.remove('selected');
    optLight.setAttribute('aria-checked', 'true');
    optDark.setAttribute('aria-checked', 'false');
    document.documentElement.classList.remove('dark-theme');
  }
}

/* ── EVENTOS ─────────────────────────────────────────────── */
function _setupEventos() {
  const optLight = document.getElementById('theme-light');
  const optDark  = document.getElementById('theme-dark');

  optLight.addEventListener('click', () => {
    localStorage.setItem('apex_theme', 'light');
    _atualizarTemaUI('light');
    _salvarDraft();
    anime({ targets: optLight, scale: [0.96, 1], ...SPRING_MICRO });
  });

  optDark.addEventListener('click', () => {
    localStorage.setItem('apex_theme', 'dark');
    _atualizarTemaUI('dark');
    _salvarDraft();
    anime({ targets: optDark, scale: [0.96, 1], ...SPRING_MICRO });
  });

  // Upload de logo via arquivo
  document.getElementById('cfg-logo-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) _uploadLogo(file);
    e.target.value = ''; // permite selecionar o mesmo arquivo novamente
  });

  // Auto-salvar rascunho ao digitar
  ['cfg-est-nome', 'cfg-est-contato', 'cfg-fiscal-cnpj', 'cfg-senha-nova', 'cfg-senha-confirma'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _salvarDraft);
  });

  // Ação de Salvar tudo
  document.getElementById('btn-salvar-configuracoes').addEventListener('click', _salvarConfiguracoes);
}

/* ── UPLOAD DE LOGO ──────────────────────────────────────── */
async function _uploadLogo(file) {
  if (!file.type.startsWith('image/')) {
    Toast.warning('Selecione um arquivo de imagem (PNG, JPG, WEBP).');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    Toast.warning('A imagem deve ter no máximo 2 MB.');
    return;
  }

  const siteId = Session.getSiteId();
  if (!siteId) {
    Toast.error('Nenhum site vinculado. Salve as configurações básicas primeiro.');
    return;
  }

  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${siteId}/${Date.now()}.${ext}`;

  _setUploadState('uploading');

  try {
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });

    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: dbErr } = await supabase
      .from('site')
      .update({ logo_loja: publicUrl })
      .eq('id_site', siteId);

    if (dbErr) throw dbErr;

    if (!localState.site) localState.site = {};
    localState.site.logo_loja = publicUrl;

    const sess = Session.ler() || {};
    if (sess.site) sess.site.logo_loja = publicUrl;
    Session.salvar(sess);

    _atualizarLogoPreview(publicUrl);
    _setUploadState('done');
    Toast.success('Logo enviado com sucesso!');

  } catch (err) {
    console.error(err);
    _setUploadState('idle');
    Toast.error('Erro ao enviar o logo. Tente novamente.');
  }
}

function _setUploadState(st) {
  const icon   = document.getElementById('logo-upload-icon');
  const label  = document.getElementById('logo-upload-label');
  const status = document.getElementById('logo-upload-status');
  const area   = document.getElementById('logo-upload-area');

  if (st === 'uploading') {
    if (icon)  icon.className         = 'ti ti-loader-2 spin';
    if (label) label.textContent       = 'Enviando...';
    if (area)  area.style.pointerEvents = 'none';
  } else if (st === 'done') {
    if (icon)  icon.className         = 'ti ti-circle-check';
    if (label) label.textContent       = 'Logo enviado!';
    if (status) status.style.color    = 'var(--success)';
    if (area)  area.style.pointerEvents = '';
    setTimeout(() => {
      if (icon)   icon.className       = 'ti ti-upload';
      if (label)  label.textContent    = 'Alterar imagem';
      if (status) status.style.color   = '';
    }, 2500);
  } else {
    if (icon)  icon.className         = 'ti ti-upload';
    if (label) label.textContent       = 'Escolher imagem...';
    if (area)  area.style.pointerEvents = '';
  }
}

/* ── SALVAR DADOS ────────────────────────────────────────── */
async function _salvarConfiguracoes() {
  const nome    = document.getElementById('cfg-est-nome').value.trim();
  const contato = document.getElementById('cfg-est-contato').value.trim();
  const cnpj    = document.getElementById('cfg-fiscal-cnpj').value.trim();
  const senhaNova = document.getElementById('cfg-senha-nova').value;
  const senhaConf = document.getElementById('cfg-senha-confirma').value;

  if (!nome) {
    Toast.warning('Nome do estabelecimento é obrigatório.');
    document.getElementById('cfg-est-nome').focus();
    return;
  }
  if (!contato) {
    Toast.warning('Contato (WhatsApp) é obrigatório.');
    document.getElementById('cfg-est-contato').focus();
    return;
  }

  // Validação de senha
  if (senhaNova || senhaConf) {
    if (senhaNova.length < 6) {
      Toast.warning('A senha nova deve conter no mínimo 6 caracteres.');
      document.getElementById('cfg-senha-nova').focus();
      return;
    }
    if (senhaNova !== senhaConf) {
      Toast.warning('As senhas digitadas não coincidem.');
      document.getElementById('cfg-senha-confirma').focus();
      return;
    }
  }

  const btn = document.getElementById('btn-salvar-configuracoes');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2 spin"></i> Salvando...';

  try {
    const userId = Session.getUsuarioId();
    const siteId = Session.getSiteId();

    // 1. Atualizar usuários (cnpj e senha se alterados)
    const userPayload = { cnpj };
    if (senhaNova) {
      userPayload.senha_usuario = senhaNova;
    }

    const { error: userErr } = await supabase
      .from('usuarios')
      .update(userPayload)
      .eq('id_usuario', userId);

    if (userErr) throw userErr;

    // 2. Atualizar site (nome_site, logo_loja, layout com whatsapp)
    let layoutObj = {};
    if (localState.site) {
      try {
        layoutObj = JSON.parse(localState.site.layout || '{}');
      } catch (e) {}
    }
    
    // Atualiza WhatsApp no layout
    layoutObj.whatsapp = contato;

    const sitePayload = {
      nome_site: nome,
      logo_loja: localState.site?.logo_loja ?? null,
      layout: JSON.stringify(layoutObj)
    };

    const { data: siteData, error: siteErr } = await supabase
      .from('site')
      .update(sitePayload)
      .eq('id_site', siteId)
      .select()
      .single();

    if (siteErr) throw siteErr;

    // Sincronizar sessão local
    const sess = Session.ler() || {};
    sess.site = siteData;
    if (sess.usuario) {
      sess.usuario.cnpj = cnpj;
    }
    Session.salvar(sess);
    
    localState.site = siteData;
    if (localState.usuario) {
      localState.usuario.cnpj = cnpj;
    }

    // Limpar campos de senha
    document.getElementById('cfg-senha-nova').value = '';
    document.getElementById('cfg-senha-confirma').value = '';
    
    // Limpar draft
    localStorage.removeItem(LS_DRAFT_KEY);

    Toast.success('Configurações salvas com sucesso!');
  } catch (err) {
    console.error(err);
    Toast.error('Erro ao salvar as configurações.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i> Salvar Configurações';
  }
}

/* ── RASCUNHOS / AUTO-SAVE ───────────────────────────────── */
function _salvarDraft() {
  const draft = {
    nome:    document.getElementById('cfg-est-nome').value,
    contato: document.getElementById('cfg-est-contato').value,
    cnpj:    document.getElementById('cfg-fiscal-cnpj').value,
  };
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(draft));
}

function _carregarDraft() {
  try {
    const raw = localStorage.getItem(LS_DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.nome)    document.getElementById('cfg-est-nome').value    = d.nome;
    if (d.contato) document.getElementById('cfg-est-contato').value = d.contato;
    if (d.cnpj)    document.getElementById('cfg-fiscal-cnpj').value = d.cnpj;
  } catch (e) {}
}

/* ── HELPERS ─────────────────────────────────────────────── */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
