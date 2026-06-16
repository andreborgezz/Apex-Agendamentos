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
const SPRING_NAV     = { easing: 'spring(1,90,14,0)', duration: 500 };

const NAV_ITEMS = [
  { id: 'nav-dashboard',     icon: 'ti-layout-dashboard', label: 'Dashboard',     href: '/pages/dashboard/dashboard.html' },
  { id: 'nav-agenda',        icon: 'ti-calendar',         label: 'Agenda',        href: '/pages/agenda/agenda.html' },
  { id: 'nav-servicos',      icon: 'ti-scissors',         label: 'Serviços',      href: '/pages/servicos/servicos.html' },
  { id: 'nav-clientes',      icon: 'ti-users',            label: 'Clientes',      href: '/pages/clientes/clientes.html' },
  { id: 'nav-site',          icon: 'ti-world-www',        label: 'Site',          href: '/pages/site/site.html' },
  { id: 'nav-configuracoes', icon: 'ti-settings',         label: 'Configurações', href: '/pages/configuracoes/configuracoes.html' },
];

function _isActive(href) {
  return window.location.pathname.endsWith(href.split('/').pop());
}

async function injectSidebar(rootId = 'sidebar-root') {
  const root = document.getElementById(rootId);
  if (!root) return;

  /* Aplicar Tema Salvo no LocalStorage centralizadamente */
  const savedTheme = localStorage.getItem('apex_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }

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
        <div class="nav-indicator" id="nav-indicator" style="position: absolute; left: 0; width: 100%; background: var(--accent-subtle); border-radius: var(--r-md); z-index: 0; pointer-events: none;"></div>
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

  /* Lógica de animação do indicador deslizante do menu */
  const activeItem = root.querySelector('.nav-item.active');
  const indicator = root.querySelector('#nav-indicator');
  
  let prevTop = sessionStorage.getItem('apex_prev_nav_top');

  if (activeItem && indicator) {
    const currentTop = activeItem.offsetTop;
    const currentHeight = activeItem.offsetHeight;
    indicator.style.height = `${currentHeight}px`;

    if (prevTop !== null && prevTop !== undefined) {
      // Posiciona no item anterior e desliza até o atual
      indicator.style.top = `${prevTop}px`;
      anime({
        targets: indicator,
        top: currentTop,
        ...SPRING_NAV,
      });
    } else {
      // Primeira carga, posiciona direto
      indicator.style.top = `${currentTop}px`;
    }
  }

  /* Hover micro-animation & SPA navigation click */
  root.querySelectorAll('.nav-item').forEach(item => {
    if (item.id !== 'btn-logout') {
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('active')) {
          anime({ targets: item, translateX: [0, 3], ...SPRING_MICRO });
        }
      });
      item.addEventListener('mouseleave', () => {
        anime({ targets: item, translateX: [3, 0], ...SPRING_MICRO });
      });
      item.addEventListener('click', (e) => {
        if (item.classList.contains('active')) return;
        e.preventDefault();
        const href = item.getAttribute('href');
        _navigateTo(href, true);
      });
    }
  });

  /* Logout */
  document.getElementById('btn-logout').addEventListener('click', () => {
    API.logout();
    sessionStorage.removeItem('apex_prev_nav_top');
    Toast.info('Você saiu da sessão.');
    setTimeout(() => { window.location.href = '/index.html'; }, 800);
  });

  /* Entrada animada */
  if (prevTop === null) {
    anime({
      targets: root.querySelectorAll('.nav-item'),
      opacity: [0, 1],
      translateX: [-10, 0],
      delay: anime.stagger(50),
      ...SPRING_ENTRADA,
    });
  } else {
    root.querySelectorAll('.nav-item').forEach(item => {
      item.style.opacity = '1';
      item.style.transform = 'none';
    });
  }
}

/* ── SPA ROUTER: NAVEGAÇÃO SUAVE SEM RELOAD ──────────────── */
async function _navigateTo(href, push = true) {
  try {
    const res = await fetch(href);
    if (!res.ok) throw new Error('Falha ao carregar página');
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const mainContent = document.querySelector('.main-content');
    const newMain = doc.querySelector('.main-content');

    if (mainContent && newMain) {
      // 1. Remove overlays antigos de modais (evitando duplicidade)
      document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

      // 2. Transição de saída do conteúdo
      await new Promise(resolve => {
        anime({
          targets: mainContent,
          opacity: 0,
          translateY: -8,
          duration: 150,
          easing: 'easeInQuad',
          complete: resolve
        });
      });

      // 3. Substituir o conteúdo principal e título
      mainContent.innerHTML = newMain.innerHTML;
      document.title = doc.title || 'Apex Agendamentos';

      // 4. Injeta novos overlays de modais (agenda, servicos) no final do body
      doc.querySelectorAll('.modal-overlay').forEach(modal => {
        document.body.appendChild(modal);
      });

      // 5. Atualiza o histórico do navegador
      if (push) {
        history.pushState({ href }, '', href);
      }

      // 6. Atualiza o estado ativo dos itens na sidebar
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const activeItem = sidebar.querySelector('.nav-item.active');
        if (activeItem) {
          sessionStorage.setItem('apex_prev_nav_top', activeItem.offsetTop);
        }

        sidebar.querySelectorAll('.nav-item').forEach(item => {
          const itemHref = item.getAttribute('href');
          const isActive = href.endsWith(itemHref.split('/').pop());
          item.classList.toggle('active', isActive);
        });

        // Reposiciona o indicador da sidebar
        const newActiveItem = sidebar.querySelector('.nav-item.active');
        const indicator = sidebar.querySelector('#nav-indicator');
        if (newActiveItem && indicator) {
          const currentTop = newActiveItem.offsetTop;
          const currentHeight = newActiveItem.offsetHeight;
          indicator.style.height = `${currentHeight}px`;

          const prevTop = sessionStorage.getItem('apex_prev_nav_top');
          if (prevTop !== null) {
            indicator.style.top = `${prevTop}px`;
            anime({
              targets: indicator,
              top: currentTop,
              easing: 'spring(1,90,14,0)',
              duration: 500
            });
          } else {
            indicator.style.top = `${currentTop}px`;
          }
        }
      }

      // Prepara opacidade 0 para o fade-in do script da própria página
      mainContent.style.opacity = '0';
      mainContent.style.transform = 'translateY(8px)';

      // 7. Injeta o script correspondente da página para re-bindar eventos e inicializar
      const script = doc.querySelector('script[type="module"]');
      if (script) {
        const src = script.getAttribute('src');
        const absoluteSrc = new URL(src, window.location.origin + href).pathname;

        const newScript = document.createElement('script');
        newScript.type = 'module';
        newScript.src = absoluteSrc + '?t=' + Date.now();
        document.body.appendChild(newScript);
      }
    }
  } catch (err) {
    console.error('SPA navigation error:', err);
    window.location.href = href;
  }
}

/* Registra listener global para botão Voltar/Avançar do navegador */
if (!window.apex_router_initialized) {
  window.apex_router_initialized = true;
  window.addEventListener('popstate', () => {
    _navigateTo(window.location.pathname, false);
  });
}

export { injectSidebar };
