package br.com.rolo35.api.auth.dto;

import br.com.rolo35.api.auth.Papel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Os `max` não são decoração: sem eles um campo grande demais passa pela validação, estoura a coluna
 * `VARCHAR(255)` no INSERT e vira 500 — quando a AC4 manda devolver 400 nomeando o campo.
 *
 * <p>`senha` para em 72 e não em 255 por causa do BCrypt, que trunca a entrada em 72 bytes: sem o
 * limite, duas senhas diferentes que compartilham os primeiros 72 bytes autenticariam uma pela
 * outra. Recusar na entrada torna isso impossível, em vez de silencioso.
 */
public record CadastroRequest(
        @NotBlank @Size(max = 255) String nome,
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 6, max = 72) String senha,
        @NotNull Papel papel) {}
