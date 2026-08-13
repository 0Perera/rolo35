package br.com.rolo35.api.ingressos.dto;

import jakarta.validation.constraints.NotBlank;

public record ValidarIngressoRequest(@NotBlank String codigo) {}
