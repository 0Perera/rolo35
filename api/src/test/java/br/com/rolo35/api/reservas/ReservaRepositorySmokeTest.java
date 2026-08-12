package br.com.rolo35.api.reservas;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ReservaRepositorySmokeTest {

    @Autowired
    private ReservaRepository reservaRepository;

    @Test
    void salvaERecarregaReservaComTodosOsCampos() {
        // TIMESTAMP (sem timezone) no Postgres só guarda até microssegundos — trunca antes de
        // comparar, mesmo tratamento já dado a expiresAt (withNano(0), truncamento pra segundos).
        Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(10).withNano(0);

        Reserva salva = reservaRepository.save(new Reserva(null, 1L, 1L, StatusReserva.ATIVA, createdAt, expiresAt));

        Reserva recarregada = reservaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recarregada.getClienteId()).isEqualTo(1L);
        assertThat(recarregada.getSessaoId()).isEqualTo(1L);
        assertThat(recarregada.getStatus()).isEqualTo(StatusReserva.ATIVA);
        assertThat(recarregada.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(recarregada.getCreatedAt()).isEqualTo(createdAt);
    }
}
