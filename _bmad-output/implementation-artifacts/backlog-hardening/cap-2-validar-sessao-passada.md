# Pseudo-story CAP-2: Fechar gaps de horário já passado (FR-10, FR-12)

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-2, Grupo A)

## Story

As cliente,
I want ser impedido de reservar ou pagar assento de uma sessão que já aconteceu,
so that eu não fico com um ingresso inútil pra um evento que já passou.

## Acceptance Criteria

1. **Given** uma sessão cujo `dataHora` já passou **When** `POST /api/reservas` é chamado pra ela
   **Then** a API rejeita (novo código de erro, ex.: `SESSAO_ENCERRADA`, `409` ou `422` — escolher
   consistente com o padrão de erro já usado nas outras exceções de `sessoes`).
2. **Given** uma reserva `ATIVA` (dentro do TTL de 10min) cuja sessão passou de horário nesse
   meio-tempo **When** `POST /api/pagamentos/confirmar` é chamado **Then** a API rejeita pelo mesmo
   motivo, sem emitir ingresso.
3. **Given** uma sessão futura normal **When** reserva e pagamento seguem o fluxo de sempre
   **Then** nada muda — os dois guards só disparam pra sessão já encerrada.

## Tasks / Subtasks

- [ ] **Task 1 — Guard em `ReservaService.reservar()` (FR-10)**
  - [ ] **[RED]** Em `api/src/test/java/br/com/rolo35/api/reservas/service/ReservaServiceTest.java`,
    caso novo: sessão com `dataHora` no passado → `reservar()` lança a exceção nova, sem chamar
    `assentoSessaoRepository`/persistir hold nenhum. Rodar e confirmar que falha (comportamento
    atual aceita).
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/sessoes/SessaoEncerradaException.java`
    (mesmo padrão de `SessaoConflitanteException`/`HoldAtivoException`). Em
    `api/src/main/java/br/com/rolo35/api/reservas/service/ReservaService.java`, adicionar guard
    clause logo após ler a `Sessao` já usada no fluxo de lock: `if (sessao.getDataHora().isBefore(
    LocalDateTime.now())) throw new SessaoEncerradaException();`.
  - [ ] Registrar o novo código de erro no `GlobalExceptionHandler` (mapeamento pro envelope
    `{codigo, mensagem}` já usado no projeto).
  - [ ] Commit: `fix(reservas): rejeita reserva de sessão com horário já passado (FR-10)`

- [ ] **Task 2 — Mesmo guard em `PagamentoService.confirmar()` (FR-12)**
  - [ ] **[RED]** Em `api/src/test/java/br/com/rolo35/api/pagamentos/service/PagamentoServiceTest.java`,
    caso novo: reserva `ATIVA` (dentro do TTL) cuja sessão associada (via `reserva.sessaoId`) já
    passou de `dataHora` → `confirmar()` lança `SessaoEncerradaException`, sem emitir ingresso. Rodar
    e confirmar que falha.
  - [ ] **[GREEN]** Em `PagamentoService.confirmar()`, buscar a `Sessao` via `reserva.sessaoId` (join
    extra — hoje o método não carrega isso) e aplicar o mesmo guard antes de qualquer emissão de
    ingresso.
  - [ ] Commit: `fix(pagamentos): rejeita confirmação de reserva de sessão já encerrada (FR-12)`

## Dev Notes

- As duas tasks reusam a mesma exceção (`SessaoEncerradaException`) — criar uma vez na Task 1,
  reaproveitar na Task 2.
- Não confundir com `SessaoConflitanteException` (conflito de horário na criação/edição) nem com
  `ReservaExpiradaException` (TTL de hold vencido) — é um terceiro motivo de rejeição, específico
  de "a sessão em si já aconteceu".
- Ver `_bmad-output/implementation-artifacts/business-rules-gaps.md` — este item já estava
  catalogado lá como achado de revisão adversarial (`[FIX]` FR-10/FR-12); esta pseudo-story fecha
  os dois.
