package br.com.rolo35.api.auth.dto;

import br.com.rolo35.api.auth.Papel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CadastroRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 6) String senha,
        @NotNull Papel papel) {}
