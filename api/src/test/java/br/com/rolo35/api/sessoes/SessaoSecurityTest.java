package br.com.rolo35.api.sessoes;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.sessoes.controller.SessaoController;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = SessaoController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class SessaoSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private SessaoService sessaoService;

    private CriarSessaoRequest requestValido() {
        return new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"));
    }

    @Test
    void returns201ForOrganizadorToken() throws Exception {
        SessaoResponse resposta = new SessaoResponse(
                100L, 1L, "Sala 1", 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"), 40, 10L);
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString())).willReturn(resposta);
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(post("/api/sessoes")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isCreated());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForClienteToken() throws Exception {
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(post("/api/sessoes")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");

        mockMvc.perform(post("/api/sessoes")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    // Sem authenticationEntryPoint próprio, o default do Spring Security responde 403 de corpo
    // vazio — o front não consegue distinguir "sessão expirou" de "erro de rede".
    @Test
    void returns401WithNaoAutenticadoEnvelopeWithoutToken() throws Exception {
        mockMvc.perform(post("/api/sessoes")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns401WithNaoAutenticadoEnvelopeForMalformedToken() throws Exception {
        mockMvc.perform(post("/api/sessoes")
                        .header("Authorization", "Bearer nao-e-um-jwt")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    // AC1 desta story: visitante sem conta precisa ver a listagem. Sem essa checagem, uma
    // story futura poderia esquecer o permitAll() de GET /api/sessoes e regressar em silêncio
    // pra 401/403 herdado de .anyRequest().authenticated().
    @Test
    void returns200ForGetSessoesWithoutAnyToken() throws Exception {
        given(sessaoService.listarPublicadas()).willReturn(List.of());

        mockMvc.perform(get("/api/sessoes")).andExpect(status().isOk());
    }
}
