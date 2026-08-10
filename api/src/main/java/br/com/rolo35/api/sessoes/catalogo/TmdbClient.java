package br.com.rolo35.api.sessoes.catalogo;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class TmdbClient {

    private static final String BASE_URL = "https://api.themoviedb.org/3";
    private static final String POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

    private final RestClient restClient;
    private final String apiToken;

    @Autowired
    public TmdbClient(@Value("${tmdb.api.token}") String apiToken) {
        this(defaultBuilder(), apiToken);
    }

    TmdbClient(RestClient.Builder builder, String apiToken) {
        this.apiToken = apiToken;
        this.restClient = builder.baseUrl(BASE_URL).build();
    }

    private static RestClient.Builder defaultBuilder() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(8));
        return RestClient.builder().requestFactory(requestFactory);
    }

    public List<FilmeDto> buscarPorTitulo(String query) {
        if (apiToken == null || apiToken.isBlank()) {
            throw new CatalogoIndisponivelException();
        }

        try {
            TmdbSearchResponse response = restClient
                    .get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/search/movie")
                            .queryParam("query", query)
                            .queryParam("language", "pt-BR")
                            .build())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                    .retrieve()
                    .body(TmdbSearchResponse.class);

            if (response == null || response.results() == null) {
                return List.of();
            }
            return response.results().stream().map(this::toFilmeDto).toList();
        } catch (RestClientException e) {
            throw new CatalogoIndisponivelException();
        }
    }

    private FilmeDto toFilmeDto(TmdbMovieResult resultado) {
        String posterUrl = resultado.posterPath() == null || resultado.posterPath().isBlank()
                ? null
                : POSTER_BASE_URL + resultado.posterPath();
        String dataEstreia = resultado.releaseDate() == null || resultado.releaseDate().isBlank()
                ? null
                : resultado.releaseDate();
        return new FilmeDto(resultado.id(), resultado.title(), posterUrl, resultado.overview(), dataEstreia);
    }

    private record TmdbSearchResponse(List<TmdbMovieResult> results) {}

    private record TmdbMovieResult(
            Long id,
            String title,
            @JsonProperty("poster_path") String posterPath,
            String overview,
            @JsonProperty("release_date") String releaseDate) {}
}