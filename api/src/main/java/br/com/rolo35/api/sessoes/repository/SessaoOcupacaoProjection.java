package br.com.rolo35.api.sessoes.repository;

import java.time.LocalDateTime;

/**
 * Só id e horário: a ocupação de uma sala é mostrada pro organizador que está montando outra
 * sessão, e nada além do intervalo bloqueado é da conta dele — título e autor de cada sessão ficam
 * de fora de propósito.
 */
public interface SessaoOcupacaoProjection {

    Long getId();

    LocalDateTime getDataHora();
}
