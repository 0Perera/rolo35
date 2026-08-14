package br.com.rolo35.api.sessoes.dto;

import java.time.LocalDateTime;

/**
 * Uma janela em que a sala não aceita sessão nova. {@code bloqueadoDe}/{@code bloqueadoAte} já vêm
 * com o buffer aplicado — a regra de conflito mora no back-end, e o formulário só desenha o que
 * recebe.
 *
 * @param sessaoId identifica a própria sessão em edição, pra que o formulário não mostre como
 *     obstáculo a janela que ele mesmo ocupa.
 */
public record OcupacaoSalaDto(
        Long sessaoId, LocalDateTime dataHora, LocalDateTime bloqueadoDe, LocalDateTime bloqueadoAte) {}
