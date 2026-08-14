package br.com.rolo35.api.ingressos.repository;

import java.time.LocalDateTime;
import java.util.UUID;

/** Uma entrada já liberada da sessão do turno (FR-21). */
public interface LeituraTurnoProjection {

    UUID getIngressoId();

    String getAssentoFileira();

    int getAssentoNumero();

    LocalDateTime getValidadoEm();
}
