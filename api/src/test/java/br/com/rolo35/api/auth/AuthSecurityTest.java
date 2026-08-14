package br.com.rolo35.api.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.controller.AuthController;
import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.service.AuthService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * `AuthControllerTest` roda com `addFilters = false` e por isso não enxerga a filter chain — sem
 * este teste, esquecer `/api/auth/cadastro` no `permitAll()` passaria despercebido até alguém tentar
 * criar conta de verdade e levar 401 (`anyRequest().authenticated()` é o padrão da configuração).
 */
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class AuthSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void cadastroReturns200WithoutToken() throws Exception {
        given(authService.cadastrar(any(CadastroRequest.class))).willReturn(new LoginResponse("token-novo", "CLIENTE"));

        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(
                                """
                                {"nome": "Fulano de Tal", "email": "novo@rolo35.com.br", "senha": "senha123", "papel": "CLIENTE"}
                                """))
                .andExpect(status().isOk());
    }

    // Contraprova: a rota liberada é exatamente a de cadastro, não um prefixo /api/auth/** que
    // deixaria passar qualquer rota de autenticação criada depois.
    @Test
    void outraRotaDeAuthContinuaExigindoToken() throws Exception {
        mockMvc.perform(post("/api/auth/cadastro/qualquer-coisa").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }
}
