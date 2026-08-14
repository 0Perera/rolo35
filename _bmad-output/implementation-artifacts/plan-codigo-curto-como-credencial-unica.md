# Código curto como credencial única — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O código curto de 8 caracteres passa a ser a credencial única do ingresso — QR, portaria e botão copiar; o código assinado por HMAC sobrevive apenas como token do link público.

**Architecture:** `POST /api/portaria/validacoes` deixa de aceitar dois formatos e passa a aceitar só o código curto normalizado, sob o mesmo lock pessimista de hoje. O código assinado sai de todos os DTOs de leitura e passa a ser cunhado sob demanda por uma rota nova e autenticada, `GET /api/ingressos/{id}/link`, que confere dono. O front resolve esse link na montagem do canhoto — nunca no clique — para manter o handler de clipboard síncrono.

**Tech Stack:** Spring Boot 3 + Spring Security + JPA/Hibernate + Flyway + Postgres; JUnit 5 + Mockito + AssertJ. React 19 + React Router + TypeScript + Tailwind v4; Vitest + Testing Library. `qrcode.react` no canhoto, `qr-scanner` na portaria.

**Spec:** [`spec-codigo-curto-como-credencial-unica.md`](spec-codigo-curto-como-credencial-unica.md)

## Global Constraints

- `GET /api/ingressos/{codigo}` continua recebendo o código **assinado** e continua chamando `extrairId()` + `validar()` **antes** de qualquer consulta ao repositório. AD-8 preservado nesta rota, sem exceção.
- Ingresso inexistente, ingresso de outro dono e assinatura adulterada devolvem **a mesma** resposta. Nenhuma rota pode virar oráculo de existência.
- Nenhum código no formato `uuid.assinatura` pode aparecer em tela, em DTO de listagem, ou ser aceito pela portaria.
- Alfabeto do código curto: Base32 Crockford `0123456789ABCDEFGHJKMNPQRSTVWXYZ` — sem `I`, `L`, `O`, `U`. Tamanho fixo 8. Não mudar nenhum dos dois.
- Nunca editar `V11__codigo_curto_ingresso.sql`: já aplicada, e alterá-la quebra o checksum do Flyway em banco local existente.
- Handoff visual inalterado: VT323 (`font-mono`), bordas `#171219`, tracejado `#C7B694`, foco ciano global.
- Sem compatibilidade retroativa. Nada foi publicado; QRs antigos param de valer por decisão explícita.
- Comentários e javadocs em português, no tom do repositório: explicam **por quê**, não o que a linha já diz.

**Aviso de ordem:** o back-end fica coerente ao fim da Task 4 e o front ao fim da Task 7. Entre a Task 2 e a Task 7 a aplicação **não roda de ponta a ponta** — cada task mantém sua própria suíte verde, mas não faça deploy no meio da sequência.

---

### Task 1: Portaria aceita somente o código curto

**Files:**
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java:134-166`
- Test: `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceValidacaoTest.java`

**Interfaces:**
- Consumes: `CodigoIngressoService.normalizarCodigoCurto(String): Optional<String>` e `IngressoRepository.findByCodigoCurtoForUpdate(String): Optional<Ingresso>` — ambos já existem, sem mudança.
- Produces: `PortariaService.validar(String, String): ValidacaoIngressoDto` com contrato novo — código assinado agora devolve `ResultadoValidacao.INVALIDO`.

- [ ] **Step 1: Escrever o teste que falha**

Em `PortariaServiceValidacaoTest`, adicionar a constante e o teste novo.

Atenção ao desenho do teste: **não basta** stubar só `normalizarCodigoCurto` devolvendo vazio. Com o serviço atual, `extrairId` não stubado devolveria `Optional.empty()` (padrão do Mockito para `Optional`), o resultado sairia `INVALIDO` por acidente e o teste nasceria verde sem provar nada. Para ficar genuinamente vermelho, o teste precisa montar um código assinado que **hoje validaria** — assinatura conferida, ingresso encontrado, sessão certa — e exigir `INVALIDO` mesmo assim:

```java
    private static final String CODIGO_ASSINADO =
            "3f2a1b4c-1111-2222-3333-444455556666.YWJjZGVmZ2hpamtsbW5vcHFy";

    // A mudança que este arquivo inteiro existe pra fixar: o código assinado deixou de ser
    // credencial de portaria. Ele continua sendo o token do link público — só não abre mais a porta.
    // Os stubs de extrairId/validar/findByIdForUpdate montam o cenário que ANTES dava VALIDO; é o
    // que faz este teste nascer vermelho em vez de passar por acidente.
    @Test
    void codigoAssinadoRetornaInvalido() {
        setUp();
        stubSessaoAtiva();
        UUID id = UUID.fromString("3f2a1b4c-1111-2222-3333-444455556666");
        given(codigoIngressoService.extrairId(CODIGO_ASSINADO)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, CODIGO_ASSINADO)).willReturn(true);
        given(ingressoRepository.findByIdForUpdate(id))
                .willReturn(Optional.of(ingresso(id, SESSAO_ATIVA_ID, StatusIngresso.VALIDO)));
        given(codigoIngressoService.normalizarCodigoCurto(CODIGO_ASSINADO)).willReturn(Optional.empty());

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO_ASSINADO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.INVALIDO);
        verify(ingressoRepository, never()).save(any());
    }
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `./mvnw -f api/pom.xml test -Dtest=PortariaServiceValidacaoTest#codigoAssinadoRetornaInvalido`
Expected: FAIL — `expected: INVALIDO but was: VALIDO`. Se vier qualquer outro erro, o cenário não foi montado direito; corrija antes de seguir.

Depois do Step 3, este mesmo teste passará a acusar `UnnecessaryStubbingException` nos stubs de `extrairId`, `validar` e `findByIdForUpdate` — o serviço não os chama mais. Removê-los é parte do Step 4, e a exceção é o sinal de que a mudança pegou.

- [ ] **Step 3: Reescrever `localizar()`**

Substituir o método inteiro (`:134-166`) e seu javadoc:

```java
    /**
     * Resolve o texto lido — QR ou digitado — no ingresso correspondente, ou {@code null}.
     *
     * <p>Um formato só: o código curto. O QR carrega exatamente o que o operador digitaria, então a
     * câmera e o teclado convergem antes de chegar aqui. O código assinado por HMAC deixou de ser
     * credencial de portaria — sobrou como token do link público, que é a única superfície sem
     * autenticação e a única que ainda precisa de assinatura.
     *
     * <p>Todos os motivos de falha (formato recusado, código inexistente) devolvem {@code null} e
     * viram o mesmo {@code INVALIDO}, pelo mesmo raciocínio já registrado na Story 5.2: a resposta
     * não pode virar oráculo de quais códigos existem.
     */
    private Ingresso localizar(String codigo) {
        Optional<String> codigoCurto = codigoIngressoService.normalizarCodigoCurto(codigo);
        if (codigoCurto.isEmpty()) {
            return null;
        }

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        try {
            return codigoCurto.flatMap(ingressoRepository::findByCodigoCurtoForUpdate).orElse(null);
        } catch (PessimisticLockingFailureException e) {
            throw new IngressoEmDisputaException();
        }
    }
```

Remover o import `java.util.UUID` (`:32`) — depois desta mudança `PortariaService` não usa mais `UUID` em lugar nenhum.

- [ ] **Step 4: Ajustar os testes que exercitavam o caminho assinado**

Cinco testes hoje stubam `extrairId`/`validar`. Com o serviço não os chamando mais, o Mockito strict-stubs falha com `UnnecessaryStubbingException` — é exatamente o alarme que queremos. Converter cada um para o caminho do código curto:

- `assinaturaValidaMasIngressoNaoEncontradoRetornaInvalido` → renomear para `codigoCurtoInexistenteRetornaInvalido` e **remover**, porque já existe um teste com esse nome e esse comportamento (`:196-207`).
- `sessaoDiferenteRetornaEventoErradoSemSalvar` → já existe o equivalente curto em `codigoCurtoDeOutraSessaoRetornaEventoErrado` (`:179-193`); remover o assinado, mas **antes** mover para o teste curto as asserções que só o assinado tinha: `assertThat(dto.assentoFileira()).isEqualTo("A")` e `assertThat(dto.sessaoTitulo()).isEqualTo("Clube da Luta")`.
- `ingressoValidoMudaParaUtilizadoESalva` → equivalente curto já existe em `codigoCurtoValidoMudaParaUtilizadoESalva` (`:159-175`); remover o assinado.
- `jaUtilizadoRetornaJaUtilizadoSemSalvarDeNovo` → **manter**, convertido para o caminho curto:

```java
    @Test
    void jaUtilizadoRetornaJaUtilizadoSemSalvarDeNovo() {
        setUp();
        stubSessaoAtiva();
        stubLockTimeout();
        given(codigoIngressoService.normalizarCodigoCurto(CODIGO_CURTO)).willReturn(Optional.of(CODIGO_CURTO));
        Ingresso ingresso = ingresso(UUID.randomUUID(), SESSAO_ATIVA_ID, StatusIngresso.UTILIZADO);
        given(ingressoRepository.findByCodigoCurtoForUpdate(CODIGO_CURTO)).willReturn(Optional.of(ingresso));
        given(assentoRepository.findById(1L)).willReturn(Optional.of(assento(1L, "A", 1)));

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO_CURTO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.JA_UTILIZADO);
        verify(ingressoRepository, never()).save(any());
    }
```

- `assinaturaInvalidaRetornaInvalido` → substituído pelo `codigoAssinadoRetornaInvalido` do Step 1; remover.
- `codigoMalformadoRetornaInvalidoSemConsultarBanco` (`:143-154`) → remover só a linha `given(codigoIngressoService.extrairId(CODIGO))...`; o resto vale igual.
- `codigoAssinadoRetornaInvalido` (o do Step 1) → remover os três stubs que existiam só para montar o cenário vermelho, deixando:

```java
    @Test
    void codigoAssinadoRetornaInvalido() {
        setUp();
        stubSessaoAtiva();
        given(codigoIngressoService.normalizarCodigoCurto(CODIGO_ASSINADO)).willReturn(Optional.empty());

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO_ASSINADO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.INVALIDO);
        verify(ingressoRepository, never()).findByIdForUpdate(any());
        verify(ingressoRepository, never()).findByCodigoCurtoForUpdate(any());
    }
```

Nos quatro testes de código curto que sobrevivem, remover também as linhas `given(codigoIngressoService.extrairId(CODIGO_CURTO)).willReturn(Optional.empty());` (`:164`, `:183`, `:200`) — mesmo motivo.

- [ ] **Step 5: Rodar a suíte da portaria**

Run: `./mvnw -f api/pom.xml test -Dtest='Portaria*'`
Expected: PASS, sem `UnnecessaryStubbingException`.

- [ ] **Step 6: Migrar o teste de concorrência**

`PortariaValidacaoConcorrenciaTest` prova o invariante de não-validação-dupla contra Postgres real. Com a mudança, o lock passa a ser adquirido por `findByCodigoCurtoForUpdate()` — caminho que antes só a digitação manual exercitava, e que agora carrega o invariante inteiro.

Substituir `:157-159`:

```java
        Ingresso ingressoEmitido = ingressoRepository.findByReservaId(reservaCriada.id()).get(0);
        UUID ingressoId = ingressoEmitido.getId();
        // O código curto vem da coluna preenchida na emissão — é literalmente o que o QR carrega e
        // o que o operador digitaria. Disputar por ele é disputar pelo caminho real.
        String codigo = ingressoEmitido.getCodigoCurto();
```

Com isso o campo `@Autowired private CodigoIngressoService codigoIngressoService;` (`:69-70`) fica sem uso — remover o campo e o import `br.com.rolo35.api.ingressos.service.CodigoIngressoService` (`:10`). O resto do teste, incluindo a asserção `containsExactlyInAnyOrder(VALIDO, JA_UTILIZADO)`, fica intacto.

Run: `./mvnw -f api/pom.xml test -Dtest=PortariaValidacaoConcorrenciaTest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java \
        api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceValidacaoTest.java \
        api/src/test/java/br/com/rolo35/api/ingressos/PortariaValidacaoConcorrenciaTest.java
git commit -m "feat(api): portaria valida somente pelo código curto"
```

---

### Task 2: Código assinado sai dos DTOs de leitura

**Files:**
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/service/CodigoIngressoService.java:40-42`
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/dto/IngressoResumoDto.java:16`
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java:43-58`
- Modify: `api/src/main/java/br/com/rolo35/api/pagamentos/dto/IngressoDto.java`
- Modify: `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java:135-141`
- Test: `api/src/test/java/br/com/rolo35/api/ingressos/service/IngressoServiceTest.java`, `api/src/test/java/br/com/rolo35/api/pagamentos/service/PagamentoServiceTest.java`, `api/src/test/java/br/com/rolo35/api/pagamentos/controller/PagamentoControllerTest.java`

**Interfaces:**
- Consumes: nada da Task 1.
- Produces: `CodigoIngressoService.gerarTokenDeLink(UUID): String` (renome de `gerar`); `IngressoResumoDto(UUID, StatusIngresso, String, Integer, String, String, String, LocalDateTime, String codigoCurto)` — 9 campos, `codigo` removido; `IngressoDto(UUID id, Long assentoId, String codigoCurto)` — 3 campos.

- [ ] **Step 1: Escrever o teste que falha**

Em `IngressoServiceTest`, um teste que fixa a ausência do campo por reflexão — o mesmo padrão de `dtoNaoExpoeCampoDeCliente` que já existe em `PortariaServiceValidacaoTest:300-312`:

```java
    // A carteira é paginada e o código assinado era computado por linha: uma HMAC por ingresso, a
    // cada abertura da tela, para um valor que ninguém usava ali. Este teste impede a volta dele.
    @Test
    void resumoNaoExpoeCodigoAssinado() {
        for (Field field : IngressoResumoDto.class.getDeclaredFields()) {
            assertThat(field.getName()).isNotEqualTo("codigo");
        }
    }
```

Import necessário: `java.lang.reflect.Field`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `./mvnw -f api/pom.xml test -Dtest=IngressoServiceTest#resumoNaoExpoeCodigoAssinado`
Expected: FAIL — `expected: not equal but was: "codigo"`

- [ ] **Step 3: Renomear `gerar()` e limpar os DTOs**

Em `CodigoIngressoService`, o renome carrega a intenção nova:

```java
    /**
     * Token do link público: {@code uuid.assinatura}. Não é mais credencial de portaria — a
     * validação usa o código curto. Isto aqui existe por causa de {@code GET /api/ingressos/{codigo}},
     * que é a única rota sem autenticação do sistema e a única que precisa provar, sem consultar o
     * banco, que o identificador recebido foi emitido por nós.
     */
    public String gerarTokenDeLink(UUID id) {
        return id + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(assinar(id));
    }
```

Ainda em `CodigoIngressoService`, corrigir o javadoc de `gerarCodigoCurto()` (`:44-54`): a frase final — "vale só em `POST /api/portaria/validacoes`, que exige token de portaria (...). O QR, o link público e a leitura por câmera continuam usando exclusivamente o código assinado" — ficou falsa. Substituir o parágrafo por:

```java
     * <p>São 40 bits de {@link SecureRandom}, não um prefixo do UUID nem um contador: prefixo de id
     * vaza ordem de emissão e contador seria adivinhável de fora. É a credencial única da portaria —
     * QR, câmera e digitação convergem nele. Os 40 bits bastam porque
     * {@code POST /api/portaria/validacoes} exige token de papel {@code PORTARIA}: força bruta aqui
     * pressupõe conta de operador comprometida, cenário em que uma assinatura não protegeria nada,
     * já que o operador vê os ingressos que valida.
```

`IngressoResumoDto`: remover a linha `String codigo,` (`:16`).

`IngressoService.listarMinhas()`: remover `codigoIngressoService.gerar(p.getId()),` da construção do DTO, e reescrever o javadoc (`:43-47`), que descrevia um custo que deixou de existir:

```java
    /**
     * Carteira paginada. Nenhuma assinatura é computada aqui: o token do link público é cunhado sob
     * demanda em {@code GET /api/ingressos/{id}/link}, no único momento em que é usado. Antes era
     * uma HMAC por linha devolvida, custo que crescia com o histórico do cliente.
     */
```

`IngressoDto`: registro e javadoc novos:

```java
/**
 * @param codigoCurto credencial do ingresso: é o que o QR carrega, o que a portaria aceita e o que o
 *     cliente dita na fila quando a câmera não lê. Vem aqui porque é na resposta do pagamento que o
 *     cliente recebe o canhoto — a carteira devolve o mesmo campo, por linha.
 */
public record IngressoDto(UUID id, Long assentoId, String codigoCurto) {}
```

`PagamentoService.paraDto()`:

```java
    private List<IngressoDto> paraDto(List<Ingresso> ingressos) {
        return ingressos.stream()
                .map(ingresso -> new IngressoDto(ingresso.getId(), ingresso.getAssentoId(), ingresso.getCodigoCurto()))
                .toList();
    }
```

`PagamentoService` deixa de usar `codigoIngressoService.gerar()`, mas **mantém** o campo injetado — `gerarCodigoCurto()` continua sendo chamado na emissão (`:109`). Não remover a dependência.

- [ ] **Step 4: Ajustar os testes existentes**

`IngressoServiceTest`:
- `:130` — remover `given(codigoIngressoService.gerar(ingressoId)).willReturn("codigo-gerado");`
- `:136` — remover `assertThat(resultado.conteudo().get(0).codigo()).isEqualTo("codigo-gerado");`
- `:142-143` — o comentário do teto de página diz que sem ele `tamanho=1000000` "faria a carteira **assinar** o histórico inteiro". Não assina mais nada; o teto continua valendo por outro motivo:

```java
    // Teto de servidor: sem ele, `tamanho=1000000` faria a carteira carregar o histórico inteiro
    // numa consulta só, com quatro JOINs — o custo que a paginação existe pra evitar.
```

`PagamentoServiceTest`: remover as três linhas `given(codigoIngressoService.gerar(any(UUID.class))).willReturn("codigo-gerado");` (`:140`, `:166`, `:356`). Com strict stubs elas quebrariam a suíte assim que `paraDto()` parar de assinar. Nas asserções sobre os ingressos emitidos, trocar `codigo()` por `codigoCurto()`.

`PagamentoControllerTest`: mesma troca nas asserções de corpo JSON — o campo `codigo` some da resposta de emissão.

- [ ] **Step 5: Rodar a suíte inteira do back**

Run: `./mvnw -f api/pom.xml test`
Expected: PASS. O compilador aponta cada construção de DTO desatualizada — trate os erros de compilação como a lista de trabalho deste passo.

- [ ] **Step 6: Commit**

```bash
git add api/src/main/java api/src/test/java
git commit -m "refactor(api): código assinado sai dos DTOs de leitura"
```

---

### Task 3: Página pública devolve o código curto

**Files:**
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/dto/IngressoPublicoDto.java`
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java:60-72`
- Test: `api/src/test/java/br/com/rolo35/api/ingressos/service/IngressoServiceTest.java:196-225`
- Test: `api/src/test/java/br/com/rolo35/api/ingressos/IngressoSecurityTest.java:80`

**Interfaces:**
- Consumes: `CodigoIngressoService.extrairId()`/`validar()` — inalterados.
- Produces: `IngressoPublicoDto(String sessaoTitulo, String salaNome, LocalDateTime dataHora, StatusIngresso status, String codigoCurto)` — 5 campos.

- [ ] **Step 1: Escrever o teste que falha**

Estender `buscarPublicoComAssinaturaEIngressoValidosDevolveDtoSemDadoDoCliente` (`:196-225`), que já monta sessão, sala e ingresso. Trocar o `codigoCurtoDeTeste()` aleatório por um valor fixo (`:203`), para poder afirmar sobre ele:

```java
        Ingresso ingresso = new Ingresso(id, 50L, 10L, 1L, "SB68XVZG", StatusIngresso.VALIDO, null, Instant.now());
```

e acrescentar ao fim das asserções:

```java
        // Quem recebeu o link compartilhado é quem vai entrar na sala: sem o código curto a página
        // pública não tem o que pôr no QR, e o ingresso compartilhado não abre porta nenhuma. Não é
        // vazamento novo — o próprio link já carrega a credencial de validação na URL.
        assertThat(dto.codigoCurto()).isEqualTo("SB68XVZG");
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `./mvnw -f api/pom.xml test -Dtest=IngressoServiceTest`
Expected: FAIL — não compila, `IngressoPublicoDto` não tem `codigoCurto()`

- [ ] **Step 3: Implementar**

```java
/**
 * @param codigoCurto credencial de entrada. Está aqui porque o link público é o caminho de
 *     compartilhar o ingresso com quem vai usá-lo, e sem este campo a página não renderiza QR nenhum.
 *     Continua sem nada do comprador — o que a rota nunca expôs, segue sem expor.
 */
public record IngressoPublicoDto(
        String sessaoTitulo, String salaNome, LocalDateTime dataHora, StatusIngresso status, String codigoCurto) {}
```

Em `buscarPublico()`, acrescentar o campo ao `return`, sem tocar na ordem das checagens — a validação de assinatura continua **antes** de `ingressoRepository.findById()`:

```java
        return new IngressoPublicoDto(
                sessao.getTitulo(), sala.getNome(), sessao.getDataHora(), ingresso.getStatus(),
                ingresso.getCodigoCurto());
```

- [ ] **Step 4: Corrigir o outro construtor do DTO**

`IngressoSecurityTest:80` monta um `IngressoPublicoDto` de fixture com 4 argumentos e passa a não compilar:

```java
        given(ingressoService.buscarPublico(anyString()))
                .willReturn(new IngressoPublicoDto(
                        "Sessão fixture", "Sala 1", LocalDateTime.now().plusDays(1), null, "SB68XVZG"));
```

- [ ] **Step 5: Rodar**

Run: `./mvnw -f api/pom.xml test -Dtest='IngressoServiceTest,IngressoSecurityTest'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/main/java/br/com/rolo35/api/ingressos api/src/test/java/br/com/rolo35/api/ingressos
git commit -m "feat(api): página pública devolve o código curto pro QR"
```

---

### Task 4: Rota do token de link, com checagem de dono

**Files:**
- Create: `api/src/main/java/br/com/rolo35/api/ingressos/dto/LinkIngressoDto.java`
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/repository/IngressoRepository.java`
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java`
- Modify: `api/src/main/java/br/com/rolo35/api/ingressos/controller/IngressoController.java:40-43`
- Modify: `api/src/main/java/br/com/rolo35/api/config/SecurityConfig.java:77-85`
- Test: `api/src/test/java/br/com/rolo35/api/ingressos/service/IngressoServiceTest.java`, `api/src/test/java/br/com/rolo35/api/ingressos/IngressoSecurityTest.java`

**Interfaces:**
- Consumes: `CodigoIngressoService.gerarTokenDeLink(UUID)` da Task 2.
- Produces: `GET /api/ingressos/{id}/link` → `200 {"codigo": "<uuid>.<assinatura>"}`; `IngressoService.tokenDeLink(String clienteEmail, UUID ingressoId): LinkIngressoDto`; `IngressoRepository.buscarIdDoDono(UUID, Long): Optional<UUID>`.

- [ ] **Step 1: Escrever os testes que falham**

Em `IngressoServiceTest`, reusando o helper `stubCliente()` que o arquivo já tem (`:76-81`). Do lado do repositório, "não é seu" e "não existe" produzem o **mesmo** `Optional.empty()`, e é por isso que os dois testes ficam idênticos exceto pelo nome — a indistinguibilidade é o requisito, não um acaso:

```java
    @Test
    void tokenDeLinkDoProprioIngressoEhCunhado() {
        setUp();
        stubCliente();
        UUID id = UUID.randomUUID();
        given(ingressoRepository.buscarIdDoDono(id, CLIENTE_ID)).willReturn(Optional.of(id));
        given(codigoIngressoService.gerarTokenDeLink(id)).willReturn(id + ".assinado");

        assertThat(ingressoService.tokenDeLink(CLIENTE_EMAIL, id).codigo()).isEqualTo(id + ".assinado");
    }

    // Os dois testes abaixo provam a mesma coisa por dois caminhos, e é essa duplicação aparente que
    // documenta o requisito: a rota não diferencia "não é seu" de "não existe". Diferenciar
    // transformaria ela num oráculo pra descobrir, por tentativa, se um id de ingresso é real — e o
    // token que ela cunha é credencial de leitura de uma rota pública, então o dono é a única
    // barreira que existe.
    @Test
    void tokenDeLinkDeIngressoAlheioNaoEhCunhado() {
        setUp();
        stubCliente();
        UUID id = UUID.randomUUID();
        given(ingressoRepository.buscarIdDoDono(id, CLIENTE_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> ingressoService.tokenDeLink(CLIENTE_EMAIL, id))
                .isInstanceOf(IngressoNaoEncontradoException.class);
        verify(codigoIngressoService, never()).gerarTokenDeLink(any());
    }

    @Test
    void tokenDeLinkDeIngressoInexistenteFalhaIgualAoAlheio() {
        setUp();
        stubCliente();
        UUID id = UUID.randomUUID();
        given(ingressoRepository.buscarIdDoDono(id, CLIENTE_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> ingressoService.tokenDeLink(CLIENTE_EMAIL, id))
                .isInstanceOf(IngressoNaoEncontradoException.class);
    }
```

E em `IngressoSecurityTest`, o caso sem token, no formato dos vizinhos (`:49-54`) — o corpo de erro é conferido, não só o status:

```java
    @Test
    void linkDoIngressoReturns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/ingressos/" + UUID.randomUUID() + "/link"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }
```

Import novo no arquivo: `java.util.UUID`.

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `./mvnw -f api/pom.xml test -Dtest='IngressoServiceTest,IngressoSecurityTest'`
Expected: FAIL — não compila (`tokenDeLink` e `buscarIdDoDono` não existem)

- [ ] **Step 3: Implementar o DTO e a query**

`LinkIngressoDto.java`:

```java
package br.com.rolo35.api.ingressos.dto;

/**
 * Token do link público, devolvido sozinho e sob demanda. É o formato {@code uuid.assinatura} — a
 * URL em si é montada no front, num lugar só ({@code web/src/lib/ingressos.ts}), para que o link do
 * botão de compartilhar e o da página pública nunca divirjam.
 */
public record LinkIngressoDto(String codigo) {}
```

Em `IngressoRepository`:

```java
    /**
     * Id do ingresso, se e somente se ele pertence a este cliente. Devolver {@link Optional#empty()}
     * para "não existe" e para "não é seu" é proposital: é a única forma de a rota que consome isto
     * não virar oráculo de ids válidos.
     */
    @Query("""
            SELECT i.id
            FROM Ingresso i
            JOIN Reserva r ON r.id = i.reservaId
            WHERE i.id = :id AND r.clienteId = :clienteId
            """)
    Optional<UUID> buscarIdDoDono(@Param("id") UUID id, @Param("clienteId") Long clienteId);
```

- [ ] **Step 4: Implementar o serviço e o controller**

Em `IngressoService`:

```java
    /**
     * Token do link público de um ingresso do próprio cliente.
     *
     * <p>É a única superfície que ainda cunha assinatura HMAC, e por isso a única que ainda precisa
     * conferir dono: o token é credencial de leitura de uma rota sem autenticação, então cunhar um
     * para ingresso alheio equivale a entregar o ingresso.
     */
    public LinkIngressoDto tokenDeLink(String clienteEmail, UUID ingressoId) {
        Usuario cliente =
                usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);
        UUID id = ingressoRepository
                .buscarIdDoDono(ingressoId, cliente.getId())
                .orElseThrow(IngressoNaoEncontradoException::new);
        return new LinkIngressoDto(codigoIngressoService.gerarTokenDeLink(id));
    }
```

Em `IngressoController`, antes de `buscarPublico()`. A ordem aqui é só organização — `/{id}/link` tem dois segmentos e `/{codigo}` tem um, então o Spring MVC não tem ambiguidade para resolver (diferente do `SecurityConfig` do passo seguinte, onde a ordem decide de verdade):

```java
    /**
     * Token do link de compartilhamento, cunhado sob demanda. Fora da listagem de propósito: mantê-lo
     * no DTO da carteira significaria assinar cada linha de cada página para um valor que só é usado
     * quando o cliente clica em compartilhar.
     */
    @GetMapping("/{id}/link")
    @PreAuthorize("hasRole('CLIENTE')")
    public ResponseEntity<LinkIngressoDto> link(Authentication authentication, @PathVariable UUID id) {
        return ResponseEntity.ok(ingressoService.tokenDeLink(authentication.getName(), id));
    }
```

- [ ] **Step 5: Declarar a rota no `SecurityConfig`**

Inserir antes do `permitAll` de `/api/ingressos/*` (`:84`):

```java
                        // /{id}/link cunha o token assinado do link público. Não casa o wildcard de
                        // um segmento logo abaixo — `*` casa um segmento só — então já cairia no
                        // anyRequest().authenticated(). Declarada mesmo assim: proteção vinda de
                        // fallback é frágil demais numa rota que emite credencial, e o teste em
                        // IngressoSecurityTest fixa isso.
                        .requestMatchers(HttpMethod.GET, "/api/ingressos/*/link")
                        .authenticated()
```

- [ ] **Step 6: Rodar**

Run: `./mvnw -f api/pom.xml test`
Expected: PASS — back-end coerente a partir daqui.

- [ ] **Step 7: Commit**

```bash
git add api/src
git commit -m "feat(api): rota do token de link com checagem de dono"
```

---

### Task 5: Contrato do front e resolução do link

**Files:**
- Modify: `web/src/api/ingressos.ts:4-23`
- Modify: `web/src/api/pagamentos.ts:5-11`
- Create: `web/src/lib/useLinkDoIngresso.ts`
- Modify: `web/src/lib/ingressos.ts:1-8`

**Interfaces:**
- Consumes: `GET /api/ingressos/{id}/link` da Task 4.
- Produces: `buscarLinkDoIngresso(id: string): Promise<{ codigo: string }>`; `useLinkDoIngresso(ingressoId: string): string | null`; `IngressoResumo` sem `codigo`; `IngressoPublico` com `codigoCurto`; `IngressoEmitido` sem `codigo`.

- [ ] **Step 1: Ajustar os tipos**

Em `web/src/api/ingressos.ts`, remover `codigo` de `IngressoResumo`, acrescentar `codigoCurto` a `IngressoPublico`, e adicionar:

```ts
export interface LinkIngresso {
  /** Token assinado `uuid.assinatura`. A URL é montada por `urlPublicaDoIngresso`. */
  codigo: string;
}

/** Cunha o token do link público. Só o dono do ingresso recebe 200. */
export function buscarLinkDoIngresso(id: string): Promise<LinkIngresso> {
  return apiFetch<LinkIngresso>(`/api/ingressos/${id}/link`);
}
```

Em `web/src/api/pagamentos.ts`, remover `codigo` de `IngressoEmitido` e atualizar o comentário de `codigoCurto`, que hoje diz "pra ditar na portaria quando a câmera não lê" — virou a credencial única, não o plano B:

```ts
export interface IngressoEmitido {
  id: string;
  assentoId: number;
  /** Credencial do ingresso: vai no QR, vale na portaria, e dá pra ditar na fila. */
  codigoCurto: string;
}
```

- [ ] **Step 2: Escrever o hook**

`web/src/lib/useLinkDoIngresso.ts`:

```ts
import { useEffect, useState } from 'react';
import { buscarLinkDoIngresso } from '../api/ingressos';
import { urlPublicaDoIngresso } from './ingressos';

/**
 * Resolve o link público de um ingresso quando o canhoto monta, não quando o botão é clicado.
 *
 * A diferença não é estética: o WebKit exige que a escrita no clipboard aconteça na mesma tarefa do
 * gesto do usuário. Um handler `async` que busca o link e só então copia perde a permissão implícita
 * no `await`, e a cópia falha calada — o botão pisca "copiado" no iPhone sem ter copiado nada.
 */
export function useLinkDoIngresso(ingressoId: string): string | null {
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarLinkDoIngresso(ingressoId)
      .then((resposta) => {
        if (ativo) {
          setLink(urlPublicaDoIngresso(resposta.codigo));
        }
      })
      .catch(() => {
        // Silêncio proposital: sem link o botão de compartilhar fica desabilitado, e o resto do
        // canhoto — QR e código curto, que é o que faz o cliente entrar na sala — segue de pé.
      });
    return () => {
      ativo = false;
    };
  }, [ingressoId]);

  return link;
}
```

- [ ] **Step 3: Corrigir o comentário de `lib/ingressos.ts`**

O comentário atual (`:1-5`) diz que a URL é "o que o botão de compartilhar copia e **o que o QR carrega**". A segunda metade ficou falsa:

```ts
/**
 * Link público do ingresso — é o que o botão de compartilhar copia, e nada além disso. O QR **não**
 * carrega URL: ele carrega o código curto, que é a credencial que a portaria valida. Mora no `lib`
 * porque a carteira e a página pública precisam gerar exatamente a mesma URL.
 */
```

- [ ] **Step 4: Verificar a compilação**

Run: `npm run build --prefix web`
Expected: FAIL, com erros apontando cada uso de `ingresso.codigo` nos componentes — essa lista é o roteiro das Tasks 6 e 7.

- [ ] **Step 5: Commit**

```bash
git add web/src/api web/src/lib
git commit -m "feat(web): contrato do link público sob demanda"
```

---

### Task 6: QR carrega o código curto

**Files:**
- Modify: `web/src/components/CanhotoIngresso.tsx:4-17,42-59`
- Modify: `web/src/components/AcoesDoIngresso.tsx`

**Interfaces:**
- Consumes: `useLinkDoIngresso` da Task 5 (usado pelos chamadores, não por estes componentes).
- Produces: `CanhotoIngresso({ codigoCurto: string, children: ReactNode })`; `AcoesDoIngresso({ codigoCurto: string, linkPublico: string | null, className?: string })`.

- [ ] **Step 1: Reescrever `CanhotoIngresso`**

A prop `codigo` some e `codigoCurto` deixa de ser opcional — a página pública agora também o recebe:

```tsx
interface CanhotoIngressoProps {
  /**
   * Credencial do ingresso: 8 caracteres Base32 Crockford. É o que o QR carrega e o que
   * `POST /api/portaria/validacoes` espera. Não é o link público — a portaria escaneia pra validar,
   * não pra abrir página; compartilhar é outro caminho, pelo botão de link.
   */
  codigoCurto: string;
  children: ReactNode;
}
```

No corpo, `<QRCodeSVG value={codigoCurto} ... />`, e o bloco `{codigoCurto && (...)}` (`:54-59`) perde a guarda, virando renderização incondicional. Ajustar também o comentário acima dele (`:52-53`), que chama o código curto de "plano B da câmera": agora câmera e digitação leem o mesmo valor, e o corpo grande existe porque quem está na fila dita ele em voz alta.

Manter `marginSize={4}`: a zona de silêncio continua obrigatória dentro do próprio SVG, e a borda amarela do handoff segue sendo decoração (nota da Story 4.2, `docs/decisions.md`).

Sobre `size={196}`: o payload cai de ~80 caracteres para 8, então o QR desce de uma versão alta para uma bem baixa — muito menos módulos, cada um muito maior no mesmo lado de 196px. **Manter os 196px.** O `size` casa com a base de 270px do painel escuro (`:37`, comentada como "196px de código + moldura + padding"); mudar o número quebraria esse cálculo e faria o QR estourar o painel nas larguras intermediárias. Módulo maior no mesmo espaço é ganho de leitura em tela riscada ou com brilho baixo — exatamente o cenário que motivou o código curto existir.

- [ ] **Step 2: Reescrever `AcoesDoIngresso`**

```tsx
interface AcoesDoIngressoProps {
  codigoCurto: string;
  /** `null` enquanto o link não foi resolvido, ou se a busca falhou. */
  linkPublico: string | null;
  className?: string;
}
```

O javadoc do componente (`:22-33`) precisa de reescrita: a justificativa atual do botão de copiar — "selecionar `uuid.assinatura` com o dedo é inviável: uma palavra só, longa" — morreu junto com o código longo. O botão sobrevive por outro motivo:

```tsx
/**
 * O rodapé de ações do canhoto: compartilhar o link público e copiar o código do ingresso.
 *
 * <p>São coisas diferentes e trocar uma pela outra quebra o fluxo — link colado no campo da portaria
 * não valida, e código colado no WhatsApp não abre página nenhuma. Daí os dois botões, com o
 * compartilhar em destaque (é a ação frequente).
 *
 * <p>Copiar o código continua valendo mesmo com 8 caracteres: quem manda o código por mensagem
 * digitando à mão troca um caractere e o outro lado chega na portaria com um ingresso que não existe.
 * Os 8 caracteres já evitam I, L, O e U por isso mesmo; copiar fecha o resto do buraco.
 *
 * <p>O link chega pronto por prop, nunca buscado no clique: ver `useLinkDoIngresso`.
 */
```

No corpo, o botão de compartilhar ganha guarda e o de copiar passa a entregar o código curto:

```tsx
      <button
        type="button"
        disabled={linkPublico === null}
        onClick={() => linkPublico && link.copiar(linkPublico)}
        className={buttonClass('ticket', 'disabled:cursor-not-allowed disabled:opacity-50')}
      >
        {ROTULOS_LINK[link.estado]}
      </button>

      <button
        type="button"
        onClick={() => codigoCopia.copiar(codigoCurto)}
        className={buttonClass('ticket', 'bg-none bg-paper-50 text-ink-950 hover:bg-paper-100 hover:text-ink-950')}
      >
        {ROTULOS_CODIGO[codigoCopia.estado]}
      </button>
```

O `<span aria-live="polite">` (`:56-62`) fica exatamente como está.

- [ ] **Step 3: Commit parcial**

Estes dois componentes não compilam sozinhos — os chamadores só são ajustados na Task 7. Commitar mesmo assim mantém o histórico legível; a árvore fica verde no fim da Task 7.

```bash
git add web/src/components/CanhotoIngresso.tsx web/src/components/AcoesDoIngresso.tsx
git commit -m "feat(web): QR do canhoto carrega o código curto"
```

---

### Task 7: Os três canhotos perdem o código longo

**Files:**
- Modify: `web/src/components/CanhotoEmitido.tsx:14-16,48-56`
- Modify: `web/src/pages/MeusIngressosPage.tsx:93-132`
- Modify: `web/src/pages/IngressoPublicoPage.tsx:73-101`
- Test: `web/src/pages/PagamentoPage.test.tsx:107-110`, `web/src/pages/MeusIngressosPage.test.tsx:157`, `web/src/pages/IngressoPublicoPage.test.tsx:77`

**Interfaces:**
- Consumes: `CanhotoIngresso`/`AcoesDoIngresso` da Task 6, `useLinkDoIngresso` da Task 5.
- Produces: nada consumido por tasks seguintes.

- [ ] **Step 1: Inverter as asserções dos testes**

Nos três arquivos, os testes hoje afirmam a presença do texto longo. Substituir por (adaptando o código curto de cada fixture):

```tsx
    // O código assinado não pode aparecer em tela nenhuma: ele é token de link, não credencial de
    // entrada, e imprimir ~80 caracteres num canhoto foi o sintoma que abriu esta mudança.
    expect(screen.queryByText(/CÓDIGO abc-123\.assinatura/)).not.toBeInTheDocument();
    expect(screen.getByText('SB68XVZG')).toBeInTheDocument();
```

**Detalhe que quebra os três arquivos se for esquecido:** `CanhotoEmitido` e `DetalheIngresso` passam a chamar `useLinkDoIngresso`, que dispara `buscarLinkDoIngresso` na montagem. Sem mock, o teste bate no `apiFetch` real. Adicionar em cada suíte que renderiza um desses componentes:

```tsx
    vi.spyOn(ingressosApi, 'buscarLinkDoIngresso').mockResolvedValue({ codigo: 'abc-123.assinatura' });
```

`PagamentoPage.test.tsx` mocka a API de pagamentos, não a de ingressos — conferir se o `import * as ingressosApi from '../api/ingressos';` existe no arquivo e acrescentar se não existir.

`IngressoPublicoPage` **não** precisa disso: lá o link é a própria URL da página.

- [ ] **Step 2: Rodar e confirmar que falham**

Run (a partir de `web/`): `npx vitest run src/pages/PagamentoPage.test.tsx src/pages/MeusIngressosPage.test.tsx src/pages/IngressoPublicoPage.test.tsx`
Expected: FAIL — o texto longo ainda está na tela

- [ ] **Step 3: `CanhotoEmitido`**

```tsx
export function CanhotoEmitido({ ingresso, reserva, rotuloAssento }: CanhotoEmitidoProps) {
  const linkPublico = useLinkDoIngresso(ingresso.id);

  return (
    <CanhotoIngresso codigoCurto={ingresso.codigoCurto}>
```

Remover a linha `CÓDIGO {ingresso.codigo}` e seu comentário `break-all` (`:48-50`). A linha seguinte perde o prefixo `ASSINADO ·`, que descrevia o código removido:

```tsx
      <p className="mt-5 font-mono text-base tracking-wide text-[#9C9488]">
        APRESENTE NA PORTARIA ATÉ 15 MIN ANTES
      </p>
      <AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={linkPublico} className="mt-5" />
```

- [ ] **Step 4: `MeusIngressosPage`**

Em `DetalheIngresso` (`:93`), a mesma troca: `const linkPublico = useLinkDoIngresso(ingresso.id);`, `<CanhotoIngresso codigoCurto={ingresso.codigoCurto}>`, remoção do bloco `:119-123` (comentário `break-all` incluído), `ASSINADO ·` fora, e `<AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={linkPublico} className="mt-5" />`.

- [ ] **Step 5: `IngressoPublicoPage`**

Aqui não há hook: o link compartilhável é a própria URL. E o comentário de `:75-76` ("Nada de compartilhar aqui — quem abriu o link já está nele") contradiz o código desde antes desta mudança, já que `AcoesDoIngresso` sempre teve o botão de compartilhar. Resolver a favor do código e reescrever o comentário — repassar o link recebido é justamente o que quem abriu a página quer fazer:

```tsx
            {/* Página pública: só leitura. O link compartilhável aqui é a própria URL — nada a
                cunhar, e nada de ação de dono. */}
            <CanhotoIngresso codigoCurto={ingresso.codigoCurto}>
```

Remover `:93-95` e o prefixo `ASSINADO ·`; nas ações, `<AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={urlPublicaDoIngresso(codigo)} className="mt-5" />`.

- [ ] **Step 6: Rodar tudo**

Run (a partir de `web/`): `npx vitest run`
Expected: PASS
Run: `npm run build --prefix web`
Expected: `tsc -b` sem erro — zero referências remanescentes a `.codigo`

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat(web): canhoto para de imprimir o código assinado"
```

---

### Task 8: Contrato do QR invertido e dica da portaria

**Files:**
- Modify: `web/src/pages/ContratoQrPortaria.test.tsx`
- Modify: `web/src/pages/ValidacaoPortariaPage.tsx:169-173`

**Interfaces:**
- Consumes: tudo das Tasks 1-7.
- Produces: nada.

- [ ] **Step 1: Reescrever o teste de contrato**

Preservar o javadoc de topo (`:11-22`) inteiro — a história de por que o arquivo existe continua verdadeira, e é o que impede alguém de apagá-lo por parecer redundante. Trocar as constantes, substituir o helper de parsing e reescrever os casos:

```tsx
const CODIGO_CURTO = 'SB68XVZG';
const TOKEN_DE_LINK = '3f2a1b4c-1111-2222-3333-444455556666.YWJjZGVmZ2hpamtsbW5vcHFy';

/**
 * Réplica fiel de `CodigoIngressoService.normalizarCodigoCurto()` (back-end): canoniza caixa,
 * hífen/espaço e as confusões do Crockford (I/L→1, O→0), depois exige 8 caracteres do alfabeto.
 * Se esta função devolve `null`, o servidor devolve INVALIDO — é a regra real, não uma aproximação.
 * Um QR com URL cai aqui, e um QR com `uuid.assinatura` também: os dois passam de 8 caracteres.
 */
function normalizarComoOBackendFaz(codigo: string): string | null {
  const canonico = codigo
    .trim()
    .toUpperCase()
    .replace(/[- ]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(canonico) ? canonico : null;
}
```

`payloadDoQrNoCanhoto()` passa a mockar a resposta pública com o campo novo e a navegar pelo token:

```tsx
  vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockResolvedValue({
    sessaoTitulo: 'Clube da Luta',
    salaNome: 'Sala 1',
    dataHora: '2030-01-01T20:00:00',
    status: 'VALIDO',
    codigoCurto: CODIGO_CURTO,
  });
  render(
    <MemoryRouter initialEntries={[`/ingressos/${TOKEN_DE_LINK}`]}>
```

Os casos:

```tsx
  it('grava no QR o código curto, nunca o token assinado nem o link', async () => {
    const payload = await payloadDoQrNoCanhoto();

    expect(payload).toBe(CODIGO_CURTO);
    expect(payload).not.toMatch(/^https?:\/\//);
    expect(payload).not.toContain('.');
  });

  it('grava um payload que a normalização do back-end aceita', async () => {
    const payload = await payloadDoQrNoCanhoto();

    expect(normalizarComoOBackendFaz(payload)).toBe(CODIGO_CURTO);
  });

  it('rejeitaria um QR que voltasse a carregar o token assinado', () => {
    // A regressão nova que este arquivo passa a vigiar: o token assinado ainda existe no sistema,
    // como credencial do link público. Se ele voltar pro QR, a portaria recusa toda leitura.
    expect(normalizarComoOBackendFaz(TOKEN_DE_LINK)).toBeNull();
  });

  it('rejeitaria um QR que voltasse a carregar a URL pública', () => {
    // A regressão original, que de fato aconteceu uma vez. Continua valendo.
    expect(normalizarComoOBackendFaz(`https://rolo35.vercel.app/ingressos/${TOKEN_DE_LINK}`)).toBeNull();
  });
```

O caso `entrega à API de validação exatamente o payload que o QR carregava` (`:105-127`) fica, trocando a asserção final `extrairIdComoOBackendFaz(...)` por `expect(normalizarComoOBackendFaz(validar.mock.calls[0][0])).toBe(CODIGO_CURTO)`.

- [ ] **Step 2: Rodar**

Run (a partir de `web/`): `npx vitest run src/pages/ContratoQrPortaria.test.tsx`
Expected: PASS

- [ ] **Step 3: Atualizar a dica da portaria**

Em `ValidacaoPortariaPage.tsx:169-173`, o comentário trata o código curto como plano B e a dica oferece dois formatos:

```tsx
            {/* Um formato só, agora: o mesmo que o QR carrega. Dizer o número de caracteres é o que
                permite ao operador perceber erro de digitação antes de mandar. */}
            <p className="mt-1 font-mono text-base tracking-wide text-paper-100/50">
              OS 8 CARACTERES DO CANHOTO
            </p>
```

- [ ] **Step 4: Rodar a suíte do front inteira**

Run (a partir de `web/`): `npx vitest run`
Expected: PASS
Run: `npm run lint --prefix web`
Expected: zero erro

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ContratoQrPortaria.test.tsx web/src/pages/ValidacaoPortariaPage.tsx
git commit -m "test(web): contrato do QR passa a exigir o código curto"
```

---

### Task 9: Documentação

**Files:**
- Modify: `docs/decisions.md`
- Modify: `docs/regras-de-negocio.md:191-218,255,261-264`
- Modify: `README.md` (se houver ocorrências)

**Interfaces:**
- Consumes: tudo.
- Produces: nada.

- [ ] **Step 1: Entrada nova em `decisions.md`**

Acrescentar ao fim, no formato das outras (título com a decisão, bullets **Decisão** e **Por quê**):

```markdown
## O código curto é a credencial única do ingresso; a assinatura HMAC fica só no link público — emenda a AD-8

- **Decisão**: `POST /api/portaria/validacoes` passa a aceitar **exclusivamente** o código curto de 8
  caracteres. O QR do canhoto carrega esse mesmo código. O formato `uuid.assinatura` (AD-8) deixa de
  ser credencial de validação, deixa de aparecer em tela e sai dos DTOs de leitura — sobra como token
  de `GET /api/ingressos/{codigo}`, cunhado sob demanda por `GET /api/ingressos/{id}/link`. Supera a
  emenda "O QR do ingresso carrega o código assinado" (code review do Epic 5).
- **Por quê**: a assinatura protege contra forja de identificador. Isso vale numa rota **sem
  autenticação** — a página pública — onde a checagem antes de tocar o banco é o que impede a rota de
  virar oráculo de existência. Não vale na portaria, que exige token de papel `PORTARIA`: força bruta
  contra os 40 bits do código curto pressupõe conta de operador comprometida, cenário em que o
  operador já vê os ingressos que valida. Manter as duas credenciais custava um código de ~80
  caracteres impresso num canhoto de cinema e um caminho de resolução com dois formatos. Efeito
  colateral: `IngressoService.listarMinhas()` computava uma HMAC por linha da carteira, custo que
  crescia com o histórico do cliente e que desapareceu.
- **Escopo da quebra**: QRs emitidos antes desta mudança param de validar. Aceito sem fallback porque
  nada havia sido publicado — só dado de teste local.
```

- [ ] **Step 2: Corrigir `regras-de-negocio.md`**

Quatro afirmações ficaram falsas. Na seção `Ingressos` (`:191-218`):
- "Código do ingresso é `UUID` + assinatura HMAC-SHA256" → passa a descrever as duas coisas separadas: credencial de entrada é o código curto Base32 Crockford de 8 caracteres com 40 bits de `SecureRandom`; token do link público é `uuid.assinatura`.
- "QR é gerado no front a partir do código assinado" → a partir do código curto.
- "a URL que ele carrega é montada num único lugar" → o QR não carrega URL; a frase sobre `web/src/lib/ingressos.ts` passa a valer só para o botão de compartilhar.
- Acrescentar a regra da rota nova: token de link exige autenticação e dono, e não diferencia "não é seu" de "não existe".

Na seção da portaria (`:255`, `:261-264`):
- "Assinatura HMAC conferida antes de qualquer consulta ou lock" → a checagem antes do lock continua, mas é a normalização do código curto: código fora do formato não chega a segurar linha nenhuma.
- "O QR do ingresso carrega o código assinado" → carrega o código curto; `ContratoQrPortaria.test.tsx` continua sendo a cobertura da travessia.

Referências de linha citadas nesse arquivo (`CodigoIngressoService.gerar`, `:32-34` etc.) mudaram com o renome — conferir cada uma.

- [ ] **Step 3: Varrer o README**

Run: `grep -n -i 'assinatur\|hmac\|uuid\.' README.md`
Expected: se houver ocorrência descrevendo o código do ingresso, corrigir; se não houver, seguir.

- [ ] **Step 4: Commit**

```bash
git add docs README.md
git commit -m "docs: código curto vira credencial única do ingresso"
```

---

## Verificação final

```bash
./mvnw -f api/pom.xml test        # back-end inteiro
npm run lint --prefix web          # zero erro
npm run build --prefix web         # tsc -b sem erro de tipo
```

E, a partir de `web/`, `npx vitest run` — no Windows o script `npm test` falha na sintaxe `NODE_OPTIONS=` inline; exportar a variável antes e chamar o `vitest` direto.

**Conferência manual, com a aplicação de pé:**
1. Comprar um ingresso → o canhoto não mostra nenhum código longo, e mostra os 8 caracteres ao lado do QR.
2. `⧉ COPIAR CÓDIGO` → colar num editor devolve exatamente 8 caracteres.
3. `↗ COMPARTILHAR` → colar devolve `.../ingressos/<uuid>.<assinatura>`; abrir a URL renderiza o canhoto com QR.
4. Portaria, digitando os 8 caracteres → `VALIDO`; repetir → `JA_UTILIZADO`.
5. Portaria, colando a URL compartilhada → `INVALIDO`.
6. Portaria, colando o trecho `uuid.assinatura` da URL → `INVALIDO`. É a quebra intencional desta mudança.
