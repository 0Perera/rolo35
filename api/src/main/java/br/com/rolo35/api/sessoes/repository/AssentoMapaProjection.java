package br.com.rolo35.api.sessoes.repository;

import java.time.LocalDateTime;

public interface AssentoMapaProjection {

    Long getAssentoId();

    String getFileira();

    Integer getNumero();

    String getStatus();

    LocalDateTime getExpiresAt();

    /**
     * Dono do hold que segura este assento, ou {@code null} se ele não está reservado. Existe pra
     * que o mapa consiga distinguir "reservado por você" de "reservado por outra pessoa" — sem
     * isso, quem volta do checkout pra trocar de assento vê os próprios assentos como bloqueados.
     */
    Long getClienteIdDoHold();
}
