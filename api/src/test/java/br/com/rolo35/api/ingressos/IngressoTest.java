package br.com.rolo35.api.ingressos;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class IngressoTest {

    @Test
    void validarMudaStatusParaUtilizadoEPreencheValidatedAt() {
        Ingresso ingresso =
                new Ingresso(UUID.randomUUID(), 1L, 1L, 1L, StatusIngresso.VALIDO, null, Instant.now());

        ingresso.validar();

        assertThat(ingresso.getStatus()).isEqualTo(StatusIngresso.UTILIZADO);
        assertThat(ingresso.getValidatedAt()).isNotNull();
    }
}
