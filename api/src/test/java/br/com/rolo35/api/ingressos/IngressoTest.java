package br.com.rolo35.api.ingressos;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class IngressoTest {

    /**
     * Código curto de fixture. A emissão real usa SecureRandom; aqui o valor só precisa ser
     * único (a coluna é UNIQUE) e caber no alfabeto Base32 Crockford de 8 caracteres.
     */
    private static String codigoCurtoDeTeste() {
        return java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    @Test
    void validarMudaStatusParaUtilizadoEPreencheValidatedAt() {
        Ingresso ingresso =
                new Ingresso(UUID.randomUUID(), 1L, 1L, 1L, codigoCurtoDeTeste(), StatusIngresso.VALIDO, null, Instant.now());

        ingresso.validar();

        assertThat(ingresso.getStatus()).isEqualTo(StatusIngresso.UTILIZADO);
        assertThat(ingresso.getValidatedAt()).isNotNull();
    }
}
