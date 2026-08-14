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

