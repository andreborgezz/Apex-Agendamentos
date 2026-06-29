/**
 * components/api.js
 * Centralizador de chamadas à API REST do backend Express.
 * Autenticação via backend bcrypt; sessão em apex_session (localStorage).
 */

const DEFAULT_BASE = 'http://localhost:3333';

function _base() {
  return localStorage.getItem('apex_api_url') || DEFAULT_BASE;
}

async function _req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${_base()}${path}`, opts);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.mensagem || `Erro ${res.status}`);
  }
  return json;
}

/* ── SESSÃO (localStorage — cache do perfil) ──────────────── */
const LS_SESSION = 'apex_session';

export const Session = {
  salvar(dados) { localStorage.setItem(LS_SESSION, JSON.stringify(dados)); },
  ler()        { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch { return null; } },
  limpar()     { localStorage.removeItem(LS_SESSION); },
  existe()     { return !!Session.ler(); },

  getSiteId() {
    const s = Session.ler();
    return s?.site?.id_site ?? null;
  },

  getUsuarioId() {
    const s = Session.ler();
    return s?.usuario?.id_usuario ?? null;
  },
};

/* ── ENDPOINTS ────────────────────────────────────────────── */
export const API = {

  async login(email_usuario, senha_usuario) {
    const dados = await _req('POST', '/usuarios/login', { email_usuario, senha_usuario });
    Session.salvar(dados);
    return dados;
  },

  logout() {
    Session.limpar();
  },

  async registrar(payload) {
    return _req('POST', '/usuarios/registrar', payload);
  },

  /** GET /usuarios/:id */
  async getUsuario(id) {
    return _req('GET', `/usuarios/${id}`);
  },

  // ── SITE ─────────────────────────────────────────────────

  /** GET /site/:link */
  async getSite(link) {
    return _req('GET', `/site/${link}`);
  },

  /** POST /site/cadastrar */
  async cadastrarSite(payload) {
    return _req('POST', '/site/cadastrar', payload);
  },

  /** PUT /site/atualizar/:id_site */
  async atualizarSite(id_site, payload) {
    return _req('PUT', `/site/atualizar/${id_site}`, payload);
  },

  // ── SERVIÇOS ──────────────────────────────────────────────

  /** GET /servicos/site/:id_site */
  async getServicos(id_site) {
    return _req('GET', `/servicos/site/${id_site}`);
  },

  /** POST /servicos */
  async criarServico(payload) {
    return _req('POST', '/servicos', payload);
  },

  /** DELETE /servicos/:id_servico */
  async deletarServico(id_servico) {
    return _req('DELETE', `/servicos/${id_servico}`);
  },

  // ── AGENDAMENTOS ──────────────────────────────────────────

  /**
   * GET /agendamentos/disponibilidade
   * @param {number} id_site
   * @param {string} data — 'YYYY-MM-DD'
   * @param {number} id_servico
   */
  async getDisponibilidade(id_site, data, id_servico) {
    return _req('GET', `/agendamentos/disponibilidade?id_site=${id_site}&data=${data}&id_servico=${id_servico}`);
  },

  /** POST /agendamentos/confirmar */
  async confirmarAgendamento(payload) {
    return _req('POST', '/agendamentos/confirmar', payload);
  },

  // ── CLIENTES ──────────────────────────────────────────────

  /** GET /clientes/busca?email=X */
  async buscarCliente(email) {
    return _req('GET', `/clientes/busca?email=${encodeURIComponent(email)}`);
  },

  /** POST /clientes/registrar */
  async registrarCliente(payload) {
    return _req('POST', '/clientes/registrar', payload);
  },
};
