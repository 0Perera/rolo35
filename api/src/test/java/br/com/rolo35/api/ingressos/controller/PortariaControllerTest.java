package br.com.rolo35.api.ingressos.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.service.PortariaService;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PortariaController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class PortariaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PortariaService portariaService;

    @Test
    void selecionarSessaoReturns200ComSessaoValida() throws Exception {
        SessaoAtivaDto dto = new SessaoAtivaDto(1L, "Clube da Luta", "Sala 1", LocalDateTime.now().plusDays(1));
        given(portariaService.selecionarSessao(anyString(), anyLong())).willReturn(dto);

        mockMvc.perform(post("/api/portaria/turno")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessaoId\":1}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessaoId").value(1))
                .andExpect(jsonPath("$.titulo").value("Clube da Luta"));
    }

    @Test
    void selecionarSessaoReturns400ComSessaoIdAusente() throws Exception {
        mockMvc.perform(post("/api/portaria/turno")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void selecionarSessaoReturns404QuandoSessaoNaoEncontrada() throws Exception {
        given(portariaService.selecionarSessao(anyString(), anyLong())).willThrow(new SessaoNaoEncontradaException());

        mockMvc.perform(post("/api/portaria/turno")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessaoId\":99}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("SESSAO_NAO_ENCONTRADA"));
    }

    @Test
    void sessaoAtivaReturns200QuandoSelecionada() throws Exception {
        SessaoAtivaDto dto = new SessaoAtivaDto(1L, "Clube da Luta", "Sala 1", LocalDateTime.now().plusDays(1));
        given(portariaService.sessaoAtiva(anyString())).willReturn(dto);

        mockMvc.perform(get("/api/portaria/turno")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessaoId").value(1));
    }

    @Test
    void sessaoAtivaReturns409QuandoNaoSelecionada() throws Exception {
        given(portariaService.sessaoAtiva(anyString())).willThrow(new SessaoAtivaNaoSelecionadaException());

        mockMvc.perform(get("/api/portaria/turno")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SESSAO_ATIVA_NAO_SELECIONADA"));
    }
}
