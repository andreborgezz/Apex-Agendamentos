/**
 * components/modal.js
 * Modal genérico reutilizável com anime.js.
 *
 * Uso:
 *   import { Modal } from '../../components/modal.js';
 *
 *   const modal = Modal.create({
 *     titulo: 'Confirmar exclusão',
 *     corpo: '<p>Tem certeza?</p>',
 *     acoes: [
 *       { label: 'Cancelar', variant: 'ghost', onClick: () => modal.fechar() },
 *       { label: 'Excluir',  variant: 'danger', onClick: () => { ... modal.fechar(); } },
 *     ],
 *   });
 *   modal.abrir();
 */

const SPRING_MODAL = { easing: 'spring(1,60,10,0)', duration: 700 };
const SPRING_MICRO = { easing: 'spring(1,200,18,0)', duration: 300 };

function create({ titulo = '', corpo = '', acoes = [] } = {}) {
  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8000;
    background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;padding:24px;
    opacity:0;
  `;

  // Dialog
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', titulo);
  dialog.style.cssText = `
    background:var(--surface);border:1px solid var(--border);
    border-radius:var(--r-xl);padding:28px;width:100%;max-width:440px;
    box-shadow:var(--shadow-lg);transform:scale(0.94) translateY(16px);
  `;

  const acoesHTML = acoes.map((a, i) => `
    <button id="modal-action-${i}" class="btn btn--${a.variant || 'ghost'}" style="${a.variant === 'danger' ? 'background:var(--danger);color:var(--text-on-accent)' : ''}">
      ${a.label}
    </button>`).join('');

  dialog.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="font-size:1rem;font-weight:600;letter-spacing:-0.01em;color:var(--text-primary)">${titulo}</h3>
      <button id="modal-close-btn" class="btn-icon" aria-label="Fechar modal">
        <i class="ti ti-x"></i>
      </button>
    </div>
    <div style="color:var(--text-secondary);font-size:0.875rem;line-height:1.6;margin-bottom:20px">${corpo}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px">${acoesHTML}</div>`;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Fechar ao clicar no overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  // Fechar com ESC
  const onEsc = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', onEsc);

  document.getElementById('modal-close-btn')?.addEventListener('click', fechar);

  // Bind ações
  acoes.forEach((a, i) => {
    document.getElementById(`modal-action-${i}`)?.addEventListener('click', a.onClick);
  });

  function abrir() {
    overlay.style.display = 'flex';
    anime({ targets: overlay, opacity: [0, 1], ...SPRING_MICRO });
    anime({ targets: dialog, scale: [0.94, 1], translateY: [16, 0], ...SPRING_MODAL });
  }

  function fechar() {
    anime({
      targets: [overlay, dialog],
      opacity: [1, 0],
      scale: dialog ? [1, 0.96] : undefined,
      ...SPRING_MICRO,
      complete: () => {
        document.removeEventListener('keydown', onEsc);
        overlay.remove();
      },
    });
  }

  return { abrir, fechar, overlay, dialog };
}

export const Modal = { create };
