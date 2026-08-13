# Story 5.1: Seleção de Sessão do Turno

Status: in-progress

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a usuário PORTARIA,
I want selecionar a sessão ativa do meu turno antes de validar qualquer ingresso,
so that toda validação seguinte já sabe contra qual sessão comparar o código.

## Acceptance Criteria

1. **Given** um usuário PORTARIA autenticado sem sessão selecionada **When** ele tenta validar um ingresso sem antes escolher uma sessão **Then** a operação é bloqueada, exigindo seleção prévia de sessão. (O endpoint de validação em si é da Story 5.2 — o mecanismo de bloqueio, `obterSessaoAtivaOuLancar()`, nasce aqui e é exercitado pelo `GET /api/portaria/turno` desta story.)
2. **Given** sessões publicadas disponíveis **When** a portaria seleciona uma delas pro turno **Then** essa sessão fica marcada como ativa pro contexto de validação desse usuário.
3. **Given** um usuário CLIENTE ou ORGANIZADOR **When** tenta acessar a seleção de sessão de portaria **Then** a requisição é rejeitada com `403`.
4. **Given** a lista de sessões disponíveis pra seleção **When** carregando, vazia, ou com erro **Then** o front-end trata os três estados.
5. **Given** uma portaria já com sessão ativa selecionada **When** ela seleciona outra sessão (mesmo endpoint, `POST /api/portaria/turno`, sem nenhum passo de "encerrar turno" antes) **Then** a nova seleção substitui a anterior imediatamente — não existe conceito de turno com início/fim registrado, é só um ponteiro pra "a sessão que a portaria está validando agora", livremente trocável a qualquer momento pelo próprio usuário PORTARIA. Histórico de trocas fica fora de escopo (não é pedido em nenhum FR). **AC adicionada nesta story** — o `epics.md` original cobre só a seleção inicial, não a troca entre sessões do mesmo turno de trabalho.

## Tasks / Subtasks

- [ ] **Task 1 — Migration `turno_portaria` (AC2, AC5)**
  - [ ] Criar `api/src/main/resources/db/migration/V5__turno_portaria.sql`:
    ```sql
    CREATE TABLE turno_portaria (
        usuario_id BIGINT PRIMARY KEY REFERENCES usuarios (id),
        sessao_id BIGINT NOT NULL REFERENCES sessoes (id),
        selecionado_em TIMESTAMP NOT NULL DEFAULT now()
    );
    ```
    PK é `usuario_id`: no máximo uma linha por portaria — ausência de linha é o estado "nenhuma sessão selecionada ainda" (AC1), sem precisar de coluna nullable. Reselecionar (AC5) é update na mesma linha, não insert de uma segunda. Sem índice extra: a única consulta desta story é lookup por PK, já coberta; não é uma tela de listagem/filtro que o non-negotiable de índices do CLAUDE.md exija cobrir.
    **Decisão consciente de não colocar isso em `usuarios`**: a Architecture Spine já registra que `usuarios` é "uma tabela pros três papéis... nenhum papel tem campo próprio que justifique split" — uma coluna `sessao_ativa_id` preenchida só por linhas com `papel = PORTARIA` violaria essa decisão. Tabela própria, sem entidade de domínio própria (mesmo espírito de `pagamentos`, que "opera sobre Reserva" sem tabela própria — aqui é o oposto, tabela própria sem conceito de domínio rico, só o ponteiro).
  - [ ] Commit: `feat(portaria): migration turno_portaria (AC2, AC5)`

- [ ] **Task 2 — `TurnoPortariaRepository`: smoke test Testcontainers (AC2, AC5)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/repository/TurnoPortariaRepositorySmokeTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `IngressoRepositorySmokeTest`/`IngressoLeituraRepositoryTest` das Stories 4.1/4.2): salvar uma linha (`usuarioId` de um usuário PORTARIA do seed, `sessaoId` de uma sessão existente) via `save()`, buscar por `findById(usuarioId)`, confirmar os campos batendo; salvar de novo com outro `sessaoId` pro mesmo `usuarioId` (update, AC5) e confirmar que `findById()` retorna só uma linha com o `sessaoId` novo; inserir com `usuarioId`/`sessaoId` inexistente e confirmar que o banco rejeita via FK (`DataIntegrityViolationException`). Rodar e confirmar que falha por `TurnoPortaria`/`TurnoPortariaRepository` ainda não existirem.
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/ingressos/TurnoPortaria.java` (entidade JPA, `@Id` manual `usuarioId` — sem `@GeneratedValue`, mesmo racional de `Ingresso.id` ser atribuído fora do banco — mais `sessaoId`, `selecionadoEm: LocalDateTime`). Criar `api/src/main/java/br/com/rolo35/api/ingressos/repository/TurnoPortariaRepository.java` (`extends JpaRepository<TurnoPortaria, Long>`, sem query custom — `findById`/`save` herdados bastam). Rodar o teste até passar.
  - [ ] Commit: `feat(portaria): TurnoPortariaRepository (AC2, AC5)`

- [ ] **Task 3 — `PortariaService`: `selecionarSessao()`, `sessaoAtiva()`, `obterSessaoAtivaOuLancar()` (AC1, AC2, AC5)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceTest.java` (Mockito puro, mocka `UsuarioRepository`, `SessaoRepository`, `SalaRepository`, `TurnoPortariaRepository`): (a) `selecionarSessao(portariaEmail, sessaoId)` sem turno prévio (`turnoPortariaRepository.findById()` retorna vazio) → salva `TurnoPortaria` novo com `usuarioId`/`sessaoId`/`selecionadoEm` corretos, retorna `SessaoAtivaDto`; (b) `selecionarSessao()` com turno já existente apontando pra outra sessão → salva atualizando `sessaoId`/`selecionadoEm` na mesma linha (prova explícita de AC5, não duas linhas); (c) `sessaoId` inexistente (`sessaoRepository.findById()` vazio) → `SessaoNaoEncontradaException`, **sem** chamar `turnoPortariaRepository.save()`; (d) `sessaoAtiva(portariaEmail)` sem linha em `turnoPortariaRepository` → `SessaoAtivaNaoSelecionadaException` (prova do mecanismo de bloqueio da AC1, reservado pra Story 5.2 reusar); (e) `sessaoAtiva()` com linha → `SessaoAtivaDto` com `sessaoId/titulo/salaNome/dataHora`, sem nenhum campo de `Usuario`/`Sessao` interno vazando (assert negativo, mesmo critério de `IngressoPublicoDto` na Story 4.2); (f) `obterSessaoAtivaOuLancar()` é o método que `sessaoAtiva()` chama por baixo — testar direto que ele devolve a entidade `Sessao` (não o DTO) e lança a mesma exceção do item (d). Rodar e confirmar que falha.
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/ingressos/dto/SessaoAtivaDto.java` (record: `sessaoId: Long, titulo: String, salaNome: String, dataHora: LocalDateTime`). Criar `api/src/main/java/br/com/rolo35/api/ingressos/SessaoAtivaNaoSelecionadaException.java` e `api/src/main/java/br/com/rolo35/api/ingressos/PortariaNaoEncontradaException.java` (mesmo padrão de `OrganizadorNaoEncontradoException`/`ClienteNaoEncontradoException` — usuário do token não existe mais). Criar `api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java`:
    ```java
    @Transactional
    public SessaoAtivaDto selecionarSessao(String portariaEmail, Long sessaoId) {
        Usuario portaria = usuarioRepository.findByEmail(portariaEmail).orElseThrow(PortariaNaoEncontradaException::new);
        Sessao sessao = sessaoRepository.findById(sessaoId).orElseThrow(SessaoNaoEncontradaException::new);
        turnoPortariaRepository.save(new TurnoPortaria(portaria.getId(), sessao.getId(), LocalDateTime.now()));
        return montarDto(sessao);
    }

    @Transactional(readOnly = true)
    public SessaoAtivaDto sessaoAtiva(String portariaEmail) {
        return montarDto(obterSessaoAtivaOuLancar(portariaEmail));
    }

    @Transactional(readOnly = true)
    public Sessao obterSessaoAtivaOuLancar(String portariaEmail) {
        Usuario portaria = usuarioRepository.findByEmail(portariaEmail).orElseThrow(PortariaNaoEncontradaException::new);
        TurnoPortaria turno = turnoPortariaRepository.findById(portaria.getId())
                .orElseThrow(SessaoAtivaNaoSelecionadaException::new);
        return sessaoRepository.findById(turno.getSessaoId()).orElseThrow(SessaoNaoEncontradaException::new);
    }

    private SessaoAtivaDto montarDto(Sessao sessao) {
        Sala sala = salaRepository.findById(sessao.getSalaId()).orElseThrow(SalaNaoEncontradaException::new);
        return new SessaoAtivaDto(sessao.getId(), sessao.getTitulo(), sala.getNome(), sessao.getDataHora());
    }
    ```
    `turnoPortariaRepository.save(new TurnoPortaria(...))` cobre insert e update com o mesmo código: PK (`usuarioId`) é atribuída manualmente (não gerada), então o Spring Data trata a entidade como "não nova" e faz `merge()` — se já existe linha com aquele `usuarioId`, atualiza; se não existe, insere. **`obterSessaoAtivaOuLancar()` é o primitivo que a Story 5.2 vai chamar antes de qualquer validação de ingresso** — não é código morto nem antecipação especulativa, é a peça que faz a AC1 ("operação bloqueada sem sessão selecionada") ser verdade quando a rota de validação existir; hoje ele já é exercitado de ponta a ponta pelo `GET /api/portaria/turno` desta story. Rodar o teste até passar.
  - [ ] Commit: `feat(portaria): PortariaService.selecionarSessao()/sessaoAtiva() (AC1, AC2, AC5)`

- [ ] **Task 4 — Rotas: `POST /api/portaria/turno`, `GET /api/portaria/turno` (AC1, AC2, AC3, AC5)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/controller/PortariaControllerTest.java` (`@WebMvcTest`, service mockado): `POST /api/portaria/turno` com token `PORTARIA` e `{sessaoId}` válido → `200` + `SessaoAtivaDto`; `sessaoId` nulo/ausente no corpo → `400`; service lança `SessaoNaoEncontradaException` → `404`. `GET /api/portaria/turno` com token `PORTARIA`, service retorna DTO → `200`; service lança `SessaoAtivaNaoSelecionadaException` → `409`. Criar `api/src/test/java/br/com/rolo35/api/ingressos/PortariaSecurityTest.java` (mesmo padrão de `IngressoSecurityTest`/`SessaoSecurityTest`, contexto Spring completo): sem token, os dois endpoints → `401`; token `CLIENTE` ou `ORGANIZADOR`, os dois endpoints → `403` (AC3); token `PORTARIA` passa da checagem de papel (chega no service mockado, não barra em `403`). Rodar e confirmar que falha.
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/ingressos/dto/SelecionarSessaoRequest.java` (record: `@NotNull Long sessaoId`). Criar `api/src/main/java/br/com/rolo35/api/ingressos/controller/PortariaController.java`:
    ```java
    @RestController
    @RequestMapping("/api/portaria")
    public class PortariaController {
        @PostMapping("/turno")
        @PreAuthorize("hasRole('PORTARIA')")
        public ResponseEntity<SessaoAtivaDto> selecionarSessao(
                @Valid @RequestBody SelecionarSessaoRequest request, Authentication authentication) {
            return ResponseEntity.ok(portariaService.selecionarSessao(authentication.getName(), request.sessaoId()));
        }

        @GetMapping("/turno")
        @PreAuthorize("hasRole('PORTARIA')")
        public ResponseEntity<SessaoAtivaDto> sessaoAtiva(Authentication authentication) {
            return ResponseEntity.ok(portariaService.sessaoAtiva(authentication.getName()));
        }
    }
    ```
    Nenhuma mudança em `SecurityConfig`: sem `@PreAuthorize`, a rota já cai em `anyRequest().authenticated()` (o catch-all no fim da cadeia); com `@PreAuthorize("hasRole('PORTARIA')")` no método, papel errado vira `AccessDeniedException` → `403` pelo `GlobalExceptionHandler.handleAcessoNegado()` já existente — mesmo padrão de `/api/sessoes/minhas`, sem matcher novo. Adicionar em `GlobalExceptionHandler`:
    ```java
    @ExceptionHandler(SessaoAtivaNaoSelecionadaException.class)
    public ResponseEntity<ApiError> handleSessaoAtivaNaoSelecionada() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "SESSAO_ATIVA_NAO_SELECIONADA", "Selecione a sessão do turno antes de continuar"));
    }

    @ExceptionHandler(PortariaNaoEncontradaException.class)
    public ResponseEntity<ApiError> handlePortariaNaoEncontrada() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("NAO_AUTENTICADO", "Usuário do token não existe mais"));
    }
    ```
    Rodar os testes até passar.
  - [ ] Commit: `feat(portaria): POST e GET /api/portaria/turno (AC1-3, AC5)`

- [ ] **Task 5 — Front-end: tela de seleção de sessão do turno (AC1, AC2, AC4, AC5)**
  - [ ] Criar `web/src/api/portaria.ts` (novo módulo por domínio, AD-2): `interface SessaoAtiva { sessaoId: number; titulo: string; salaNome: string; dataHora: string }`, `selecionarSessaoTurno(sessaoId: number): Promise<SessaoAtiva>` (`POST /api/portaria/turno`), `buscarSessaoAtiva(): Promise<SessaoAtiva | null>` (`GET /api/portaria/turno` — captura `ApiRequestError` com `status === 409` e devolve `null` em vez de propagar, é o estado esperado "nenhuma sessão selecionada ainda", não um erro de tela).
  - [ ] Criar `web/src/pages/SelecaoTurnoPortariaPage.tsx`: no mount, dispara `buscarSessaoAtiva()` e `listarSessoesPublicadas()` (reaproveitada de `web/src/api/sessoes.ts`, já usada por `ListagemSessoesPage`) em paralelo; máquina de estado `carregando/vazio/erro/pronto` pra lista de sessões (AC4, mesmo critério de `ListagemSessoesPage`/`MeusIngressosPage` — lista vazia é estado próprio, não erro). Usa `SeletorDeOpcao` (já existe, `web/src/components/SeletorDeOpcao.tsx`) pra escolher entre as sessões carregadas; ao confirmar, chama `selecionarSessaoTurno(sessaoId)` e atualiza o destaque "sessão ativa" no topo da tela. O seletor fica **sempre disponível pra trocar de sessão**, mesmo já havendo uma ativa — sem nenhum passo de "encerrar turno" no meio (AC5): escolher outra sessão na lista já reenvia `POST /api/portaria/turno` e substitui o destaque.
  - [ ] Em `web/src/App.tsx`: trocar a rota `/portaria` (hoje `<PapelPlaceholderPage titulo="Área da Portaria" />`) por `<Route path="/portaria" element={<SelecaoTurnoPortariaPage />} />`, dentro do `<Route element={<Layout />}>` — mesmo grupo das demais telas autenticadas, `LoginPage.rotaPorPapel('PORTARIA')` já aponta pra cá.
  - [ ] Depois do componente pronto: `SelecaoTurnoPortariaPage.test.tsx` (vitest + testing-library) — cobre os três estados da lista (AC4) e o caso de trocar de sessão já com uma ativa selecionada (AC5), contrato de comportamento, não pixel/CSS.
  - [ ] Commit: `feat(portaria): tela de seleção de sessão do turno (AC1, AC2, AC4, AC5)`

- [ ] **Task 6 — Confirmação final (sem código novo, checklist de saída)**
  - [ ] Rodar a suíte completa: backend `mvn test` (inclui o smoke test Testcontainers da Task 2); front-end `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`. Confirmar tudo verde.
  - [ ] Registrar em `docs/decisions.md`: (a) por que `turno_portaria` é tabela própria em vez de coluna em `usuarios` (a arquitetura já veta campo papel-específico na tabela única de usuários); (b) por que a lista de seleção reaproveita `listarSessoesPublicadas()` (filtro `data_hora >= now()`) sem uma listagem dedicada "sessões de hoje/em andamento" — simplificação consciente dentro do prazo de 7 dias; (c) `PortariaService.obterSessaoAtivaOuLancar()` é o primitivo que a Story 5.2 vai reusar antes de validar qualquer ingresso, não é código especulativo.
  - [ ] Atualizar o Status desta story pra `review`.
  - [ ] Atualizar `_bmad-output/implementation-artifacts/sprint-status.yaml`: `5-1-selecao-de-sessao-do-turno: review`, `epic-5: in-progress`.
  - [ ] Commit: `docs(portaria): confirmação final e fecha Story 5.1 pra review`

## Dev Notes

- **Por que não é uma coluna em `usuarios`.** A Architecture Spine descreve `usuarios(id, nome, email, senha_hash, papel, created_at)` como "uma tabela pros três papéis... nenhum papel tem campo próprio que justifique split". Uma coluna `sessao_ativa_id` só preenchida por linhas `papel = PORTARIA` seria exatamente esse split que a arquitetura já decidiu não fazer. `turno_portaria` como tabela própria (PK = `usuario_id`, sem entidade de domínio rica) resolve isso sem contradizer a decisão registrada.

- **AC1 é sobre um endpoint que ainda não existe nesta story.** O texto original da AC1 (`epics.md`) fala em "tenta validar um ingresso" — isso é `POST /portaria/validacoes`, que só nasce na Story 5.2. O que esta story entrega é o **mecanismo** de bloqueio (`PortariaService.obterSessaoAtivaOuLancar()`, que lança `SessaoAtivaNaoSelecionadaException` quando não há linha em `turno_portaria`) e um jeito de exercitá-lo hoje via `GET /api/portaria/turno` (retorna `409 SESSAO_ATIVA_NAO_SELECIONADA` sem sessão escolhida). A Story 5.2 só vai *chamar* esse mesmo método antes de tocar no código do ingresso — não deve reimplementar a checagem.

- **AC5 (troca de sessão) não estava no `epics.md` original — foi adicionada nesta story** depois de uma pergunta direta sobre o que acontece quando a sessão selecionada "acaba" e a portaria precisa validar ingressos de outra. Resposta: não existe conceito de turno com início/fim — `turno_portaria` guarda só o ponteiro atual, e `selecionarSessao()` reescreve a mesma linha (`save()` com PK manual faz upsert automaticamente via `merge()`, ver Task 3). Nenhum histórico de trocas é mantido — fora de escopo, nenhum FR pede isso.

- **Reaproveitamento deliberado de `listarSessoesPublicadas()`** (já existe, usada por `ListagemSessoesPage`) em vez de uma rota nova de "sessões disponíveis pra portaria". Traz junto o filtro `data_hora >= now()` de `SessaoRepository.listarPublicadas()` — ou seja, a portaria escolhe entre sessões futuras/em andamento no sentido de "ainda não passaram da lista pública", não uma janela horária mais estrita de "sessão rolando agora". Simplificação assumida conscientemente pro prazo de 7 dias; registrar em `docs/decisions.md` (Task 6).

- **`PortariaNaoEncontradaException`/`SessaoNaoEncontradaException`/`SalaNaoEncontradaException` são todas reaproveitadas ou espelhadas de padrões existentes** — `SessaoNaoEncontradaException`/`SalaNaoEncontradaException` já existem em `sessoes` e são usadas direto (mesmo padrão de `IngressoService.buscarPublico()` reusando `SessaoRepository`/`SalaRepository` da Story 4.2). `PortariaNaoEncontradaException` é nova mas espelha exatamente `OrganizadorNaoEncontradoException`/`ClienteNaoEncontradoException` (usuário do token sumiu do banco — `401 NAO_AUTENTICADO`).

### Project Structure Notes

- Novo domínio de código dentro do pacote `ingressos` já existente (a Architecture Spine reserva `ingressos/controller/PortariaController` pra este propósito, vai acumular a validação da Story 5.2 no mesmo controller).
- **Back-end (novo)**: `api/src/main/resources/db/migration/V5__turno_portaria.sql`; `api/src/main/java/br/com/rolo35/api/ingressos/TurnoPortaria.java`; `.../ingressos/repository/TurnoPortariaRepository.java`; `.../ingressos/SessaoAtivaNaoSelecionadaException.java`; `.../ingressos/PortariaNaoEncontradaException.java`; `.../ingressos/dto/SessaoAtivaDto.java`; `.../ingressos/dto/SelecionarSessaoRequest.java`; `.../ingressos/service/PortariaService.java`; `.../ingressos/controller/PortariaController.java`; testes correspondentes em `api/src/test/java/br/com/rolo35/api/ingressos/**`.
- **Back-end (update)**: `.../common/GlobalExceptionHandler.java` (handlers de `SessaoAtivaNaoSelecionadaException`, `PortariaNaoEncontradaException`).
- **Front-end (novo)**: `web/src/api/portaria.ts`; `web/src/pages/SelecaoTurnoPortariaPage.tsx` + `.test.tsx`.
- **Front-end (update)**: `web/src/App.tsx` (rota `/portaria` deixa de ser `PapelPlaceholderPage`).
- **Documentação (update)**: `docs/decisions.md`; `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Leitura obrigatória antes de codar**: `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java` (padrão de sequência de lookups sessão→sala sem N+1 real, Story 4.2); `.../ingressos/IngressoSecurityTest.java` e `.../sessoes/SessaoSecurityTest.java` (padrão de teste de papel); `.../config/SecurityConfig.java` (confirmar que nenhum matcher novo é necessário); `.../common/GlobalExceptionHandler.java`; `web/src/api/sessoes.ts` (`listarSessoesPublicadas`, reaproveitada); `web/src/pages/ListagemSessoesPage.tsx`/`MeusIngressosPage.tsx` (padrão de máquina de estado); `web/src/components/SeletorDeOpcao.tsx`; `web/src/pages/LoginPage.tsx` (`rotaPorPapel`, já aponta `PORTARIA` → `/portaria`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1: Seleção de Sessão do Turno]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md — FR-17]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-9 (separação leitura pública/validação portaria), Structural Seed (`ingressos/controller/PortariaController`), Entidades (ERD — `usuarios` sem campo papel-específico)]
- [Source: CLAUDE.md — Non-negotiable "autorização checada em toda requisição, inclusive rotas de portaria", Metodologia XP + TDD, convenção de nomenclatura (entidades em português, código em inglês)]
- [Source: _bmad-output/implementation-artifacts/4-2-meus-ingressos-e-link-publico.md — precedente direto de sequência de lookups sessão/sala sem N+1, DTO explícito sem vazamento de campo interno, padrão de `SecurityTest`]
- [Source: código existente lido por completo nesta criação de story: `auth.Usuario`/`UsuarioRepository`, `sessoes.service.SessaoService`, `sessoes.repository.SessaoRepository`, `sessoes.controller.SessaoController`, `config.SecurityConfig`, `common.GlobalExceptionHandler`, `web/src/api/client.ts`/`sessoes.ts`, `web/src/pages/ListagemSessoesPage.tsx`, `web/src/pages/PapelPlaceholderPage.tsx`, `web/src/components/SeletorDeOpcao.tsx`, `web/src/App.tsx`, `web/src/pages/LoginPage.tsx`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-agent-dev, Amelia)

### Debug Log References

Nenhum problema além do esperado no ciclo Red-Green-Refactor: RED confirmado por falha de
compilação (Tasks 2, 3, 4) antes de cada GREEN; um ajuste de `UnnecessaryStubbingException`
em `PortariaServiceTest` (stub de `turnoPortariaRepository.findById()` desnecessário, já que
`selecionarSessao()` sempre chama `save()` direto, sem checagem prévia).

### Completion Notes List

- Migration nomeada `V6__turno_portaria.sql` (não `V5` como o rascunho original da story
  sugeria) — `V5` já estava ocupado por `V5__indice_assento_sessao_reserva.sql`.
- Suíte completa verde: `mvn test` (backend) e `npx tsc --noEmit && npm run lint && npm run
  build` (frontend).
- **Correção do code review (2026-08-13):** esta nota afirmava que 3 arquivos de teste
  (`client.test.ts`, `Header.test.tsx`, `LoginPage.test.tsx`) falhavam por "problema de ambiente
  (`localStorage` indisponível)". **Era falso.** O comando do checklist estava errado: `npx vitest
  run` descarta a flag que o script do projeto carrega — `web/package.json:11` define
  `"test": "NODE_OPTIONS=--no-experimental-webstorage vitest run"`, e esse script já existia em
  `main` desde `ef98404`. Rodando `npm test`, a suíte passa integralmente. Usar **`npm test`**,
  nunca `npx vitest run`.
- Decisões registradas em `docs/decisions.md`.

### File List

- `api/src/main/resources/db/migration/V6__turno_portaria.sql`
- `api/src/main/java/br/com/rolo35/api/ingressos/TurnoPortaria.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/repository/TurnoPortariaRepository.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/SessaoAtivaNaoSelecionadaException.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/PortariaNaoEncontradaException.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/SessaoAtivaDto.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/SelecionarSessaoRequest.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/controller/PortariaController.java`
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update)
- `api/src/test/java/br/com/rolo35/api/ingressos/repository/TurnoPortariaRepositorySmokeTest.java`
- `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceTest.java`
- `api/src/test/java/br/com/rolo35/api/ingressos/controller/PortariaControllerTest.java`
- `api/src/test/java/br/com/rolo35/api/ingressos/PortariaSecurityTest.java`
- `web/src/api/portaria.ts`
- `web/src/pages/SelecaoTurnoPortariaPage.tsx`
- `web/src/pages/SelecaoTurnoPortariaPage.test.tsx`
- `web/src/App.tsx` (update)
- `docs/decisions.md` (update)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (update)

### Review Findings

Code review de 2026-08-13 (3 camadas adversariais + verificação empírica). Corrigidos nesta rodada
marcados; o restante fica como action item — escopo reduzido a pedido, só blocker e `high`.

- [x] [Review][Patch] `selecionar()` tem `finally` sem `catch` — troca de sessão falha em silêncio e o painel segue mostrando a sessão antiga, levando a portaria a validar contra o turno errado [web/src/pages/SelecaoTurnoPortariaPage.tsx:41] — corrigido, coberto por teste de rejeição
- [x] [Review][Decision] Sessão ativa some do seletor quando a sessão começa (`listarPublicadas()` filtra `data_hora >= now()`), voltando ao placeholder com turno ativo — decidido: reinjetar a sessão ativa nas opções, mantendo o reuso da listagem pública [web/src/pages/SelecaoTurnoPortariaPage.tsx:88]
- [ ] [Review][Patch] `buscarSessaoAtiva()` mapeia *qualquer* 409 pra "sem sessão", ignorando `erro.codigo` — contraria o racional documentado em `client.ts:11-14` [web/src/api/portaria.ts:28]
- [ ] [Review][Patch] `Promise.all` acopla endpoint público e autenticado: 401/403 de `buscarSessaoAtiva()` é reportado como "não foi possível carregar as sessões" [web/src/pages/SelecaoTurnoPortariaPage.tsx:22]
- [ ] [Review][Patch] `selecionarSessao()` aceita qualquer `sessaoId` (passada, não publicada) — o filtro vive só no front, contrariando o non-negotiable de não confiar no cliente como controle de acesso [api/.../service/PortariaService.java:60]
- [ ] [Review][Patch] `turno_portaria.sessao_id`: FK sem índice e sem `ON DELETE` [api/src/main/resources/db/migration/V6__turno_portaria.sql:2]
- [ ] [Review][Patch] Tabela `turno_portaria` no singular — a convenção do projeto é plural (`sessoes`, `salas`, `ingressos`) [api/src/main/resources/db/migration/V6__turno_portaria.sql:1]
- [ ] [Review][Patch] `@Transactional(readOnly = true)` em `obterSessaoAtivaOuLancar()` é inerte (self-invocation não passa pelo proxy) e o método devolve a entidade `Sessao`, não um DTO [api/.../service/PortariaService.java:73]
- [x] [Review][Patch] Completion Notes declaravam 14 testes de front falhando por "ambiente"; era o comando errado (`npx vitest run` em vez de `npm test`, que carrega `NODE_OPTIONS=--no-experimental-webstorage`). Suíte sempre esteve verde — corrigido abaixo

**Verificação empírica desta rodada:** `./mvnw test` verde; `npx tsc --noEmit` limpo; `npm run lint`
só com os 2 warnings pré-existentes; `npm test` **127/127** em 18 arquivos.
