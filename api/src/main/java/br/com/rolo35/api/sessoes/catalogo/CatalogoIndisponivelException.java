package br.com.rolo35.api.sessoes.catalogo;

public class CatalogoIndisponivelException extends RuntimeException {

    public CatalogoIndisponivelException() {
        super("Catálogo de filmes indisponível no momento");
    }
}
