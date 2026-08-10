package br.com.rolo35.api.sessoes.catalogo;

import static org.hamcrest.Matchers.not;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = FilmeController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class FilmeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TmdbClient tmdbClient;

    @Test
    void returns200WithFilmesForValidQuery() throws Exception {
        given(tmdbClient.buscarPorTitulo("clube"))
                .willReturn(List.of(new FilmeDto(
                        550L,
                        "Clube da Luta",
                        "https://image.tmdb.org/t/p/w500/poster.jpg",
                        "Sinopse do filme",
                        "1999-10-15")));

        mockMvc.perform(get("/api/filmes/buscar").param("query", "clube"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tmdbId").value(550))
                .andExpect(jsonPath("$[0].titulo").value("Clube da Luta"))
                .andExpect(jsonPath("$[0].posterUrl").value("https://image.tmdb.org/t/p/w500/poster.jpg"))
                .andExpect(jsonPath("$[0].sinopse").value("Sinopse do filme"))
                .andExpect(jsonPath("$[0].dataEstreia").value("1999-10-15"))
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("tmdb.api.token"))));
    }

    @Test
    void returns200WithEmptyListForQueryWithNoResults() throws Exception {
        given(tmdbClient.buscarPorTitulo("filme-inexistente")).willReturn(List.of());

        mockMvc.perform(get("/api/filmes/buscar").param("query", "filme-inexistente"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void returns502WithEnvelopeWhenTmdbClientThrowsCatalogoIndisponivel() throws Exception {
        given(tmdbClient.buscarPorTitulo("clube")).willThrow(new CatalogoIndisponivelException());

        mockMvc.perform(get("/api/filmes/buscar").param("query", "clube"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.codigo").value("CATALOGO_INDISPONIVEL"))
                .andExpect(jsonPath("$.mensagem").exists());
    }
}
