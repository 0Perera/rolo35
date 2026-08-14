package br.com.rolo35.api.auth.controller;

import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/api/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /**
     * Devolve o mesmo `LoginResponse` do login — quem acabou de se cadastrar já entra, sem uma
     * segunda requisição só pra repetir a senha recém-digitada.
     */
    @PostMapping("/api/auth/cadastro")
    public LoginResponse cadastrar(@Valid @RequestBody CadastroRequest request) {
        return authService.cadastrar(request);
    }
}
