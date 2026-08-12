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
}
