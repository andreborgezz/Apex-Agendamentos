---
trigger: always_on
---

# APEX AGENDAMENTOS — ANTIGRAVITY FRONTEND

## STACK (fixo, sem exceções)
HTML5 · CSS3 vars nativas · JS ES2022 ESM · sem frameworks · sem bundler

CDN obrigatório (ordem de carregamento):
- anime.js 3.2.1 → `cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js`
- Supabase v2 → `cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
- Tabler Icons → `cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css`
- Fontes → DM Sans (300/400/500/600) + JetBrains Mono (400/500) via Google Fonts

---

## ESTRUTURA DE PASTAS
```
apex-agendamentos/
├── index.html          ← login/entrada
├── styles.css          ← tokens globais (não duplicar em páginas)
├── pages/
│   ├── dashboard/      dashboard.html + dashboard.js
│   ├── agenda/         agenda.html + agenda.js
│   ├── agendamento/    agendamento.html + agendamento.js  ← fluxo público
│   ├── servicos/       servicos.html + servicos.js
│   ├── clientes/       clientes.html + clientes.js
│   └── configuracoes/  configuracoes.html + configuracoes.js
└── components/
    ├── supabase.js     ← instância única exportada
    ├── sidebar.js      ← injetado via JS em todas as páginas
    ├── modal.js
    ├── toast.js
    └── skeleton.js
```
Regra: 1 `.html` + 1 `.js` por página. O `.js` contém DOM, API, animações e estado local.

---

## TOKENS DE DESIGN (styles.css — não sobrescrever)
```css
:root {
  --apex-bg:#0C0C0E; --apex-surface:#111114; --apex-surface-alt:#1A1A1F; --apex-surface-hover:#22222A;
  --apex-border:rgba(255,255,255,0.07); --apex-border-focus:rgba(255,255,255,0.18);
  --apex-text-primary:#F0EFE8; --apex-text-secondary:#8A8A96; --apex-text-muted:#52525C;
  --apex-accent:#5C6AC4; --apex-accent-hover:#6B7AD4; --apex-accent-subtle:rgba(92,106,196,0.12);
  --apex-success:#2ECC8F; --apex-warning:#F0A050; --apex-danger:#E05252; --apex-info:#5096E0;
  --r-sm:6px; --r-md:10px; --r-lg:16px; --r-xl:24px;
  --font-display:'DM Sans',sans-serif; --font-mono:'JetBrains Mono',monospace;
}
```
**Proibido:** `#000` `#fff` `#000000` `#ffffff` qualquer hex fora dos tokens acima.

---

## SPRINGS (anime.js — valores fixos, não alterar)
```js
const SPRING_ENTRADA = { easing:'spring(1,80,12,0)', duration:600 };  // cards, listas, painéis
const SPRING_MODAL   = { easing:'spring(1,60,10,0)', duration:700 };  // modais, drawers, expansões
const SPRING_MICRO   = { easing:'spring(1,200,18,0)', duration:300 }; // hover, click, feedback
const SPRING_NAV     = { easing:'spring(1,90,14,0)', duration:500 };  // calendário, navegação
```
**Proibido:** `transition: ease` `transition: linear` `setTimeout` para simular animação.

---

## REGRAS OPERACIONAIS

**Animações**
```js
// ❌  element.style.transition='all 0.3s ease'; element.style.opacity='1';
// ✅
anime({ targets:element, opacity:[0,1], translateY:[12,0], ...SPRING_ENTRADA });
```

**Supabase**
```js
// ❌  createClient('URL','KEY') inline em cada página
// ✅  components/supabase.js → export const supabase = createClient(URL, KEY)
//     páginas → import { supabase } from '../../components/supabase.js'
```

**Optimistic Update (toda mutação de dado)**
```js
// 1. atualiza UI imediatamente
// 2. await supabase.from(...).update/insert/delete
// 3. if(error) → desfaz UI + toast.erro('mensagem')
```

**Loading**
```js
// ❌  innerHTML = '<div class="spinner"></div>'
// ✅  skeleton com height/border-radius exatos do componente final + animation:shimmer
```

**Erros**
```js
// ❌  alert() · console.log() · tela em branco
// ✅  toast.js sempre · nunca resetar campos já preenchidos pelo usuário
```

**Formulários críticos:** auto-save parcial no `localStorage` a cada input. Nunca perder progresso por oscilação de rede.

---

## CHECKLIST DE ENTREGA
```
[ ] HTML+CSS+JS puro — zero React/Vue/Svelte
[ ] Animações: anime.js com SPRING_* fixados
[ ] Cores: exclusivamente variáveis --apex-*
[ ] Supabase: importado de components/supabase.js
[ ] Mutações: optimistic update + rollback com toast
[ ] Loading: skeleton com dimensões exatas (zero layout shift)
[ ] Erros: toast.js (nunca alert/console)
[ ] Formulários críticos: auto-save localStorage
[ ] Responsivo: mobile-first, breakpoint único 768px
```

---

## PRODUTO & PERSONAS (referência rápida)
**Apex Agendamentos** — SaaS de gestão de agendamentos para prestadores de alto valor (clínicas, estúdios, autônomos).

| Persona | Necessidade core |
|---|---|
| Prestador | Visão cirúrgica da agenda. Drag-drop. Zero painel poluído. |
| Cliente final | Marcar em segundos. Desiste no primeiro loader ou campo confuso. |

**Tom visual:** escuro · limpo · respirando · sem gradientes decorativos · cada pixel justificado por função.
