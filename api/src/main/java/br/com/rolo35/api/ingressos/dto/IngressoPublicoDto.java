package br.com.rolo35.api.ingressos.dto;

import br.com.rolo35.api.ingressos.StatusIngresso;
import java.time.LocalDateTime;

/**
 * @param codigoCurto credencial ditável na portaria. Está aqui porque o link público é o caminho de
 *     passar o ingresso pra quem vai usá-lo, e sem este campo a página não tem o que oferecer quando
 *     a câmera falha. Não é exposição nova: a própria URL do link carrega o código assinado, que a
 *     portaria também aceita. Continua sem nada do comprador — o que a rota nunca expôs, segue sem
 *     expor.
 */
public record IngressoPublicoDto(
        String sessaoTitulo, String salaNome, LocalDateTime dataHora, StatusIngresso status, String codigoCurto) {}
