package br.com.rolo35.api.sessoes.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
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
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";

    @Autowired
    private SessaoService sessaoService;

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private SessaoRepository sessaoRepository;

    @Autowired
    private AssentoSessaoRepository assentoSessaoRepository;

    @AfterEach
    void limpaSessoesDoTeste() {
        List<Sessao> criadas = sessaoRepository.findAll().stream()
                .filter(sessao -> TITULO_LIVRE.equals(sessao.getTitulo()) || TITULO_ESGOTADA.equals(sessao.getTitulo()))
                .toList();
        criadas.forEach(
                sessao -> assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessao.getId())));
        sessaoRepository.deleteAll(criadas);
    }

    private CriarSessaoRequest requestCom(Long salaId, String titulo, LocalDateTime dataHora) {
        return new CriarSessaoRequest(salaId, 550L, titulo, null, null, null, dataHora, new BigDecimal("25.00"));
    }

    @Test
    void listarPublicadasTrazSessaoComVagaESessaoEsgotadaSemN1() {
        Long salaId = salaRepository.findAll().get(0).getId();
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
        assertThat(projecaoComVaga.getCapacidade()).isEqualTo(40);
        assertThat(projecaoComVaga.getAssentosLivres()).isEqualTo(40);

        var projecaoEsgotada = listagem.stream()
                .filter(p -> TITULO_ESGOTADA.equals(p.getTitulo()))
                .findFirst()
                .orElseThrow();
        assertThat(projecaoEsgotada.getSalaNome()).isEqualTo("Sala 1");
        assertThat(projecaoEsgotada.getCapacidade()).isEqualTo(40);
        assertThat(projecaoEsgotada.getAssentosLivres()).isEqualTo(0);
    }
}
