package br.com.rolo35.api.reservas.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.StatusAssento;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.ReservaCheckoutProjection;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ReservaCheckoutRepositoryTest {

    private static final String CLIENTE_1 = "cliente1@rolo35.com.br";
    private static final String CLIENTE_2 = "cliente2@rolo35.com.br";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private AssentoRepository assentoRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    private final List<AssentoSessaoId> linhasCriadas = new ArrayList<>();
    private final List<Long> reservasCriadas = new ArrayList<>();
    private final List<Long> sessoesCriadas = new ArrayList<>();
    private Long salaCriadaId;

    @AfterEach
    void limpaFixture() {
        linhasCriadas.forEach(assentoSessaoRepository::deleteById);
        reservasCriadas.forEach(reservaRepository::deleteById);
        sessoesCriadas.forEach(sessaoRepository::deleteById);
        if (salaCriadaId != null) {
            assentoRepository.deleteAll(assentoRepository.findBySalaId(salaCriadaId));
            salaRepository.deleteById(salaCriadaId);
        }
    }

    private Sala salaCom(String nome) {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", nome);
        ReflectionTestUtils.setField(sala, "linhas", 2);
        ReflectionTestUtils.setField(sala, "colunas", 2);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();
        return sala;
    }

    private Assento assentoCom(Long salaId, String fileira, int numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "salaId", salaId);
        ReflectionTestUtils.setField(assento, "fileira", fileira);
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assentoRepository.save(assento);
    }

    private Sessao sessaoCom(Long salaId, String titulo, BigDecimal preco, LocalDateTime dataHora) {
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessao = sessaoRepository.save(Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo(titulo)
                .dataHora(dataHora)
                .preco(preco)
                .createdAt(Instant.now())
                .build());
        sessoesCriadas.add(sessao.getId());
        return sessao;
    }

    private Reserva reservaAtivaCom(String clienteEmail, Long sessaoId) {
        Long clienteId = usuarioRepository.findByEmail(clienteEmail).orElseThrow().getId();
        Reserva reserva = reservaRepository.save(new Reserva(
                null,
                clienteId,
                sessaoId,
                StatusReserva.ATIVA,
                Instant.now().truncatedTo(ChronoUnit.MICROS),
                LocalDateTime.now().plusMinutes(10).withNano(0)));
        reservasCriadas.add(reserva.getId());
        return reserva;
    }

    private void reivindicar(Long sessaoId, Long assentoId, Long reservaId) {
        AssentoSessaoId id = new AssentoSessaoId(sessaoId, assentoId);
        assentoSessaoRepository.save(
                new AssentoSessao(id, StatusAssento.RESERVADO, reservaId, LocalDateTime.now().plusMinutes(10).withNano(0)));
        linhasCriadas.add(id);
    }

    @Test
    void buscarAssentosDaReservaResolveAssentoSessaoESalaNumaQuerySo() {
        Sala sala = salaCom("Sala checkout (fixture)");
        Assento a2 = assentoCom(sala.getId(), "A", 2);
        Assento b1 = assentoCom(sala.getId(), "B", 1);
        LocalDateTime dataHora = LocalDateTime.now().plusDays(90).withNano(0);
        Sessao sessao = sessaoCom(sala.getId(), "Sessão checkout (fixture)", new BigDecimal("32.50"), dataHora);
        Reserva reserva = reservaAtivaCom(CLIENTE_1, sessao.getId());

        // Reivindica na ordem inversa da esperada: sem o ORDER BY explícito da query, o resultado
        // sairia na ordem física das linhas e este teste passaria por coincidência.
        reivindicar(sessao.getId(), b1.getId(), reserva.getId());
        reivindicar(sessao.getId(), a2.getId(), reserva.getId());

        List<ReservaCheckoutProjection> resultado =
                assentoSessaoRepository.buscarAssentosDaReserva(reserva.getId());

        assertThat(resultado).hasSize(2);
        ReservaCheckoutProjection primeiro = resultado.get(0);
        assertThat(primeiro.getAssentoId()).isEqualTo(a2.getId());
        assertThat(primeiro.getFileira()).isEqualTo("A");
        assertThat(primeiro.getNumero()).isEqualTo(2);
        assertThat(primeiro.getSessaoTitulo()).isEqualTo("Sessão checkout (fixture)");
        assertThat(primeiro.getSalaNome()).isEqualTo("Sala checkout (fixture)");
        assertThat(primeiro.getDataHora()).isEqualTo(dataHora);
        assertThat(primeiro.getPreco()).isEqualByComparingTo(new BigDecimal("32.50"));
        assertThat(resultado.get(1).getAssentoId()).isEqualTo(b1.getId());
        assertThat(resultado.get(1).getFileira()).isEqualTo("B");
    }

    @Test
    void buscarAssentosDaReservaNaoDevolveAssentoReivindicadoPorOutraReserva() {
        Sala sala = salaCom("Sala checkout vizinha (fixture)");
        Assento a1 = assentoCom(sala.getId(), "A", 1);
        Assento a2 = assentoCom(sala.getId(), "A", 2);
        Sessao sessao = sessaoCom(
                sala.getId(),
                "Sessão checkout vizinha (fixture)",
                new BigDecimal("20.00"),
                LocalDateTime.now().plusDays(91).withNano(0));
        Sessao outraSessao = sessaoCom(
                sala.getId(),
                "Outra sessão (fixture)",
                new BigDecimal("20.00"),
                LocalDateTime.now().plusDays(92).withNano(0));
        Reserva minha = reservaAtivaCom(CLIENTE_1, sessao.getId());
        Reserva deOutroCliente = reservaAtivaCom(CLIENTE_2, outraSessao.getId());

        reivindicar(sessao.getId(), a1.getId(), minha.getId());
        reivindicar(outraSessao.getId(), a2.getId(), deOutroCliente.getId());

        List<ReservaCheckoutProjection> resultado = assentoSessaoRepository.buscarAssentosDaReserva(minha.getId());

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getAssentoId()).isEqualTo(a1.getId());
        assertThat(resultado.get(0).getSessaoTitulo()).isEqualTo("Sessão checkout vizinha (fixture)");
    }
}
