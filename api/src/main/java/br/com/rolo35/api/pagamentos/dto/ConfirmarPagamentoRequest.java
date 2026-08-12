package br.com.rolo35.api.pagamentos.dto;

import br.com.rolo35.api.pagamentos.ResultadoSimulado;
import jakarta.validation.constraints.NotNull;

public record ConfirmarPagamentoRequest(@NotNull Long reservaId, @NotNull ResultadoSimulado resultadoSimulado) {}
