package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.Sessao;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessaoRepository extends JpaRepository<Sessao, Long> {

    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM sessoes
          WHERE sala_id = :salaId
            AND data_hora < (CAST(:dataHora AS timestamp) + (INTERVAL '1 minute' * :bufferMinutos))
            AND (data_hora + (INTERVAL '1 minute' * :bufferMinutos)) > CAST(:dataHora AS timestamp)
        )""", nativeQuery = true)
    boolean existeConflitante(
            @Param("salaId") Long salaId, @Param("dataHora") LocalDateTime dataHora,
            @Param("bufferMinutos") int bufferMinutos);

    @Query(value = """
        SELECT s.id AS id, sa.nome AS salaNome, s.tmdb_id AS tmdbId, s.titulo AS titulo,
               s.poster_url AS posterUrl, s.sinopse AS sinopse, s.data_estreia AS dataEstreia,
               s.data_hora AS dataHora, s.preco AS preco,
               COUNT(DISTINCT a.id) AS capacidade,
               COUNT(DISTINCT CASE WHEN asx.status = 'LIVRE' THEN asx.assento_id END) AS assentosLivres
        FROM sessoes s
        JOIN salas sa ON sa.id = s.sala_id
        JOIN assentos a ON a.sala_id = s.sala_id
        LEFT JOIN assento_sessao asx ON asx.sessao_id = s.id AND asx.assento_id = a.id
        GROUP BY s.id, sa.nome
        ORDER BY s.data_hora
        """, nativeQuery = true)
    List<SessaoListagemProjection> listarPublicadas();
}
