package br.com.rolo35.api.reservas;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.reservas.service.ReservaService;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * AC5 contra o banco real: duas requisições concorrentes disputando (ao menos em parte) o
 * mesmo assento só podem produzir uma reserva vencedora — provado com duas conexões reais,
 * não mocks, via SELECT...FOR UPDATE ordenado por assento_id (Task 2-3).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ReservaConcorrenciaConflitoTest {

    private static final String NOME_SALA = "Sala concorrência (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";
    private static final String CLIENTE = "cliente1@rolo35.com.br";

    @Autowired
    private ReservaService reservaService;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private AssentoRepository assentoRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Long salaCriadaId;
    private Long sessaoCriadaId;

    @AfterEach
    void limpaFixture() {
        if (sessaoCriadaId != null) {
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessaoCriadaId));
            reservaRepository.findAll().stream()
                    .filter(reserva -> sessaoCriadaId.equals(reserva.getSessaoId()))
                    .forEach(reserva -> reservaRepository.deleteById(reserva.getId()));
            sessaoRepository.deleteById(sessaoCriadaId);
        }
        if (salaCriadaId != null) {
            assentoRepository.deleteAll(assentoRepository.findBySalaId(salaCriadaId));
            salaRepository.deleteById(salaCriadaId);
        }
    }

    @Test
    void exatamenteUmaReservaConcorrenteVenceQuandoDisputamOMesmoAssento() throws Exception {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", NOME_SALA);
        ReflectionTestUtils.setField(sala, "linhas", 1);
        ReflectionTestUtils.setField(sala, "colunas", 2);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();

        Assento a1 = new Assento();
        ReflectionTestUtils.setField(a1, "salaId", sala.getId());
        ReflectionTestUtils.setField(a1, "fileira", "A");
        ReflectionTestUtils.setField(a1, "numero", 1);
        a1 = assentoRepository.save(a1);

        Assento a2 = new Assento();
        ReflectionTestUtils.setField(a2, "salaId", sala.getId());
        ReflectionTestUtils.setField(a2, "fileira", "A");
        ReflectionTestUtils.setField(a2, "numero", 2);
        a2 = assentoRepository.save(a2);

        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(sala.getId())
                .tmdbId(550L)
                .titulo("Sessão concorrência (fixture)")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessao = sessaoRepository.save(sessao);
        sessaoCriadaId = sessao.getId();
        Long sessaoId = sessao.getId();

        assentoSessaoRepository.saveAll(List.of(
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), "LIVRE", null, null),
                new AssentoSessao(new AssentoSessaoId(sessao.getId(), a2.getId()), "LIVRE", null, null)));

        ReservarAssentosRequest request = new ReservarAssentosRequest(sessao.getId(), List.of(a1.getId(), a2.getId()));

        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<ReservaDto> tarefa = () -> {
            barrier.await();
            return reservaService.reservar(request, CLIENTE);
        };

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ReservaDto> future1 = executor.submit(tarefa);
            Future<ReservaDto> future2 = executor.submit(tarefa);

            List<ReservaDto> sucessos = new ArrayList<>();
            List<Exception> falhas = new ArrayList<>();
            for (Future<ReservaDto> future : List.of(future1, future2)) {
                try {
                    sucessos.add(future.get());
                } catch (ExecutionException e) {
                    falhas.add((Exception) e.getCause());
                }
            }

            assertThat(sucessos).hasSize(1);
            assertThat(falhas).hasSize(1);
            assertThat(falhas.get(0)).isInstanceOf(AssentoIndisponivelException.class);
        } finally {
            executor.shutdown();
        }

        List<Reserva> reservasAtivas = reservaRepository.findAll().stream()
                .filter(reserva -> sessaoId.equals(reserva.getSessaoId()) && reserva.getStatus() == StatusReserva.ATIVA)
                .toList();
        assertThat(reservasAtivas).hasSize(1);

        List<AssentoSessao> linhas = assentoSessaoRepository.findByIdSessaoId(sessaoId);
        assertThat(linhas).allSatisfy(linha -> {
            assertThat(linha.getStatus()).isEqualTo("RESERVADO");
            assertThat(linha.getReservaId()).isEqualTo(reservasAtivas.get(0).getId());
        });
    }
}
