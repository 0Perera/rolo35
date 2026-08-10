package br.com.rolo35.api.sessoes.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = SessaoController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class SessaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SessaoService sessaoService;

    private CriarSessaoRequest requestValido() {
        return new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"));
    }

    @Test
    void returns201WithSessaoResponseForValidBody() throws Exception {
        SessaoResponse resposta = new SessaoResponse(
                100L, 1L, "Sala 1", 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"), 40, 10L);
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString())).willReturn(resposta);

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.salaId").value(1))
                .andExpect(jsonPath("$.salaNome").value("Sala 1"))
                .andExpect(jsonPath("$.tmdbId").value(550))
                .andExpect(jsonPath("$.titulo").value("Clube da Luta"))
                .andExpect(jsonPath("$.capacidade").value(40))
                .andExpect(jsonPath("$.organizadorId").value(10));
    }

    @Test
    void returns400WithDataHoraNoPassadoEnvelope() throws Exception {
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString()))
                .willThrow(new DataHoraNoPassadoException());

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATA_HORA_NO_PASSADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns409WithSessaoConflitanteEnvelope() throws Exception {
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString()))
                .willThrow(new SessaoConflitanteException());

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SESSAO_CONFLITANTE"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns400WithParametroInvalidoWhenSalaIdIsNull() throws Exception {
        CriarSessaoRequest request = new CriarSessaoRequest(
                null, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusDays(30),
                new BigDecimal("25.00"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns400WithParametroInvalidoWhenPrecoIsNegative() throws Exception {
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusDays(30),
                new BigDecimal("-1.00"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }
}
