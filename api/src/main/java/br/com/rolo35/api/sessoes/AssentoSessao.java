package br.com.rolo35.api.sessoes;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "assento_sessao")
@Getter
@NoArgsConstructor
public class AssentoSessao implements Persistable<AssentoSessaoId> {

    @EmbeddedId
    private AssentoSessaoId id;

    // O enum já existia (StatusAssento) e a coluna já é CHECK-ada pros mesmos três valores no
    // schema — só o campo continuava String, então cada comparação virava .name().equals() e
    // qualquer literal errado passava batido até o banco recusar. Agora o compilador cobra.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusAssento status;

    @Column(name = "reserva_id")
    private Long reservaId;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    // Com @EmbeddedId atribuído em código, o isNew() padrão do Spring Data olha só pro id
    // não-nulo e conclui "já existe" — o save vira merge, que dispara um SELECT por linha
    // antes de cada INSERT. Dentro da transação que segura o lock da sala (AD-5) isso são
    // dezenas de round-trips desnecessários. Persistable devolve o controle pro código.
    @Transient
    private boolean novo;

    public AssentoSessao(AssentoSessaoId id, StatusAssento status, Long reservaId, LocalDateTime expiresAt) {
        this.id = id;
        this.status = status;
        this.reservaId = reservaId;
        this.expiresAt = expiresAt;
        this.novo = true;
    }

    @Override
    public AssentoSessaoId getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return novo;
    }

    @PostPersist
    @PostLoad
    void marcaComoPersistido() {
        this.novo = false;
    }
}
