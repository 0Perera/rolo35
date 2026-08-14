# Pseudo-story CAP-4: Guarda de rota protegida no front

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-4, Grupo A)

## Story

As visitante sem papel autorizado (sem token, ou com papel errado),
I want ser barrado antes de preencher uma tela inteira que não vou conseguir submeter,
so that eu não perco tempo com um formulário que só vai devolver 401/403 no fim.

## Contexto / por quê

Item pedido em **3 code reviews anteriores** (Story 2.1, Story 4-3, registrados em
`deferred-work.md`) como "resolver de uma vez com componente de rota protegida" — nunca feito.
Confirmado ausente por grep em `web/src/App.tsx` nesta auditoria. Não é falha de segurança (o
back-end sempre valida via `@PreAuthorize`/JWT) — é fricção de UX pura, mas é o item mais
recorrente e nunca fechado do histórico de review do projeto.

## Acceptance Criteria

1. **Given** um visitante sem token **When** acessa `/organizador/*`, `/portaria/*` ou
   `/pagamento/:reservaId` diretamente pela URL **Then** é redirecionado pro login (ou recebe
   feedback claro), sem ver o formulário/tela completa antes disso.
2. **Given** um usuário autenticado com papel errado (ex.: `CLIENTE` acessando `/organizador/*`)
   **When** tenta acessar **Then** é bloqueado no front antes de qualquer submit, com mensagem
   apropriada (não a genérica de erro de comunicação).
3. **Given** um usuário com o papel certo **When** acessa a rota correspondente **Then** nada
   muda — comportamento idêntico ao atual.
4. **Given** a cobertura de teste do componente novo **When** rodada **Then** prova os 3 cenários
   acima (sem token, papel errado, papel certo) — cobertura leve de contrato, não de renderização
   (mesmo critério das instruções do projeto pra componentes de interação visual).

## Tasks / Subtasks

- [ ] **Task 1 — Componente `ProtectedRoute`**
  - [ ] **[RED]** Criar `web/src/components/ProtectedRoute.test.tsx`: renderizar rota protegida
    sob 3 condições (sem token no client de auth, token com papel errado, token com papel certo)
    e afirmar o resultado (redirect vs. renderiza children). Rodar e confirmar que falha por
    `ProtectedRoute` não existir.
  - [ ] **[GREEN]** Criar `web/src/components/ProtectedRoute.tsx` — componente que lê o estado de
    auth já existente no projeto (client/contexto de auth atual, verificar onde o papel/token
    ficam expostos hoje — provavelmente o mesmo lugar que `LoginPage.tsx` usa pra decidir
    `rotaPorPapel`), aceita uma prop de papel(is) permitido(s), redireciona pro login (ou pra rota
    pública) quando não autenticado/papel errado, renderiza `children`/`<Outlet />` quando ok.
  - [ ] Rodar o teste até passar.

- [ ] **Task 2 — Aplicar nas rotas do `App.tsx`**
  - [ ] Envolver `/organizador/*` com `<ProtectedRoute papel="ORGANIZADOR">`, `/portaria/*` com
    `<ProtectedRoute papel="PORTARIA">`, `/pagamento/:reservaId` com
    `<ProtectedRoute papel="CLIENTE">` em `web/src/App.tsx`.
  - [ ] Teste de integração leve (ou ajuste nos testes de página existentes) confirmando que as
    páginas afetadas continuam renderizando normalmente pro papel certo.
  - [ ] Commit: `feat(web): guarda de rota protegida por papel (ProtectedRoute)`

## Dev Notes

- Não duplicar a checagem de autorização do back — isso já existe e continua sendo a fonte de
  verdade. O componente é só UX, não vira controle de acesso real.
- Checar se já existe algum client/contexto de auth centralizado (`web/src/api/client.ts` foi
  citado em `deferred-work.md` como onde o `papel` é lido via cast não validado) — reaproveitar
  esse ponto em vez de duplicar lógica de leitura de token/papel.
