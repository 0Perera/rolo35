package br.com.rolo35.api.sessoes.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Contexto de checkout de uma reserva: o assento e os dados da sessão em que ele foi reivindicado.
 * Mora em {@code sessoes.repository} porque é resultado de uma query de {@link AssentoSessaoRepository},
 * que é repositório de entidade de {@code sessoes} — a mesma direção de dependência que
 * {@code reservas} e {@code pagamentos} já seguem ao consumir esse repositório.
 */
public interface ReservaCheckoutProjection {
    Long getAssentoId();

    String getFileira();

    Integer getNumero();

    String getSessaoTitulo();

    String getSalaNome();

    LocalDateTime getDataHora();

    BigDecimal getPreco();
}
