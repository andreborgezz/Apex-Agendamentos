# Apex Agendamentos — Contexto do Projeto

## Instruções de comportamento

- Seja direto e objetivo. Sem explicações longas, sem introduções desnecessárias.
- Não repita o que já foi dito. Não confirme o que vai fazer antes de fazer — apenas faça.
- Não peça confirmação para tarefas simples e claras. Execute direto.
- Prefira editar só o necessário. Nunca reescreva um arquivo inteiro se a mudança é pontual.
- Não adicione comentários óbvios no código (`// busca os dados`, `// retorna resultado`).
- Não crie arquivos, funções ou abstrações além do que foi pedido.
- Se houver ambiguidade, pergunte em uma linha antes de agir.
- Respostas de texto: máximo 3-4 linhas. O código fala por si.

---

SaaS de agendamentos para prestadores de serviço locais (barbearias, salões, clínicas, estúdios).
Desenvolvido por André Borges. Produto voltado para venda B2B local em Sorocaba/SP.

---

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript ES2022 puro (sem framework, sem bundler)
- **Backend:** Node.js + Express.js v5 (porta 3333, módulos ESM)
- **Banco de dados:** Supabase (PostgreSQL gerenciado na nuvem)
- **Ícones:** Tabler Icons via CDN (`@tabler/icons-webfont`)
- **Animações:** anime.js 3.2.1 via CDN
- **Fonte:** DM Sans (300/400/500/600) + JetBrains Mono via Google Fonts

---

## Estrutura de pastas

```
Apex-Agendamentos/
├── CLAUDE.md
├── Sistema/
│   ├── backend/
│   │   ├── server.js          ← entrada da API
│   │   ├── database.js        ← instância Supabase
│   │   ├── .env               ← NUNCA versionar
│   │   └── routes/
│   │       ├── usuarios.js
│   │       ├── sites.js
│   │       ├── servicos.js
│   │       ├── agendamentos.js
│   │       ├── clientes.js
│   │       └── tipos.js
│   ├── frontend/
│   │   ├── index.html         ← login (entrada)
│   │   ├── index.js
│   │   ├── styles.css         ← design system (usar este, não style.css)
│   │   ├── components/
│   │   │   ├── api.js         ← todas as chamadas ao backend
│   │   │   ├── supabase.js    ← instância Supabase do frontend
│   │   │   ├── sidebar.js     ← sidebar injetada via JS
│   │   │   ├── modal.js       ← sistema de modais
│   │   │   ├── toast.js       ← notificações (NUNCA usar alert())
│   │   │   └── skeleton.js    ← skeletons de loading
│   │   └── pages/
│   │       ├── dashboard/     ← dashboard.html + dashboard.js
│   │       ├── agenda/        ← agenda.html + agenda.js
│   │       ├── clientes/      ← clientes.html + clientes.js
│   │       ├── servicos/      ← servicos.html + servicos.js
│   │       ├── site/          ← site.html + site.js (customização)
│   │       ├── agendamento/   ← página PÚBLICA do cliente final
│   │       └── configuracoes/ ← configuracoes.html + configuracoes.js
│   └── db/
│       ├── script.sql         ← DDL (criação das tabelas)
│       └── inserts.sql        ← dados iniciais
```

---

## Design system (styles.css)

Usar sempre as variáveis CSS definidas — nunca hardcodar cores.

```css
/* Fundos */
--apex-bg:              #0C0C0E    /* fundo principal */
--apex-surface:         #111114    /* cards e superfícies */
--apex-surface-alt:     #1A1A1F    /* superfícies alternativas */
--apex-surface-hover:   #22222A    /* hover */

/* Bordas */
--apex-border:          rgba(255,255,255,0.07)
--apex-border-focus:    rgba(255,255,255,0.18)

/* Texto */
--apex-text-primary:    #F0EFE8
--apex-text-secondary:  #8A8A96
--apex-text-muted:      #52525C

/* Ação */
--apex-accent:          #5C6AC4
--apex-accent-hover:    #6B7AD4
--apex-accent-subtle:   rgba(92,106,196,0.12)

/* Semânticas */
--apex-success:         #2ECC8F
--apex-warning:         #F0A050
--apex-danger:          #E05252
--apex-info:            #5096E0

/* Bordas arredondadas */
--r-sm: 6px
--r-md: 10px
--r-lg: 16px
--r-xl: 24px

/* Tipografia */
--font-display: 'DM Sans', sans-serif
--font-mono:    'JetBrains Mono', monospace
```

### Springs de animação (anime.js)

```js
SPRING_ENTRADA = { easing: 'spring(1,80,12,0)',  duration: 600 }  // cards, listas
SPRING_MODAL   = { easing: 'spring(1,60,10,0)',  duration: 700 }  // modais
SPRING_MICRO   = { easing: 'spring(1,200,18,0)', duration: 300 }  // hover, clique
SPRING_NAV     = { easing: 'spring(1,90,14,0)',  duration: 500 }  // navegação
```

---

## Regras obrigatórias de desenvolvimento

- **NUNCA usar `alert()`** — sempre `toast.js`
- **NUNCA usar `console.log()` visível ao usuário** — só para debug interno
- **Loading:** sempre skeleton (`skeleton.js`), nunca spinner genérico
- **Erros:** sempre via toast com mensagem amigável
- **Otimistic Update:** atualiza UI antes da resposta da API, desfaz em erro
- **Formulários críticos:** auto-save parcial no localStorage a cada input
- **Responsivo:** mobile-first, breakpoint único em 768px
- **Estilo:** usar sempre `styles.css` (não `style.css`, que é versão antiga)
- **Módulos:** todo JS usa `type="module"` e imports ES6

---

## Banco de dados (Supabase)

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `usuarios` | Donos dos estabelecimentos (login no painel) |
| `site` | Estabelecimento — tem slug único (`link`) para URL pública |
| `tipo_estabelecimento` | Catálogo: 'loja', 'salao', 'clinica' |
| `clientes_do_site` | Clientes captados pela página pública |
| `servicos` | Serviços oferecidos por cada site |
| `regras_de_horarios` | Horários de funcionamento por dia da semana (0=Dom, 6=Sáb) |
| `agendamentos_confirmados` | Agendamentos efetivados |

### Relacionamentos

```
usuarios (1) → (N) site
site (1) → (N) clientes_do_site
site (1) → (N) servicos
site (1) → (N) regras_de_horarios
site (1) → (N) agendamentos_confirmados
clientes_do_site (1) → (N) agendamentos_confirmados
servicos (1) → (N) agendamentos_confirmados
```

### Sessão do usuário (localStorage)

```js
// Chave: 'apex_session'
// Estrutura:
{
  usuario: { id_usuario, nome_usuario, email_usuario, cnpj },
  site: { id_site, nome_site, link } | null
}

Session.ler()       // lê sessão
Session.salvar()    // salva sessão
Session.limpar()    // logout
Session.existe()    // boolean
```

---

## API (backend Express — porta 3333)

Todas as chamadas passam por `components/api.js`. Nunca chamar fetch direto nas páginas.

```
POST   /usuarios/login              → autenticar prestador
POST   /usuarios/registrar          → cadastrar novo prestador
GET    /usuarios/:id                → perfil do usuário
PUT    /usuarios/:id                → atualizar perfil

POST   /site/cadastrar              → criar site
GET    /site/:link                  → buscar site pelo slug
PUT    /site/atualizar/:id_site     → atualizar configurações

GET    /servicos/site/:id_site      → listar serviços
POST   /servicos                    → criar serviço
PUT    /servicos/:id_servico        → editar serviço
DELETE /servicos/:id_servico        → remover serviço

GET    /agendamentos/disponibilidade?id_site=X&data=YYYY-MM-DD&id_servico=Y
POST   /agendamentos/confirmar      → confirmar agendamento

GET    /clientes/site/:id_site      → listar clientes
POST   /clientes/registrar          → cadastrar cliente
GET    /clientes/busca?email=X      → buscar por email
DELETE /clientes/:id                → remover cliente (LGPD)
```

---

## Telas do painel (estado atual)

### ✅ Funcionando bem — não mexer na estrutura

| Tela | Status | Observação |
|------|--------|------------|
| Login | ✅ Pronto | Limpo, funcional |
| Agenda | ✅ Pronto | Calendário mensal com agendamentos |
| Serviços | ✅ Pronto | Cards com editar/deletar |
| Clientes | ✅ Pronto | Tabela com busca |
| Página pública (mobile) | ✅ Pronto | Dark mode, passos claros, excelente UX |
| Confirmação de agendamento | ✅ Pronto | Tela de sucesso profissional |

### 🔧 Precisa de melhoria

| Tela | Problema | O que fazer |
|------|----------|-------------|
| **Dashboard** | Vazio — não mostra nada útil | Adicionar cards de métricas + lista de agendamentos de hoje |
| **Site (customização)** | Muito sobrecarregada, mostra nomes de tabelas do banco | Remover textos técnicos, simplificar em abas: Aparência / Horários |

---

## Próximas tarefas priorizadas

1. **Dashboard** — implementar:
   - Card: total de agendamentos hoje
   - Card: total de clientes cadastrados
   - Card: agendamentos da semana
   - Lista: próximos 5 agendamentos do dia (nome cliente + serviço + horário)
   - Usar skeleton loading enquanto carrega
   - Dados via Supabase (tabelas: `agendamentos_confirmados`, `clientes_do_site`, `servicos`, `clientes_do_site`)

2. **Página Site** — simplificar:
   - Remover labels técnicas (`tabela: site`, `tabela: servicos`)
   - Organizar em duas seções visuais claras: Aparência e Funcionamento
   - Manter preview ao vivo (está ótimo)

3. **Notificação WhatsApp** — ao confirmar agendamento, disparar mensagem pro prestador via WhatsApp Business API (Evolution API)

4. **Autenticação segura** — substituir senha em texto plano por Supabase Auth ou bcrypt

---

## Observações importantes

- O Google Calendar foi removido da lógica — `agendamentos.js` já consulta só o Supabase. Pode deletar `google-key.json` e `googleapis` do package.json.
- O frontend se comunica tanto com o backend Express (via `api.js`) quanto diretamente com o Supabase (via `supabase.js`).
- CORS do backend configurado para `localhost:5173` e `localhost:5500`. Adicionar nova porta se necessário em `server.js`.
- Senha do usuário está em texto plano no banco — **não colocar em produção antes de resolver isso**.