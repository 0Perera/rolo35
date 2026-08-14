# Story 5.2: Validação de Ingresso na Portaria

Status: done

<!-- Nota: validação é opcional. Rode validate-create-story pra checagem de qualidade antes do dev-story. -->

## Story

As a usuário PORTARIA,
I want ler um ingresso por câmera ou digitação manual e receber um resultado inequívoco,
so that eu decido se libero a entrada com confiança, sem depender de julgamento visual.

## Acceptance Criteria

1. **Given** uma sessão ativa selecionada e um código de ingresso válido, não usado, da sessão correta **When** lido por câmera (QR) ou digitado manualmente **Then** ambos os caminhos produzem o mesmo resultado — "válido" — e o ingresso passa a `UTILIZADO`.
2. **Given** um código com assinatura adulterada ou inexistente **When** validado **Then** retorna "inválido".
3. **Given** um ingresso já validado anteriormente **When** validado de novo **Then** retorna "já utilizado", sem mudar de estado outra vez.
4. **Given** um ingresso válido, mas de uma sessão diferente da selecionada pela portaria **When** validado **Then** retorna "evento errado".
5. **Given** qualquer validação **When** a resposta é montada **Then** é exatamente um de: válido / inválido / já utilizado / evento errado — nunca ambíguo, nunca mais de um.
6. **Given** um usuário CLIENTE ou ORGANIZADOR **When** tenta chamar o endpoint de validação (`POST /portaria/validacoes`) **Then** rejeitado com `403`.
7. **Given** a resposta de qualquer validação **When** inspecionada **Then** não inclui dado sensível do cliente além do necessário à operação (sem e-mail, sem telefone).
8. **Given** duas validações concorrentes do mesmo ingresso (cenário Testcontainers) **When** disparadas ao mesmo tempo **Then** exatamente uma retorna "válido" e a outra "já utilizado", garantido por constraint/lock de banco — `POST /portaria/validacoes` é o único lugar que transiciona `VALIDO → UTILIZADO` (AD-9).

## Tasks / Subtasks

- [ ] **Task 1 — `Ingresso.validar()`: mutador de estado (AC1, AC3)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/IngressoTest.java` (JUnit puro, sem contexto Spring, mesmo nível de `Reserva`/`AssentoSessao` — que não têm teste unitário próprio porque `confirmar()`/`recusar()` são mutadores triviais, mas `validar()` tem uma regra a mais: dois campos mudam junto): construir um `Ingresso` com `status = VALIDO`, `validatedAt = null`; chamar `validar()`; confirmar `status == UTILIZADO` e `validatedAt` não-nulo (recebe `LocalDateTime.now()` no momento da chamada). Rodar e confirmar que falha por `validar()` não existir.
  - [ ] **[GREEN]** Em `api/src/main/java/br/com/rolo35/api/ingressos/Ingresso.java`, adicionar mutador estreito (mesmo padrão de `Reserva.confirmar()`/`recusar()` — não um setter genérico):
    ```java
    public void validar() {
        this.status = StatusIngresso.UTILIZADO;
        this.validatedAt = LocalDateTime.now();
    }
    ```
    Rodar o teste até passar.
  - [ ] Commit: `feat(ingressos): Ingresso.validar() (AC1, AC3)`

- [ ] **Task 2 — `PortariaService.validar()`: as 4 regras de resultado + bloqueio sem sessão ativa (AC1-5, AC7)**
  - [ ] **⚠️ Dependência viva com a Story 5.1, ainda não implementada em código no momento em que esta spec foi criada.** `PortariaService.obterSessaoAtivaOuLancar()`, `SessaoAtivaNaoSelecionadaException`, `PortariaNaoEncontradaException` existem só na spec `5-1-selecao-de-sessao-do-turno.md`. Esta story reusa esses nomes exatamente como especificados lá. **Não iniciar `dev-story` desta story antes da 5.1 estar implementada e commitada** — se a implementação real da 5.1 divergir (assinatura do método, nome da exceção), ajustar esta story primeiro.
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceValidacaoTest.java` (Mockito puro, mocka `IngressoRepository`, `CodigoIngressoService`, `AssentoRepository`, e os métodos de sessão-ativa já cobertos por `PortariaServiceTest` da Story 5.1 — reusar o mesmo `PortariaService`, é a mesma classe ganhando um método novo, não uma segunda classe). Casos:
    - Sem sessão ativa (`obterSessaoAtivaOuLancar()` lança `SessaoAtivaNaoSelecionadaException`) → propaga a mesma exceção, **sem** chamar `codigoIngressoService`/`ingressoRepository` (bloqueio acontece antes de qualquer trabalho — AC1 da Story 5.1 se tornando realidade nesta story).
    - Código malformado (`codigoIngressoService.extrairId()` retorna `Optional.empty()`) → `ResultadoValidacao.INVALIDO`, sem chamar `ingressoRepository.findByIdForUpdate()`.
    - Id extraído mas assinatura não bate (`codigoIngressoService.validar()` retorna `false`) → `INVALIDO`, mesma garantia da Story 4.2 (assinatura checada **antes** do banco, mesmo racional de AD-8/timing-oracle).
    - Assinatura válida mas `findByIdForUpdate()` não encontra a linha → `INVALIDO` — **mesma resposta** do caso de assinatura inválida (AC2 não diferencia os dois motivos, mesmo critério de `IngressoNaoEncontradoException` na Story 4.2, só que aqui é um valor de enum, não uma exceção HTTP).
    - Ingresso encontrado, `sessaoId` diferente da sessão ativa da portaria → `EVENTO_ERRADO`, **sem** chamar `ingressoRepository.save()` (não muta estado — AC4 + reforço de AD-9).
    - Ingresso encontrado, mesma sessão, `status == UTILIZADO` → `JA_UTILIZADO`, **sem** chamar `save()` de novo (idempotente, AC3).
    - Ingresso encontrado, mesma sessão, `status == VALIDO` → chama `ingresso.validar()` + `ingressoRepository.save(ingresso)`, retorna `VALIDO`.
    - Toda resposta de sucesso é um `ValidacaoIngressoDto` sem nenhum campo de cliente (assert negativo — nenhum getter de e-mail/nome, mesmo critério de `IngressoPublicoDto`/`SessaoAtivaDto`, AC7).
    Rodar e confirmar que falha.
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/ingressos/ResultadoValidacao.java` (enum: `VALIDO, INVALIDO, JA_UTILIZADO, EVENTO_ERRADO`). Criar `api/src/main/java/br/com/rolo35/api/ingressos/dto/ValidacaoIngressoDto.java` (record: `resultado: ResultadoValidacao, assentoFileira: String, assentoNumero: Integer, sessaoTitulo: String` — os três últimos `null` quando `resultado == INVALIDO`, já que nenhuma linha foi resolvida). Criar `api/src/main/java/br/com/rolo35/api/ingressos/IngressoEmDisputaException.java` (mesmo padrão de `AssentoEmDisputaException`/`ReservaEmDisputaException`: `"Ingresso em disputa no momento — tente novamente"`). Adicionar em `PortariaService`:
    ```java
    @Transactional
    public ValidacaoIngressoDto validar(String portariaEmail, String codigo) {
        Sessao sessaoAtiva = obterSessaoAtivaOuLancar(portariaEmail); // bloqueia antes de qualquer outro trabalho (AC1)

        Optional<UUID> idOptional = codigoIngressoService.extrairId(codigo);
        if (idOptional.isEmpty() || !codigoIngressoService.validar(idOptional.get(), codigo)) {
            return new ValidacaoIngressoDto(ResultadoValidacao.INVALIDO, null, null, null);
        }

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        Ingresso ingresso;
        try {
            ingresso = ingressoRepository.findByIdForUpdate(idOptional.get()).orElse(null);
        } catch (PessimisticLockingFailureException e) {
            throw new IngressoEmDisputaException();
        }
        if (ingresso == null) {
            return new ValidacaoIngressoDto(ResultadoValidacao.INVALIDO, null, null, null);
        }

        Assento assento = assentoRepository.findById(ingresso.getAssentoId()).orElseThrow(AssentoNaoEncontradoException::new);

        if (!ingresso.getSessaoId().equals(sessaoAtiva.getId())) {
            return new ValidacaoIngressoDto(
                    ResultadoValidacao.EVENTO_ERRADO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
        }
        if (ingresso.getStatus() == StatusIngresso.UTILIZADO) {
            return new ValidacaoIngressoDto(
                    ResultadoValidacao.JA_UTILIZADO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
        }

        ingresso.validar();
        ingressoRepository.save(ingresso);
        return new ValidacaoIngressoDto(
                ResultadoValidacao.VALIDO, assento.getFileira(), assento.getNumero(), sessaoAtiva.getTitulo());
    }
    ```
    Nova exceção `AssentoNaoEncontradoException` só é necessária se ainda não existir uma equivalente em `sessoes` reaproveitável — checar primeiro (`SalaNaoEncontradaException` existe, um paralelo pra `Assento` pode não existir ainda; se não existir, criar em `sessoes` seguindo o mesmo padrão, é FK garantida pelo schema então na prática nunca deveria disparar — defensivo, não caminho testado por AC). Adicionar `IngressoRepository.findByIdForUpdate(UUID id)`:
    ```java
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Ingresso i where i.id = :id")
    Optional<Ingresso> findByIdForUpdate(@Param("id") UUID id);
    ```
    mesmo padrão exato de `SessaoRepository.findByIdForUpdate`/`ReservaRepository.findByIdForUpdate` — sem teste unitário dedicado pra essa query (nenhuma das duas outras tem), a garantia de lock real é provada pelo teste de concorrência da Task 4. Rodar os testes até passar.
  - [ ] Commit: `feat(portaria): PortariaService.validar() (AC1-5, AC7)`

- [ ] **Task 3 — Rota: `POST /api/portaria/validacoes` (AC1-7)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/controller/PortariaValidacaoControllerTest.java` (`@WebMvcTest`, service mockado): token `PORTARIA` + corpo `{codigo}` válido, service retorna `ValidacaoIngressoDto(VALIDO, ...)` → `200` + corpo correspondente; corpo com `codigo` em branco/ausente → `400`; service lança `SessaoAtivaNaoSelecionadaException` → `409`; service lança `IngressoEmDisputaException` → `409` com código de erro diferente (`INGRESSO_EM_DISPUTA` vs `SESSAO_ATIVA_NAO_SELECIONADA` — dois motivos de 409 distintos, checar o `codigo` do `ApiError`, não só o status). Estender `PortariaSecurityTest` (criado na Story 5.1): sem token → `401`; token `CLIENTE`/`ORGANIZADOR` → `403` (AC6); token `PORTARIA` chega no service mockado.
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/ingressos/dto/ValidarIngressoRequest.java` (record: `@NotBlank String codigo`). Adicionar em `PortariaController` (mesmo controller da Story 5.1, `POST /api/portaria/turno` já vive lá):
    ```java
    @PostMapping("/validacoes")
    @PreAuthorize("hasRole('PORTARIA')")
    public ResponseEntity<ValidacaoIngressoDto> validar(
            @Valid @RequestBody ValidarIngressoRequest request, Authentication authentication) {
        return ResponseEntity.ok(portariaService.validar(authentication.getName(), request.codigo()));
    }
    ```
    Em `GlobalExceptionHandler`, adicionar handler de `IngressoEmDisputaException` (mesmo padrão de `handleAssentoEmDisputa`/`handleReservaEmDisputa`, `409 INGRESSO_EM_DISPUTA`, com `log.warn` do lock estourado). `SessaoAtivaNaoSelecionadaException` já tem handler da Story 5.1 — reusado sem mudança. Rodar os testes até passar.
  - [ ] Commit: `feat(portaria): POST /api/portaria/validacoes (AC1-7)`

- [ ] **Task 4 — Concorrência real: duas validações do mesmo ingresso (AC8, FR-20)**
  - [ ] **[RED]** Criar `api/src/test/java/br/com/rolo35/api/ingressos/PortariaValidacaoConcorrenciaTest.java` (`@Import(TestcontainersConfiguration.class) @SpringBootTest`, mesmo formato de `PagamentoConcorrenciaConflitanteTest`/`ReservaConcorrenciaConflitoTest`): monta a fixture completa até ter um ingresso `VALIDO` de verdade (sala → assento → sessão → `assento_sessao` LIVRE → `reservaService.reservar()` → `pagamentoService.confirmar(APROVADO)` — reaproveita os services já existentes, não insere `Ingresso` direto via repository, pra passar pelo caminho real de emissão) e a portaria com essa sessão marcada como ativa (`portariaService.selecionarSessao()`, Story 5.1). Duas threads (`CyclicBarrier` de 2, `ExecutorService` de 2) chamam `portariaService.validar(codigoDoIngresso)` ao mesmo tempo pro **mesmo código**. Rodar e confirmar que falha (método/fixture ainda incompletos — normal, é RED por dependência de infraestrutura de teste nova, não por lógica de produção faltando, já que a Task 2/3 já a implementou; o RED aqui é sobre o teste em si não compilar/rodar até a fixture estar montada certo).
  - [ ] **[GREEN]** Ajustar a fixture/asserts até o teste passar de verdade contra o Postgres real do Testcontainers: `assertThat(List.of(resultado1.resultado(), resultado2.resultado())).containsExactlyInAnyOrder(ResultadoValidacao.VALIDO, ResultadoValidacao.JA_UTILIZADO)` — exatamente um de cada, nunca os dois `VALIDO` (que provaria a falha de lock) nem os dois `JA_UTILIZADO` (que provaria um bug diferente, ninguém validou de fato). Conferir ao final que `ingressoRepository.findById(id)` tem `status == UTILIZADO` e `validatedAt` não-nulo uma única vez (não sobrescrito pela segunda chamada).
  - [ ] Commit: `test(portaria): concorrência real prova AC8/FR-20 via Testcontainers`

- [ ] **Task 5 — Front-end: leitura por câmera (QR) e digitação manual (AC1, AC2, AC3, AC4, AC5)**
  - [ ] **Nova dependência, decidida com o usuário nesta criação de story**: adicionar `qr-scanner` (pacote `qr-scanner` no npm, wrapper leve sobre `getUserMedia` + decodificação contínua em loop, API `start()`/`stop()`/callback `onDecode`) em `web/package.json`. Rodar `npm install qr-scanner` dentro de `web/` como primeiro passo desta task.
  - [ ] Criar `web/src/api/portaria.ts` — **atenção**: se a Story 5.1 já criou este arquivo com `selecionarSessaoTurno`/`buscarSessaoAtiva`, esta task só **estende** o mesmo módulo, não recria. Adicionar: `interface ResultadoValidacao { resultado: 'VALIDO' | 'INVALIDO' | 'JA_UTILIZADO' | 'EVENTO_ERRADO'; assentoFileira: string | null; assentoNumero: number | null; sessaoTitulo: string | null }`, `validarIngresso(codigo: string): Promise<ResultadoValidacao>` (`POST /api/portaria/validacoes`).
  - [ ] Criar `web/src/pages/ValidacaoPortariaPage.tsx`: dois caminhos de entrada pro mesmo `codigo` — campo de texto com botão "validar" (digitação manual) e um leitor de câmera opcional (`qr-scanner`, ativado por um botão "ligar câmera" — não abre a câmera sozinho no mount, exige gesto explícito do usuário, tanto por UX quanto porque `getUserMedia` pode falhar/negar permissão e a tela precisa de um estado pra isso). Os dois caminhos chamam a **mesma** função `validarIngresso(codigo)` (AC1 — "ambos os caminhos produzem o mesmo resultado" fica garantido por construção, não por coincidência: um único ponto de chamada). Resultado renderizado com uma cor/rótulo por `resultado` (`VALIDO` verde, `INVALIDO`/`EVENTO_ERRADO` vermelho, `JA_UTILIZADO` amarelo/aviso — decisão de estilo, não pixel-perfect nesta story) mostrando `assentoFileira`/`assentoNumero`/`sessaoTitulo` quando presentes. Tela acessível só a partir de `/portaria` (a tela de seleção de turno da Story 5.1 ganha um link/botão "validar ingressos" que leva pra cá — só depois de já existir uma sessão ativa selecionada; sem sessão ativa, a própria chamada a `validarIngresso()` já devolve `409` e a tela mostra a mensagem pedindo pra voltar e selecionar).
  - [ ] Em `web/src/App.tsx`: adicionar `<Route path="/portaria/validar" element={<ValidacaoPortariaPage />} />` dentro do `<Route element={<Layout />}>`, ao lado da rota `/portaria` da Story 5.1.
  - [ ] Depois do componente pronto: `ValidacaoPortariaPage.test.tsx` (vitest + testing-library) — cobre os 4 resultados via digitação manual (mock de `validarIngresso`), e que o botão "ligar câmera" existe e dispara `QrScanner.start()` (mock do módulo `qr-scanner` — sem depender de `getUserMedia` real em jsdom, mesmo espírito de `prefereMenosAnimacao()` sendo defensivo pra ambiente sem certas APIs). Contrato de comportamento, não pixel.
  - [ ] Commit: `feat(portaria): leitura de ingresso por câmera e digitação manual (AC1-5)`

- [ ] **Task 6 — Confirmação final (sem código novo, checklist de saída)**
  - [ ] Rodar a suíte completa: backend `mvn test` (inclui os dois cenários de concorrência do projeto — Story 3.2/reservas e esta); front-end `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`. Confirmar tudo verde.
  - [ ] Registrar em `docs/decisions.md`: (a) por que os 4 resultados de validação (`VALIDO`/`INVALIDO`/`JA_UTILIZADO`/`EVENTO_ERRADO`) voltam como `200` + campo `resultado`, não como códigos HTTP de erro — são desfechos de negócio esperados, mesmo racional de `PagamentoDto` sempre `200` (AD-6), não "algo deu errado" no sentido HTTP; (b) por que `INVALIDO` não diferencia "não encontrado" de "assinatura errada" (mesma decisão da Story 4.2, AD-8, reaplicada aqui); (c) escolha de `qr-scanner` como dependência nova e por quê (leve, API mínima, decisão tomada com o usuário nesta criação de story).
  - [ ] Atualizar o Status desta story pra `review`.
  - [ ] Atualizar `_bmad-output/implementation-artifacts/sprint-status.yaml`: `5-2-validacao-de-ingresso-na-portaria: review`, `epic-5: done` (fecha o épico — última story).
  - [ ] Commit: `docs(portaria): confirmação final e fecha Story 5.2 pra review — encerra Epic 5`

## Dev Notes

- **Dependência viva com a Story 5.1**, já sinalizada na Task 2 — não reprocessar aqui, só lembrar: `PortariaService` é a **mesma classe** entre as duas stories, esta só adiciona o método `validar()` (e o construtor ganha `AssentoRepository`, `CodigoIngressoService`, `EntityManager` como dependências novas se ainda não estiverem lá pela 5.1).

- **Por que a resposta é sempre `200` com um campo `resultado`, nunca um `404`/`409` pros 4 desfechos de negócio.** `INVALIDO`/`JA_UTILIZADO`/`EVENTO_ERRADO` não são "a requisição falhou" — são respostas de negócio válidas que a portaria precisa tratar visualmente sem que o front precise diferenciar "erro de rede" de "ingresso já usado". Mesmo racional de `PagamentoDto` (AD-6: "resposta sempre `200` com `{status, ingressos}` refletindo o estado persistido"). As exceções reais desta story (`SessaoAtivaNaoSelecionadaException` → `409`, `IngressoEmDisputaException` → `409`) são sobre a **operação em si** não poder ser tentada (sem sessão selecionada) ou não poder ser **completada agora** (lock estourado, tente de novo) — categoria diferente de "o ingresso é inválido".

- **`INVALIDO` não diferencia motivo, de propósito** — mesma decisão de `IngressoNaoEncontradoException` na Story 4.2 (AD-8): código malformado, assinatura adulterada e UUID inexistente caem todos no mesmo resultado. Evita usar o endpoint de validação como oráculo pra descobrir se um UUID é válido por tentativa e erro.

- **Assinatura é checada antes de qualquer lock/consulta de banco** — mesma ordem de operações da Story 4.2 (`buscarPublico()`), reaplicada aqui: `codigoIngressoService.extrairId()`/`validar()` rodam antes de `entityManager.createNativeQuery("SET LOCAL lock_timeout...")`. Um código forjado nunca chega a segurar uma linha da tabela `ingressos`, mesmo que só por um instante.

- **`EVENTO_ERRADO` não muta estado** — só `VALIDO` (primeira validação bem-sucedida) escreve. `JA_UTILIZADO` e `EVENTO_ERRADO` leem sob o mesmo lock pessimista (já foi adquirido pra decidir o resultado) mas não chamam `save()` — o lock é liberado no commit da transação sem nenhuma escrita, comportamento idêntico a uma leitura pura do ponto de vista do dado, só que serializada contra escritas concorrentes (é exatamente essa serialização que garante AC8).

- **Por que o teste de concorrência (Task 4) reaproveita `reservaService`/`pagamentoService` pra criar o ingresso, em vez de inserir `Ingresso` direto no repositório.** Um `Ingresso` inserido "à mão" no teste pode divergir sutilmente do que o fluxo real produz (nesta arquitetura já aconteceu antes — ver o cuidado equivalente em `PagamentoConcorrenciaConflitanteTest`, que também monta a fixture via `reservaService.reservar()`). Passar pelo caminho real (reserva → pagamento aprovado → ingresso) garante que o teste prova o comportamento que a portaria de fato vai encontrar em produção.

- **Câmera é opt-in, nunca automática** — `qr-scanner` só é iniciado por um clique explícito do usuário PORTARIA. Além de UX (não pedir permissão de câmera sem contexto), simplifica o teste (`ValidacaoPortariaPage.test.tsx` não precisa lidar com `getUserMedia` disparando no mount de todo teste que renderiza a página).

### Project Structure Notes

- Fecha a Epic 5 — nenhum pacote novo, estende `ingressos/` (nascido nas Stories 4.1/4.2, ganhou `PortariaService`/`PortariaController` na Story 5.1).
- **Back-end (novo)**: `.../ingressos/ResultadoValidacao.java`; `.../ingressos/IngressoEmDisputaException.java`; `.../ingressos/dto/ValidacaoIngressoDto.java`; `.../ingressos/dto/ValidarIngressoRequest.java`; testes: `IngressoTest.java`, `service/PortariaServiceValidacaoTest.java`, `controller/PortariaValidacaoControllerTest.java`, `PortariaValidacaoConcorrenciaTest.java`.
- **Back-end (update)**: `.../ingressos/Ingresso.java` (`validar()`); `.../ingressos/repository/IngressoRepository.java` (`findByIdForUpdate()`); `.../ingressos/service/PortariaService.java` (método `validar()`, novas dependências no construtor); `.../ingressos/controller/PortariaController.java` (`POST /validacoes`); `.../common/GlobalExceptionHandler.java` (handler de `IngressoEmDisputaException`); `.../ingressos/PortariaSecurityTest.java` (estendido, criado na 5.1).
- **Front-end (novo)**: `web/src/pages/ValidacaoPortariaPage.tsx` + `.test.tsx`.
- **Front-end (update)**: `web/src/api/portaria.ts` (estendido, criado na 5.1); `web/src/App.tsx` (rota `/portaria/validar`); `web/package.json` (`qr-scanner`).
- **Documentação (update)**: `docs/decisions.md`; `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Leitura obrigatória antes de codar**: `_bmad-output/implementation-artifacts/5-1-selecao-de-sessao-do-turno.md` (nomes exatos de `PortariaService`/exceções, **checar contra a implementação real assim que existir**); `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java` (padrão de lock + `SET LOCAL lock_timeout` + catch de `PessimisticLockingFailureException`); `api/src/test/java/br/com/rolo35/api/pagamentos/PagamentoConcorrenciaConflitanteTest.java` (template direto do teste da Task 4); `.../ingressos/service/IngressoService.java` (padrão `buscarPublico()` — assinatura antes do banco, mesma resposta pros dois motivos de não-encontrado); `.../reservas/Reserva.java` (padrão de mutador estreito, replicado em `Ingresso.validar()`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2: Validação de Ingresso na Portaria]
- [Source: _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md — FR-18, FR-19, FR-20]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md#AD-8 (assinatura HMAC recomputada antes do banco), AD-9 (POST /portaria/validacoes é o único lugar que transiciona VALIDO→UTILIZADO, mesmo lock pessimista de AD-3/AD-5/AD-6)]
- [Source: instruções do projeto — Non-negotiable "não validar o mesmo ingresso duas vezes, resolvido com constraint/lock de banco", Metodologia XP + TDD (Testcontainers reservado pros dois cenários de concorrência — este é o segundo, o primeiro é FR-11/reservas)]
- [Source: _bmad-output/implementation-artifacts/5-1-selecao-de-sessao-do-turno.md — PortariaService/PortariaController/exceções especificados, mesmo aviso de dependência viva]
- [Source: _bmad-output/implementation-artifacts/4-2-meus-ingressos-e-link-publico.md — precedente direto de "mesma resposta pros dois motivos de não-encontrado" e assinatura checada antes do banco]
- [Source: código existente lido por completo nesta criação de story: `pagamentos.service.PagamentoService` (lock + idempotência), `pagamentos.PagamentoConcorrenciaConflitanteTest`/`reservas.ReservaConcorrenciaConflitoTest` (template de teste de concorrência), `reservas.Reserva` (mutador estreito), `ingressos.Ingresso`/`StatusIngresso`/`IngressoRepository`/`CodigoIngressoService` (Stories 4.1/4.2), `web/package.json` (dependências atuais, confirma ausência de lib de QR)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-agent-dev, Amelia)

### Debug Log References

RED confirmado por falha de compilação/rota 404→500 antes de cada GREEN (Tasks 1-3). Um ajuste
de mock em `PortariaServiceValidacaoTest` (stub de `entityManager.createNativeQuery()`, ausente
inicialmente, causava `NullPointerException` nos 4 casos que passam do lock em diante). Teste de
concorrência (Task 4) passou de primeira e se manteve estável em execuções repetidas.

### Completion Notes List

- Dependência viva com a Story 5.1 já estava resolvida: `PortariaService`, `obterSessaoAtivaOuLancar()`
  e as exceções bateram exatamente com os nomes assumidos pela spec desta story.
- `PortariaServiceTest` (Story 5.1) precisou de ajuste mecânico pro construtor novo de
  `PortariaService` (4 dependências a mais); nenhum teste de comportamento da 5.1 mudou.
- Suíte completa verde: `mvn test` (backend, inclui os dois cenários de concorrência do
  projeto) e `npx tsc --noEmit && npm run lint && npm run build` (frontend).
- **Correção do code review (2026-08-13):** a alegação de "3 arquivos falhando por ambiente
  (`localStorage` indisponível)" herdada da Story 5.1 era falsa — o comando do checklist estava
  errado. Usar **`npm test`** (que carrega `NODE_OPTIONS=--no-experimental-webstorage`), nunca
  `npx vitest run`. A suíte do front sempre esteve verde.
- Decisões registradas em `docs/decisions.md`.
- Epic 5 encerrado — fluxo ponta a ponta completo (buscar filme → sessão → assento → pagamento
  → ingresso → validar na portaria) implementado.

### File List

- `api/src/main/java/br/com/rolo35/api/ingressos/Ingresso.java` (update — `validar()`)
- `api/src/main/java/br/com/rolo35/api/ingressos/ResultadoValidacao.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/IngressoEmDisputaException.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/ValidacaoIngressoDto.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/ValidarIngressoRequest.java`
- `api/src/main/java/br/com/rolo35/api/sessoes/AssentoNaoEncontradoException.java`
- `api/src/main/java/br/com/rolo35/api/ingressos/repository/IngressoRepository.java` (update —
  `findByIdForUpdate()`)
- `api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java` (update —
  `validar()`, novas dependências no construtor)
- `api/src/main/java/br/com/rolo35/api/ingressos/controller/PortariaController.java` (update —
  `POST /validacoes`)
- `api/src/main/java/br/com/rolo35/api/common/GlobalExceptionHandler.java` (update — handler de
  `IngressoEmDisputaException`)
- `api/src/test/java/br/com/rolo35/api/ingressos/IngressoTest.java`
- `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceValidacaoTest.java`
- `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceTest.java` (update —
  construtor novo)
- `api/src/test/java/br/com/rolo35/api/ingressos/controller/PortariaValidacaoControllerTest.java`
- `api/src/test/java/br/com/rolo35/api/ingressos/PortariaSecurityTest.java` (update — estendido)
- `api/src/test/java/br/com/rolo35/api/ingressos/PortariaValidacaoConcorrenciaTest.java`
- `web/package.json` (update — `qr-scanner`)
- `web/src/api/portaria.ts` (update — `ResultadoValidacao`, `validarIngresso`)
- `web/src/pages/ValidacaoPortariaPage.tsx`
- `web/src/pages/ValidacaoPortariaPage.test.tsx`
- `web/src/pages/SelecaoTurnoPortariaPage.tsx` (update — link "validar ingressos")
- `web/src/App.tsx` (update — rota `/portaria/validar`)
- `docs/decisions.md` (update)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (update)

### Review Findings

Code review de 2026-08-13 (3 camadas adversariais + verificação empírica). Corrigidos nesta rodada
marcados; o restante fica como action item — escopo reduzido a pedido, só blocker e `high`.

- [x] [Review][Decision] **BLOCKER — AC1 não atendido.** O QR gravava `${origin}/ingressos/${codigo}` e a tela mandava o payload cru; `extrairId()` fazia `UUID.fromString("https://rolo35")` e **toda leitura por câmera devolvia `INVALIDO`**. Decidido: o QR passa a carregar o código assinado [web/src/components/CanhotoIngresso.tsx:38] — coberto por `ContratoQrPortaria.test.tsx`, que testa a travessia entre as duas pontas
- [x] [Review][Patch] `onDecode` dispara ~25×/s sem parar o scanner: o mesmo ingresso era validado dezenas de vezes e o veredito invertia de `VALIDO` pra `JA_UTILIZADO` na frente do operador (AC1/AC5) [web/src/pages/ValidacaoPortariaPage.tsx:82] — scanner para na primeira leitura + guarda de in-flight
- [x] [Review][Patch] `scanner.start()` era Promise não tratada e `setCameraLigada(true)` rodava incondicionalmente: permissão negada deixava a tela sem estado e sem volta [web/src/pages/ValidacaoPortariaPage.tsx:94] — `catch` com mensagem e botão preservado
- [x] [Review][Patch] Veredito anterior nunca era limpo: o cartão verde "VÁLIDO — LIBERAR ENTRADA" sobrevivia embaixo do erro do ingresso seguinte (AC5) [web/src/pages/ValidacaoPortariaPage.tsx:49] — `setResultado(null)` no início de `validar()`
- [x] [Review][Decision] `EVENTO_ERRADO` devolve o título da sessão *ativa*, e a UI renderizava cru — o operador lia "EVENTO ERRADO / Clube da Luta" segurando ingresso de outro filme. Decidido: rotular na UI ("Sessão do turno: X"), backend intocado [web/src/pages/ValidacaoPortariaPage.tsx:173]
- [x] [Review][Patch] README e `docs/regras-de-negocio.md` declaravam o Epic 5 inexistente ("não existe código", "a rota `/portaria` é um placeholder") — corrigidos, incluindo a linha do README que documentava o QR carregando o link público
- [x] [Review][Defer] `AssentoNaoEncontradoException` é lançada sem `@ExceptionHandler` → `500 ERRO_INTERNO`; única exceção nova fora do envelope de erro [api/.../service/PortariaService.java:102] — deferido: inalcançável na prática (FK garante assento válido pra todo ingresso), sem non-negotiable violado.
- [x] [Review][Defer] Estouro de lock fora do `try` estreito (flush/commit do `save()`) cai no handler global `handleSalaOcupada` → `503 "Outra criação de sessão para essa sala está em andamento"` exibido a quem escaneia ingresso [api/.../service/PortariaService.java:93] — deferido: mensagem confusa em janela de contenção rara, comportamento (503, retry funciona) está correto.
- [x] [Review][Defer] Teste de concorrência não afere que `validatedAt` não é sobrescrito pela segunda chamada [api/.../PortariaValidacaoConcorrenciaTest.java:832] — deferido: gap de cobertura de teste, não bug de produção.
- [x] [Review][Defer] `dtoNaoExpoeCampoDeCliente` é tautologia [api/.../service/PortariaServiceValidacaoTest.java:1585] — deferido: qualidade de teste, não bug de produção.
- [x] [Review][Defer] `assentoFileira && assentoNumero` esconde o assento quando `numero === 0` [web/src/pages/ValidacaoPortariaPage.tsx:178] — deferido: inalcançável, `numero` de assento sempre começa em 1 (`generate_series(1, colunas)` no seed/geração de mapa).
- [x] [Review][Defer] `#2E7D46` inventado fora da paleta fixa e aplicado por `style` inline [web/src/pages/ValidacaoPortariaPage.tsx:9] — deferido: cosmético.
- [x] [Review][Defer] Campo manual fora de `<form>`: Enter não submete, leitor de código de barras keyboard-wedge não funciona; tela nunca mostra qual é a sessão ativa [web/src/pages/ValidacaoPortariaPage.tsx:121] — deferido: digitação manual continua funcional via botão, não é fluxo quebrado; UX a melhorar depois.
- [x] [Review][Defer] Tipo TS `ResultadoValidacao` nomeia o envelope enquanto o enum Java homônimo é só o resultado [web/src/api/portaria.ts:10] — deferido: cosmético, sem bug funcional.
- [x] [Review][Defer] Sem limite de tamanho em `codigo` [api/.../dto/ValidarIngressoRequest.java] — deferido: rota exige papel `PORTARIA` autenticado, risco de abuso baixo.
- [x] [Review][Defer] `setUp()` privado chamado à mão em todos os testes em vez de `@BeforeEach` [api/.../PortariaSecurityTest.java:634] — deferido: higiene de teste, sem impacto funcional.
- [x] [Review][Defer] Caminho `IngressoEmDisputaException` nunca é realmente disparado — o teste de controller lança a exceção já traduzida e o de concorrência não estoura o `lock_timeout` de 3s — deferido, exigiria fixture de lock artificial

**Verificação empírica desta rodada:** `./mvnw test` verde (inclui os 2 cenários de concorrência);
`npx tsc --noEmit` limpo; `npm run build` ok; `npm test` **127/127** em 18 arquivos.

**O que se sustentou no review:** o lock pessimista de AC8 é real — remover `@Lock(PESSIMISTIC_WRITE)`
faz o teste falhar. Ordem AD-8 (assinatura antes do banco) preservada e asseverada. AD-9 se sustenta:
`Ingresso.validar()` tem exatamente um chamador. Matriz 401/403 completa nos três endpoints × dois
papéis errados. Nenhum vazamento de campo sensível, nenhuma regra de negócio no controller.
