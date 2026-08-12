package br.com.rolo35.api.ingressos;

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
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ingressos")
@Getter
@NoArgsConstructor
public class Ingresso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "reserva_id", nullable = false)
    private Long reservaId;

    @Column(name = "assento_id", nullable = false)
    private Long assentoId;

    @Column(name = "sessao_id", nullable = false)
    private Long sessaoId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private StatusIngresso status;

    @Column(name = "validated_at")
    private LocalDateTime validatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Ingresso(
            UUID id,
            Long reservaId,
            Long assentoId,
            Long sessaoId,
            StatusIngresso status,
            LocalDateTime validatedAt,
            Instant createdAt) {
        this.id = id;
        this.reservaId = reservaId;
        this.assentoId = assentoId;
        this.sessaoId = sessaoId;
        this.status = status;
        this.validatedAt = validatedAt;
        this.createdAt = createdAt;
    }
}
