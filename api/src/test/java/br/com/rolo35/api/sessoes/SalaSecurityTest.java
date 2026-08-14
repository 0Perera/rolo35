package br.com.rolo35.api.sessoes;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.sessoes.controller.SalaController;
import br.com.rolo35.api.sessoes.dto.SalaResumoDto;
import br.com.rolo35.api.sessoes.service.SalaService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Complementa {@link br.com.rolo35.api.sessoes.controller.SalaControllerTest}, que desliga os
 * filtros com {@code addFilters = false} e por isso não enxerga regra de segurança nenhuma.
 */
@WebMvcTest(controllers = SalaController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class SalaSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SalaService salaService;

    // O filtro de sala da vitrine é público como a própria vitrine: quem monta a lista de opções é
    // esta rota, e sem matcher próprio ela herda .anyRequest().authenticated() e responde 401 pro
    // visitante deslogado — o seletor abre com "TODAS AS SALAS" e mais nada, sem erro visível.
    @Test
    void returns200ForGetSalasWithoutAnyToken() throws Exception {
        given(salaService.listar()).willReturn(List.of(new SalaResumoDto(1L, "Sala 1", 40)));

        mockMvc.perform(get("/api/salas")).andExpect(status().isOk());
    }
}
