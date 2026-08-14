package br.com.rolo35.api.auth;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.controller.AuthController;
import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.service.AuthService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthService authService;

    @Test
    void returns200WithTokenForValidCredentials() throws Exception {
        given(authService.login(any(LoginRequest.class))).willReturn(new LoginResponse("token-abc", "CLIENTE"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new LoginRequest("cliente1@rolo35.com.br", "cliente123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("token-abc"))
                .andExpect(jsonPath("$.papel").value("CLIENTE"));
    }

    @Test
    void returns401WithGenericEnvelopeForInvalidCredentials() throws Exception {
        given(authService.login(any(LoginRequest.class))).willThrow(new CredenciaisInvalidasException());

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new LoginRequest("cliente1@rolo35.com.br", "senha-errada"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIAIS_INVALIDAS"))
                .andExpect(jsonPath("$.mensagem").exists())
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("senhaHash"))));
    }

    @Test
    void returns401ForNonExistentEmailWithSameGenericMessage() throws Exception {
        given(authService.login(any(LoginRequest.class))).willThrow(new CredenciaisInvalidasException());

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(new LoginRequest("nao-existe@rolo35.com.br", "qualquer"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIAIS_INVALIDAS"));
    }

    private String corpoDeCadastro(String nome, String email, String senha, String papel) {
        // JSON montado à mão (e não via CadastroRequest) porque metade dos casos abaixo precisa
        // enviar um `papel` que o enum não aceita — algo que o próprio record impediria de existir.
        return """
                {"nome": %s, "email": %s, "senha": %s, "papel": %s}
                """
                .formatted(json(nome), json(email), json(senha), json(papel));
    }

    private String json(String valor) {
        return valor == null ? "null" : "\"" + valor + "\"";
    }

    @ParameterizedTest
    @ValueSource(strings = {"ORGANIZADOR", "CLIENTE", "PORTARIA"})
    void returns200WithTokenForEachPapel(String papel) throws Exception {
        given(authService.cadastrar(any(CadastroRequest.class))).willReturn(new LoginResponse("token-novo", papel));

        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(corpoDeCadastro("Fulano de Tal", "novo@rolo35.com.br", "senha123", papel)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("token-novo"))
                .andExpect(jsonPath("$.papel").value(papel));
    }

    @Test
    void returns409WhenEmailIsAlreadyRegistered() throws Exception {
        given(authService.cadastrar(any(CadastroRequest.class))).willThrow(new EmailJaCadastradoException());

        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(corpoDeCadastro("Fulano de Tal", "ocupado@rolo35.com.br", "senha123", "CLIENTE")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("EMAIL_JA_CADASTRADO"))
                .andExpect(jsonPath("$.mensagem").exists())
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("senhaHash"))));
    }

    // AC3, caminho do @NotNull: `papel` ausente é campo faltando, reprovado pelo Bean Validation.
    @Test
    void returns400WithParametroInvalidoWhenPapelIsMissing() throws Exception {
        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(corpoDeCadastro("Fulano de Tal", "novo@rolo35.com.br", "senha123", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").value(containsString("papel")));

        verify(authService, never()).cadastrar(any());
    }

    // AC3, o outro caminho: um papel fora do conjunto quebra na desserialização do enum, antes de o
    // Bean Validation rodar — por isso cai em CORPO_INVALIDO e não em PARAMETRO_INVALIDO. Os dois
    // acabam em 400 sem tocar o banco, que é o que a AC pede.
    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "PORTEIRO", "cliente"})
    void returns400WithCorpoInvalidoWhenPapelIsOutsideTheEnum(String papel) throws Exception {
        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(corpoDeCadastro("Fulano de Tal", "novo@rolo35.com.br", "senha123", papel)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("CORPO_INVALIDO"));

        verify(authService, never()).cadastrar(any());
    }

    @Test
    void returns400WithFieldNameWhenEmailIsMalformed() throws Exception {
        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(corpoDeCadastro("Fulano de Tal", "nao-e-email", "senha123", "CLIENTE")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").value(containsString("email")));

        verify(authService, never()).cadastrar(any());
    }

    @Test
    void returns400WithFieldNameWhenPasswordIsTooShort() throws Exception {
        mockMvc.perform(post("/api/auth/cadastro")
                        .contentType("application/json")
                        .content(corpoDeCadastro("Fulano de Tal", "novo@rolo35.com.br", "12345", "CLIENTE")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").value(containsString("senha")));

        verify(authService, never()).cadastrar(any());
    }
}
