package br.com.rolo35.api.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * Converte página e tamanho vindos da query string num {@link Pageable} seguro.
 *
 * <p>Mora junto do {@link PaginaDto} porque é a outra metade do mesmo contrato: um sanitiza o que
 * entra, o outro define o que sai. Ficar em cada service faria o teto de tamanho ser regra
 * duplicada — e regra duplicada é regra que só é corrigida num dos lugares.
 */
public final class Paginacao {

    public static final int TAMANHO_PADRAO = 12;
    public static final int TAMANHO_MAXIMO = 50;

    private Paginacao() {}

    /**
     * Teto de servidor: sem ele, um cliente pede {@code tamanho=1000000} e a "paginação" vira uma
     * listagem completa disfarçada, com o custo de memória e de rede que a paginação existia pra
     * evitar. Entrada inválida cai no padrão em vez de estourar — página e tamanho são parâmetros
     * de navegação, não entrada de negócio: recusar com 400 puniria quem colou um link torto.
     */
    public static Pageable de(int pagina, int tamanho) {
        return PageRequest.of(Math.max(pagina, 0), limitarTamanho(tamanho));
    }

    private static int limitarTamanho(int tamanho) {
        if (tamanho < 1) {
            return TAMANHO_PADRAO;
        }
        return Math.min(tamanho, TAMANHO_MAXIMO);
    }
}
