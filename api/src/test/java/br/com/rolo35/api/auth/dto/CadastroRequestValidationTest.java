package br.com.rolo35.api.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.auth.Papel;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Bean Validation do corpo de cadastro. É aqui que a AC3 (papel ausente) e a AC4 (e-mail/senha em
 * formato inválido) são barradas — antes de o service existir na jogada, portanto antes de qualquer
 * ida ao banco.
 */
class CadastroRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void abreValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void fechaValidator() {
        factory.close();
    }

    private Set<String> camposComViolacao(CadastroRequest request) {
        return validator.validate(request).stream()
                .map(violacao -> violacao.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }

    @ParameterizedTest
    @EnumSource(Papel.class)
    void aceitaOsTresPapeisQuandoOsDemaisCamposEstaoValidos(Papel papel) {
        Set<ConstraintViolation<CadastroRequest>> violacoes =
                validator.validate(new CadastroRequest("Fulano de Tal", "fulano@rolo35.com.br", "senha123", papel));

        assertThat(violacoes).isEmpty();
    }

    @Test
    void rejeitaPapelNulo() {
        assertThat(camposComViolacao(new CadastroRequest("Fulano de Tal", "fulano@rolo35.com.br", "senha123", null)))
                .contains("papel");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejeitaNomeEmBranco(String nome) {
        assertThat(camposComViolacao(new CadastroRequest(nome, "fulano@rolo35.com.br", "senha123", Papel.CLIENTE)))
                .contains("nome");
    }

    @Test
    void rejeitaNomeNulo() {
        assertThat(camposComViolacao(new CadastroRequest(null, "fulano@rolo35.com.br", "senha123", Papel.CLIENTE)))
                .contains("nome");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejeitaEmailEmBranco(String email) {
        assertThat(camposComViolacao(new CadastroRequest("Fulano de Tal", email, "senha123", Papel.CLIENTE)))
                .contains("email");
    }

    @ParameterizedTest
    @ValueSource(strings = {"fulano", "fulano@", "@rolo35.com.br", "fulano rolo35.com.br"})
    void rejeitaEmailMalFormatado(String email) {
        assertThat(camposComViolacao(new CadastroRequest("Fulano de Tal", email, "senha123", Papel.CLIENTE)))
                .contains("email");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejeitaSenhaEmBranco(String senha) {
        assertThat(camposComViolacao(new CadastroRequest("Fulano de Tal", "fulano@rolo35.com.br", senha, Papel.CLIENTE)))
                .contains("senha");
    }

    @Test
    void rejeitaSenhaMenorQueSeisCaracteres() {
        assertThat(camposComViolacao(
                        new CadastroRequest("Fulano de Tal", "fulano@rolo35.com.br", "12345", Papel.CLIENTE)))
                .contains("senha");
    }

    // Fronteira do @Size(min = 6): seis caracteres passam, cinco não. Sem este caso, um `min = 7`
    // acidental continuaria fazendo o teste acima passar.
    @Test
    void aceitaSenhaComExatamenteSeisCaracteres() {
        assertThat(camposComViolacao(
                        new CadastroRequest("Fulano de Tal", "fulano@rolo35.com.br", "123456", Papel.CLIENTE)))
                .isEmpty();
    }

    // A AC4 promete "mensagem de erro por campo": o handler de MethodArgumentNotValidException monta
    // essa mensagem a partir do caminho da propriedade, então cada campo reprovado precisa aparecer
    // como violação própria — uma violação genérica no objeto inteiro não daria o que a AC pede.
    @Test
    void reportaUmaViolacaoPorCampoQueFalhou() {
        Set<ConstraintViolation<CadastroRequest>> violacoes =
                validator.validate(new CadastroRequest("Fulano de Tal", "nao-e-email", "12345", Papel.CLIENTE));

        assertThat(violacoes)
                .extracting(violacao -> violacao.getPropertyPath().toString())
                .containsExactlyInAnyOrder("email", "senha");
    }
}
