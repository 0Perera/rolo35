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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
    private static final String TITULO_TERCEIRA = "Listagem terceira (fixture)";
    private static final String SUFIXO_FIXTURE = "(fixture)";
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
        // Por sufixo, não por lista de títulos: a lista silenciosamente deixava de limpar a
        // fixture nova, e sessão vazada de um teste entra na contagem do seguinte.
        List<Sessao> criadas = sessaoRepository.findAll().stream()
                .filter(sessao -> sessao.getTitulo() != null && sessao.getTitulo().endsWith(SUFIXO_FIXTURE))
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

        List<SessaoListagemProjection> listagem =
                sessaoRepository.listarPublicadas("%", 0L, 0L, Pageable.ofSize(100)).getContent();

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

        List<SessaoListagemProjection> listagem =
                sessaoRepository.listarPublicadas("%", 0L, 0L, Pageable.ofSize(100)).getContent();

        assertThat(listagem).noneMatch(p -> TITULO_PASSADA.equals(p.getTitulo()));
    }

    /**
     * A query principal multiplica linhas por assento antes de agrupar. Se a contagem da página
     * saísse dela, o total viria como a soma das capacidades das salas — 80 em vez de 1 pra uma
     * única sessão na Sala 1 — e a tela mostraria dezenas de páginas vazias. Só o banco de verdade
     * prova que a {@code countQuery} separada não caiu nessa.
     */
    @Test
    void contagemDaPaginaNaoEhMultiplicadaPelaCapacidadeDaSala() {
        Long salaId = salaUmId();
        LocalDateTime base = LocalDateTime.now().plusDays(140).withNano(0);
        sessaoService.criar(requestCom(salaId, TITULO_LIVRE, base), ORGANIZADOR);

        var pagina = sessaoRepository.listarPublicadas("%" + TITULO_LIVRE + "%", 0L, 0L, Pageable.ofSize(10));

        assertThat(pagina.getTotalElements()).isEqualTo(1);
        assertThat(pagina.getContent()).hasSize(1);
    }

    @Test
    void buscaCasaPorTituloPorNomeDaSalaEPorDataEscritaComoNoBrasil() {
        Long salaId = salaUmId();
        LocalDateTime base = LocalDateTime.now().plusDays(160).withNano(0).withHour(20).withMinute(30);
        sessaoService.criar(requestCom(salaId, TITULO_LIVRE, base), ORGANIZADOR);

        String dataBr = base.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));

        assertThat(sessaoRepository.listarPublicadas("%com vaga%", 0L, 0L, Pageable.ofSize(50)).getContent())
                .anyMatch(p -> TITULO_LIVRE.equals(p.getTitulo()));
        assertThat(sessaoRepository.listarPublicadas("%Sala 1%", 0L, 0L, Pageable.ofSize(50)).getContent())
                .anyMatch(p -> TITULO_LIVRE.equals(p.getTitulo()));
        assertThat(sessaoRepository.listarPublicadas("%" + dataBr + "%", 0L, 0L, Pageable.ofSize(50)).getContent())
                .anyMatch(p -> TITULO_LIVRE.equals(p.getTitulo()));
        assertThat(sessaoRepository.listarPublicadas("%nada que exista%", 0L, 0L, Pageable.ofSize(50)).getContent())
                .isEmpty();
    }

    /**
     * Sem o desempate por id no {@code ORDER BY}, duas sessões no mesmo horário podem trocar de
     * posição entre duas consultas — e aí uma delas aparece em duas páginas enquanto a outra
     * some de todas.
     */
    @Test
    void paginacaoNaoRepeteNemPerdeLinhaEntrePaginas() {
        Long salaId = salaUmId();
        LocalDateTime base = LocalDateTime.now().plusDays(180).withNano(0);
        sessaoService.criar(requestCom(salaId, TITULO_LIVRE, base), ORGANIZADOR);
        sessaoService.criar(requestCom(salaId, TITULO_ESGOTADA, base.plusHours(5)), ORGANIZADOR);
        sessaoService.criar(requestCom(salaId, TITULO_TERCEIRA, base.plusHours(10)), ORGANIZADOR);

        String termo = "%(fixture)%";
        var todos = sessaoRepository.listarPublicadas(termo, 0L, 0L, Pageable.ofSize(100)).getContent().stream()
                .map(SessaoListagemProjection::getId)
                .toList();

        var acumulado = new java.util.ArrayList<Long>();
        for (int pagina = 0; pagina < 60; pagina++) {
            var conteudo = sessaoRepository.listarPublicadas(termo, 0L, 0L, PageRequest.of(pagina, 2)).getContent();
            if (conteudo.isEmpty()) {
                break;
            }
            conteudo.forEach(p -> acumulado.add(p.getId()));
        }

        assertThat(acumulado).containsExactlyElementsOf(todos);
        assertThat(acumulado).doesNotHaveDuplicates();
    }
}
