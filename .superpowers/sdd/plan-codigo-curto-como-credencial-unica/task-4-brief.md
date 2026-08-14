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

