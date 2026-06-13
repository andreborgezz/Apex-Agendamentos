/**
 * components/toast.js
 * Sistema de notificações toast usando anime.js.
 * ❌ Nunca usar alert() — sempre usar Toast.
 *
 * Uso:
 *   import { Toast } from '../../components/toast.js';
 *   Toast.success('Salvo!');
 *   Toast.error('Ops, erro.');
 *   Toast.info('Informação.');
 *   Toast.warning('Atenção!');
 */

const SPRING_MICRO = { easing: 'spring(1,200,18,0)', duration: 300 };

const ICONS = {
  success: 'ti-circle-check',
  error:   'ti-circle-x',
  info:    'ti-info-circle',
  warning: 'ti-alert-triangle',
};

function _ensureContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.setAttribute('aria-live', 'polite');
    c.style.cssText = `
      position:fixed;top:20px;right:20px;z-index:9999;
      display:flex;flex-direction:column;gap:8px;pointer-events:none;
    `;
    document.body.appendChild(c);
  }
  return c;
}

function show(message, type = 'info', duration = 3500) {
  const container = _ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <i class="ti ${ICONS[type]} toast-icon" style="font-size:1.1rem;flex-shrink:0"></i>
    <span style="flex:1;font-size:0.875rem">${message}</span>
    <button
      onclick="this.parentElement.remove()"
      style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;display:flex;align-items:center;padding:2px"
      aria-label="Fechar notificação">
      <i class="ti ti-x"></i>
    </button>`;
  container.appendChild(el);

  anime({
    targets: el,
    opacity: [0, 1],
    translateX: [24, 0],
    ...SPRING_MICRO,
  });

  setTimeout(() => {
    anime({
      targets: el,
      opacity: [1, 0],
      translateX: [0, 24],
      ...SPRING_MICRO,
      complete: () => el.remove(),
    });
  }, duration);

  return el;
}

export const Toast = {
  success: (msg, dur) => show(msg, 'success', dur),
  error:   (msg, dur) => show(msg, 'error', dur),
  info:    (msg, dur) => show(msg, 'info', dur),
  warning: (msg, dur) => show(msg, 'warning', dur),
};
