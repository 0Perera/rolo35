package br.com.rolo35.api.ingressos.dto;

import java.time.LocalDateTime;

public record SessaoAtivaDto(Long sessaoId, String titulo, String salaNome, LocalDateTime dataHora) {}
