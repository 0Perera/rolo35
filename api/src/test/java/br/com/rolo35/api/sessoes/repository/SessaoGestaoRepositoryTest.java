package br.com.rolo35.api.sessoes.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contra o banco de verdade: as três queries nativas novas da Story 2.2 (lock de sessão, checagem
 * de conflito excluindo a própria sessão, checagem de ingresso confirmado) e a listagem de gestão
 * por organizador, que precisa trazer o flag `editavel` já agregado (sem N+1).
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SessaoGestaoRepositoryTest {

    private static final String TITULO = "Gestão repository (fixture)";
    private static final String TITULO_COM_INGRESSO = "Gestão repository com ingresso (fixture)";
    private static final String ORGANIZADOR = "organizador@rolo35.com.br";
    private static final String CLIENTE = "cliente1@rolo35.com.br";

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

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limpaSessoesDoTeste() {
        List<Sessao> criadas = sessaoRepository.findAll().stream()
                .filter(sessao -> TITULO.equals(sessao.getTitulo()) || TITULO_COM_INGRESSO.equals(sessao.getTitulo()))
                .toList();
        criadas.forEach(sessao -> {
            jdbcTemplate.update("DELETE FROM ingressos WHERE sessao_id = ?", sessao.getId());
            jdbcTemplate.update("DELETE FROM reservas WHERE sessao_id = ?", sessao.getId());
            assentoSessaoRepository.deleteAll(assentoSessaoRepository.findByIdSessaoId(sessao.getId()));
        });
        sessaoRepository.deleteAll(criadas);
    }

    private CriarSessaoRequest requestEm(Long salaId, String titulo, LocalDateTime dataHora) {
        return new CriarSessaoRequest(salaId, 550L, titulo, null, null, null, dataHora, new BigDecimal("25.00"));
    }

    private void confirmaIngressoPara(Long sessaoId) {
        Long clienteId = usuarioRepository.findByEmail(CLIENTE).orElseThrow().getId();
        Long assentoId = assentoSessaoRepository.findByIdSessaoId(sessaoId).get(0).getId().getAssentoId();
        Long reservaId = jdbcTemplate.queryForObject(
                "INSERT INTO reservas (cliente_id, sessao_id, status) VALUES (?, ?, 'CONFIRMADA') RETURNING id",
                Long.class, clienteId, sessaoId);
        jdbcTemplate.update(
                "INSERT INTO ingressos (id, reserva_id, assento_id, sessao_id, status) VALUES (?, ?, ?, ?, 'VALIDO')",
                UUID.randomUUID(), reservaId, assentoId, sessaoId);
    }

    // findByIdForUpdate emite SELECT ... FOR UPDATE (LockModeType.PESSIMISTIC_WRITE), que exige
    // uma transação ativa — fora de uma, o Hibernate rejeita com TransactionRequiredException.
    @Test
    @Transactional
    void findByIdForUpdateRetornaASessaoCorreta() {
        Long salaId = salaRepository.findAll().get(0).getId();
        var criada = sessaoService.criar(requestEm(salaId, TITULO, LocalDateTime.now().plusDays(150).withNano(0)), ORGANIZADOR);

        var travada = sessaoRepository.findByIdForUpdate(criada.id());

        assertThat(travada).isPresent();
        assertThat(travada.get().getTitulo()).isEqualTo(TITULO);
    }

    @Test
    void existeConflitanteExcluindoIgnoraAPropriaSessaoMasAcusaOutraSobreposta() {
        Long salaId = salaRepository.findAll().get(0).getId();
        LocalDateTime base = LocalDateTime.now().plusDays(151).withNano(0);
        var sessao = sessaoService.criar(requestEm(salaId, TITULO, base), ORGANIZADOR);

        assertThat(sessaoRepository.existeConflitanteExcluindo(salaId, base, 240, sessao.id())).isFalse();

        var outra = sessaoService.criar(requestEm(salaId, TITULO_COM_INGRESSO, base.plusDays(1)), ORGANIZADOR);
        assertThat(sessaoRepository.existeConflitanteExcluindo(salaId, base.plusDays(1).plusHours(1), 240, sessao.id()))
                .isTrue();
        assertThat(outra.id()).isNotNull();
    }

    @Test
    void existeIngressoConfirmadoRefleteExistenciaDeLinhaEmIngressos() {
        Long salaId = salaRepository.findAll().get(0).getId();
        var sessao = sessaoService.criar(
                requestEm(salaId, TITULO_COM_INGRESSO, LocalDateTime.now().plusDays(152).withNano(0)), ORGANIZADOR);

        assertThat(sessaoRepository.existeIngressoConfirmado(sessao.id())).isFalse();

        confirmaIngressoPara(sessao.id());

        assertThat(sessaoRepository.existeIngressoConfirmado(sessao.id())).isTrue();
    }

    @Test
    void findByOrganizadorIdTrazSoAsProprias() {
        Long salaId = salaRepository.findAll().get(0).getId();
        var propria = sessaoService.criar(
                requestEm(salaId, TITULO, LocalDateTime.now().plusDays(153).withNano(0)), ORGANIZADOR);

        List<SessaoGestaoProjection> minhas = sessaoRepository.findByOrganizadorId(usuarioRepository
                .findByEmail(ORGANIZADOR)
                .orElseThrow()
                .getId());

        assertThat(minhas).anySatisfy(p -> {
            assertThat(p.getId()).isEqualTo(propria.id());
            assertThat(p.getTitulo()).isEqualTo(TITULO);
            assertThat(p.getEditavel()).isTrue();
        });
    }

    @Test
    void findByOrganizadorIdMarcaEditavelFalseQuandoHaIngressoConfirmado() {
        Long salaId = salaRepository.findAll().get(0).getId();
        var sessao = sessaoService.criar(
                requestEm(salaId, TITULO_COM_INGRESSO, LocalDateTime.now().plusDays(154).withNano(0)), ORGANIZADOR);
        confirmaIngressoPara(sessao.id());

        List<SessaoGestaoProjection> minhas = sessaoRepository.findByOrganizadorId(usuarioRepository
                .findByEmail(ORGANIZADOR)
                .orElseThrow()
                .getId());

        assertThat(minhas)
                .filteredOn(p -> TITULO_COM_INGRESSO.equals(p.getTitulo()))
                .allSatisfy(p -> assertThat(p.getEditavel()).isFalse());
    }
}
