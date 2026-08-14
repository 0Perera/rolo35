# Pseudo-story CAP-7: Mostrar ocupação da sala no formulário de sessão

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-7, Grupo B)

## Story

As organizador criando/editando uma sessão,
I want ver quais horários da sala escolhida já estão ocupados antes de submeter,
so that eu não descubro o conflito só depois do `409 SESSAO_CONFLITANTE`.

## Contexto / por quê

`salas` é pool compartilhado sem dono; `sessoes` hoje é (ou era, antes do CAP-1) isolada por
organizador — o dropdown de sala em `FormSessao.tsx` lista todas as salas sem mostrar ocupação
nenhuma. Fica **mais relevante depois do CAP-1**, já que toda a equipe passa a compartilhar a
gestão de sessão e vai ver conflito de colegas com mais frequência.

## Acceptance Criteria

1. **Given** o organizador seleciona uma sala no formulário **When** o formulário carrega/atualiza
   **Then** exibe os intervalos de horário já ocupados por outras sessões daquela sala (buffer de
   4h já usado no back), sem expor de quem é cada sessão.
2. **Given** o organizador escolhe um horário que colide com um intervalo já ocupado **When** ele
   tenta submeter **Then** o form pode (opcional) já bloquear no client, mas o back continua sendo
   a fonte de verdade — o `409` do back não é removido, só vira menos comum na prática.
3. **Given** uma sala sem nenhuma sessão marcada **When** selecionada **Then** exibe "sem sessões
   marcadas" ou equivalente, sem erro.

## Tasks / Subtasks

- [ ] **Task 1 — Endpoint de ocupação da sala**
  - [ ] **[RED]** `@WebMvcTest` novo (ou teste em `SessaoControllerTest`) provando
    `GET /api/salas/{id}/ocupacao` (ou rota equivalente) retorna lista de intervalos
    `{inicio, fim}` sem nenhum campo de organizador/sessão identificável. Rodar e confirmar falha
    (rota não existe).
  - [ ] **[GREEN]** Nova query em `SessaoRepository` (ou `SalaRepository`) retornando `dataHora` +
    duração assumida (buffer de 4h) de todas as sessões futuras da sala; DTO novo
    (`OcupacaoSalaDto`) só com os intervalos, sem `organizadorId`/`titulo`. Endpoint novo em
    `SalaController` ou `SessaoController`, `@PreAuthorize("hasRole('ORGANIZADOR')")`.
  - [ ] Commit: `feat(sessoes): endpoint de ocupação de sala pro form de criação/edição`

- [ ] **Task 2 — Exibir no front**
  - [ ] Em `web/src/components/FormSessao.tsx`, ao selecionar sala, buscar ocupação via API nova e
    renderizar os intervalos (lista simples ou destaque visual no campo de data/hora).
  - [ ] Teste de contrato leve (comportamento, não renderização) confirmando que a chamada dispara
    ao trocar de sala e os intervalos aparecem.
  - [ ] Commit: `feat(web): exibe ocupação da sala escolhida no form de sessão`

## Dev Notes

- Não expor `organizadorId` nem `titulo` da sessão ocupante — só o intervalo bloqueado, conforme
  decidido no `SPEC.md`.
- Reaproveitar o buffer de 4h já usado em `existeConflitante`/`existeConflitanteExcluindo`
  (`SessaoRepository`) pra calcular o fim do intervalo — não inventar constante nova.
