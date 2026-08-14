package br.com.rolo35.api.sessoes.repository;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * O seed é o que um avaliador vê no primeiro boot, e nada na aplicação o valida — nem o Flyway, que
 * só garante que o SQL rodou. As asserções são todas por "pelo menos", e recortadas nos títulos
 * semeados: fixtures de outros testes usam títulos próprios e só somariam ruído.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SeedSessoesRepositoryTest {

    private static final String TITULOS_SEMEADOS = "('Clube da Luta', 'Matrix', 'Cidade de Deus', 'A Origem')";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void seedTemPeloMenosSeisSessoesEDoisFilmesComMaisDeUmHorario() {
        Integer sessoes = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM sessoes WHERE titulo IN " + TITULOS_SEMEADOS, Integer.class);
        Integer filmesComVariosHorarios = jdbcTemplate.queryForObject(
                """
                SELECT count(*) FROM (
                  SELECT tmdb_id FROM sessoes WHERE titulo IN %s GROUP BY tmdb_id HAVING count(*) > 1
                ) AS t
                """.formatted(TITULOS_SEMEADOS),
                Integer.class);

        assertThat(sessoes).isGreaterThanOrEqualTo(6);
        assertThat(filmesComVariosHorarios).isGreaterThanOrEqualTo(2);
    }

    /**
     * O seed não pode criar estado que a própria aplicação recusaria criar: duas sessões na mesma
     * sala dentro do buffer de 4h são exatamente o que {@code SessaoService.criar()} rejeita com
     * {@code SESSAO_CONFLITANTE}.
     */
    @Test
    void nenhumaSessaoSemeadaConflitaComOutraNaMesmaSala() {
        List<Map<String, Object>> conflitos = jdbcTemplate.queryForList(
                """
                SELECT a.id AS id_a, b.id AS id_b
                FROM sessoes a
                JOIN sessoes b ON b.sala_id = a.sala_id AND b.id > a.id
                WHERE a.titulo IN %s AND b.titulo IN %s
                  AND abs(EXTRACT(EPOCH FROM (a.data_hora - b.data_hora))) < 240 * 60
                """.formatted(TITULOS_SEMEADOS, TITULOS_SEMEADOS));

        assertThat(conflitos).isEmpty();
    }

    @Test
    void todaSessaoSemeadaTemOMapaDeAssentosDaSuaSala() {
        List<Map<String, Object>> semMapaCompleto = jdbcTemplate.queryForList(
                """
                SELECT s.id, s.titulo
                FROM sessoes s
                WHERE s.titulo IN %s
                  AND (SELECT count(*) FROM assento_sessao asx WHERE asx.sessao_id = s.id)
                      <> (SELECT count(*) FROM assentos a WHERE a.sala_id = s.sala_id)
                """.formatted(TITULOS_SEMEADOS));

        assertThat(semMapaCompleto).isEmpty();
    }
}
