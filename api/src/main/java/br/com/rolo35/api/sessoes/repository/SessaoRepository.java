package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.Sessao;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessaoRepository extends JpaRepository<Sessao, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Sessao s where s.id = :id")
    Optional<Sessao> findByIdForUpdate(@Param("id") Long id);

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
        SELECT EXISTS (
          SELECT 1 FROM sessoes
          WHERE sala_id = :salaId
            AND id != :sessaoIdExcluir
            AND data_hora < (CAST(:dataHora AS timestamp) + (INTERVAL '1 minute' * :bufferMinutos))
            AND (data_hora + (INTERVAL '1 minute' * :bufferMinutos)) > CAST(:dataHora AS timestamp)
        )""", nativeQuery = true)
    boolean existeConflitanteExcluindo(
            @Param("salaId") Long salaId, @Param("dataHora") LocalDateTime dataHora,
            @Param("bufferMinutos") int bufferMinutos, @Param("sessaoIdExcluir") Long sessaoIdExcluir);

    @Query(value = "SELECT EXISTS (SELECT 1 FROM ingressos WHERE sessao_id = :sessaoId)", nativeQuery = true)
    boolean existeIngressoConfirmado(@Param("sessaoId") Long sessaoId);

    @Query(value = """
        SELECT s.id AS id, s.sala_id AS salaId, sa.nome AS salaNome, s.titulo AS titulo,
               s.data_hora AS dataHora, s.preco AS preco,
               COUNT(DISTINCT a.id) AS capacidade,
               NOT EXISTS (SELECT 1 FROM ingressos i WHERE i.sessao_id = s.id) AS editavel
        FROM sessoes s
        JOIN salas sa ON sa.id = s.sala_id
        JOIN assentos a ON a.sala_id = s.sala_id
        WHERE s.organizador_id = :organizadorId
        GROUP BY s.id, s.sala_id, sa.nome
        ORDER BY s.data_hora
        """, nativeQuery = true)
    List<SessaoGestaoProjection> findByOrganizadorId(@Param("organizadorId") Long organizadorId);

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
        WHERE s.data_hora >= now()
        GROUP BY s.id, sa.nome
        ORDER BY s.data_hora
        """, nativeQuery = true)
    List<SessaoListagemProjection> listarPublicadas();
}
