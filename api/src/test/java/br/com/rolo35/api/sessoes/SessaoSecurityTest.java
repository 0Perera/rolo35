package br.com.rolo35.api.sessoes;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.sessoes.controller.SessaoController;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoGestaoDto;
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

    // AC1 desta story (3.1): visitante sem conta precisa ver o mapa de assentos de uma sessão
    // específica antes de decidir se reserva. Sem esse matcher próprio em SecurityConfig, a rota
    // herdaria .anyRequest().authenticated() em silêncio.
    @Test
    void returns200ForGetMapaAssentosWithoutAnyToken() throws Exception {
        given(sessaoService.mapaAssentos(100L)).willReturn(null);

        mockMvc.perform(get("/api/sessoes/100/mapa-assentos")).andExpect(status().isOk());
    }

    private EditarSessaoRequest editarRequestValido() {
        return new EditarSessaoRequest(
                1L, "Clube da Luta (editado)", "sinopse editada", LocalDateTime.now().plusDays(30),
                new BigDecimal("30.00"));
    }

    // Regressão explícita do risco descrito no comentário de SecurityConfig: o permitAll()
    // novo de /api/sessoes/*/mapa-assentos (Story 3.1) não pode vazar pra essa rota de gestão.
    @Test
    void returns401WithNaoAutenticadoEnvelopeForGetMinhasWithoutAnyToken() throws Exception {
        mockMvc.perform(get("/api/sessoes/minhas")).andExpect(status().isUnauthorized());
    }

    @Test
    void returns200ForGetMinhasWithOrganizadorToken() throws Exception {
        given(sessaoService.listarMinhas(anyString())).willReturn(List.of());
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(get("/api/sessoes/minhas").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForGetMinhasWithClienteToken() throws Exception {
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(get("/api/sessoes/minhas").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    // Regressão explícita do risco descrito no comentário de SecurityConfig: o permitAll()
    // novo de /api/sessoes/*/mapa-assentos (Story 3.1) não pode vazar pra essa rota de gestão.
    @Test
    void returns401WithNaoAutenticadoEnvelopeForGetByIdWithoutAnyToken() throws Exception {
        mockMvc.perform(get("/api/sessoes/100")).andExpect(status().isUnauthorized());
    }

    @Test
    void returns200ForGetByIdWithOrganizadorToken() throws Exception {
        SessaoGestaoDto dto = new SessaoGestaoDto(
                100L, 1L, "Sala 1", "Clube da Luta", "sinopse", LocalDateTime.now().plusDays(7),
                new BigDecimal("25.00"), 40, true);
        given(sessaoService.buscarPorId(anyLong(), anyString())).willReturn(dto);
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(get("/api/sessoes/100").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForGetByIdWithPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");

        mockMvc.perform(get("/api/sessoes/100").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void returns200ForPutWithOrganizadorToken() throws Exception {
        SessaoResponse resposta = new SessaoResponse(
                100L, 1L, "Sala 1", 550L, "Clube da Luta (editado)", "http://poster", "sinopse editada",
                "1999-10-15", LocalDateTime.now().plusDays(30), new BigDecimal("30.00"), 40, 10L);
        given(sessaoService.editar(anyLong(), any(EditarSessaoRequest.class), anyString())).willReturn(resposta);
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(put("/api/sessoes/100")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(editarRequestValido())))
                .andExpect(status().isOk());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForPutWithClienteToken() throws Exception {
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(put("/api/sessoes/100")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(editarRequestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }
}
