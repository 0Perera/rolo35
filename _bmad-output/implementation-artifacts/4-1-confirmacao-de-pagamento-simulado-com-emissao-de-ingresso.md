---
baseline_commit: e255202
---

# Story 4.1: Confirmação de Pagamento Simulado com Emissão de Ingresso

Status: ready-for-dev

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a cliente autenticado,
I want confirmar o pagamento (simulado) da minha reserva ativa,
so that eu recebo meu(s) ingresso(s) com QR assinado se aprovado, ou tenho os assentos liberados imediatamente se recusado.

## Acceptance Criteria

1. **Given** uma reserva `ATIVA` e própria do cliente (hold não expirado — `expiresAt` no futuro no momento em que o lock é adquirido) **When** ele confirma o pagamento (`POST /api/pagamentos/confirmar`) com `{"reservaId": <id>, "resultadoSimulado": "APROVADO"}` **Then** a reserva muda pra `CONFIRMADA`, um `Ingresso` é emitido pra cada assento reservado (N assentos → N linhas independentes em `ingressos`, PK `UUID` própria), cada um com código `uuid + "." + base64url(HMAC-SHA256(secret, uuid))` computado on-the-fly (sem coluna própria de código, AD-8), e `assento_sessao.status` das linhas dessa reserva vira `VENDIDO`.
2. **Given** a mesma reserva `ATIVA` **When** confirmada com `{"resultadoSimulado": "RECUSADO"}` **Then** a reserva muda pra `RECUSADA`, nenhum `Ingresso` é criado, e `assento_sessao.status` das linhas dessa reserva volta a `LIVRE` **imediatamente** (limpa `reserva_id`/`expires_at` das linhas — não espera o TTL lazy de AD-4, esse caminho é escrita imediata).
3. **Given** uma reserva que existe mas pertence a outro cliente **When** o cliente autenticado tenta confirmar o pagamento dela **Then** rejeitada com `403 {codigo: "NAO_AUTORIZADO"}` — a mesma resposta (corpo e status) de uma reserva inexistente (`404` **não** é usado aqui, ao contrário do padrão de posse de sessão do organizador — ver Dev Notes), pra não revelar se o `reservaId` existe ou de quem é.
4. **Given** uma reserva `ATIVA` cujo `expiresAt` já passou (hold vencido) no momento em que o lock é adquirido **When** a confirmação é tentada **Then** rejeitada com `409 {codigo: "RESERVA_EXPIRADA"}`, sem transicionar a reserva pra `CONFIRMADA` nem `RECUSADA` — permanece como estava (o lazy check de AD-4 já cobre a leitura subsequente; esta AC é sobre a escrita não acontecer).
5. **Given** duas confirmações concorrentes da mesma reserva — inclusive com `resultadoSimulado` conflitante entre as duas chamadas (cenário Testcontainers, duas threads/conexões reais) **When** disparadas ao mesmo tempo **Then** o resultado é determinístico: a que adquire o lock primeiro decide o desfecho real (transiciona `reserva`/`assento_sessao`), a segunda, ao adquirir o lock, encontra `reserva.status` já não-`ATIVA` e **não reprocessa** seu próprio `resultadoSimulado` — devolve o estado já persistido. As duas chamadas recebem `200` com `{status, ingressos}` refletindo o mesmo estado final; nenhum ingresso duplicado é gerado; nunca existe um estado em que ingresso foi emitido **e** o assento foi liberado pra mesma reserva.
6. **Given** um código de ingresso recém-emitido **When** a assinatura é recomputada a partir do `TICKET_HMAC_SECRET` e comparada (tempo constante) ao hash embutido no código **Then** a verificação bate; **Given** o mesmo código com o hash adulterado (payload alterado, ou hash de outro ingresso colado) **When** validado **Then** é rejeitado como inválido **antes** de qualquer consulta ao banco — verificação de assinatura é puramente computacional, não depende de round-trip.

## Tasks / Subtasks

- [x] **Task 1 — `CodigoIngressoService`: gera e valida assinatura HMAC-SHA256, sem banco (AC1, AC6)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/service/CodigoIngressoServiceTest.java` (JUnit puro, sem `@SpringBootTest` — a classe não depende de banco nem de Spring context, só do secret): construir o service com um secret fixo de teste; `gerar(uuid)` retorna string no formato `<uuid>.<base64url>`; `validar(uuidExtraido, codigo)` retorna `true` pro código recém-gerado; adulterar 1 caractere do trecho base64 → `validar` retorna `false`; gerar um segundo código com outro `uuid` e colar sua assinatura no primeiro `uuid` → `validar` retorna `false` (prova que a assinatura é vinculada ao `uuid` específico, não só "uma assinatura válida qualquer"). Rodar e confirmar que falha por `CodigoIngressoService` ainda não existir.
  - [x] **[GREEN]** Criar `ingressos/service/CodigoIngressoService.java`:
    ```java
    @Service
    public class CodigoIngressoService {
        private final SecretKey signingKey;

        public CodigoIngressoService(@Value("${ticket.hmac.secret}") String secret) {
            this.signingKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        }

        public String gerar(UUID id) {
            return id + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(assinar(id));
        }

        public boolean validar(UUID id, String codigo) {
            String[] partes = codigo.split("\\.", 2);
            if (partes.length != 2 || !partes[0].equals(id.toString())) {
                return false;
            }
            byte[] esperado = assinar(id);
            byte[] recebido;
            try {
                recebido = Base64.getUrlDecoder().decode(partes[1]);
            } catch (IllegalArgumentException e) {
                return false;
            }
            return MessageDigest.isEqual(esperado, recebido); // comparação em tempo constante
        }

        private byte[] assinar(UUID id) {
            try {
                Mac mac = Mac.getInstance("HmacSHA256");
                mac.init(signingKey);
                return mac.doFinal(id.toString().getBytes(StandardCharsets.UTF_8));
            } catch (NoSuchAlgorithmException | InvalidKeyException e) {
                throw new IllegalStateException(e);
            }
        }
    }
    ```
    `MessageDigest.isEqual` (não `Arrays.equals`/`.equals()` de String) é o que garante tempo constante — comparação byte-a-byte sem short-circuit no primeiro byte diferente, evita timing attack na validação da assinatura (mesmo raciocínio de qualquer comparação de segredo/hash). Adicionar `ticket.hmac.secret=${TICKET_HMAC_SECRET}` em `application.properties` (seção nova `### Ticket HMAC ###`, mesmo padrão de `security.jwt.secret=${JWT_SECRET}` — sem fallback, obrigatório) e `TICKET_HMAC_SECRET=troque-por-um-segredo-aleatorio-de-verdade-so-pra-dev-local` em `.env.example`, com comentário explícito que é **distinto** do `JWT_SECRET` (non-negotiable da arquitetura, AD-8) — nunca derivar um do outro nem reaproveitar. Rodar o teste até passar.
  - [x] Commit: `feat(ingressos): CodigoIngressoService com HMAC-SHA256 e comparação em tempo constante (AC1, AC6)`

- [x] **Task 2 — `Ingresso` entity + `IngressoRepository` (setup, suporta AC1)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/IngressoRepositorySmokeTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo padrão de `ReservaRepositorySmokeTest` da Story 3.2): salvar um `Ingresso` (`id` gerado como `UUID`, `reservaId`, `assentoId`, `sessaoId`, `status=StatusIngresso.VALIDO`, `createdAt`), recarregar por id, assert de round-trip. Rodar e confirmar que falha.
  - [x] **[GREEN]** Criar `ingressos/StatusIngresso.java` (`enum { VALIDO, UTILIZADO }`, `@Enumerated(EnumType.STRING)` — bate com o `CHECK` de `V1__schema.sql`). Criar `ingressos/Ingresso.java` (`@Entity @Table(name = "ingressos")`, `@Id @GeneratedValue(strategy = GenerationType.UUID) UUID id` — Hibernate 6/Spring Boot 4 gera `UUID` nativamente via `GenerationType.UUID`, sem precisar de `@GenericGenerator` legado; `Long reservaId`, `Long assentoId`, `Long sessaoId`, `StatusIngresso status`, `LocalDateTime validatedAt` nullable, `Instant createdAt`). Criar `ingressos/repository/IngressoRepository.java extends JpaRepository<Ingresso, UUID>` com `List<Ingresso> findByReservaId(Long reservaId)` (usado no Task 3 pra montar a resposta idempotente). Rodar o teste até passar.
  - [x] Commit: `feat(ingressos): entidade Ingresso e IngressoRepository (setup, AC1)`

- [x] **Task 3 — `PagamentoService.confirmar()`: lock pessimista + write path idempotente (AC1-5)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/pagamentos/service/PagamentoServiceTest.java` (Mockito puro, mocka `ReservaRepository`, `AssentoSessaoRepository` (de `sessoes.repository`, reaproveitado da Story 3.2), `IngressoRepository`, `CodigoIngressoService`, `EntityManager`): cobrir (a) reserva `ATIVA` não vencida + `APROVADO` → `reserva.status=CONFIRMADA` salvo, N `Ingresso` salvos (um por assento da reserva — a lista de `assentoId`s vem das linhas de `assento_sessao` com aquele `reservaId`, não de um campo novo em `Reserva`), `assentoSessaoRepository` chamado pra marcar `VENDIDO`, resposta com `status=CONFIRMADA` e `ingressos` não-vazio; (b) mesma reserva + `RECUSADO` → `reserva.status=RECUSADA`, nenhum `Ingresso` salvo, `assentoSessaoRepository` chamado pra voltar `LIVRE` limpando `reservaId`/`expiresAt`; (c) reserva de outro `clienteId` → `NaoAutorizadoException` (nome distinto de `SessaoNaoPertenceAoOrganizadorException` — este domínio é `reservas`/`pagamentos`, não `sessoes`), sem tocar `save`; (d) reserva inexistente → mesma `NaoAutorizadoException` (não uma `NaoEncontrada` — AC3 exige não revelar a diferença); (e) reserva `ATIVA` mas `expiresAt` vencido → `ReservaExpiradaException`, sem `save`; (f) reserva já `CONFIRMADA`/`RECUSADA` (não-`ATIVA`) → **não** lança exceção, devolve a resposta já persistida (busca os `Ingresso`s existentes via `findByReservaId` se `CONFIRMADA`, lista vazia se `RECUSADA`) sem chamar `save` de novo em nada — este é o caminho que a Task 4 (concorrência) prova de ponta a ponta. Rodar e confirmar que falha.
  - [x] **[GREEN]** Criar `pagamentos/dto/ConfirmarPagamentoRequest.java` (record: `@NotNull Long reservaId`, `@NotNull ResultadoSimulado resultadoSimulado` — enum `{ APROVADO, RECUSADO }` no próprio DTO ou em `pagamentos/ResultadoSimulado.java`, AD-7). Criar `pagamentos/dto/PagamentoDto.java` (record: `status: StatusReserva`, `ingressos: List<IngressoDto>` — `IngressoDto` record `id, assentoId, codigo` reaproveitável pela Story 4.2 "Meus Ingressos"). Criar `pagamentos/NaoAutorizadoException.java`, `pagamentos/ReservaExpiradaException.java`. Criar `pagamentos/service/PagamentoService.java`:
    ```java
    @Transactional
    public PagamentoDto confirmar(ConfirmarPagamentoRequest request, String clienteEmail) {
        Usuario cliente = usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Reserva reserva = reservaRepository.findByIdForUpdate(request.reservaId())
                .filter(r -> r.getClienteId().equals(cliente.getId()))
                .orElseThrow(NaoAutorizadoException::new); // reserva de outro cliente cai aqui também — 403 idêntico

        if (reserva.getStatus() != StatusReserva.ATIVA) {
            // Idempotência: já decidido por uma chamada anterior (ou concorrente que venceu o
            // lock primeiro). Não reprocessa resultadoSimulado — devolve o que já é verdade.
            return montarResposta(reserva);
        }
        if (reserva.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ReservaExpiradaException();
        }

        List<Long> assentoIds = assentoSessaoRepository.findByIdSessaoId(reserva.getSessaoId()).stream()
                .filter(a -> reserva.getId().equals(a.getReservaId()))
                .map(a -> a.getId().getAssentoId())
                .toList();

        if (request.resultadoSimulado() == ResultadoSimulado.APROVADO) {
            reserva.confirmar(); // transiciona status em memória — ver Dev Notes sobre mutabilidade
            reservaRepository.save(reserva);
            List<Ingresso> ingressos = assentoIds.stream()
                    .map(assentoId -> ingressoRepository.save(new Ingresso(
                            null, reserva.getId(), assentoId, reserva.getSessaoId(), StatusIngresso.VALIDO, null, Instant.now())))
                    .toList();
            assentoSessaoRepository.reivindicarVendido(reserva.getSessaoId(), assentoIds);
            return new PagamentoDto(StatusReserva.CONFIRMADA, paraDto(ingressos));
        }

        reserva.recusar();
        reservaRepository.save(reserva);
        assentoSessaoRepository.liberar(reserva.getSessaoId(), assentoIds);
        return new PagamentoDto(StatusReserva.RECUSADA, List.of());
    }
    ```
    **`reserva.confirmar()`/`.recusar()` exigem que `Reserva` (Story 3.2) ganhe esses métodos de transição** — ou, se a 3.2 já tiver sido implementada só com `@Getter`/construtor completo (sem setters, mesmo padrão de `AssentoSessao`), usar `reservaRepository.save(reserva.toBuilder().status(StatusReserva.CONFIRMADA).build())` **se** `Reserva` tiver `@Builder`/`toBuilder` (como `Sessao` já tem), ou adicionar 2 métodos mutadores estreitos (`confirmar()`/`recusar()`, sem setter genérico de `status`) diretamente na entidade — decisão a bater com o que a Story 3.2 realmente implementou (ver Dev Notes, dependência viva). `assentoSessaoRepository.reivindicarVendido()`/`.liberar()` são métodos novos em `AssentoSessaoRepository` (pacote `sessoes.repository`, mesmo `@Modifying @Query` de UPDATE em lote já usado por `reivindicar()` na Story 3.2 — não reinventar o padrão). `findByIdForUpdate` em `ReservaRepository` segue o mesmo `@Lock(PESSIMISTIC_WRITE)` de `SalaRepository`/`SessaoRepository`. Rodar o teste até passar.
  - [x] Commit: `feat(pagamentos): PagamentoService.confirmar() com lock pessimista e idempotência (AC1-5)`

- [x] **Task 4 — `POST /api/pagamentos/confirmar` restrito a `CLIENTE` (AC1-4)**
  - [x] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/pagamentos/controller/PagamentoControllerTest.java` (`@WebMvcTest`, service mockado, mesmo padrão de `ReservaControllerTest`): corpo válido + token `CLIENTE` → `200` + shape de `PagamentoDto`; `resultadoSimulado` ausente/inválido → `400 PARAMETRO_INVALIDO`; service lança `NaoAutorizadoException` → `403 NAO_AUTORIZADO`; service lança `ReservaExpiradaException` → `409 RESERVA_EXPIRADA`. Criar `PagamentoSecurityTest.java` (mesmo padrão de `ReservaSecurityTest`): sem token → `403`; `ORGANIZADOR`/`PORTARIA` → `403`; `CLIENTE` → passa pro service mockado. Rodar e confirmar que falha.
  - [x] **[GREEN]** Criar `pagamentos/controller/PagamentoController.java`:
    ```java
    @RestController
    @RequestMapping("/api/pagamentos")
    public class PagamentoController {
        @PostMapping("/confirmar")
        @PreAuthorize("hasRole('CLIENTE')")
        public ResponseEntity<PagamentoDto> confirmar(@Valid @RequestBody ConfirmarPagamentoRequest request, Authentication authentication) {
            return ResponseEntity.ok(pagamentoService.confirmar(request, authentication.getName()));
        }
    }
    ```
    Mesmo padrão de `ReservaController` — **sem mudança em `SecurityConfig`**, cai no `.anyRequest().authenticated()` já existente. Adicionar em `GlobalExceptionHandler`: `handleNaoAutorizado` (pagamentos) → `403 NAO_AUTORIZADO` (reaproveitar a mesma constante de código já usada por `handleAcessoNegado`/`handleSessaoNaoPertenceAoOrganizador` — mesmo `codigo`, é o mesmo conceito de negação de acesso, só a exceção Java é de outro pacote); `handleReservaExpirada` → `409 RESERVA_EXPIRADA` (código já estava na lista não-exaustiva de AD-11). Rodar os testes até passar.
  - [x] Commit: `feat(pagamentos): POST /api/pagamentos/confirmar restrito a CLIENTE (AC1-4)`

- [ ] **Task 5 — Teste de concorrência real com parâmetros conflitantes via Testcontainers (AC5)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/pagamentos/PagamentoConcorrenciaConflitanteTest.java` (`@SpringBootTest` + Testcontainers, mesmo padrão de `ReservaConcorrenciaConflitoTest` da Story 3.2 — ler antes de escrever): criar uma `Reserva` `ATIVA` real (via `ReservaService.reservar()`, não fixture direta — garante que o estado de `assento_sessao` também está coerente); disparar duas chamadas reais a `pagamentoService.confirmar()` em threads separadas pra mesma `reservaId`, uma com `APROVADO` e outra com `RECUSADO`, simultaneamente; assert que as duas respostas têm o **mesmo** `status` (uma delas "venceu", a outra ecoa); assert no banco que só existe um estado final coerente: se `CONFIRMADA`, existem `Ingresso`s e `assento_sessao=VENDIDO`; se `RECUSADA`, não existe nenhum `Ingresso` pra essa reserva e `assento_sessao=LIVRE`. Rodar e confirmar que passa (prova final de AC5, não deveria exigir código novo se a Task 3 fez o lock certo).
  - [ ] Commit: `test(pagamentos): concorrência com parâmetros conflitantes é determinística (AC5)`

- [ ] **Task 6 — Confirmação final (sem código novo, checklist de saída)**
  - [ ] Rodar a suíte completa (back-end `mvn test`, incluindo os testes Testcontainers das Tasks 2 e 5) e confirmar tudo verde. Front-end não é tocado nesta story (a tela de confirmação de pagamento fica fora do escopo explícito — ver Dev Notes; se o dev decidir que uma UI mínima é necessária pra fechar o fluxo ponta a ponta manualmente, registrar isso como decisão em `docs/decisions.md`, não expandir a story sem avisar).
  - [ ] Registrar em `docs/decisions.md`: (a) por que `NaoAutorizadoException` de `pagamentos` retorna o mesmo `403 NAO_AUTORIZADO` de reserva inexistente (não revelar existência, AC3); (b) por que a mutação de `Reserva`/`assento_sessao` usa os métodos exatos que a Story 3.2 implementou de fato (registrar aqui qual foi — `toBuilder()`, mutador estreito, ou `@Modifying @Query` — só se souber no momento desta confirmação; caso contrário, deixar como nota pendente pro code review); (c) confirmar que `TICKET_HMAC_SECRET` ficou documentado em `.env.example` como distinto do `JWT_SECRET`.
  - [ ] Atualizar o Status desta story pra `review`.
  - [ ] Commit: `docs(pagamentos): confirmação final e fecha Story 4.1 pra review`

## Dev Notes

- **Dependência viva com a Story 3.2, que ainda não foi implementada em código no momento em que esta spec foi criada.** `Reserva`, `ReservaRepository`, `StatusReserva`, `AssentoSessaoRepository.reivindicar()`/`travarParaReserva()` existem só como especificação (`3-2-reserva-de-assentos-com-hold-temporario.md`), não como classes reais no working tree. **Não iniciar `dev-story` desta story (4.1) antes da 3.2 estar implementada e commitada.** Em particular, a Task 3 desta story assume que `Reserva` tem algum mecanismo de mutação de `status` (`toBuilder()` como `Sessao`, ou métodos estreitos `confirmar()`/`recusar()`) — a 3.2, como especificada, não define isso explicitamente (só cria a entidade, não a atualiza depois de criada). Quem implementar a 4.1 precisa checar o que a 3.2 implementou de fato e adaptar (ou, se a 3.2 ainda não decidiu isso, propor o método mais estreito possível na própria `Reserva`, seguindo o mesmo cuidado que `AssentoSessao` já demonstrou — mutação implícita e ampla é o que causou o gotcha do `Persistable`/`novo` na Story 3.2, não repetir esse padrão em `Reserva`).

- **`AC3` usa `403` genérico pra reserva de outro cliente **e** reserva inexistente — decisão deliberada, diferente do padrão de posse de sessão do organizador.** `SessaoNaoPertenceAoOrganizadorException` (Story 2.2) também devolve `403` (não `404`) quando o organizador não é dono, mas a Story 2.2 nunca disfarça "sessão não existe" do mesmo jeito — lá, uma sessão inexistente é sempre `404 SESSAO_NAO_ENCONTRADA` primeiro, e só depois de confirmar que existe é que a posse é checada. Aqui é o oposto, por design: FR-12 do PRD exige explicitamente "sem revelar se a reserva existe" — então reserva-inexistente e reserva-de-outro-cliente colapsam na mesma exceção/resposta. Não "corrigir" isso pra separar os dois casos num code review futuro sem revisitar essa AC primeiro.

- **`ReservaExpiradaException` é sobre o caminho de escrita, não leitura.** O TTL lazy de AD-4 (Story 3.1: mapa de assentos; Story 3.2: nova tentativa de reserva) trata hold vencido como livre na leitura. Esta story usa a mesma regra de cálculo, mas do lado da escrita: se a reserva já venceu no momento em que o lock é adquirido, a confirmação simplesmente não pode prosseguir (nem aprovar nem recusar) — é um terceiro desfecho, distinto de AC1/AC2, por isso vira exceção (`409`) em vez de uma resposta `200` com algum status novo. Isso também é o motivo do AC5 dizer "estado determinístico" e não "aprovado ou recusado": a corrida real do PRD (FR-12, último parágrafo) é entre uma reserva expirando e uma nova reserva pro mesmo assento — fora do escopo desta AC5 específica (que é sobre duas confirmações da *mesma* reserva), mas é o motivo de checar `expiresAt` **depois** de adquirir o lock, nunca antes (checar antes teria uma janela de corrida entre o check e o lock).

- **`TICKET_HMAC_SECRET` é um segredo novo, não reaproveita `JWT_SECRET`.** Non-negotiable explícito de AD-8/CLAUDE.md — os dois protegem coisas diferentes (sessão de usuário vs. autenticidade de ingresso físico/QR) e um vazamento de um não deve comprometer o outro. Mesmo padrão de leitura (`@Value` sem fallback, obrigatório) do `security.jwt.secret` já usado por `JwtService`.

- **`GenerationType.UUID` (Hibernate 6/Spring Boot 4) em vez de gerar `UUID.randomUUID()` manualmente no service.** Deixa a geração no nível JPA, consistente com como as outras entidades (`GenerationType.IDENTITY`) delegam geração de PK pro provedor — não inventar um padrão diferente só porque o tipo é `UUID` em vez de `Long`.

- **Ingressos e ordenação/consulta por reserva.** `IngressoRepository.findByReservaId()` é usado tanto pelo write path (nunca, na verdade — os ingressos são criados um a um no loop) quanto pelo caminho idempotente de leitura (Task 3, item f) — quando a segunda chamada concorrente encontra a reserva já `CONFIRMADA`, ela busca os ingressos já emitidos pela chamada vencedora pra montar a mesma resposta, em vez de tentar recriar.

- **Sem tela de front-end nesta story, por decisão de escopo explícita.** O PRD/epics não descrevem uma UI própria de "confirmar pagamento" com FR numerado — a Story 4.2 ("Meus Ingressos e Link Público") é quem primeiro expõe ingresso na UI. Esta story fecha o backend do fluxo de pagamento; não inventar uma tela aqui só pra "ver funcionando" sem que isso esteja pedido — se for necessário validar manualmente, usar um cliente HTTP (curl/Postman/Insomnia) contra o endpoint, documentado em `docs/decisions.md` se relevante.

### Project Structure Notes

- Primeira story a criar os pacotes `pagamentos/` e `ingressos/` (AD-1: `pagamentos → reservas`, `ingressos → reservas, pagamentos`). `pagamentos/` não tem `repository/` próprio (opera sobre `Reserva`, que pertence a `reservas/` — Structural Seed já previa isso).
- **Back-end (novo)**: `api/src/main/java/br/com/rolo35/api/ingressos/StatusIngresso.java`; `.../ingressos/Ingresso.java`; `.../ingressos/repository/IngressoRepository.java`; `.../ingressos/service/CodigoIngressoService.java`; `.../pagamentos/ResultadoSimulado.java`; `.../pagamentos/dto/ConfirmarPagamentoRequest.java`; `.../pagamentos/dto/PagamentoDto.java`; `.../pagamentos/dto/IngressoDto.java`; `.../pagamentos/NaoAutorizadoException.java`; `.../pagamentos/ReservaExpiradaException.java`; `.../pagamentos/service/PagamentoService.java`; `.../pagamentos/controller/PagamentoController.java`; testes correspondentes em `api/src/test/java/br/com/rolo35/api/{ingressos,pagamentos}/**`.
- **Back-end (update)**: `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (novos métodos `reivindicarVendido()`, `liberar()`, mesmo padrão `@Modifying @Query` da Story 3.2); `.../reservas/repository/ReservaRepository.java` (novo `findByIdForUpdate()`, mesmo padrão `@Lock(PESSIMISTIC_WRITE)` de `SalaRepository`); `.../reservas/Reserva.java` (mecanismo de transição de status — exato a confirmar contra a implementação real da 3.2, ver Dev Notes); `.../common/GlobalExceptionHandler.java` (novos handlers); `api/src/main/resources/application.properties` (`ticket.hmac.secret`); `.env.example` (`TICKET_HMAC_SECRET`).
- **Documentação (update)**: `docs/decisions.md`.
- **Leitura obrigatória antes de codar** (arquivos UPDATE, não criar do zero — todos já lidos por completo durante a criação desta story, exceto onde indicado): `api/src/main/java/br/com/rolo35/api/auth/JwtService.java` (padrão de secret via `@Value`), `api/src/main/resources/application.properties`, `.env.example`, `api/src/main/resources/db/migration/V1__schema.sql` (schema de `ingressos`), `.../sessoes/repository/SalaRepository.java` (padrão `@Lock(PESSIMISTIC_WRITE)`), `.../common/GlobalExceptionHandler.java`, `.../common/ApiError.java`, `_bmad-output/implementation-artifacts/3-2-reserva-de-assentos-com-hold-temporario.md` (story anterior, **ainda não implementada** — checar o código real de `Reserva`/`ReservaRepository`/`AssentoSessaoRepository` assim que existir, não confiar só na spec), `_bmad-output/implementation-artifacts/deferred-work.md`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Confirmação de Pagamento Simulado com Emissão de Ingresso]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md#§4.5 Pagamento Simulado — FR-12, FR-13; §4.6 Emissão e Consulta de Ingresso — FR-14]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-1 (pacotes pagamentos/ingressos e direção de dependência), AD-6 (confirmação idempotente via lock pessimista em reserva), AD-7 (parâmetro de teste no corpo), AD-8 (código HMAC-SHA256, secret dedicado), AD-11 (envelope de erro, códigos RESERVA_EXPIRADA/NAO_AUTORIZADO já previstos), AD-12 (DTO explícito), Structural Seed (pacotes pagamentos/, ingressos/), Capability → Architecture Map §4.5-§4.6]
- [Source: CLAUDE.md — Non-negotiables de Segurança (código do ingresso assinado, não forjável; segredos só em env var), Metodologia XP + TDD, Convenções de nomenclatura]
- [Source: _bmad-output/implementation-artifacts/3-2-reserva-de-assentos-com-hold-temporario.md — Reserva/StatusReserva/AssentoSessaoRepository especificados (não implementados no momento desta criação), padrão @Modifying @Query, TTL lazy AD-4]
- [Source: api/src/main/resources/db/migration/V1__schema.sql — schema de `ingressos` (id UUID, status VALIDO/UTILIZADO) e `reservas`]
- [Source: código existente lido por completo nesta criação de story: `auth.JwtService`, `sessoes.repository.SalaRepository` (padrão de lock), `common.{GlobalExceptionHandler,ApiError}`, `api/src/main/resources/application.properties`, `.env.example`]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Task 1: `CodigoIngressoService` criado com HMAC-SHA256 e comparação em tempo constante
  (`MessageDigest.isEqual`). Secret `TICKET_HMAC_SECRET` adicionado em
  `application.properties`/`.env.example` (distinto de `JWT_SECRET`) e no `pom.xml`
  (env var de teste do surefire, mesmo padrão de `JWT_SECRET`/`TMDB_API_TOKEN`).
- Task 2: `Ingresso`/`StatusIngresso`/`IngressoRepository` criados usando
  `GenerationType.UUID` (Hibernate 6/Spring Boot 4, sem `@GenericGenerator`). Smoke test
  cria uma `Reserva` real (seed `cliente_id=1`/`sessao_id=1`) e usa `assento_id=1` do seed
  pra satisfazer as FKs de `ingressos`.
- Task 3: `Reserva` (3.2) veio sem builder — resolvido com dois mutadores estreitos
  `confirmar()`/`recusar()` direto na entidade (decisão registrada em `docs/decisions.md`
  na Task 6). `ReservaRepository.findByIdForUpdate()` e
  `AssentoSessaoRepository.reivindicarVendido()`/`.liberar()` novos, mesmo padrão de lock/
  `@Modifying @Query` já usado na Story 3.2. `ClienteNaoEncontradoException` (pacote
  `reservas`, já mapeada para 401) reaproveitada em vez de recriada em `pagamentos`.
- Task 4: `PagamentoController`/`PagamentoSecurityTest` seguem exatamente o padrão de
  `ReservaController`/`ReservaSecurityTest` — sem mudança em `SecurityConfig`, rota cai no
  `.anyRequest().authenticated()` já existente. Suíte completa (148 testes) verde.

### File List

- `api/src/main/java/br/com/rolo35/api/ingressos/service/CodigoIngressoService.java` (novo)
- `api/src/test/java/br/com/rolo35/api/ingressos/service/CodigoIngressoServiceTest.java` (novo)
- `api/src/main/resources/application.properties` (update)
- `.env.example` (update)
- `api/pom.xml` (update)
- `api/src/main/java/br/com/rolo35/api/ingressos/StatusIngresso.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/Ingresso.java` (novo)
- `api/src/main/java/br/com/rolo35/api/ingressos/repository/IngressoRepository.java` (novo)
- `api/src/test/java/br/com/rolo35/api/ingressos/IngressoRepositorySmokeTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/ResultadoSimulado.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/NaoAutorizadoException.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/ReservaExpiradaException.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/dto/ConfirmarPagamentoRequest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/dto/IngressoDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/dto/PagamentoDto.java` (novo)
- `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java` (novo)
- `api/src/test/java/br/com/rolo35/api/pagamentos/service/PagamentoServiceTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/reservas/Reserva.java` (update — `confirmar()`/`recusar()`)
- `api/src/main/java/br/com/rolo35/api/reservas/repository/ReservaRepository.java` (update — `findByIdForUpdate()`)
- `api/src/main/java/br/com/rolo35/api/sessoes/repository/AssentoSessaoRepository.java` (update — `reivindicarVendido()`/`liberar()`)
- `api/src/main/java/br/com/rolo35/api/pagamentos/controller/PagamentoController.java` (novo)
- `api/src/test/java/br/com/rolo35/api/pagamentos/controller/PagamentoControllerTest.java` (novo)
- `api/src/test/java/br/com/rolo35/api/pagamentos/PagamentoSecurityTest.java` (novo)
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update — handlers de `NaoAutorizadoException`/`ReservaExpiradaException`)
