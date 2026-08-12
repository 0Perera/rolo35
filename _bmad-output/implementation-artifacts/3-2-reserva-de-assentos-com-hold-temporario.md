---
baseline_commit: e255202
---

# Story 3.2: Reserva de Assentos com Hold Temporário

Status: ready-for-dev

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a cliente autenticado,
I want selecionar de 1 a 6 assentos livres e reservá-los,
so that eu garanto minha escolha por um tempo enquanto decido pagar, sem risco de perder pra outro cliente.

## Acceptance Criteria

1. **Given** um cliente autenticado (papel `CLIENTE`) e de 1 a 6 assentos livres na mesma sessão selecionados **When** ele confirma a seleção (`POST /api/reservas`) **Then** um hold de 10 min é criado pra todos os assentos de uma vez, de forma atômica: uma linha em `reservas` (`status=ATIVA`, `expires_at = now() + 10min`) e as N linhas de `assento_sessao` correspondentes viram `status=RESERVADO`, `reserva_id=<id da nova reserva>`, `expires_at` igual ao da reserva — tudo na mesma transação.
2. **Given** uma seleção que inclui pelo menos um assento cujo status efetivo (TTL lazy, AD-4) já não é `LIVRE` (hold ativo de outro cliente ou `VENDIDO`) **When** a reserva é submetida **Then** nenhum assento da seleção é reservado (sem hold parcial — rollback da transação inteira), retorna `409` com `{codigo: "ASSENTO_INDISPONIVEL", mensagem}`, e o cliente permanece habilitado a consultar o mapa da mesma sessão (`GET /api/sessoes/{id}/mapa-assentos`, Story 3.1) pra tentar de novo com o estado atualizado.
3. **Given** um visitante sem token, ou autenticado como `ORGANIZADOR`/`PORTARIA` **When** tenta `POST /api/reservas` **Then** a requisição é rejeitada com `403` (via `@PreAuthorize("hasRole('CLIENTE')")` + `GlobalExceptionHandler.handleAcessoNegado`, mesmo padrão já usado em `SessaoController`) — só `CLIENTE` autenticado reserva.
4. **Given** um hold criado há mais de 10 min sem confirmação de pagamento **When** o estado do assento é lido ou escrito em qualquer rota (mapa de assentos da Story 3.1, ou uma nova tentativa de reserva sobre o mesmo assento) **Then** ele é tratado como `LIVRE` (TTL calculado lazy a partir de `expires_at`, sem job agendado — AD-4); uma nova reserva pode reivindicá-lo normalmente.
5. **Given** duas requisições concorrentes tentando reservar (ao menos em parte) o mesmo assento na mesma sessão (cenário Testcontainers, duas threads/conexões reais) **When** ambas disparadas simultaneamente **Then** exatamente uma é aceita (`200`) e a outra falha de forma determinística (`409 ASSENTO_INDISPONIVEL`), garantido por `SELECT ... FOR UPDATE` nas linhas de `assento_sessao` **ordenadas por `assento_id`** (AD-3) dentro de uma única transação curta (AD-5) — não checagem isolada na aplicação antes do lock.
6. **Given** uma seleção de mais de 6 assentos, uma seleção vazia, ou uma seleção com `assentoId` duplicado **When** submetida **Then** rejeitada com `400` (`{codigo: "PARAMETRO_INVALIDO", mensagem}`, Bean Validation no `ReservarAssentosRequest`) antes de qualquer lock ser adquirido — nenhum hold é criado.

## Tasks / Subtasks

- [ ] **Task 1 — Modelo de domínio `reservas/`: `Reserva`, `StatusAssento`, `ReservaRepository` (setup, suporta AC1, AC4-5)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/reservas/ReservaRepositorySmokeTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `SalaAssentoRepositorySmokeTest`): salvar uma `Reserva` (`clienteId`, `sessaoId`, `status=StatusReserva.ATIVA`, `createdAt`, `expiresAt`), recarregar por id, assert de round-trip dos campos. Rodar e confirmar que falha por `Reserva`/`StatusReserva`/`ReservaRepository` ainda não existirem.
  - [ ] **[GREEN]** Criar pacote `api/src/main/java/br/com/rolo35/api/reservas/` (AD-1: `reservas` depende de `sessoes`/`auth`, nunca o inverso). Criar `reservas/StatusReserva.java` (`enum { ATIVA, CONFIRMADA, RECUSADA }`, mapeado com `@Enumerated(EnumType.STRING)` — os 3 valores gravados batem 1:1 com o `CHECK` de `V1__schema.sql`, "expirada" continua **não persistido**, calculado via AD-4, mesma decisão já registrada em AD-6 pra Epic 4). Criar `sessoes/StatusAssento.java` (`enum { LIVRE, RESERVADO, VENDIDO }` — fica em `sessoes/`, não em `reservas/`, porque `SessaoService`/`AssentoMapaDto` da Story 3.1 já usam esses 3 valores e `reservas` pode depender de `sessoes` pela direção de AD-1, nunca o contrário). Criar `reservas/Reserva.java` (`@Entity @Table(name = "reservas")`, `@Id @GeneratedValue(IDENTITY) Long id`, `Long clienteId`, `Long sessaoId`, `@Enumerated(EnumType.STRING) StatusReserva status`, `Instant createdAt`, `LocalDateTime expiresAt` — mesmo estilo Lombok `@Getter @NoArgsConstructor` + construtor completo já usado em `Sessao`/`Usuario`, sem builder por enquanto, campos suficientes). Criar `reservas/repository/ReservaRepository.java extends JpaRepository<Reserva, Long>`. Rodar o teste até passar.
  - [ ] Commit: `feat(reservas): pacote reservas com Reserva, StatusReserva, StatusAssento (setup)`

- [ ] **Task 2 — `AssentoSessaoRepository`: lock ordenado por `assento_id` + reivindicação atômica (AC1, AC2, AC5)**
  - [ ] **[RED]** Estender `AssentoSessaoMapaRepositoryTest.java` (ou criar `ReservaAssentoLockRepositoryTest.java` ao lado, mesmo padrão Testcontainers): popular sessão com 4 assentos livres; chamar `travarParaReserva(sessaoId, List.of(assentoId1, assentoId3))` dentro de uma transação de teste e assert que retorna as 2 linhas, na ordem de `assento_id` crescente, independente da ordem da lista de entrada. Segundo teste: chamar `reivindicar(sessaoId, assentoIds, reservaId, expiresAt)` e assert (recarregando via `findByIdSessaoId`) que as linhas viraram `status=RESERVADO`, `reservaId`/`expiresAt` setados, e que as **não** incluídas continuam `LIVRE`. Rodar e confirmar que falha.
  - [ ] **[GREEN]** Adicionar em `AssentoSessaoRepository` (pacote `sessoes.repository`, onde já vive — Story 3.1 já decidiu não mover `AssentoSessao`/`AssentoSessaoId` pra `reservas/` só por causa de leitura; esta story também não move, só adiciona escrita: mover exigiria arrastar `AssentoSessaoId`, `AssentoMapaProjection`, `buscarMapaPorSessao()` e o `@PostLoad`/`Persistable` inteiros de `sessoes/`, diff desnecessário pro que a story pede):
    ```java
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT a FROM AssentoSessao a
        WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds
        ORDER BY a.id.assentoId
        """)
    List<AssentoSessao> travarParaReserva(Long sessaoId, List<Long> assentoIds);

    @Modifying
    @Query("""
        UPDATE AssentoSessao a SET a.status = 'RESERVADO', a.reservaId = :reservaId, a.expiresAt = :expiresAt
        WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds
        """)
    void reivindicar(Long sessaoId, List<Long> assentoIds, Long reservaId, LocalDateTime expiresAt);
    ```
    **Por que `@Modifying @Query` de UPDATE em vez de `save()` da entidade recarregada:** `AssentoSessao` implementa `Persistable` com a flag `novo` controlada só por `@PostPersist`/`@PostLoad` (Story 2.1/3.1) — não tem setters. Um `save()` de uma instância construída manualmente com o mesmo `id` forçaria `isNew()=true` (a flag `novo` só vira `false` via `@PostLoad`), o que faria o Spring Data tentar um `INSERT` sobre uma PK composta já existente e violar a constraint. `@Modifying @Query` evita esse problema inteiro: escreve direto via SQL gerado pelo Hibernate a partir do JPQL, sem passar pela máquina de dirty-checking/`Persistable` da entidade. `ORDER BY a.id.assentoId` no `travarParaReserva` é o mecanismo real de AD-3 (evita deadlock entre duas reservas concorrentes que pedem os mesmos assentos em ordem diferente) — não é só estética.
  - [ ] Commit: `feat(sessoes): lock ordenado por assento_id + reivindicação atômica (AC1-2, AC5)`

- [ ] **Task 3 — `ReservaService.reservar()`: validação, lock, atomicidade (AC1, AC2, AC4, AC5, AC6)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/reservas/service/ReservaServiceTest.java` (Mockito puro, mocka `AssentoSessaoRepository`, `ReservaRepository`, `UsuarioRepository`, `EntityManager`): cobrir (a) 1-6 assentos livres → `Reserva` salva com `status=ATIVA`, `expiresAt=+10min`, `AssentoSessaoRepository.reivindicar()` chamado uma vez com todos os ids; (b) 0 ou 7+ assentos, ou lista com duplicado → `SelecaoAssentosInvalidaException`, **nenhuma** chamada a `travarParaReserva`/`reivindicar`/`save` (prova que a validação roda antes do lock, AC6); (c) `travarParaReserva` retorna menos linhas que os ids pedidos (assento não existe pra essa sessão) OU alguma linha retornada tem status efetivo (aplicar a mesma lógica de TTL lazy de `SessaoService.statusEfetivo`, AD-4) diferente de `LIVRE` → `AssentoIndisponivelException`, e `reivindicar`/`save` **nunca** chamados (prova de rollback/sem hold parcial, AC2); (d) usuário do token não encontrado → exceção já existente reaproveitada (`OrganizadorNaoEncontradoException` é nome específico de organizador — criar `ClienteNaoEncontradoException` análoga, mesmo padrão). Rodar e confirmar que falha por `ReservaService`/exceções ainda não existirem.
  - [ ] **[GREEN]** Criar `reservas/dto/ReservarAssentosRequest.java` (record: `Long sessaoId`, `List<Long> assentoIds` — `@NotNull`, `@Size(min=1, max=6)` em `assentoIds`, validado por Bean Validation como o resto dos DTOs do projeto, AD-7-like consistência). Criar `reservas/dto/ReservaDto.java` (record: `id, sessaoId, status, expiresAt, assentoIds` — o suficiente pra tela saber o que foi reservado e até quando, sem vazar `clienteId` de volta desnecessariamente pro próprio dono — ele já sabe quem é). Criar `reservas/SelecaoAssentosInvalidaException.java`, `reservas/AssentoIndisponivelException.java`, `reservas/ClienteNaoEncontradoException.java` (mesmo padrão de `RuntimeException` simples das exceções de `sessoes/`, sem construtor de mensagem — mensagem fixa no `GlobalExceptionHandler`). Criar `reservas/service/ReservaService.java`:
    ```java
    @Transactional
    public ReservaDto reservar(ReservarAssentosRequest request, String clienteEmail) {
        List<Long> assentoIds = request.assentoIds();
        if (assentoIds.isEmpty() || assentoIds.size() > 6 || assentoIds.size() != Set.copyOf(assentoIds).size()) {
            throw new SelecaoAssentosInvalidaException();
        }
        Usuario cliente = usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        List<AssentoSessao> travados = assentoSessaoRepository.travarParaReserva(request.sessaoId(), assentoIds);

        LocalDateTime agora = LocalDateTime.now();
        boolean algumIndisponivel = travados.size() != assentoIds.size()
                || travados.stream().anyMatch(a -> !statusEfetivoLivre(a, agora));
        if (algumIndisponivel) {
            throw new AssentoIndisponivelException();
        }

        LocalDateTime expiraEm = agora.plusMinutes(10);
        Reserva reserva = reservaRepository.save(
                new Reserva(null, cliente.getId(), request.sessaoId(), StatusReserva.ATIVA, Instant.now(), expiraEm));
        assentoSessaoRepository.reivindicar(request.sessaoId(), assentoIds, reserva.getId(), expiraEm);

        return new ReservaDto(reserva.getId(), request.sessaoId(), reserva.getStatus(), expiraEm, assentoIds);
    }
    ```
    Reaproveitar a mesma lógica de TTL lazy da Story 3.1 (`SessaoService.statusEfetivo`) — extrair como método privado equivalente `statusEfetivoLivre` aqui em vez de importar de `SessaoService` (evita acoplar `reservas` a um método privado de `sessoes`; a regra é simples o bastante — `StatusAssento.RESERVADO == status && expiresAt != null && expiresAt.isBefore(agora)` conta como livre — pra duplicar sem drama; se a duplicação incomodar num code review futuro, promover pra um helper estático em `sessoes.StatusAssento` é o refactor natural). Rodar o teste até passar.
  - [ ] Commit: `feat(reservas): ReservaService.reservar() com lock e atomicidade (AC1-2, AC4-6)`

- [ ] **Task 4 — `POST /api/reservas` restrito a `CLIENTE` (AC1-3)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/reservas/controller/ReservaControllerTest.java` (`@WebMvcTest`, service mockado, mesmo padrão de `SessaoControllerTest`): `POST /api/reservas` com corpo válido e token `CLIENTE` → `200` + shape de `ReservaDto`; corpo com `assentoIds` vazio/>6 → `400 PARAMETRO_INVALIDO` (valida o `@Valid` do request, sem precisar do service real); service lança `AssentoIndisponivelException` → `409 ASSENTO_INDISPONIVEL`; service lança `SelecaoAssentosInvalidaException` → `400`. Criar/estender `ReservaSecurityTest.java` (mesmo padrão de `SessaoSecurityTest`): sem token → `403`; token `ORGANIZADOR` → `403`; token `PORTARIA` → `403`; token `CLIENTE` → passa pro service mockado. Rodar e confirmar que falha.
  - [ ] **[GREEN]** Criar `reservas/controller/ReservaController.java`:
    ```java
    @RestController
    @RequestMapping("/api/reservas")
    public class ReservaController {
        @PostMapping
        @PreAuthorize("hasRole('CLIENTE')")
        public ResponseEntity<ReservaDto> reservar(@Valid @RequestBody ReservarAssentosRequest request, Authentication authentication) {
            return ResponseEntity.ok(reservaService.reservar(request, authentication.getName()));
        }
    }
    ```
    Mesmo padrão de `SessaoController.criar()` (`Authentication.getName()` = e-mail do token). **Sem mudança em `SecurityConfig`**: a rota não está em nenhum `permitAll()`, cai no `.anyRequest().authenticated()` já existente — `@PreAuthorize` sozinho já nega `ORGANIZADOR`/`PORTARIA` (AC3), consistente com o comentário já presente em `SecurityConfig` ("papel é decidido por `@PreAuthorize`... sem anotação, ela simplesmente não passa"). Adicionar em `GlobalExceptionHandler`: `handleSelecaoAssentosInvalida` → `400 PARAMETRO_INVALIDO`; `handleAssentoIndisponivel` → `409 ASSENTO_INDISPONIVEL`; `handleClienteNaoEncontrado` → `401 NAO_AUTENTICADO` (mesmo padrão de `handleOrganizadorNaoEncontrado`). Rodar os testes até passar.
  - [ ] Commit: `feat(reservas): POST /api/reservas restrito a CLIENTE (AC1-3)`

- [ ] **Task 5 — Regressão obrigatória: `SessaoService.editar()` preserva hold ativo (dívida registrada no code review da Story 2.2)**
  - [ ] **[RED]** Estender `SessaoServiceTest.java`: cenário onde `editar()` troca `salaId` de uma sessão que tem pelo menos um `assento_sessao` com `status=RESERVADO` e `expiresAt` no futuro (hold ativo de verdade, não vencido) → deve lançar uma exceção nova (`HoldAtivoException` ou similar) **antes** de apagar `assento_sessao`, sem chamar `deleteAll`/`saveAll`. Cenário de controle: hold já vencido (`expiresAt` no passado) não bloqueia a edição (mesma lógica de TTL lazy, AD-4 — hold vencido não é hold ativo). Rodar e confirmar que falha (hoje `editar()` só checa `existeIngressoConfirmado`, então o teste do hold ativo passa incorretamente/apaga o hold).
  - [ ] **[GREEN]** Em `sessoes/service/SessaoService.editar()`, ao trocar de sala, antes do `deleteAll`, checar se existe algum `assento_sessao` da sessão com status efetivo `RESERVADO` (reaproveitar a mesma lógica de TTL lazy já usada em `mapaAssentos()`/`statusEfetivo`) — se existir, lançar exceção nova mapeada em `GlobalExceptionHandler` pra `409` (código `SESSAO_COM_HOLD_ATIVO`, mensagem própria, distinta de `SESSAO_COM_INGRESSO_CONFIRMADO`). **Por que isto é parte desta story e não um item solto:** `deferred-work.md` (review da Story 2.2) marcou isto como **"Ação obrigatória pra Epic 3"** — antes de 3.2, a checagem era inalcançável porque nenhum hold real existia; agora que `ReservaService.reservar()` cria holds de verdade (Task 3), o gap vira alcançável de fato: um cliente em checkout perderia o assento silenciosamente se um organizador trocasse a sala da sessão no meio da janela de 10 min, deixando a `reserva` órfã (apontando pra `assento_sessao` que não existe mais pra aquela sala). Rodar o teste até passar.
  - [ ] Commit: `fix(sessoes): editar() rejeita troca de sala com hold ativo (dívida da Story 2.2)`

- [ ] **Task 6 — Teste de concorrência real via Testcontainers (AC5)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/reservas/ReservaConcorrenciaConflitoTest.java` (`@SpringBootTest` + Testcontainers, mesmo padrão de `SessaoConcorrenciaConflitoTest` da Story 2.1 — ler esse arquivo primeiro, é o precedente direto): popular uma sessão com >=2 assentos livres; disparar duas chamadas reais a `reservaService.reservar()` **em threads separadas** (ou via `ExecutorService` com 2 conexões de banco reais, não mocks) pedindo pelo menos um assento em comum entre as duas seleções; assert que exatamente uma retorna `ReservaDto` com sucesso e a outra lança `AssentoIndisponivelException`; assert no banco que só uma `Reserva` ficou `ATIVA` e o(s) assento(s) disputado(s) aponta(m) pra ela. Rodar e confirmar que passa só depois do lock da Task 2-3 estar implementado (este teste é a prova final de AC5, não deveria exigir código novo se as tasks anteriores fizeram o lock certo — mas roda **depois** delas de propósito, como smoke de concorrência real, TDD "outside-in" pro cenário que só o banco de verdade prova).
  - [ ] Commit: `test(reservas): concorrência real prova exatamente uma reserva vence (AC5)`

- [ ] **Task 7 — Tela de seleção de assentos (AC1-6) — BLOQUEADA até a Story 3.1 Task 4 estar no working tree**
  - [ ] **⚠️ Pré-requisito não satisfeito no momento da criação desta story:** `web/src/pages/MapaAssentosPage.tsx` **ainda não existe** no working tree — é a Task 4 da Story 3.1, que está guardada em `git stash` (`story-3.1-task4-visual-pendente-rebase-retrofit`), não commitada. Não iniciar esta task antes do stash ser recuperado (`git stash pop`) e a Story 3.1 Task 4 estar de fato no código. Tasks 1-6 desta story (backend) não têm essa dependência e podem prosseguir livremente.
  - [ ] Estender `web/src/api/reservas.ts` (novo arquivo, um módulo por domínio — AD-2, mesmo padrão de `sessoes.ts`): `interface ReservarAssentosRequest { sessaoId: number; assentoIds: number[] }`, `interface Reserva { id: number; sessaoId: number; status: 'ATIVA' | 'CONFIRMADA' | 'RECUSADA'; expiresAt: string; assentoIds: number[] }`, `reservarAssentos(request): Promise<Reserva>` (`POST /api/reservas` — precisa de `Authorization`, ao contrário de `buscarMapaAssentos`; `apiFetch` já anexa o header automaticamente quando há token no `localStorage`, sem mudança em `client.ts`).
  - [ ] Em `MapaAssentosPage.tsx` (arquivo que volta do stash): tornar os assentos `LIVRE` clicáveis (o comentário da Story 3.1 já deixou isso reservado: "seleção/reserva é escopo da Story 3.2"), com estado local de seleção (`Set<number>`, máx. 6 — desabilitar clique em novo assento quando já há 6 selecionados, feedback visual do limite). Botão "Reservar" habilitado só com 1-6 selecionados, chama `reservarAssentos`; sucesso navega pra próxima etapa (pagamento — fora do escopo da 3.2, Epic 4; por ora, navegar de volta ao mapa com uma mensagem de sucesso simples ou pra uma rota de placeholder já existente, não inventar tela de pagamento aqui). Erro `409 ASSENTO_INDISPONIVEL`: mostrar mensagem clara, recarregar o mapa (`buscarMapaAssentos`) pra refletir o estado atual (AC2 exige o cliente permanecer no mapa da mesma sessão, não redirecionar pra escolha de sessão) e limpar a seleção de qualquer assento que não esteja mais livre. Não exige token visível na UI — se `apiFetch` devolver `401`/`403` (usuário não logado ou papel errado tentando via URL direta), mostrar mensagem de "faça login como cliente" — sem guarda de rota nova (dívida pré-existente desde Story 2.1, fora de escopo).
  - [ ] Depois do componente pronto: estender `MapaAssentosPage.test.tsx` — cobrir seleção/deseleção, limite de 6, submissão de sucesso, e o caminho de erro 409 recarregando o mapa (contrato de comportamento, não pixel/CSS — mesmo critério da Story 3.1).
  - [ ] Commit: `feat(reservas): seleção e reserva de assentos na tela do mapa (AC1-6)`

- [ ] **Task 8 — Confirmação final (sem código novo, checklist de saída)**
  - [ ] Rodar a suíte completa (back-end `mvn test`, incluindo os testes Testcontainers das Tasks 1, 2 e 6; front-end `npm test`, `npm run build`, `npm run lint`) e confirmar tudo verde. **Se a Task 7 ainda estiver bloqueada** (Story 3.1 Task 4 não chegou), rodar a suíte só do que foi implementado (backend completo) e deixar essa confirmação registrada nos Dev Agent Record — não simular passar um teste de front que não existe.
  - [ ] Registrar em `docs/decisions.md`: (a) por que `travarParaReserva`/`reivindicar` usam `@Modifying @Query` em vez de `save()` de entidade recarregada (gotcha do `Persistable`/`novo` herdado da Story 2.1/3.1); (b) por que `StatusAssento` fica em `sessoes/` e não em `reservas/` mesmo sendo usado por `ReservaService` (direção de dependência AD-1); (c) por que a correção de `SessaoService.editar()` (Task 5) entrou nesta story em vez de ficar só registrada em `deferred-work.md` — porque só agora (com hold real existindo) o cenário se torna alcançável, conforme a nota já deixada no review da Story 2.2.
  - [ ] Atualizar o Status desta story pra `review` (mesmo ciclo já usado nas Stories 1.1/1.2/2.1/2.3/3.1: code-review antes de `done`).
  - [ ] Commit: `docs(reservas): confirmação final e fecha Story 3.2 pra review`

## Dev Notes

- **Dependência viva com a Story 3.1, ainda `in-progress`.** Esta story foi criada com a 3.1 não fechada (Tasks 1-3 commitadas, Task 4 stashada, Task 5 pendente). O backend desta story (Tasks 1-6) não tem overlap de arquivo com o que falta da 3.1 — mas a Task 7 (front-end) depende literalmente do arquivo `MapaAssentosPage.tsx`, que só existe depois do `git stash pop` da 3.1. Não montar a Task 7 achando que o arquivo já está lá; conferir `ls web/src/pages/MapaAssentosPage.tsx` antes de começar.

- **`AssentoSessao` continua em `sessoes/`, não migra pra `reservas/` nesta story.** O Structural Seed da arquitetura (`ARCHITECTURE-SPINE.md`) desenha `reservas/{Reserva.java, AssentoSessao.java}` como aspiracional, mas mover `AssentoSessao`/`AssentoSessaoId`/`AssentoMapaProjection`/`AssentoSessaoRepository` inteiros pra `reservas/` só pra bater com o diagrama arrastaria toda a Story 3.1 (leitura) sem necessidade funcional — a direção de dependência de AD-1 (`reservas → sessoes`) já permite `reservas/service/ReservaService.java` importar `sessoes.repository.AssentoSessaoRepository` sem violar nada. Revisitar essa organização só se um code review futuro achar que o pacote `sessoes/` está sobrecarregado.

- **Gotcha central desta story: `AssentoSessao` não tem setters.** É uma entidade `Persistable` (Story 2.1) com a flag `novo` controlada só por `@PostPersist`/`@PostLoad`. Reconstruir a entidade manualmente com o mesmo `id` e chamar `save()` forçaria `isNew()=true` (insert sobre PK já existente → erro). A solução adotada (Task 2) é `@Modifying @Query` de `UPDATE` em JPQL — não tenta mutar a entidade em memória, escreve direto. Não "consertar" isso adicionando setters ao `AssentoSessao` sem necessidade — mudaria o comportamento de `isNew()` usado pela Story 2.1/3.1 pra outro fim; o `@Modifying @Query` resolve o caso desta story sem tocar a entidade.

- **TTL lazy (AD-4) se aplica tanto na leitura (Story 3.1, já feito) quanto na escrita (esta story).** O `SELECT ... FOR UPDATE` de `travarParaReserva` traz o valor bruto da coluna `status` — cabe ao `ReservaService` (não ao repository) decidir se cada linha travada está efetivamente livre, aplicando a mesma regra da Story 3.1 (`RESERVADO` com `expiresAt` vencido conta como livre). É por isso que o AC4 desta story não pede nenhum código de "expiração" separado: o mesmo cálculo de status efetivo, agora também consultado dentro do lock, é o mecanismo — uma reserva vencida nunca bloqueia uma nova tentativa, mesmo que a linha no banco ainda diga `RESERVADO`.

- **Atomicidade multi-assento é rollback de transação, não lógica condicional.** `ReservaService.reservar()` lança exceção assim que detecta qualquer assento indisponível **antes** de chamar `reivindicar()` — como o método é `@Transactional`, qualquer exceção não capturada dispara rollback automático do Spring; mesmo que `reivindicar()` já tivesse sido chamado parcialmente (não é o caso aqui, é tudo-ou-nada por construção), o rollback desfaria. Não escrever lógica de "desfazer manualmente os assentos já reivindicados" — não existe esse caminho no desenho atual, e adicionar um seria trabalho morto.

- **`SET LOCAL lock_timeout = '3s'` copiado do padrão de `SessaoService.criar()`/`editar()` (AD-5).** Mesma transação, mesmo motivo: pool de conexão pequeno do Render free não pode ficar preso atrás de um lock esquecido. Não inventar um valor de timeout diferente sem motivo — `3s` já é o padrão estabelecido nas Stories 2.1/2.2.

- **Ordem de lock: só assentos, nesta story — sem lock de `sessoes`/`salas`.** Diferente de `SessaoService.criar()`/`editar()` (que travam `Sala`/`Sessao` primeiro), `ReservaService.reservar()` só trava linhas de `assento_sessao`. Não existe cenário de deadlock entre `ReservaService` e `SessaoService` hoje porque não compartilham lock na mesma ordem/tabela dentro da mesma transação — mas a Task 5 desta story (checagem de hold ativo em `editar()`) faz `SessaoService.editar()` **ler** (não travar) `assento_sessao` antes do `deleteAll`; leitura simples não participa de deadlock de lock pessimista, só a escrita (`deleteAll`/`saveAll`) já protegida pelo lock de `Sala`/`Sessao` que `editar()` já segura primeiro.

- **`ReservaDto` não inclui `clienteId` no corpo de resposta.** O próprio cliente autenticado já sabe quem é (é o dono do token); devolver o id de volta não agrega nada e amplia a superfície de dado exposta sem necessidade (mesmo espírito de AD-12/CLAUDE.md: DTO explícito, só os campos que a tela realmente usa).

- **Erro `ASSENTO_INDISPONIVEL` já estava na lista não-exaustiva de códigos de AD-11** — não é código novo inventado por esta story, é o código que a arquitetura já previa pra este exato caso.

### Project Structure Notes

- Primeira story a criar o pacote `reservas/` de fato (AD-1) — `sessoes/` continua intocado na sua responsabilidade de leitura (Story 3.1), `reservas/` nasce só com o caminho de escrita, como a Dev Note da Story 3.1 já anunciava.
- **Back-end (novo)**: `api/src/main/java/br/com/rolo35/api/reservas/StatusReserva.java`; `.../reservas/Reserva.java`; `.../reservas/repository/ReservaRepository.java`; `.../sessoes/StatusAssento.java`; `.../reservas/dto/ReservarAssentosRequest.java`; `.../reservas/dto/ReservaDto.java`; `.../reservas/SelecaoAssentosInvalidaException.java`; `.../reservas/AssentoIndisponivelException.java`; `.../reservas/ClienteNaoEncontradoException.java`; `.../reservas/HoldAtivoException.java` (nome exato a definir na Task 5, mapeado pra `SESSAO_COM_HOLD_ATIVO`); `.../reservas/service/ReservaService.java`; `.../reservas/controller/ReservaController.java`; testes correspondentes em `api/src/test/java/br/com/rolo35/api/reservas/**`.
- **Back-end (update)**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (novos métodos `travarParaReserva()`, `reivindicar()`); `.../sessoes/service/SessaoService.java` (checagem de hold ativo em `editar()`, Task 5; possível troca das constantes `STATUS_LIVRE`/`STATUS_RESERVADO` pro novo `StatusAssento` se o dev decidir aplicar a migração de enum também aqui — não obrigatório pra fechar as ACs desta story, mas é o gatilho natural apontado no `deferred-work.md`); `.../common/GlobalExceptionHandler.java` (novos handlers); `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoServiceTest.java` (Task 5).
- **Front-end (novo)**: `web/src/api/reservas.ts`; extensão de `MapaAssentosPage.test.tsx` (arquivo já existe a partir da Story 3.1 Task 4, quando recuperada do stash).
- **Front-end (update, condicional à Task 7 estar desbloqueada)**: `web/src/pages/MapaAssentosPage.tsx`.
- **Documentação (update)**: `docs/decisions.md`.
- **Leitura obrigatória antes de codar** (arquivos UPDATE, não criar do zero — todos já lidos por completo durante a criação desta story): `api/src/main/java/br/com/rolo35/api/sessoes/AssentoSessao.java`, `.../sessoes/AssentoSessaoId.java`, `.../sessoes/repository/AssentoSessaoRepository.java`, `.../sessoes/repository/SalaRepository.java` (padrão exato de `@Lock(PESSIMISTIC_WRITE)`), `.../sessoes/service/SessaoService.java` (padrão `SET LOCAL lock_timeout`, `editar()` inteiro, `statusEfetivo()`), `.../auth/Usuario.java`, `.../common/GlobalExceptionHandler.java`, `.../common/ApiError.java`, `.../config/SecurityConfig.java`, `.../sessoes/controller/SessaoController.java` (padrão `@PreAuthorize` + `Authentication`), `api/src/test/java/br/com/rolo35/api/sessoes/service/SessaoConcorrenciaConflitoTest.java` (precedente direto do teste de concorrência da Task 6), `web/src/api/client.ts`, `web/src/api/sessoes.ts`, `_bmad-output/implementation-artifacts/3-1-mapa-de-assentos-publico.md` (story anterior completa), `_bmad-output/implementation-artifacts/deferred-work.md` (itens marcados "obrigação da Epic 3").

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Reserva de Assentos com Hold Temporário]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#§4.4 Busca e Reserva de Assento — FR-9, FR-10, FR-11]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-1 (pacotes por domínio e direção de dependência), AD-3 (lock ordenado por assento_id), AD-4 (TTL lazy), AD-5 (transação de lock curta), AD-11 (envelope de erro, código ASSENTO_INDISPONIVEL já previsto), AD-13 (nomenclatura), Structural Seed (pacote reservas/), Capability → Architecture Map §4.4]
- [Source: CLAUDE.md — Metodologia XP + TDD, Non-negotiables de Segurança (não vender assento duas vezes via constraint/lock, não só checagem de aplicação) e Modelagem, Convenções de nomenclatura]
- [Source: _bmad-output/implementation-artifacts/3-1-mapa-de-assentos-publico.md — DTO de mapa, statusEfetivo()/TTL lazy, decisão de manter AssentoSessao em sessoes/, padrão de story]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 2-1... ("LIVRE" como string literal — introduzir enum na Epic 3); #Deferred from: code review of 2-2... ("Ação obrigatória pra Epic 3" — editar() checar hold ativo)]
- [Source: api/src/main/resources/db/migration/V1__schema.sql — schema de `reservas` (status/expires_at) e `assento_sessao` (status/reserva_id/expires_at)]
- [Source: código existente lido por completo nesta criação de story: `sessoes.{AssentoSessao,AssentoSessaoId}`, `sessoes.repository.{AssentoSessaoRepository,SalaRepository,SessaoRepository}`, `sessoes.service.SessaoService`, `sessoes.controller.SessaoController`, `auth.Usuario`, `common.{GlobalExceptionHandler,ApiError}`, `config.SecurityConfig`, `web/src/api/{client.ts,sessoes.ts}`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
