package br.com.rolo35.api.sessoes;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "assento_sessao")
@Getter
@NoArgsConstructor
@Builder
public class AssentoSessao {

    @EmbeddedId
    private AssentoSessaoId id;

    @Column(nullable = false)
    private String status;

    @Column(name = "reserva_id")
    private Long reservaId;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    public AssentoSessao(AssentoSessaoId id, String status, Long reservaId, LocalDateTime expiresAt) {
        this.id = id;
        this.status = status;
        this.reservaId = reservaId;
        this.expiresAt = expiresAt;
    }
}
