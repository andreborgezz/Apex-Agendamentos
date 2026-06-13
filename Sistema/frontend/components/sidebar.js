/**
 * components/sidebar.js
 * Sidebar injetada via JS em todas as páginas internas.
 * Verifica sessão via Session (components/api.js).
 * Detecta a página atual pelo pathname e marca o item ativo.
 *
 * Paths absolutos funcionam corretamente com o Live Preview
 * configurado em .vscode/settings.json (livePreview.serverRoot → frontend/).
 */

import { API, Session } from './api.js';
import { Toast }        from './toast.js';

const SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 };
const SPRING_ENTRADA = { easing: 'spring(1,80,12,0)', duration: 600 };

const NAV_ITEMS = [
  { id: 'nav-dashboard',     icon: 'ti-layout-dashboard', label: 'Dashboard',     href: '/pages/dashboard/dashboard.html' },
  { id: 'nav-agenda',        icon: 'ti-calendar',         label: 'Agenda',        href: '/pages/agenda/agenda.html' },
  { id: 'nav-servicos',      icon: 'ti-scissors',         label: 'Serviços',      href: '/pages/servicos/servicos.html' },
  { id: 'nav-clientes',      icon: 'ti-users',            label: 'Clientes',      href: '/pages/clientes/clientes.html' },
  { id: 'nav-configuracoes', icon: 'ti-settings',         label: 'Configurações', href: '/pages/configuracoes/configuracoes.html' },
];

function _isActive(href) {
  return window.location.pathname.endsWith(href.split('/').pop());
}

async function injectSidebar(rootId = 'sidebar-root') {
  const root = document.getElementById(rootId);
  if (!root) return;

  /* Guard de sessão — redireciona ao login se não autenticado */
  const session = Session.ler();
  if (!session?.usuario) {
    window.location.href = '/index.html';
    return;
  }

  const usuario = session.usuario;
  const nome    = usuario.nome_usuario || usuario.email_usuario?.split('@')[0] || 'Admin';
  const inicial = nome[0].toUpperCase();

  const navHTML = NAV_ITEMS.map(item => `
    <a href="${item.href}" id="${item.id}" class="nav-item${_isActive(item.href) ? ' active' : ''}" aria-label="${item.label}">
      <i class="ti ${item.icon} nav-icon" aria-hidden="true"></i>
      <span class="nav-label">${item.label}</span>
    </a>`).join('');

  root.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-logo" aria-hidden="true">
          <i class="ti ti-calendar-bolt"></i>
        </div>
        <span class="sidebar-name">Apex</span>
      </div>

      <nav class="sidebar-nav" aria-label="Menu principal">
        ${navHTML}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="user-avatar" aria-hidden="true">${inicial}</div>
          <div class="user-info">
            <span class="user-name">${nome}</span>
            <span class="user-role">Proprietário</span>
          </div>
        </div>
        <button id="btn-logout" class="nav-item nav-item--danger" aria-label="Sair da conta" title="Sair">
          <i class="ti ti-logout nav-icon" aria-hidden="true"></i>
        </button>
      </div>
    </aside>`;

  /* Hover micro-animation */
  root.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      if (!item.classList.contains('active')) {
        anime({ targets: item, translateX: [0, 3], ...SPRING_MICRO });
      }
    });
    item.addEventListener('mouseleave', () => {
      anime({ targets: item, translateX: [3, 0], ...SPRING_MICRO });
    });
  });

  /* Logout */
  document.getElementById('btn-logout').addEventListener('click', () => {
    API.logout();
    Toast.info('Você saiu da sessão.');
    setTimeout(() => { window.location.href = '/index.html'; }, 800);
  });

  /* Entrada animada */
  anime({
    targets: root.querySelectorAll('.nav-item'),
    opacity: [0, 1],
    translateX: [-10, 0],
    delay: anime.stagger(50),
    ...SPRING_ENTRADA,
  });
}

export { injectSidebar };
