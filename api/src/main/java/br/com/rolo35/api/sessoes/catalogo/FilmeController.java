package br.com.rolo35.api.sessoes.catalogo;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FilmeController {

    private final TmdbClient tmdbClient;

    public FilmeController(TmdbClient tmdbClient) {
        this.tmdbClient = tmdbClient;
    }

    @GetMapping("/api/filmes/buscar")
    public List<FilmeDto> buscar(@RequestParam String query) {
        return tmdbClient.buscarPorTitulo(query);
    }
}
