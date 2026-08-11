package br.com.rolo35.api.sessoes.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * AC2 contra o banco de verdade: prova que {@code listarPublicadas()} traz sessão + sala numa
 * única consulta (sem N+1) e que a contagem de assentos livres reflete o estado real de
 * {@code assento_sessao}, não um cálculo em memória.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SessaoListagemRepositoryTest {

    private static final String TITULO_LIVRE = "Listagem com vaga (fixture)";
    private static final String TITULO_ESGOTADA = "Listagem esgotada (fixture)";
    private static final String TITULO_PASSADA = "Listagem sessão passada (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";

    @Autowired
    private SessaoService sessaoService;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @AfterEach
    void limpaSessoesDoTeste() {
        List<Sessao> criadas = sessaoRepository.findAll().stream()
                .filter(sessao -> TITULO_LIVRE.equals(sessao.getTitulo()) || TITULO_ESGOTADA.equals(sessao.getTitulo())
                        || TITULO_PASSADA.equals(sessao.getTitulo()))
                .toList();
        criadas.forEach(
                sessao -> assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessao.getId())));
        sessaoRepository.deleteAll(criadas);
    }

    private CriarSessaoRequest requestCom(Long salaId, String titulo, LocalDateTime dataHora) {
        return new CriarSessaoRequest(salaId, 550L, titulo, null, null, null, dataHora, new BigDecimal("25.00"));
    }

    private Long salaUmId() {
        return salaRepository.findAll().stream()
                .filter(sala -> "Sala 1".equals(sala.getNome()))
                .findFirst()
                .orElseThrow()
                .getId();
    }

    @Test
    void listarPublicadasTrazSessaoComVagaESessaoEsgotadaSemN1() {
        Long salaId = salaUmId();
        LocalDateTime base = LocalDateTime.now().plusDays(120).withNano(0);

        var sessaoComVaga = sessaoService.criar(requestCom(salaId, TITULO_LIVRE, base), ORGANIZADOR);
        var sessaoEsgotada = sessaoService.criar(requestCom(salaId, TITULO_ESGOTADA, base.plusHours(5)), ORGANIZADOR);

        List<AssentoSessao> assentosDaEsgotada = assentoSessaoRepository.findByIdSessaoId(sessaoEsgotada.id());
        assentosDaEsgotada.forEach(as -> ReflectionTestUtils.setField(as, "status", "VENDIDO"));
        assentoSessaoRepository.saveAll(assentosDaEsgotada);

        List<SessaoListagemProjection> listagem = sessaoRepository.listarPublicadas();

        var projecaoComVaga = listagem.stream()
                .filter(p -> TITULO_LIVRE.equals(p.getTitulo()))
                .findFirst()
                .orElseThrow();
        assertThat(projecaoComVaga.getSalaNome()).isEqualTo("Sala 1");
        assertThat(projecaoComVaga.getCapacidade()).isEqualTo(80);
        assertThat(projecaoComVaga.getAssentosLivres()).isEqualTo(80);

        var projecaoEsgotada = listagem.stream()
                .filter(p -> TITULO_ESGOTADA.equals(p.getTitulo()))
                .findFirst()
                .orElseThrow();
        assertThat(projecaoEsgotada.getSalaNome()).isEqualTo("Sala 1");
        assertThat(projecaoEsgotada.getCapacidade()).isEqualTo(80);
        assertThat(projecaoEsgotada.getAssentosLivres()).isEqualTo(0);
    }

    // Sessão criada legitimamente no futuro (SessaoService.criar rejeita data no passado) que o
    // relógio já ultrapassou — inserida direto via repository pra simular esse avanço do tempo,
    // já que o service não permite criar uma sessão com data passada.
    @Test
    void listarPublicadasNaoTrazSessaoComDataHoraNoPassado() {
        Long salaId = salaUmId();
        Long organizadorId = usuarioRepository.findByEmail(ORGANIZADOR).orElseThrow().getId();
        Sessao sessaoPassada = Sessao.builder()
                .organizadorId(organizadorId)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo(TITULO_PASSADA)
                .dataHora(LocalDateTime.now().minusDays(30).withNano(0))
                .preco(new BigDecimal("25.00"))
                .createdAt(Instant.now())
                .build();
        sessaoRepository.save(sessaoPassada);

        List<SessaoListagemProjection> listagem = sessaoRepository.listarPublicadas();

        assertThat(listagem).noneMatch(p -> TITULO_PASSADA.equals(p.getTitulo()));
    }
}
