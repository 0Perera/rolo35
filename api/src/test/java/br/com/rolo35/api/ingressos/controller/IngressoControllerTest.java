package br.com.rolo35.api.ingressos.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.ingressos.IngressoNaoEncontradoException;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.dto.IngressoPublicoDto;
import br.com.rolo35.api.ingressos.dto.IngressoResumoDto;
import br.com.rolo35.api.ingressos.service.IngressoService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = IngressoController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class IngressoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IngressoService ingressoService;

    @Test
    void minhasReturns200WithArrayForClienteToken() throws Exception {
        IngressoResumoDto dto = new IngressoResumoDto(
                UUID.randomUUID(), StatusIngresso.VALIDO, "A", 1, "Sessão fixture", null, "Sala 1",
                LocalDateTime.now().plusDays(1), "codigo-x");
        given(ingressoService.listarMinhas(anyString())).willReturn(List.of(dto));

        mockMvc.perform(get("/api/ingressos/minhas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].salaNome").value("Sala 1"));
    }

    @Test
    void buscarPublicoReturns200SemDadoDoClienteOuCodigo() throws Exception {
        IngressoPublicoDto dto =
                new IngressoPublicoDto("Sessão fixture", "Sala 1", LocalDateTime.now().plusDays(1), StatusIngresso.VALIDO);
        given(ingressoService.buscarPublico(anyString())).willReturn(dto);

        mockMvc.perform(get("/api/ingressos/algum-codigo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessaoTitulo").value("Sessão fixture"))
                .andExpect(jsonPath("$.salaNome").value("Sala 1"))
                .andExpect(jsonPath("$.status").value("VALIDO"))
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.clienteId").doesNotExist())
                .andExpect(jsonPath("$.codigo").doesNotExist());
    }

    @Test
    void buscarPublicoReturns404WithIngressoNaoEncontradoWhenServiceRejects() throws Exception {
        given(ingressoService.buscarPublico(anyString())).willThrow(new IngressoNaoEncontradoException());

        mockMvc.perform(get("/api/ingressos/codigo-invalido"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("INGRESSO_NAO_ENCONTRADO"));
    }
}
