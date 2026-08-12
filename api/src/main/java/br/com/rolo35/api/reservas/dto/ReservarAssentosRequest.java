package br.com.rolo35.api.reservas.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReservarAssentosRequest(
        @NotNull Long sessaoId, @NotNull @Size(min = 1, max = 6) List<@NotNull Long> assentoIds) {}
