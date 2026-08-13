package br.com.rolo35.api.ingressos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "turno_portaria")
@Getter
@NoArgsConstructor
public class TurnoPortaria {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "sessao_id", nullable = false)
    private Long sessaoId;

    @Column(name = "selecionado_em", nullable = false)
    private LocalDateTime selecionadoEm;

    public TurnoPortaria(Long usuarioId, Long sessaoId, LocalDateTime selecionadoEm) {
        this.usuarioId = usuarioId;
        this.sessaoId = sessaoId;
        this.selecionadoEm = selecionadoEm;
    }
}
