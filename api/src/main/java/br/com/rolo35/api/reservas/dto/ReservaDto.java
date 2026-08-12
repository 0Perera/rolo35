package br.com.rolo35.api.reservas.dto;

import br.com.rolo35.api.reservas.StatusReserva;
import java.time.LocalDateTime;
import java.util.List;

public record ReservaDto(Long id, Long sessaoId, StatusReserva status, LocalDateTime expiresAt, List<Long> assentoIds) {}
