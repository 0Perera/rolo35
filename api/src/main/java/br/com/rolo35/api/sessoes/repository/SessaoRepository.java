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

    /**
     * Sessão já começou (FR-10/FR-12): guard de reserva e de pagamento.
     *
     * <p>Usa {@code now()} do banco, e não o relógio da JVM, pra ser exatamente o complemento de
     * {@code listarPublicadas} ({@code data_hora >= now()}): com dois relógios, uma sessão podia
     * sumir da vitrine e continuar reservável. Sessão inexistente devolve {@code false} de
     * propósito — quem chama já tem tratamento próprio pra id que não existe, e inventar aqui um
     * segundo caminho de "não encontrada" só mudaria a resposta de erro de quem chuta ids.
     */
    @Query(
            value = "SELECT EXISTS (SELECT 1 FROM sessoes WHERE id = :sessaoId AND data_hora < now())",
            nativeQuery = true)
    boolean jaComecou(@Param("sessaoId") Long sessaoId);

    /**
     * Janelas em que a sala não aceita sessão nova, pro formulário avisar antes do submit.
     *
     * <p>O recorte é o mesmo de {@code existeConflitante}, não "sessões futuras": uma sessão que já
     * começou continua bloqueando enquanto o buffer dela não vencer, então o filtro é sobre o fim
     * da janela ({@code data_hora + buffer > now()}) e não sobre {@code data_hora}. Um filtro por
     * sessão futura mostraria a sala livre num horário que o {@code POST} recusaria — exatamente o
     * 409-surpresa que esta consulta existe pra evitar.
     */
    @Query(value = """
        SELECT s.id AS id, s.data_hora AS dataHora
        FROM sessoes s
        WHERE s.sala_id = :salaId
          AND (s.data_hora + (INTERVAL '1 minute' * :bufferMinutos)) > now()
        ORDER BY s.data_hora
        """, nativeQuery = true)
    List<SessaoOcupacaoProjection> listarOcupacaoDaSala(
            @Param("salaId") Long salaId, @Param("bufferMinutos") int bufferMinutos);

    /**
     * Listagem de gestão: todas as sessões do cinema, sem filtro por organizador. A coluna
     * {@code organizador_id} continua registrando quem criou cada sessão, mas não restringe mais
     * quem a vê ou edita — a equipe de organizadores é compartilhada (CAP-1, ver
     * {@code docs/decisions.md}).
     *
     * <p>Paginada pelo mesmo motivo que {@code listarPublicadas}: o {@code WHERE organizador_id = ?}
     * que o CAP-1 removeu era o único recorte desta consulta, e sem ele a resposta é o histórico
     * inteiro do cinema, crescendo indefinidamente com a agenda.
     *
     * <p>O {@code ORDER BY} desempata por {@code id}: {@code data_hora} sozinho não é único (duas
     * salas podem ter sessão no mesmo horário), e ordem instável entre páginas faz uma sessão
     * aparecer duas vezes ou nenhuma na travessia. O {@code countQuery} é explícito porque o
     * {@code GROUP BY} faria a contagem derivada contar linhas de assento, não de sessão.
     */
    @Query(value = """
        SELECT s.id AS id, s.sala_id AS salaId, sa.nome AS salaNome, s.titulo AS titulo,
               s.sinopse AS sinopse, s.data_hora AS dataHora, s.preco AS preco,
               COUNT(DISTINCT a.id) AS capacidade,
               NOT EXISTS (SELECT 1 FROM ingressos i WHERE i.sessao_id = s.id) AS editavel
        FROM sessoes s
        JOIN salas sa ON sa.id = s.sala_id
        JOIN assentos a ON a.sala_id = s.sala_id
        GROUP BY s.id, s.sala_id, sa.nome
        ORDER BY s.data_hora, s.id
        """,
            countQuery = """
        SELECT COUNT(*)
        FROM sessoes s
        JOIN salas sa ON sa.id = s.sala_id
        WHERE EXISTS (SELECT 1 FROM assentos a WHERE a.sala_id = s.sala_id)
        """,
            nativeQuery = true)
    Page<SessaoGestaoProjection> findParaGestao(Pageable pageable);

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
