package br.com.rolo35.api.ingressos.repository;

import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.StatusIngresso;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IngressoRepository extends JpaRepository<Ingresso, UUID> {

    List<Ingresso> findByReservaId(Long reservaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Ingresso i where i.id = :id")
    Optional<Ingresso> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Mesmo lock do caminho por QR: a validação por código curto transiciona
     * {@code VALIDO → UTILIZADO} igual, e duas leituras simultâneas do mesmo ingresso (uma por
     * câmera, outra digitada) precisam serializar do mesmo jeito.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Ingresso i where i.codigoCurto = :codigoCurto")
    Optional<Ingresso> findByCodigoCurtoForUpdate(@Param("codigoCurto") String codigoCurto);

    // JOIN ... ON explícito, mesmo padrão de AssentoSessaoRepository.buscarMapaPorSessao()
    // (Story 3.1): Ingresso guarda só IDs soltos (reservaId/assentoId/sessaoId), sem
    // associação @ManyToOne mapeada entre as entidades. Evita N+1 na tela "Meus Ingressos" —
    // 4 tabelas numa query só, em vez de uma consulta por ingresso.
    // `i.id` fecha a ordenação: `dataHora` e `createdAt` empatam quando a emissão salva os
    // ingressos de uma reserva no mesmo microssegundo, e com empate a ordem entre páginas fica por
    // conta do plano do banco — a mesma linha pode voltar na página 2 e outra sumir. Sem paginação
    // isso era invisível; com ela, é o tipo de defeito que ninguém reproduz sob demanda.
    //
    // O countQuery é explícito não porque o derivado erre, mas porque contar não precisa de
    // Assento, Sessao nem Sala: o filtro é `r.clienteId`, e o derivado carregaria os quatro JOINs
    // a cada página só pra chegar num número.
    @Query(
            value =
                    """
            SELECT i.id AS id, i.status AS status, i.codigoCurto AS codigoCurto,
                   a.fileira AS assentoFileira, a.numero AS assentoNumero,
                   s.titulo AS sessaoTitulo, s.posterUrl AS sessaoPosterUrl, sa.nome AS salaNome, s.dataHora AS dataHora
            FROM Ingresso i
            JOIN Reserva r ON r.id = i.reservaId
            JOIN Assento a ON a.id = i.assentoId
            JOIN Sessao s ON s.id = i.sessaoId
            JOIN Sala sa ON sa.id = s.salaId
            WHERE r.clienteId = :clienteId
            ORDER BY s.dataHora DESC, i.createdAt DESC, i.id DESC
            """,
            countQuery =
                    """
            SELECT count(i)
            FROM Ingresso i
            JOIN Reserva r ON r.id = i.reservaId
            WHERE r.clienteId = :clienteId
            """)
    Page<IngressoResumoProjection> buscarPorCliente(@Param("clienteId") Long clienteId, Pageable pageable);

    /** Quantas pessoas já entraram na sessão (FR-21). */
    long countBySessaoIdAndStatus(Long sessaoId, StatusIngresso status);

    /** Denominador do contador: ingressos emitidos pra sessão, não capacidade da sala (FR-21). */
    long countBySessaoId(Long sessaoId);

    /**
     * Histórico de entradas liberadas do turno, mais recente primeiro.
     *
     * <p>Devolve o código curto, nunca o assinado: o assinado é credencial reutilizável (AD-8) e
     * não pode aparecer numa tela. O curto listado aqui é sempre de ingresso já UTILIZADO — uma
     * segunda leitura dele devolveria JA_UTILIZADO. Também não traz nada do cliente: a portaria
     * decide entrada por assento e estado (FR-19).
     */
    @Query(
            """
            SELECT i.codigoCurto AS codigoCurto, a.fileira AS assentoFileira, a.numero AS assentoNumero,
                   i.validatedAt AS validadoEm
            FROM Ingresso i
            JOIN Assento a ON a.id = i.assentoId
            WHERE i.sessaoId = :sessaoId AND i.status = br.com.rolo35.api.ingressos.StatusIngresso.UTILIZADO
            ORDER BY i.validatedAt DESC
            """)
    List<LeituraTurnoProjection> buscarLeiturasDoTurno(@Param("sessaoId") Long sessaoId, Pageable pageable);
}
