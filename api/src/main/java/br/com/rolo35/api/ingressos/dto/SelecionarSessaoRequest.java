package br.com.rolo35.api.ingressos.dto;

import jakarta.validation.constraints.NotNull;

public record SelecionarSessaoRequest(@NotNull Long sessaoId) {}
