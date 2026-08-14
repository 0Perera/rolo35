package br.com.rolo35.api.common;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * Envelope de resposta paginada.
 *
 * <p>Existe em vez de serializar o {@code Page} do Spring Data direto porque o JSON do {@code Page}
 * é uma estrutura interna do framework — muda entre versões e carrega campos que ninguém consome
 * ({@code pageable}, {@code sort.unsorted}, {@code first}). AD-12 exige contrato explícito por
 * endpoint; este é o contrato.
 */
public record PaginaDto<T>(List<T> conteudo, int pagina, int tamanho, long total, int totalPaginas) {

    public static <O, D> PaginaDto<D> de(Page<O> pagina, java.util.function.Function<O, D> mapear) {
        return new PaginaDto<>(
                pagina.getContent().stream().map(mapear).toList(),
                pagina.getNumber(),
                pagina.getSize(),
                pagina.getTotalElements(),
                pagina.getTotalPages());
    }
}
