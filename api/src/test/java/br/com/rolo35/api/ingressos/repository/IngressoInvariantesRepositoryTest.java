package br.com.rolo35.api.ingressos.repository;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rolo35.api.TestcontainersConfiguration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Os backstops de banco da V8 exercitados por INSERT direto, e não pelo service: a graça deles é
 * justamente valer pra quem não passa por {@code PagamentoService.confirmar()}.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class IngressoInvariantesRepositoryTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long sessaoId;
    private Long assentoDaSessao;
    private Long reservaId;

    @BeforeEach
    void preparaReserva() {
        sessaoId = jdbcTemplate.queryForObject("SELECT sessao_id FROM assento_sessao LIMIT 1", Long.class);
        assentoDaSessao = jdbcTemplate.queryForObject(
                "SELECT assento_id FROM assento_sessao WHERE sessao_id = ? ORDER BY assento_id LIMIT 1",
                Long.class, sessaoId);
        Long clienteId = jdbcTemplate.queryForObject(
                "SELECT id FROM usuarios WHERE email = 'cliente1@rolo35.com.br'", Long.class);
        reservaId = jdbcTemplate.queryForObject(
                "INSERT INTO reservas (cliente_id, sessao_id, status) VALUES (?, ?, 'CONFIRMADA') RETURNING id",
                Long.class, clienteId, sessaoId);
    }

    @AfterEach
    void limpa() {
        jdbcTemplate.update("DELETE FROM ingressos WHERE reserva_id = ?", reservaId);
        jdbcTemplate.update("DELETE FROM reservas WHERE id = ?", reservaId);
    }

    private void insereIngresso(Long assentoId) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO ingressos (id, reserva_id, assento_id, sessao_id, codigo_curto, status)
                VALUES (?, ?, ?, ?, ?, 'VALIDO')
                """,
                id, reservaId, assentoId, sessaoId, codigoCurtoDe(id));
    }

    /** Único por ingresso, que é o que a coluna exige — a aleatoriedade real fica na emissão. */
    private static String codigoCurtoDe(UUID id) {
        return id.toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    /**
     * Assento que existe (passa pela FK de {@code assentos}) e sessão que existe (passa pela FK de
     * {@code sessoes}), mas que juntos não formam linha nenhuma do mapa — o buraco exato que as
     * duas FKs separadas deixavam aberto.
     */
    @Test
    void ingressoDeAssentoForaDoMapaDaSessaoNaoEntra() {
        Long assentoDeOutraSala = jdbcTemplate.queryForObject(
                """
                SELECT a.id FROM assentos a
                WHERE NOT EXISTS (
                  SELECT 1 FROM assento_sessao asx WHERE asx.sessao_id = ? AND asx.assento_id = a.id)
                ORDER BY a.id LIMIT 1
                """,
                Long.class, sessaoId);

        assertThatThrownBy(() -> insereIngresso(assentoDeOutraSala))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aMesmaReservaNaoEmiteDoisIngressosProMesmoAssento() {
        assertThatCode(() -> insereIngresso(assentoDaSessao)).doesNotThrowAnyException();

        assertThatThrownBy(() -> insereIngresso(assentoDaSessao))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /** A linha do mapa que sustenta um ingresso emitido não pode mais ser apagada por baixo dele. */
    @Test
    void apagarLinhaDoMapaComIngressoEmitidoNaoPassa() {
        insereIngresso(assentoDaSessao);

        assertThatThrownBy(() -> jdbcTemplate.update(
                        "DELETE FROM assento_sessao WHERE sessao_id = ? AND assento_id = ?",
                        sessaoId, assentoDaSessao))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /** Assentos diferentes da mesma reserva continuam sendo o caso normal de uma compra em lote. */
    @Test
    void assentosDiferentesDaMesmaReservaContinuamPassando() {
        List<Long> doisAssentos = jdbcTemplate.queryForList(
                "SELECT assento_id FROM assento_sessao WHERE sessao_id = ? ORDER BY assento_id LIMIT 2",
                Long.class, sessaoId);

        assertThatCode(() -> doisAssentos.forEach(this::insereIngresso)).doesNotThrowAnyException();
    }
}
