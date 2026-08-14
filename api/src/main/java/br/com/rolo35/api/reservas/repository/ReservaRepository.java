package br.com.rolo35.api.reservas.repository;

import br.com.rolo35.api.reservas.Reserva;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservaRepository extends JpaRepository<Reserva, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reserva r where r.id = :id")
    Optional<Reserva> findByIdForUpdate(@Param("id") Long id);

    /**
     * Hold ainda ativo deste cliente nesta sessão, já travado. Usado por
     * {@code ReservaService.reservar()} pra cancelar a reserva anterior quando o cliente volta e
     * escolhe outros assentos.
     *
     * <p>Trava na leitura porque o que vem depois é escrita: sem o lock, um pagamento concorrente
     * da mesma reserva poderia confirmá-la entre esta consulta e o cancelamento, e os assentos
     * seriam liberados debaixo de um ingresso já emitido.
     *
     * <p>Só {@code ATIVA} entra — reserva confirmada virou ingresso e não é hold pra recolher.
     * Não filtra por {@code expiresAt}: hold vencido continua ocupando a linha até alguém
     * reivindicar (TTL lazy, AD-4), então recolher também esse caso é o que limpa a sujeira.
     *
     * <p>Devolve lista, não {@code Optional}: depois desta mudança o cliente tem no máximo um hold
     * ativo por sessão, mas antes dela ele podia acumular vários — era o próprio bug. Um banco com
     * dados anteriores faria {@code Optional} estourar em vez de recolher a sujeira que existe.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            """
            select r from Reserva r
            where r.clienteId = :clienteId and r.sessaoId = :sessaoId and r.status = 'ATIVA'
            order by r.id
            """)
    List<Reserva> buscarAtivasDoClienteNaSessaoForUpdate(
            @Param("clienteId") Long clienteId, @Param("sessaoId") Long sessaoId);
}
