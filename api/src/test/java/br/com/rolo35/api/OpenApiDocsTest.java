package br.com.rolo35.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * A documentação só vale se estiver de pé e alcançável sem token. Springdoc 2.8.6 é publicado pro
 * Spring Boot 3.x e este projeto roda no 4.1 — a combinação funciona, mas é exatamente o tipo de
 * coisa que quebra em silêncio numa atualização de dependência. Este teste é o alarme.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiDocsTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void apiDocsRespondePublicamenteEDescreveAsRotasDeSessao() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.paths['/api/sessoes'].get").exists())
                .andExpect(jsonPath("$.paths['/api/portaria/validacoes'].post").exists());
    }

    @Test
    void swaggerUiRespondeSemToken() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
    }
}
