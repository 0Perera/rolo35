package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.Sessao;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
               s.sinopse AS sinopse, s.data_hora AS dataHora, s.preco AS preco,
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

    /**
     * Listagem pública paginada, com busca por título do filme, nome da sala ou data/hora escrita
     * como o brasileiro escreve ("14/08", "20:30").
     *
     * <p>Três decisões que a paginação obriga e que não são cosméticas:
     *
     * <ul>
     *   <li>{@code ORDER BY s.data_hora, s.id} — sem o desempate por id, duas sessões no mesmo
     *       horário podem trocar de posição entre duas requisições, e aí uma linha aparece em duas
     *       páginas enquanto outra não aparece em nenhuma.
     *   <li>{@code countQuery} própria, sem o {@code JOIN assentos} — a query principal multiplica
     *       linhas por assento antes de agrupar; contar sobre ela devolveria a capacidade somada
     *       das salas em vez do número de sessões.
     *   <li>{@code :tmdbId} e {@code :salaId} usam {@code 0} como "sem filtro" em vez de
     *       {@code NULL}: numa query nativa, {@code :param IS NULL} deixa o Postgres sem tipo pra
     *       inferir e a consulta estoura em runtime. Nem filme do TMDb nem sala têm id 0, então o
     *       sentinela é seguro.
     *   <li>{@code :termo} chega já como padrão LIKE montado pelo service, com {@code !}, {@code %}
     *       e {@code _} do usuário neutralizados por {@code ESCAPE '!'} — {@code !} em vez da barra
     *       invertida porque esta é escapada duas vezes no caminho (text block do Java e literal do
     *       Postgres), e o resultado disso é difícil de ler e fácil de quebrar. Não há ramo
     *       {@code IS NULL}: busca vazia vira {@code '%'}, que casa com tudo.
     * </ul>
     */
    @Query(
            value = """
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
          AND (:tmdbId = 0 OR s.tmdb_id = :tmdbId)
          AND (:salaId = 0 OR s.sala_id = :salaId)
          AND (s.titulo ILIKE :termo ESCAPE '!'
               OR sa.nome ILIKE :termo ESCAPE '!'
               OR to_char(s.data_hora, 'DD/MM/YYYY HH24:MI') ILIKE :termo ESCAPE '!')
        GROUP BY s.id, sa.nome
        ORDER BY s.data_hora, s.id
        """,
            countQuery = """
        SELECT COUNT(*)
        FROM sessoes s
        JOIN salas sa ON sa.id = s.sala_id
        WHERE s.data_hora >= now()
          AND (:tmdbId = 0 OR s.tmdb_id = :tmdbId)
          AND (:salaId = 0 OR s.sala_id = :salaId)
          AND (s.titulo ILIKE :termo ESCAPE '!'
               OR sa.nome ILIKE :termo ESCAPE '!'
               OR to_char(s.data_hora, 'DD/MM/YYYY HH24:MI') ILIKE :termo ESCAPE '!')
        """,
            nativeQuery = true)
    Page<SessaoListagemProjection> listarPublicadas(
            @Param("termo") String termo, @Param("tmdbId") long tmdbId, @Param("salaId") long salaId,
            Pageable pageable);
}
