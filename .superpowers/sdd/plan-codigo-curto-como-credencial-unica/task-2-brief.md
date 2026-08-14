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

