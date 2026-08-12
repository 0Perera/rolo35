package br.com.rolo35.api.reservas;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.reservas.service.ReservaService;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.HoldAtivoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import br.com.rolo35.api.sessoes.service.SessaoService;
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
 * Achado do code review da Story 3.2: {@code SessaoService.editar()} lia {@code assento_sessao}
 * sem lock antes de checar hold ativo e apagar, reabrindo (com janela menor) a mesma corrida que
 * a Task 5 devia fechar — um {@code reservar()} concorrente podia confirmar um hold entre a
 * leitura e o {@code deleteAll}, deixando a reserva órfã. {@code travarPorSessao()} fecha essa
 * janela usando o mesmo mecanismo de {@code travarParaReserva} (PESSIMISTIC_WRITE ordenado por
 * assento_id). Este teste prova, com duas conexões reais disputando o mesmo assento, que o
 * resultado é sempre determinístico e seguro nas duas ordens possíveis: ou a reserva vence e a
 * edição toma {@code HoldAtivoException}, ou a edição vence e a reserva toma
 * {@code AssentoIndisponivelException} — nunca as duas sucedem, e nunca sobra reserva órfã.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class ReservaEditarConcorrenciaTest {

    private static final String NOME_SALA_A = "Sala A editar-concorrencia (fixture)";
    private static final String NOME_SALA_B = "Sala B editar-concorrencia (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";
    private static final String CLIENTE = "cliente1@rolo35.com.br";

    @Autowired
    private ReservaService reservaService;

    @Autowired
    private SessaoService sessaoService;

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

    private final List<Long> salasCriadas = new ArrayList<>();
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
        salasCriadas.forEach(salaId -> {
            assentoRepository.deleteAll(assentoRepository.findBySalaId(salaId));
            salaRepository.deleteById(salaId);
        });
    }

    private Sala salaSalva(String nome, int linhas, int colunas) {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", nome);
        ReflectionTestUtils.setField(sala, "linhas", linhas);
        ReflectionTestUtils.setField(sala, "colunas", colunas);
        Sala salva = salaRepository.save(sala);
        salasCriadas.add(salva.getId());
        return salva;
    }

    private Assento assentoSalvo(Long salaId, String fileira, int numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "salaId", salaId);
        ReflectionTestUtils.setField(assento, "fileira", fileira);
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assentoRepository.save(assento);
    }

    @Test
    void reservarEEditarConcorrentesNuncaProduzemReservaOrfa() throws Exception {
        Sala salaA = salaSalva(NOME_SALA_A, 1, 1);
        Assento assentoA1 = assentoSalvo(salaA.getId(), "A", 1);

        Sala salaB = salaSalva(NOME_SALA_B, 1, 2);
        assentoSalvo(salaB.getId(), "A", 1);
        assentoSalvo(salaB.getId(), "A", 2);

        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        LocalDateTime dataHora = LocalDateTime.now().plusDays(90).withNano(0);
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(salaA.getId())
                .tmdbId(550L)
                .titulo("Sessão editar-concorrencia (fixture)")
                .dataHora(dataHora)
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessao = sessaoRepository.save(sessao);
        Long sessaoId = sessao.getId();
        sessaoCriadaId = sessaoId;

        assentoSessaoRepository.save(
                new AssentoSessao(new AssentoSessaoId(sessaoId, assentoA1.getId()), "LIVRE", null, null));

        ReservarAssentosRequest reservarRequest = new ReservarAssentosRequest(sessaoId, List.of(assentoA1.getId()));
        EditarSessaoRequest editarRequest = new EditarSessaoRequest(
                salaB.getId(), "Sessão editar-concorrencia (fixture)", null, dataHora, new BigDecimal("25.00"));

        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<Object> tarefaReservar = () -> {
            barrier.await();
            return reservaService.reservar(reservarRequest, CLIENTE);
        };
        Callable<Object> tarefaEditar = () -> {
            barrier.await();
            return sessaoService.editar(sessaoId, editarRequest, ORGANIZADOR);
        };

        ExecutorService executor = Executors.newFixedThreadPool(2);
        Object resultadoReservar = null;
        Exception falhaReservar = null;
        Object resultadoEditar = null;
        Exception falhaEditar = null;
        try {
            Future<Object> futureReservar = executor.submit(tarefaReservar);
            Future<Object> futureEditar = executor.submit(tarefaEditar);

            try {
                resultadoReservar = futureReservar.get();
            } catch (ExecutionException e) {
                falhaReservar = (Exception) e.getCause();
            }
            try {
                resultadoEditar = futureEditar.get();
            } catch (ExecutionException e) {
                falhaEditar = (Exception) e.getCause();
            }
        } finally {
            executor.shutdown();
        }

        boolean reservarVenceu = resultadoReservar != null;
        boolean editarVenceu = resultadoEditar != null;
        assertThat(reservarVenceu ^ editarVenceu)
                .as("exatamente uma das duas operações deve suceder, nunca as duas nem nenhuma")
                .isTrue();

        if (reservarVenceu) {
            assertThat(falhaEditar).isInstanceOf(HoldAtivoException.class);

            List<Reserva> reservasAtivas = reservaRepository.findAll().stream()
                    .filter(r -> sessaoId.equals(r.getSessaoId()) && r.getStatus() == StatusReserva.ATIVA)
                    .toList();
            assertThat(reservasAtivas).hasSize(1);

            List<AssentoSessao> linhas = assentoSessaoRepository.findByIdSessaoId(sessaoId);
            assertThat(linhas).hasSize(1);
            assertThat(linhas.get(0).getId().getAssentoId()).isEqualTo(assentoA1.getId());
            assertThat(linhas.get(0).getStatus()).isEqualTo("RESERVADO");
            assertThat(linhas.get(0).getReservaId()).isEqualTo(reservasAtivas.get(0).getId());
        } else {
            assertThat(falhaReservar).isInstanceOf(AssentoIndisponivelException.class);

            List<Reserva> reservasAtivas = reservaRepository.findAll().stream()
                    .filter(r -> sessaoId.equals(r.getSessaoId()) && r.getStatus() == StatusReserva.ATIVA)
                    .toList();
            assertThat(reservasAtivas).isEmpty();

            List<AssentoSessao> linhas = assentoSessaoRepository.findByIdSessaoId(sessaoId);
            assertThat(linhas).hasSize(2);
            assertThat(linhas).allSatisfy(linha -> assertThat(linha.getStatus()).isEqualTo("LIVRE"));
        }
    }
}
