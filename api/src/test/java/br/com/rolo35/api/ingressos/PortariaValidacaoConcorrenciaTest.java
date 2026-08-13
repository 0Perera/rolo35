package br.com.rolo35.api.ingressos;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.repository.TurnoPortariaRepository;
import br.com.rolo35.api.ingressos.service.CodigoIngressoService;
import br.com.rolo35.api.ingressos.service.PortariaService;
import br.com.rolo35.api.pagamentos.ResultadoSimulado;
import br.com.rolo35.api.pagamentos.dto.ConfirmarPagamentoRequest;
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
import java.util.UUID;
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
 * AC8/FR-20 contra o banco real: duas validações concorrentes do mesmo ingresso produzem
 * exatamente um "válido" e um "já utilizado" — nunca os dois "válido" (falha de lock) nem os
 * dois "já utilizado" (ninguém validou de fato).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class PortariaValidacaoConcorrenciaTest {

    private static final String NOME_SALA = "Sala validação concorrência (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";
    private static final String CLIENTE = "cliente1@rolo35.com.br";
    private static final String PORTARIA = "portaria@rolo35.com.br";

    @Autowired
    private ReservaService reservaService;

    @Autowired
    private PagamentoService pagamentoService;

    @Autowired
    private PortariaService portariaService;

    @Autowired
    private CodigoIngressoService codigoIngressoService;

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

    @Autowired
    private TurnoPortariaRepository turnoPortariaRepository;

    private Long salaCriadaId;
    private Long sessaoCriadaId;
    private Long reservaCriadaId;
    private Long portariaId;

    @AfterEach
    void limpaFixture() {
        if (portariaId != null) {
            turnoPortariaRepository.deleteById(portariaId);
        }
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
    void duasValidacoesConcorrentesDoMesmoIngressoProduzemUmValidoEUmJaUtilizado() throws Exception {
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
                .titulo("Sessão validação concorrência (fixture)")
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
        pagamentoService.confirmar(new ConfirmarPagamentoRequest(reservaCriada.id(), ResultadoSimulado.APROVADO), CLIENTE);

        UUID ingressoId =
                ingressoRepository.findByReservaId(reservaCriada.id()).get(0).getId();
        String codigo = codigoIngressoService.gerar(ingressoId);

        portariaId = usuarioRepository.findByEmail(PORTARIA).orElseThrow().getId();
        portariaService.selecionarSessao(PORTARIA, sessao.getId());

        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<ValidacaoIngressoDto> validaIngresso = () -> {
            barrier.await();
            return portariaService.validar(PORTARIA, codigo);
        };

        ExecutorService executor = Executors.newFixedThreadPool(2);
        ValidacaoIngressoDto resultado1;
        ValidacaoIngressoDto resultado2;
        try {
            Future<ValidacaoIngressoDto> future1 = executor.submit(validaIngresso);
            Future<ValidacaoIngressoDto> future2 = executor.submit(validaIngresso);
            resultado1 = future1.get();
            resultado2 = future2.get();
        } finally {
            executor.shutdown();
        }

        assertThat(List.of(resultado1.resultado(), resultado2.resultado()))
                .containsExactlyInAnyOrder(ResultadoValidacao.VALIDO, ResultadoValidacao.JA_UTILIZADO);

        Ingresso ingressoFinal = ingressoRepository.findById(ingressoId).orElseThrow();
        assertThat(ingressoFinal.getStatus()).isEqualTo(StatusIngresso.UTILIZADO);
        assertThat(ingressoFinal.getValidatedAt()).isNotNull();
    }
}
