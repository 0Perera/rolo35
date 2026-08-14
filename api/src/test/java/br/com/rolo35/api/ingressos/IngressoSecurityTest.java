package br.com.rolo35.api.ingressos;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.common.PaginaDto;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.ingressos.controller.IngressoController;
import br.com.rolo35.api.ingressos.dto.IngressoPublicoDto;
import br.com.rolo35.api.ingressos.service.IngressoService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = IngressoController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class IngressoSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private IngressoService ingressoService;

    @Test
    void minhasReturns200ForClienteToken() throws Exception {
        given(ingressoService.listarMinhas(anyString(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(), 0, 12, 0, 0));
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(get("/api/ingressos/minhas").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void minhasReturns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/ingressos/minhas"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }

    @Test
    void minhasReturns403ForOrganizadorToken() throws Exception {
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(get("/api/ingressos/minhas").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void minhasReturns403ForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");

        mockMvc.perform(get("/api/ingressos/minhas").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    // Sem token nenhum, ao contrário de /minhas: rota pública de propósito (AC3/AD-9). Passa
    // pro service mockado — prova a lacuna de autenticação, mesmo padrão de
    // SessaoSecurityTest/ReservaSecurityTest pras suas rotas públicas equivalentes.
    @Test
    void buscarPublicoReturns200WithoutToken() throws Exception {
        given(ingressoService.buscarPublico(anyString()))
                .willReturn(new IngressoPublicoDto("Sessão fixture", "Sala 1", LocalDateTime.now().plusDays(1), null));

        mockMvc.perform(get("/api/ingressos/algum-codigo")).andExpect(status().isOk());
    }
}
