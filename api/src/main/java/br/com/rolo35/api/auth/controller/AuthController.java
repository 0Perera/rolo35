package br.com.rolo35.api.auth.controller;

import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.service.AuthService;
import br.com.rolo35.api.auth.service.LimitadorDeCadastro;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;
    private final LimitadorDeCadastro limitadorDeCadastro;

    public AuthController(AuthService authService, LimitadorDeCadastro limitadorDeCadastro) {
        this.authService = authService;
        this.limitadorDeCadastro = limitadorDeCadastro;
    }

    @PostMapping("/api/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /**
     * Devolve o mesmo `LoginResponse` do login — quem acabou de se cadastrar já entra, sem uma
     * segunda requisição só pra repetir a senha recém-digitada.
     *
     * <p>O limite roda depois do `@Valid`, e não antes, porque só quem passa da validação chega a
     * criar conta: contar corpo malformado gastaria o teto de quem errou o formulário sem nunca ter
     * criado nada.
     */
    @PostMapping("/api/auth/cadastro")
    public LoginResponse cadastrar(@Valid @RequestBody CadastroRequest request, HttpServletRequest requisicao) {
        limitadorDeCadastro.registrarTentativa(enderecoDeOrigem(requisicao));
        return authService.cadastrar(request);
    }

    /**
     * Em produção a API fica atrás do proxy do Render, então `getRemoteAddr()` devolve o endereço do
     * proxy e limitaria o mundo inteiro como se fosse um cliente só — daí ler `X-Forwarded-For`, cujo
     * primeiro elemento é o cliente original. O cabeçalho é falsificável por quem alcança a API
     * direto, e é por isso que o limite se assume atrito e não fronteira de segurança (ver
     * `LimitadorDeCadastro`). `getRemoteAddr()` continua sendo o caminho local, onde o cabeçalho não
     * existe.
     */
    private static String enderecoDeOrigem(HttpServletRequest requisicao) {
        String encaminhados = requisicao.getHeader("X-Forwarded-For");
        if (encaminhados == null || encaminhados.isBlank()) {
            return requisicao.getRemoteAddr();
        }
        String primeiro = encaminhados.split(",", 2)[0].trim();
        return primeiro.isEmpty() ? requisicao.getRemoteAddr() : primeiro;
    }
}
