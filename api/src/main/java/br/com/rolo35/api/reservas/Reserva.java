package br.com.rolo35.api.reservas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "reservas")
@Getter
@NoArgsConstructor
public class Reserva {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Column(name = "sessao_id", nullable = false)
    private Long sessaoId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private StatusReserva status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    public Reserva(
            Long id, Long clienteId, Long sessaoId, StatusReserva status, Instant createdAt, LocalDateTime expiresAt) {
        this.id = id;
        this.clienteId = clienteId;
        this.sessaoId = sessaoId;
        this.status = status;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    // Mutadores estreitos (não um setter genérico de status) — Reserva é carregada dentro da
    // mesma transação via ReservaRepository.findByIdForUpdate (PESSIMISTIC_WRITE), então mutar
    // o campo aqui e deixar o dirty-checking do Hibernate cuidar do UPDATE no commit é seguro,
    // ao contrário de AssentoSessao (Persistable com PK composta, onde isso não se aplica).
    public void confirmar() {
        this.status = StatusReserva.CONFIRMADA;
    }

    /** Hold abandonado pelo próprio cliente ao reservar de novo na mesma sessão. */
    public void cancelar() {
        this.status = StatusReserva.CANCELADA;
    }

    public void recusar() {
        this.status = StatusReserva.RECUSADA;
    }
}
