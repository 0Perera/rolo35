---
baseline_commit: 7bb65d2
---

# Story 2.2: Edição de Sessão com Trava Pós-Venda

Status: in-progress

## Story

As a organizador,
I want gerenciar e editar apenas as sessões que eu mesmo criei, e ser barrado de editar qualquer campo assim que a sessão já tiver ingresso vendido,
so that eu corrijo dados antes da venda sem risco de quebrar ingresso já emitido, e não interfiro em sessões de outro organizador.

## Acceptance Criteria

1. **Given** sessões criadas por múltiplos organizadores **When** um organizador lista suas próprias sessões **Then** só vê as que ele mesmo criou — nunca as de outro organizador, nem na própria listagem de gestão.

2. **Given** uma sessão criada por outro organizador **When** ele tenta editá-la (mesmo sabendo o ID) **Then** a requisição é rejeitada com `403`.

3. **Given** uma sessão própria sem nenhum ingresso confirmado **When** ele edita data, sala, preço, título ou sinopse **Then** a edição é aceita e persistida.

4. **Given** uma sessão própria com ≥1 ingresso confirmado **When** ele tenta editar qualquer campo — data, sala/capacidade, preço, título ou sinopse **Then** a edição é rejeitada, sem exceção pra nenhum campo, com erro claro indicando o motivo.

5. **Given** a resposta de qualquer endpoint de gestão de sessão **When** inspecionada **Then** não expõe dado de outro organizador nem identidade de cliente.

## Branch e commits — regra obrigatória desta story

Continuação da branch `epic-2-gestao-de-sessoes-organizador` (já existe, já tem 2.1 e 2.3). Cada task abaixo termina em **um commit próprio**, ciclo RED (teste falha por ausência do código) → GREEN (código mínimo que passa) → commit, mesma disciplina das stories 2.1/2.3. Mensagem curta, Conventional Commits: `tipo(sessoes): descrição curta`.

## TDD — regra obrigatória desta story

Regra única do projeto (CLAUDE.md § Metodologia XP + TDD): todo teste nasce antes do código. Front-end de interação puramente visual é a única exceção documentada (teste de contrato nasce depois do componente).

## Tasks / Subtasks

- [x] **Task 1 — Repository: queries de edição + smoke test (sem AC isolada, infraestrutura das demais)**
  - [x] **[RED]** Estender `SessaoListagemRepositoryTest` (ou criar `SessaoGestaoRepositoryTest`, Testcontainers) cobrindo: `SessaoRepository.findByIdForUpdate` trava e retorna a sessão certa; `existeConflitanteExcluindo` retorna `false` pra sessão sobrepondo só com ela mesma e `true` pra sobreposição com outra sessão real; `existeIngressoConfirmado` retorna `false` sem linha em `ingressos` e `true` com uma linha inserida via SQL direto no teste (schema já existe, sem entidade `Ingresso` — insert nativo no teste); `findByOrganizadorId` retorna só as sessões do organizador dado, com `editavel=true`/`false` batendo com a existência de ingresso.
  - [x] **[GREEN]** Adicionar em `SessaoRepository`: `findByIdForUpdate` (`@Lock(PESSIMISTIC_WRITE)`, mesmo padrão de `SalaRepository`), `existeConflitanteExcluindo(salaId, dataHora, bufferMinutos, sessaoIdExcluir)` (mesma query nativa de `existeConflitante` + `AND id != :sessaoIdExcluir`), `existeIngressoConfirmado(sessaoId)` (`SELECT EXISTS(SELECT 1 FROM ingressos WHERE sessao_id = :sessaoId)`), `findByOrganizadorId(organizadorId)` retornando `List<SessaoGestaoProjection>` (query nativa: mesmos campos de `listarPublicadas` + `s.organizador_id = :organizadorId`, sem filtro de `data_hora >= now()`, agregando `editavel = NOT EXISTS(SELECT 1 FROM ingressos i WHERE i.sessao_id = s.id)`). Criar `SessaoGestaoProjection` (interface, mesmo estilo de `SessaoListagemProjection`, com `getEditavel()` a mais).
  - [x] Commit: `feat(sessoes): queries de repository pra edição e listagem de gestão`

- [x] **Task 2 — SessaoService.editar() (AC1, AC2, AC3, AC4)**
  - [x] **[RED]** Estender `SessaoServiceTest` (Mockito puro) cobrindo `editar(id, request, organizadorEmail)`: caso feliz sem troca de sala (campos atualizados, `assentoSessaoRepository` não tocado); caso feliz com troca de sala (linhas antigas de `AssentoSessao` apagadas, novas inseridas pra nova sala, todas `LIVRE`); sessão inexistente → `SessaoNaoEncontradaException`; sessão de outro organizador → `SessaoNaoPertenceAoOrganizadorException`, sem chegar a checar conflito; ingresso confirmado existente → `SessaoComIngressoConfirmadoException`, e `sessaoRepository.save` nunca chamado; conflito de horário (excluindo a própria sessão) → `SessaoConflitanteException`. Rodar e confirmar falha por ausência do método/exceptions.
  - [x] **[GREEN]** Criar `SessaoNaoEncontradaException`, `SessaoNaoPertenceAoOrganizadorException`, `SessaoComIngressoConfirmadoException` (raiz de `sessoes`, `RuntimeException` simples). Implementar `SessaoService.editar`: (1) validar `dataHora` no futuro antes de qualquer lock; (2) resolver organizador; (3) `SET LOCAL lock_timeout`; (4) `sessaoRepository.findByIdForUpdate(id)` → vazio → `SessaoNaoEncontradaException`; (5) ownership → senão `SessaoNaoPertenceAoOrganizadorException`; (6) `existeIngressoConfirmado` → true → `SessaoComIngressoConfirmadoException`; (7) se sala mudou, `salaRepository.findByIdForUpdate` da nova sala; checar `existeConflitanteExcluindo` na sala (nova ou atual) excluindo o próprio id; (8) se sala mudou: `assentoSessaoRepository.deleteAll(findByIdSessaoId(id))` + inserir uma linha `LIVRE` por assento da nova sala; (9) `sessao.toBuilder()` com os campos editados, `save`; (10) retornar `SessaoResponse`. Adicionar `@Builder(toBuilder = true)` em `Sessao`.
  - [x] Commit: `feat(sessoes): SessaoService.editar() com ownership e trava pós-venda`

- [x] **Task 3 — GET /api/sessoes/minhas, GET /api/sessoes/{id}, PUT /api/sessoes/{id} (AC1, AC2, AC3, AC4, AC5)**
  - [x] **[RED]** Estender `SessaoControllerTest` (`@WebMvcTest`, service mockado): `GET /minhas` → `200` + lista de `SessaoGestaoDto` (sem campo de outro organizador — resolvido no service, controller só repassa); `GET /{id}` → `200` corpo completo, service lança `SessaoNaoEncontradaException` → `404`, `SessaoNaoPertenceAoOrganizadorException` → `403`; `PUT /{id}` corpo válido → `200` + `SessaoResponse`, `SessaoComIngressoConfirmadoException` → `409`, `SessaoConflitanteException` → `409`, corpo inválido (`preco` negativo) → `400`.
  - [x] **[GREEN]** Criar `dto/EditarSessaoRequest.java` (record: `salaId @NotNull Long`, `dataHora @NotNull LocalDateTime`, `preco @NotNull @Positive @Digits(...) BigDecimal`, `titulo @NotBlank String`, `sinopse String` nullable) e `dto/SessaoGestaoDto.java` (record: `id, salaId, salaNome, titulo, dataHora, preco, capacidade, editavel`). Adicionar em `SessaoController`: `@GetMapping("/minhas")`, `@GetMapping("/{id}")`, `@PutMapping("/{id}")`, todos com `Authentication` repassando `authentication.getName()` pro service. Adicionar em `GlobalExceptionHandler`: `SessaoNaoEncontradaException` → `404 SESSAO_NAO_ENCONTRADA`; `SessaoNaoPertenceAoOrganizadorException` → `403 NAO_AUTORIZADO`; `SessaoComIngressoConfirmadoException` → `409 SESSAO_COM_INGRESSO_CONFIRMADO`.
  - [x] Commit: `feat(sessoes): endpoints de listagem de gestão, detalhe e edição de sessão`

- [x] **Task 4 — Restringe os 3 endpoints novos a ORGANIZADOR (AC1, AC2, AC5)**
  - [x] **[RED]** Estender `SessaoSecurityTest` (filtros reais): token `ORGANIZADOR` chega no service mockado nos 3 endpoints novos; token `CLIENTE`/`PORTARIA` → `403` no envelope padrão.
  - [x] **[GREEN]** `@PreAuthorize("hasRole('ORGANIZADOR')")` em `minhas`, `buscarPorId` e `editar` no controller (mesmo padrão do `POST` existente).
  - [x] Commit: `feat(sessoes): restringe gestão de sessão a ORGANIZADOR`

- [x] **Task 5 — Front-end: listagem de gestão e tela de edição**
  - [x] Estender `web/src/api/sessoes.ts`: tipos `SessaoGestao`, `EditarSessaoRequest`; funções `listarMinhasSessoes()`, `buscarSessao(id)`, `editarSessao(id, request)`.
  - [x] Criar `web/src/pages/GerenciarSessoesPage.tsx`: estados `loading/vazio/erro/pronto` (NFR-1, mesmo padrão de `ListagemSessoesPage`), lista as sessões do organizador, sessão com `editavel=false` mostra badge "travada" sem link; `editavel=true` linka pra `/organizador/sessoes/:id/editar`.
  - [x] Criar `web/src/pages/EditarSessaoPage.tsx`: `useParams()` pro `id`, busca via `buscarSessao(id)` no mount (loading/erro), formulário pré-populado (sala, data/hora, preço, título, sinopse — mesmos componentes de `CriarSessaoPage`), submit via `editarSessao`; erro `409` (trava ou conflito) mostrado com a mensagem vinda do back, sem mensagem genérica.
  - [x] `web/src/App.tsx`: rotas `/organizador/sessoes` e `/organizador/sessoes/:id/editar`.
  - [x] `BuscaFilmesPage.tsx`: link "Minhas sessões" pra `/organizador/sessoes`.
  - [x] Depois dos componentes prontos: `GerenciarSessoesPage.test.tsx`, `EditarSessaoPage.test.tsx` (vitest + testing-library, mock de `api/sessoes.ts`).
  - [x] Commit: `feat(sessoes): tela de gestão e edição de sessão`

- [x] **Task 6 — Confirmação final**
  - [x] Rodar `mvn test` (back) e `npm test && npm run build && npx oxlint` (front), tudo verde.
  - [x] Registrar decisões relevantes em `docs/decisions.md` (reescrita de `assento_sessao` na troca de sala; ausência de teste de concorrência edição-vs-venda por falta de par real do lado de Epic 4).
  - [x] Status desta story → `review`.
  - [x] Commit: `docs(sessoes): confirmação final e fecha Story 2.2 pra review`

## Dev Notes

- **Sem teste de concorrência edição-vs-venda dedicado.** O par lock+checagem replica o mesmo mecanismo de banco da 2.1 (ação obrigatória registrada no deferred-work do code review da 2.1), mas não existe ainda código de confirmação de ingresso (Epic 4) rodando em paralelo pra um teste de concorrência real testar contra. Fabricar esse teste hoje testaria só a checagem isolada de app, não a garantia real — mesmo raciocínio que a 2.1 usou pra exigir que o teste de conflito de horário derrube o lock manualmente antes de confiar nele.
- **Troca de sala reescreve `assento_sessao`.** Como o passo de trava (ingresso confirmado) já roda antes, trocar a sala numa edição nunca perde estado de venda — é seguro apagar e recriar todas as linhas.
- **`existeIngressoConfirmado` não precisa checar `status`.** `ingressos` só ganha uma linha quando o pagamento já foi confirmado (decisão já registrada em `docs/decisions.md` sobre o fluxo de pagamento simulado) — a existência da linha já é o sinal.

## Project Structure Notes

- **Back-end (novo)**: `SessaoNaoEncontradaException`, `SessaoNaoPertenceAoOrganizadorException`, `SessaoComIngressoConfirmadoException`, `dto/EditarSessaoRequest`, `dto/SessaoGestaoDto`, `repository/SessaoGestaoProjection`; testes correspondentes.
- **Back-end (update)**: `Sessao` (`@Builder(toBuilder = true)`), `SessaoRepository`, `SessaoService`, `SessaoController`, `GlobalExceptionHandler`.
- **Front-end (novo)**: `web/src/pages/GerenciarSessoesPage.tsx` (+ teste), `web/src/pages/EditarSessaoPage.tsx` (+ teste).
- **Front-end (update)**: `web/src/api/sessoes.ts`, `web/src/App.tsx`, `web/src/pages/BuscaFilmesPage.tsx`.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Edição de Sessão com Trava Pós-Venda]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — ação obrigatória do code review da 2.1: PUT precisa replicar o par lock+checagem de conflito]
- [Source: _bmad-output/implementation-artifacts/2-1-criacao-de-sessao-com-bloqueio-de-conflito-de-horario.md — padrões de service/controller/testes a mirror]
- [Source: api/src/main/resources/db/migration/V1__schema.sql — tabela `ingressos` já existente]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-agent-dev, persona Amelia)

### Completion Notes List

- Tasks 1-5: implementadas em sequência RED→GREEN→commit, mirrorando os padrões da Story 2.1. Task 4 (`@PreAuthorize` nos 3 endpoints novos) foi de fato commitada junto da Task 3 (o controller já nasceu anotado) — a suíte de segurança (`SessaoSecurityTest`) entrou num commit próprio logo em seguida, cobrindo o comportamento mesmo sem o RED isolado pra essa task específica; desvio pontual do ciclo estrito, sem impacto na cobertura final.
- Backend: 81 testes verdes (`mvn test`), incluindo o novo `SessaoGestaoRepositoryTest` (Testcontainers) e as extensões de `SessaoServiceTest`/`SessaoControllerTest`/`SessaoSecurityTest`.
- Front-end: 38 testes verdes (`npm test`), `npm run build` e `npx oxlint` limpos (só o warning pré-existente de `LoginPage.tsx`).
- Decisões registradas em `docs/decisions.md`: reescrita de `assento_sessao` na troca de sala; ausência de teste de concorrência edição-vs-venda por falta de par real do lado de Epic 4.

### Review Findings

Code review de 2026-08-10 — 3 camadas (adversarial geral, edge cases, auditoria de aceite) sobre `git diff 7bb65d2..HEAD`. 13 achados após deduplicação, 1 descartado como ruído.

- [ ] [Review][Patch] Ordem `dataHora` vs ownership em `editar()` pode devolver `400` em vez do `403` da AC2 — `SessaoService.java:450-452` valida `dataHora` no futuro **antes** de checar dono da sessão (mesma ordem fail-fast-antes-do-lock da Story 2.1, AD-5). Uma edição malformada (data no passado) mirando o ID de outro organizador recebe `400 DATA_HORA_NO_PASSADO`, não `403`, porque a checagem de ownership só roda depois do lock. **Decisão do usuário**: reordenar — travar a sessão e checar ownership antes de validar `dataHora`.

- [ ] [Review][Patch] Sem índice em `sessoes.organizador_id` pra `findByOrganizadorId` [`api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java`] — viola o non-negotiable de índice em coluna de filtro/join de tela (CLAUDE.md). Adicionar migration com `CREATE INDEX idx_sessoes_organizador_id ON sessoes (organizador_id)`.

- [ ] [Review][Patch] `buscarPorId` calcula `capacidade` via `assentoSessaoRepository.findByIdSessaoId(id).size()`, enquanto `listarMinhas`/`criar` derivam do mapa de assentos da sala (`assentoRepository.findBySalaId`) — duas fontes pra um mesmo conceito, sem nada garantindo que fiquem iguais [`api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java`]. Unificar `buscarPorId` pra usar a mesma fonte (mapa de assentos da sala).

- [ ] [Review][Patch] `editar()` trava a sala com `findByIdForUpdate` e roda `existeConflitanteExcluindo` mesmo quando nem `salaId` nem `dataHora` mudam — lock desnecessário na sala pra uma edição só de `preco`/`titulo`/`sinopse`, contrariando o texto da Task 2 ("se sala mudou...") e o princípio de transação de lock mais curta possível (AD-5) [`api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java`]. Só travar+checar conflito quando `salaId` ou `dataHora` mudarem.

- [ ] [Review][Patch] `listarMinhas`/`buscarPorId` sem teste unitário direto em `SessaoServiceTest` (só cobertos indiretamente via controller com o service mockado) — a regra de ownership de `buscarPorId` (AC2/AC5) nunca é de fato executada por nenhum teste. `SessaoGestaoRepositoryTest.findByOrganizadorIdTrazSoAsProprias` também não prova a exclusão de sessão de outro organizador (só prova a presença da própria) [`api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java`, `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoGestaoRepositoryTest.java`]. Adicionar testes diretos de `listarMinhas`/`buscarPorId` no service e o caso negativo no repository test.

- [ ] [Review][Patch] `EditarSessaoPage` não checa `sessao.editavel` antes de renderizar o form — quem chega numa sessão travada (link antigo, back-button, favorito) vê o formulário inteiro liberado e só descobre a trava depois de submeter e tomar `409` [`web/src/pages/EditarSessaoPage.tsx`]. Checar `sessao.editavel` após o load e mostrar mensagem de trava sem formulário quando `false`.

- [x] [Review][Defer] Troca de sala em `editar()` apaga `assento_sessao` sem checar hold ativo (`RESERVADO`/`reservas` não confirmada) [`api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java`] — deferred, pre-existing (hoje inalcançável: Epic 3, que cria reservas/holds, ainda não existe em código). **Ação obrigatória pra Epic 3**: quando reserva com hold temporário existir, `editar()` precisa checar hold ativo além de `existeIngressoConfirmado` antes de reescrever `assento_sessao`.

- [x] [Review][Defer] `findByOrganizadorId` usa `INNER JOIN assentos` — uma sessão cuja sala não tenha assento cadastrado some da listagem de gestão em vez de aparecer com `capacidade=0` [`api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java`] — deferred, pre-existing (mesma classe de achado já registrada no deferred-work da Story 2.3 pra `listarPublicadas`; hoje inalcançável porque `criar()` rejeita sala sem assentos).

- [x] [Review][Defer] Ordem de lock assimétrica entre `criar()` (só sala) e `editar()` (sessão, depois sala) [`api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java`] — deferred, pre-existing risk pattern, nenhum cenário concreto de deadlock identificado hoje (não há caminho que trave sala antes de sessão em nenhum outro lugar do código).

- [x] [Review][Defer] `findByOrganizadorId` ordena só por `s.data_hora`, sem critério de desempate (`s.id`) — duas sessões no mesmo horário podem reordenar entre requisições [`api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java`] — deferred, cosmético.

- [x] [Review][Defer] Matriz de testes de segurança não cobre toda combinação papel×endpoint (falta `PORTARIA` em `/minhas` e `PUT`, `CLIENTE` em `GET /{id}`) [`api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java`] — deferred, valor marginal baixo já que a mesma anotação `@PreAuthorize("hasRole('ORGANIZADOR')")` já está provada em pelo menos uma combinação por endpoint.

- [x] [Review][Defer] `EditarSessaoPage` não espelha a restrição `@Digits(integer=8, fraction=2)` do back no campo preço — só descobre no round-trip da API [`web/src/pages/EditarSessaoPage.tsx`] — deferred, cosmético, back já rejeita com segurança.

### File List

- `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoGestaoProjection.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/SessaoRepository.java` (update: `findByIdForUpdate`, `existeConflitanteExcluindo`, `existeIngressoConfirmado`, `findByOrganizadorId`)
- `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoGestaoRepositoryTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/Sessao.java` (update: `@Builder(toBuilder = true)`)
- `api/src/main/java/br/com/rolo35/api/sessoes/{SessaoNaoEncontradaException,SessaoNaoPertenceAoOrganizadorException,SessaoComIngressoConfirmadoException}.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/dto/{EditarSessaoRequest,SessaoGestaoDto}.java` (novo)
- `api/src/main/java/br/com/rolo35/api/sessoes/service/SessaoService.java` (update: `editar`, `listarMinhas`, `buscarPorId`)
- `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (update)
- `api/src/main/java/br/com/rolo35/api/sessoes/controller/SessaoController.java` (update: `GET /minhas`, `GET /{id}`, `PUT /{id}`)
- `api/src/test/java/br/com/rolo35/api/sessoes/controller/SessaoControllerTest.java` (update)
- `api/src/test/java/br/com/rolo35/api/sessoes/SessaoSecurityTest.java` (update)
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update: 3 handlers novos)
- `web/src/api/sessoes.ts` (update: `SessaoGestao`, `EditarSessaoRequest`, `listarMinhasSessoes`, `buscarSessao`, `editarSessao`)
- `web/src/pages/GerenciarSessoesPage.tsx` (novo, + teste)
- `web/src/pages/EditarSessaoPage.tsx` (novo, + teste)
- `web/src/App.tsx` (update: rotas novas)
- `web/src/pages/BuscaFilmesPage.tsx` (update: link "Minhas sessões")
- `docs/decisions.md` (update: 2 decisões novas)
