package br.com.rolo35.api.sessoes;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Embeddable
@Getter
@NoArgsConstructor
public class AssentoSessaoId implements Serializable {

    @Column(name = "sessao_id", nullable = false)
    private Long sessaoId;

    @Column(name = "assento_id", nullable = false)
    private Long assentoId;

    public AssentoSessaoId(Long sessaoId, Long assentoId) {
        this.sessaoId = sessaoId;
        this.assentoId = assentoId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof AssentoSessaoId that)) {
            return false;
        }
        return Objects.equals(sessaoId, that.sessaoId) && Objects.equals(assentoId, that.assentoId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sessaoId, assentoId);
    }
}
