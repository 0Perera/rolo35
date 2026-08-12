package br.com.rolo35.api.pagamentos;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.pagamentos.dto.ConfirmarPagamentoRequest;
import br.com.rolo35.api.pagamentos.dto.PagamentoDto;
import br.com.rolo35.api.pagamentos.service.PagamentoService;
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
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
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
 * AC5 contra o banco real: duas confirmações concorrentes da mesma reserva, com
 * resultadoSimulado conflitante entre as duas chamadas, produzem um único desfecho
 * determinístico — quem adquire o lock primeiro decide; a segunda ecoa o mesmo estado, sem
 * reprocessar.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class PagamentoConcorrenciaConflitanteTest {

    private static final String NOME_SALA = "Sala pagamento concorrência (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";
    private static final String CLIENTE = "cliente1@rolo35.com.br";

    @Autowired
    private ReservaService reservaService;

    @Autowired
    private PagamentoService pagamentoService;

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
    private IngressoRepository ingressoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private Long salaCriadaId;
    private Long sessaoCriadaId;
    private Long reservaCriadaId;

    @AfterEach
    void limpaFixture() {
        if (reservaCriadaId != null) {
            ingressoRepository.deleteAll(ingressoRepository.findByReservaId(reservaCriadaId));
        }
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
    void confirmacoesConcorrentesComResultadoConflitanteProduzemEstadoDeterministico() throws Exception {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", NOME_SALA);
        ReflectionTestUtils.setField(sala, "linhas", 1);
        ReflectionTestUtils.setField(sala, "colunas", 1);
        sala = salaRepository.save(sala);
        salaCriadaId = sala.getId();

        Assento a1 = new Assento();
        ReflectionTestUtils.setField(a1, "salaId", sala.getId());
        ReflectionTestUtils.setField(a1, "fileira", "A");
        ReflectionTestUtils.setField(a1, "numero", 1);
        a1 = assentoRepository.save(a1);

        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessao = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(sala.getId())
                .tmdbId(550L)
                .titulo("Sessão pagamento concorrência (fixture)")
                .dataHora(LocalDateTime.now().plusDays(90).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessao = sessaoRepository.save(sessao);
        sessaoCriadaId = sessao.getId();

        assentoSessaoRepository.save(new AssentoSessao(new AssentoSessaoId(sessao.getId(), a1.getId()), "LIVRE", null, null));

        ReservaDto reservaCriada =
                reservaService.reservar(new ReservarAssentosRequest(sessao.getId(), List.of(a1.getId())), CLIENTE);
        reservaCriadaId = reservaCriada.id();

        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<PagamentoDto> confirmaAprovado = () -> {
            barrier.await();
            return pagamentoService.confirmar(
                    new ConfirmarPagamentoRequest(reservaCriada.id(), ResultadoSimulado.APROVADO), CLIENTE);
        };
        Callable<PagamentoDto> confirmaRecusado = () -> {
            barrier.await();
            return pagamentoService.confirmar(
                    new ConfirmarPagamentoRequest(reservaCriada.id(), ResultadoSimulado.RECUSADO), CLIENTE);
        };

        ExecutorService executor = Executors.newFixedThreadPool(2);
        PagamentoDto resultado1;
        PagamentoDto resultado2;
        try {
            Future<PagamentoDto> future1 = executor.submit(confirmaAprovado);
            Future<PagamentoDto> future2 = executor.submit(confirmaRecusado);
            resultado1 = future1.get();
            resultado2 = future2.get();
        } finally {
            executor.shutdown();
        }

        assertThat(resultado1.status()).isEqualTo(resultado2.status());

        List<Ingresso> ingressosDaReserva = ingressoRepository.findByReservaId(reservaCriada.id());
        List<AssentoSessao> linhas = assentoSessaoRepository.findByIdSessaoId(sessao.getId());

        if (resultado1.status() == br.com.rolo35.api.reservas.StatusReserva.CONFIRMADA) {
            assertThat(ingressosDaReserva).hasSize(1);
            assertThat(linhas).allSatisfy(linha -> assertThat(linha.getStatus()).isEqualTo("VENDIDO"));
        } else {
            assertThat(ingressosDaReserva).isEmpty();
            assertThat(linhas).allSatisfy(linha -> assertThat(linha.getStatus()).isEqualTo("LIVRE"));
        }
    }
}
