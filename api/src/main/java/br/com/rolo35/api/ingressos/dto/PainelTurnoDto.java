package br.com.rolo35.api.ingressos.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Painel de acompanhamento do turno da portaria (FR-21).
 *
 * <p>{@code emitidos} é o total de ingressos vendidos pra sessão, não a capacidade da sala: uma
 * sessão com 62 ingressos vendidos e 37 pessoas dentro mostra "37 / 62", e não "37 / 120", que
 * leria como sala vazia.
 *
 * <p>Nenhum campo identifica cliente e nenhum campo carrega o código assinado inteiro — as duas
 * omissões são deliberadas (FR-19 e FR-14).
 */
public record PainelTurnoDto(long validados, long emitidos, List<LeituraTurnoDto> leituras) {

    public record LeituraTurnoDto(
            String codigoCurto, String assentoFileira, int assentoNumero, LocalDateTime validadoEm) {}
}
