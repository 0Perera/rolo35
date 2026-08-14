package br.com.rolo35.api.ingressos.repository;

import java.time.LocalDateTime;

/** Uma entrada já liberada da sessão do turno (FR-21). */
public interface LeituraTurnoProjection {

    /**
     * O código curto persistido do ingresso — o mesmo que a pessoa tem no canhoto. Antes o painel
     * mostrava um prefixo do UUID, que servia pra conferência visual mas não era nada que o cliente
     * pudesse ler em voz alta.
     */
    String getCodigoCurto();

    String getAssentoFileira();

    int getAssentoNumero();

    LocalDateTime getValidadoEm();
}
