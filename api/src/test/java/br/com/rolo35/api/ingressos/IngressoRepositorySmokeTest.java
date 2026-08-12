package br.com.rolo35.api.ingressos;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class IngressoRepositorySmokeTest {

    @Autowired
    private IngressoRepository ingressoRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Test
    void salvaERecarregaIngressoComTodosOsCampos() {
        Reserva reserva = reservaRepository.save(
                new Reserva(null, 1L, 1L, StatusReserva.CONFIRMADA, Instant.now().truncatedTo(ChronoUnit.MICROS), null));
        Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);

        Ingresso salvo = ingressoRepository.save(
                new Ingresso(null, reserva.getId(), 1L, 1L, StatusIngresso.VALIDO, null, createdAt));

        assertThat(salvo.getId()).isNotNull();
        Ingresso recarregado = ingressoRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recarregado.getReservaId()).isEqualTo(reserva.getId());
        assertThat(recarregado.getAssentoId()).isEqualTo(1L);
        assertThat(recarregado.getSessaoId()).isEqualTo(1L);
        assertThat(recarregado.getStatus()).isEqualTo(StatusIngresso.VALIDO);
        assertThat(recarregado.getValidatedAt()).isNull();
        assertThat(recarregado.getCreatedAt()).isEqualTo(createdAt);
    }
}
