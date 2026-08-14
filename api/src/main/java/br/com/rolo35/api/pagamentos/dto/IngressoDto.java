package br.com.rolo35.api.pagamentos.dto;

import java.util.UUID;

/**
 * @param codigo código assinado por HMAC — é o que vai no QR e no link público.
 * @param codigoCurto o mesmo ingresso, no formato que dá pra ditar na portaria quando a câmera não
 *     lê. Vem junto porque é aqui, na resposta do pagamento, que o cliente recebe o canhoto: a
 *     carteira não devolve código nenhum, por decisão da Story 4.2.
 */
public record IngressoDto(UUID id, Long assentoId, String codigo, String codigoCurto) {}
