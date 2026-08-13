package br.com.rolo35.api.ingressos.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.ingressos.IngressoEmDisputaException;
import br.com.rolo35.api.ingressos.ResultadoValidacao;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.service.PortariaService;
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
class PortariaValidacaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PortariaService portariaService;

    @Test
    void validarReturns200ComResultadoValido() throws Exception {
        ValidacaoIngressoDto dto = new ValidacaoIngressoDto(ResultadoValidacao.VALIDO, "A", 1, "Clube da Luta");
        given(portariaService.validar(anyString(), anyString())).willReturn(dto);

        mockMvc.perform(post("/api/portaria/validacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"codigo-valido\"}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultado").value("VALIDO"))
                .andExpect(jsonPath("$.assentoFileira").value("A"));
    }

    @Test
    void validarReturns400ComCodigoEmBranco() throws Exception {
        mockMvc.perform(post("/api/portaria/validacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"\"}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void validarReturns400ComCodigoAusente() throws Exception {
        mockMvc.perform(post("/api/portaria/validacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void validarReturns409QuandoSemSessaoAtiva() throws Exception {
        given(portariaService.validar(anyString(), anyString())).willThrow(new SessaoAtivaNaoSelecionadaException());

        mockMvc.perform(post("/api/portaria/validacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"algum-codigo\"}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SESSAO_ATIVA_NAO_SELECIONADA"));
    }

    @Test
    void validarReturns409QuandoIngressoEmDisputa() throws Exception {
        given(portariaService.validar(anyString(), anyString())).willThrow(new IngressoEmDisputaException());

        mockMvc.perform(post("/api/portaria/validacoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"algum-codigo\"}")
                        .principal(new UsernamePasswordAuthenticationToken("portaria@rolo35.com.br", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("INGRESSO_EM_DISPUTA"));
    }
}
