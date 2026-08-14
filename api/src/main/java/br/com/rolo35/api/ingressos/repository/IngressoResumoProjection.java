package br.com.rolo35.api.ingressos.repository;

import br.com.rolo35.api.ingressos.StatusIngresso;
import java.time.LocalDateTime;
import java.util.UUID;

public interface IngressoResumoProjection {

    /** O código de digitação manual, pra que a carteira mostre o mesmo que o canhoto da compra. */
    String getCodigoCurto();
    UUID getId();

    StatusIngresso getStatus();

    String getAssentoFileira();

    Integer getAssentoNumero();

    String getSessaoTitulo();

    String getSessaoPosterUrl();

    String getSalaNome();

    LocalDateTime getDataHora();
}
