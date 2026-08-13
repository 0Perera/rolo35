package br.com.rolo35.api.ingressos.service;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CodigoIngressoService {

    private final SecretKey signingKey;

    public CodigoIngressoService(@Value("${ticket.hmac.secret}") String secret) {
        // Falha rápida no boot: SecretKeySpec puro (ao contrário de Keys.hmacShaKeyFor() da lib
        // jjwt, usada por JwtService) não valida a chave — um TICKET_HMAC_SECRET em branco
        // construiria uma chave HMAC degenerada silenciosamente, só falhando (ou pior, não
        // falhando) na primeira assinatura.
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("TICKET_HMAC_SECRET não pode ser vazio");
        }
        this.signingKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    public String gerar(UUID id) {
        return id + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(assinar(id));
    }

    public boolean validar(UUID id, String codigo) {
        String[] partes = codigo.split("\\.", 2);
        if (partes.length != 2 || !partes[0].equals(id.toString())) {
            return false;
        }
        byte[] esperado = assinar(id);
        byte[] recebido;
        try {
            recebido = Base64.getUrlDecoder().decode(partes[1]);
        } catch (IllegalArgumentException e) {
            return false;
        }
        return MessageDigest.isEqual(esperado, recebido);
    }

    // Reaproveita o mesmo parsing que validar() já faz internamente (Story 4.2: buscarPublico()
    // precisa do id antes de validar a assinatura). Optional.empty() cobre tanto formato
    // malformado quanto UUID inválido — o chamador trata os dois como "não encontrado".
    public Optional<UUID> extrairId(String codigo) {
        String[] partes = codigo.split("\\.", 2);
        if (partes.length != 2) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(partes[0]));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private byte[] assinar(UUID id) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(signingKey);
            return mac.doFinal(id.toString().getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException(e);
        }
    }
}
