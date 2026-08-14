package br.com.rolo35.api.ingressos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CodigoIngressoServiceTest {

    private final CodigoIngressoService service = new CodigoIngressoService("segredo-de-teste-fixo-para-hmac");

    @Test
    void geraCodigoNoFormatoUuidPontoAssinatura() {
        UUID id = UUID.randomUUID();

        String codigo = service.gerar(id);

        assertThat(codigo).startsWith(id + ".");
        assertThat(codigo.split("\\.", 2)).hasSize(2);
    }

    @Test
    void validaCodigoRecemGeradoComoValido() {
        UUID id = UUID.randomUUID();
        String codigo = service.gerar(id);

        assertThat(service.validar(id, codigo)).isTrue();
    }

    @Test
    void rejeitaCodigoComAssinaturaAdulterada() {
        UUID id = UUID.randomUUID();
        String codigo = service.gerar(id);
        int posicaoAssinatura = codigo.indexOf('.') + 1;
        char original = codigo.charAt(posicaoAssinatura);
        char trocado = original == 'A' ? 'B' : 'A';
        String adulterado = codigo.substring(0, posicaoAssinatura) + trocado + codigo.substring(posicaoAssinatura + 1);

        assertThat(service.validar(id, adulterado)).isFalse();
    }

    @Test
    void rejeitaAssinaturaDeOutroIdColadaNoPrimeiroId() {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        String codigo1 = service.gerar(id1);
        String codigo2 = service.gerar(id2);
        String assinatura2 = codigo2.split("\\.", 2)[1];
        String codigoForjado = id1 + "." + assinatura2;

        assertThat(service.validar(id1, codigoForjado)).isFalse();
    }

    @Test
    void extrairIdDevolveUuidDoCodigoGerado() {
        UUID id = UUID.randomUUID();
        String codigo = service.gerar(id);

        assertThat(service.extrairId(codigo)).contains(id);
    }

    @Test
    void extrairIdDevolveVazioParaCodigoSemPonto() {
        assertThat(service.extrairId("sem-ponto-nenhum")).isEqualTo(Optional.empty());
    }

    @Test
    void extrairIdDevolveVazioParaUuidMalformado() {
        assertThat(service.extrairId("nao-e-um-uuid.assinatura")).isEqualTo(Optional.empty());
    }

    @Test
    void construtorLancaExcecaoParaSecretVazio() {
        assertThatThrownBy(() -> new CodigoIngressoService("")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void construtorLancaExcecaoParaSecretSoComEspacos() {
        assertThatThrownBy(() -> new CodigoIngressoService("   ")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void construtorLancaExcecaoParaSecretNulo() {
        assertThatThrownBy(() -> new CodigoIngressoService(null)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void codigoCurtoTemOitoCaracteresDoAlfabetoCrockford() {
        for (int i = 0; i < 200; i++) {
            assertThat(service.gerarCodigoCurto()).matches("[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{8}");
        }
    }

    // Não é decoração: I, L, O e U fora do alfabeto é o que faz o código sobreviver a ser ditado
    // por telefone e digitado por outra pessoa.
    @Test
    void codigoCurtoNuncaUsaLetrasQueSeConfundemComNumeros() {
        for (int i = 0; i < 200; i++) {
            assertThat(service.gerarCodigoCurto()).doesNotContain("I", "L", "O", "U");
        }
    }

    @Test
    void codigosCurtosNaoSeRepetemEmVolumePequeno() {
        java.util.Set<String> gerados = new java.util.HashSet<>();
        for (int i = 0; i < 1_000; i++) {
            gerados.add(service.gerarCodigoCurto());
        }

        assertThat(gerados).hasSize(1_000);
    }

    // A tolerância de leitura do Crockford: quem digita o que está escrito no canhoto acerta,
    // mesmo trocando O por 0 ou digitando em minúscula.
    @Test
    void normalizaCaixaSeparadoresEOsCaracteresConfundiveis() {
        assertThat(service.normalizarCodigoCurto("7zk3qw9m")).contains("7ZK3QW9M");
        assertThat(service.normalizarCodigoCurto(" 7ZK3-QW9M ")).contains("7ZK3QW9M");
        assertThat(service.normalizarCodigoCurto("7ZK3QWOM")).contains("7ZK3QW0M");
        assertThat(service.normalizarCodigoCurto("7ZK3QWIM")).contains("7ZK3QW1M");
        assertThat(service.normalizarCodigoCurto("7ZK3QWLM")).contains("7ZK3QW1M");
    }

    @Test
    void recusaOQueNaoPodeSerCodigoCurto() {
        assertThat(service.normalizarCodigoCurto(null)).isEmpty();
        assertThat(service.normalizarCodigoCurto("")).isEmpty();
        assertThat(service.normalizarCodigoCurto("7ZK3QW9")).isEmpty();
        assertThat(service.normalizarCodigoCurto("7ZK3QW9MX")).isEmpty();
        // O código assinado inteiro nunca pode ser confundido com um código curto.
        assertThat(service.normalizarCodigoCurto(service.gerar(UUID.randomUUID()))).isEmpty();
    }

    // U não está no alfabeto e, ao contrário de I/L/O, não tem equivalente numérico — então é
    // recusado em vez de traduzido.
    @Test
    void recusaCaractereForaDoAlfabetoSemEquivalente() {
        assertThat(service.normalizarCodigoCurto("7ZK3QWUM")).isEmpty();
    }
}
