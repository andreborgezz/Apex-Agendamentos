/**
 * components/skeleton.js
 * Gerador de skeletons com dimensões exatas (zero layout shift).
 *
 * Uso:
 *   import { Skeleton } from '../../components/skeleton.js';
 *   Skeleton.linhas(tbody, 5, 6);      // 5 linhas, 6 colunas
 *   Skeleton.cards(container, 3);      // 3 cards
 *   Skeleton.lista(container, 4);      // 4 itens de lista
 */

export const Skeleton = {

  /**
   * Injeta linhas skeleton em um <tbody>
   * @param {HTMLElement} tbody
   * @param {number} count  — número de linhas
   * @param {number} cols   — número de colunas
   */
  linhas(tbody, count = 5, cols = 6) {
    tbody.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const tr = document.createElement('tr');
      tr.className = 'skeleton-row';
      tr.innerHTML = `<td colspan="${cols}"><div class="skeleton-line"></div></td>`;
      tbody.appendChild(tr);
    }
  },

  /**
   * Injeta cards skeleton (métricas / bento)
   * @param {HTMLElement} container
   * @param {number} count
   */
  cards(container, count = 3) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'metric-card skeleton-card';
      card.innerHTML = `
        <div class="metric-header">
          <div class="metric-icon metric-icon--blue"></div>
        </div>
        <div class="metric-value"> </div>
        <div class="metric-label"> </div>
        <div class="metric-sub"> </div>`;
      container.appendChild(card);
    }
  },

  /**
   * Injeta itens de lista skeleton (serviços, clientes)
   * @param {HTMLElement} container
   * @param {number} count
   */
  lista(container, count = 4) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.className = 'servico-skeleton';
      container.appendChild(item);
    }
  },
};
