package br.com.rolo35.api.ingressos;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.ingressos.controller.PortariaController;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.service.PortariaService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PortariaController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class PortariaSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private PortariaService portariaService;

    @Test
    void selecionarSessaoReturns401WithoutToken() throws Exception {
        mockMvc.perform(post("/api/portaria/turno")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessaoId\":1}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }

    @Test
    void sessaoAtivaReturns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/portaria/turno"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }

    @Test
    void selecionarSessaoReturns403ForClienteToken() throws Exception {
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(post("/api/portaria/turno")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessaoId\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void selecionarSessaoReturns403ForOrganizadorToken() throws Exception {
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(post("/api/portaria/turno")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessaoId\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void sessaoAtivaReturns403ForClienteToken() throws Exception {
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(get("/api/portaria/turno").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void sessaoAtivaReturns403ForOrganizadorToken() throws Exception {
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(get("/api/portaria/turno").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void sessaoAtivaReturns200ForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");
        given(portariaService.sessaoAtiva(anyString()))
                .willReturn(new SessaoAtivaDto(1L, "Clube da Luta", "Sala 1", LocalDateTime.now().plusDays(1)));

        mockMvc.perform(get("/api/portaria/turno").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void selecionarSessaoReturns200ForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");
        given(portariaService.selecionarSessao(anyString(), anyLong()))
                .willReturn(new SessaoAtivaDto(1L, "Clube da Luta", "Sala 1", LocalDateTime.now().plusDays(1)));

        mockMvc.perform(post("/api/portaria/turno")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessaoId\":1}"))
                .andExpect(status().isOk());
    }

    @Test
    void validarReturns401WithoutToken() throws Exception {
        mockMvc.perform(post("/api/portaria/validacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"algum-codigo\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }

    @Test
    void validarReturns403ForClienteToken() throws Exception {
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(post("/api/portaria/validacoes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"algum-codigo\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void validarReturns403ForOrganizadorToken() throws Exception {
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(post("/api/portaria/validacoes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"algum-codigo\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void validarReturns200ForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");
        given(portariaService.validar(anyString(), anyString()))
                .willReturn(new ValidacaoIngressoDto(br.com.rolo35.api.ingressos.ResultadoValidacao.VALIDO, "A", 1, "Clube da Luta"));

        mockMvc.perform(post("/api/portaria/validacoes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"algum-codigo\"}"))
                .andExpect(status().isOk());
    }
}
