package br.com.rolo35.api.ingressos.repository;

import br.com.rolo35.api.ingressos.Ingresso;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface IngressoRepository extends JpaRepository<Ingresso, UUID> {

    List<Ingresso> findByReservaId(Long reservaId);

    // JOIN ... ON explícito, mesmo padrão de AssentoSessaoRepository.buscarMapaPorSessao()
    // (Story 3.1): Ingresso guarda só IDs soltos (reservaId/assentoId/sessaoId), sem
    // associação @ManyToOne mapeada entre as entidades. Evita N+1 na tela "Meus Ingressos" —
    // 4 tabelas numa query só, em vez de uma consulta por ingresso.
    @Query(
            """
            SELECT i.id AS id, i.status AS status,
                   a.fileira AS assentoFileira, a.numero AS assentoNumero,
                   s.titulo AS sessaoTitulo, s.posterUrl AS sessaoPosterUrl, sa.nome AS salaNome, s.dataHora AS dataHora
            FROM Ingresso i
            JOIN Reserva r ON r.id = i.reservaId
            JOIN Assento a ON a.id = i.assentoId
            JOIN Sessao s ON s.id = i.sessaoId
            JOIN Sala sa ON sa.id = s.salaId
            WHERE r.clienteId = :clienteId
            ORDER BY s.dataHora DESC, i.createdAt DESC
            """)
    List<IngressoResumoProjection> buscarPorCliente(Long clienteId);
}
