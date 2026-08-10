package br.com.rolo35.api.sessoes.catalogo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class TmdbClientTest {

    private static final String VALID_TOKEN = "token-valido-de-teste";

    @Test
    void mapeiaRespostaDoTmdbParaFilmeDto() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TmdbClient client = new TmdbClient(builder, VALID_TOKEN);

        server.expect(requestTo(containsString("/search/movie")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer " + VALID_TOKEN))
                .andRespond(withSuccess(
                        """
                        {
                          "results": [
                            {
                              "id": 550,
                              "title": "Clube da Luta",
                              "poster_path": "/poster.jpg",
                              "overview": "Sinopse do filme",
                              "release_date": "1999-10-15"
                            },
                            {
                              "id": 551,
                              "title": "Sem pôster",
                              "poster_path": null,
                              "overview": "Outra sinopse",
                              "release_date": ""
                            }
                          ]
                        }
                        """,
                        MediaType.APPLICATION_JSON));

        List<FilmeDto> filmes = client.buscarPorTitulo("clube");

        assertThat(filmes).hasSize(2);
        assertThat(filmes.get(0).tmdbId()).isEqualTo(550L);
        assertThat(filmes.get(0).titulo()).isEqualTo("Clube da Luta");
        assertThat(filmes.get(0).posterUrl()).isEqualTo("https://image.tmdb.org/t/p/w500/poster.jpg");
        assertThat(filmes.get(0).sinopse()).isEqualTo("Sinopse do filme");
        assertThat(filmes.get(0).dataEstreia()).isEqualTo("1999-10-15");
        assertThat(filmes.get(1).posterUrl()).isNull();
        assertThat(filmes.get(1).dataEstreia()).isNull();
    }

    @Test
    void lancaCatalogoIndisponivelQuandoTokenEmBranco() {
        TmdbClient client = new TmdbClient(RestClient.builder(), "   ");

        assertThatThrownBy(() -> client.buscarPorTitulo("qualquer"))
                .isInstanceOf(CatalogoIndisponivelException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {401, 500, 503})
    void lancaCatalogoIndisponivelQuandoTmdbRespondeErroHttp(int statusCode) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TmdbClient client = new TmdbClient(builder, VALID_TOKEN);

        server.expect(requestTo(containsString("/search/movie")))
                .andRespond(withStatus(HttpStatus.valueOf(statusCode)));

        assertThatThrownBy(() -> client.buscarPorTitulo("qualquer"))
                .isInstanceOf(CatalogoIndisponivelException.class);
    }

    @Test
    void lancaCatalogoIndisponivelQuandoTmdbDaTimeout() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TmdbClient client = new TmdbClient(builder, VALID_TOKEN);

        server.expect(requestTo(containsString("/search/movie")))
                .andRespond(request -> {
                    throw new SocketTimeoutException("timeout simulado");
                });

        assertThatThrownBy(() -> client.buscarPorTitulo("qualquer"))
                .isInstanceOf(CatalogoIndisponivelException.class);
    }
}
