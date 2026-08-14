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

