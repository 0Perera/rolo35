# Pseudo-story CAP-1: Remover isolamento de dono entre organizadores

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-1, Grupo A)

> ⚠️ **Tratamento especial**: esta pseudo-story vira **um único commit isolado**, com sua própria
> entrada em `docs/decisions.md` escrita no mesmo commit — não entra no lote de commits das outras
> pseudo-stories deste backlog.

## Story

As qualquer usuário ORGANIZADOR,
I want editar e gerenciar qualquer sessão do cinema, não só as que eu criei,
so that a equipe inteira compartilha a gestão do mesmo cinema, sem barreira artificial entre
colegas.

## Contexto / por quê

O requisito oficial do desafio (`Desafio-Elite-Dev-2026-1.pdf`) e o seed atual
(`V2__seed.sql`) só especificam **um** organizador, sem exigência de isolamento multi-tenant. A
restrição atual (`SessaoNaoPertenceAoOrganizadorException`, checagem de `organizador_id` em
`SessaoService`) é escopo que o dev acrescentou por conta própria — engenharia defensiva não
pedida. Removê-la é descope de volta ao que foi solicitado, não uma feature nova.

## Acceptance Criteria

1. **Given** dois usuários `ORGANIZADOR` distintos, um sendo dono de uma sessão **When** o outro
   organizador chama `PUT /api/sessoes/{id}` ou consulta `GET /api/sessoes/{id}` **Then** a
   operação funciona normalmente, sem `403`/exceção de ownership.
2. **Given** `GET /api/sessoes/minhas` **When** chamado por qualquer `ORGANIZADOR` **Then** retorna
   todas as sessões do cinema (não mais filtradas por `organizador_id`) — avaliar se o nome do
   endpoint/rota ainda faz sentido como "minhas" ou se deve virar algo como "gestão" (decisão de
   nomenclatura pode ficar registrada em `docs/decisions.md`, não é obrigatório renomear a rota
   nesta pseudo-story se o tempo apertar).
3. **Given** a suíte de testes existente que cobre `SessaoNaoPertenceAoOrganizadorException`
   **When** a exceção é removida **Then** os testes que a exercitavam são removidos/reescritos
   pra provar o novo comportamento (qualquer organizador pode editar), não deixados quebrados.
4. **Given** a remoção **When** o commit é criado **Then** ele vem sozinho, com uma entrada nova em
   `docs/decisions.md` no mesmo commit, citando a justificativa (requisito oficial só especifica
   um organizador; a restrição era engenharia defensiva não pedida).

## Tasks / Subtasks

- [ ] **Task 1 — Remover a checagem de ownership em `SessaoService`**
  - [ ] **[RED]** Em `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java`
    (ou equivalente), atualizar/criar teste provando que `editar()`/`buscarPorId()`/`listarMinhas()`
    não filtram nem rejeitam por `organizador_id` diferente do usuário autenticado. Rodar e
    confirmar que falha contra o comportamento atual.
  - [ ] **[GREEN]** Em `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java`,
    remover a checagem que lança `SessaoNaoPertenceAoOrganizadorException` em `editar()` e
    `buscarPorId()`; ajustar `findByOrganizadorId`/`listarMinhas()` pra não filtrar por dono (ou
    remover o filtro da query, mantendo só a listagem de gestão sem cláusula de ownership).
  - [ ] Deletar `api/src/main/java/br/com/rolo35/api/sessoes/SessaoNaoPertenceAoOrganizadorException.java`
    e qualquer referência a ela (handler em `GlobalExceptionHandler`, se existir entrada dedicada).
  - [ ] Rodar a suíte completa de `sessoes` e confirmar verde.

- [ ] **Task 2 — Registrar a decisão e commitar isolado**
  - [ ] Adicionar entrada em `docs/decisions.md`: decisão (remover isolamento de dono entre
    organizadores) + por quê (requisito oficial só especifica um organizador seedado, sem
    isolamento multi-tenant; a restrição era escopo não pedido, confirmado contra o PDF oficial no
    penúltimo dia do prazo).
  - [ ] Commit único: `refactor(sessoes): remove isolamento de dono entre organizadores — sessão
    vira recurso do cinema` (mensagem final ajustável, mas precisa citar a justificativa resumida
    ou apontar pra `docs/decisions.md`).

## Dev Notes

- Não mexer em `salas` — já é pool compartilhado, não precisa de mudança.
- Não introduzir nenhum conceito de "cinema"/multi-tenant novo — é remoção pura, não adição de
  modelo.
- Ver `_bmad-output/specs/spec-backlog-hardening/backlog-priority.md` (CAP-1) pra dependências:
  **CAP-9 (índice em `organizador_id`) só deve ser decidido depois desta pseudo-story**, porque a
  forma final de `findByOrganizadorId` pode mudar aqui.
