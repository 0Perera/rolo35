package br.com.rolo35.api.ingressos.service;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CodigoIngressoService {

    /** Base32 Crockford: sem I, L, O e U — os caracteres que a leitura humana confunde. */
    private static final String ALFABETO_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    private static final int TAMANHO_CODIGO_CURTO = 8;
    private static final SecureRandom ALEATORIO = new SecureRandom();

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

    /**
     * Código curto pro caminho de digitação manual na portaria — o de sempre, quando a câmera não
     * lê. Base32 Crockford: sem {@code I}, {@code L}, {@code O} e {@code U}, justamente os
     * caracteres que quem digita confunde com 1, 0 e entre si.
     *
     * <p>São 40 bits de {@link SecureRandom}, não um prefixo do UUID nem um contador: prefixo de id
     * vaza ordem de emissão e contador seria adivinhável de fora. Ainda assim é mais fraco que o
     * código assinado por HMAC, e por isso vale só em {@code POST /api/portaria/validacoes}, que
     * exige token de portaria — força bruta aqui pressupõe uma conta de operador. O QR, o link
     * público e a leitura por câmera continuam usando exclusivamente o código assinado.
     */
    public String gerarCodigoCurto() {
        StringBuilder codigo = new StringBuilder(TAMANHO_CODIGO_CURTO);
        for (int i = 0; i < TAMANHO_CODIGO_CURTO; i++) {
            codigo.append(ALFABETO_CROCKFORD.charAt(ALEATORIO.nextInt(ALFABETO_CROCKFORD.length())));
        }
        return codigo.toString();
    }

    /**
     * Texto digitado → código curto canônico, ou {@link Optional#empty()} se não puder ser um.
     *
     * <p>Aplica a tolerância que o Crockford define pra leitura: caixa não importa, {@code I} e
     * {@code L} viram {@code 1}, {@code O} vira {@code 0}, e hífen/espaço de agrupamento somem.
     * Sem isso, quem digita o que está escrito no canhoto acerta e o sistema diz que não existe.
     */
    public Optional<String> normalizarCodigoCurto(String codigo) {
        if (codigo == null) {
            return Optional.empty();
        }
        String canonico = codigo.trim()
                .toUpperCase(Locale.ROOT)
                .replace("-", "")
                .replace(" ", "")
                .replace('I', '1')
                .replace('L', '1')
                .replace('O', '0');
        if (canonico.length() != TAMANHO_CODIGO_CURTO) {
            return Optional.empty();
        }
        boolean todosNoAlfabeto = canonico.chars().allMatch(c -> ALFABETO_CROCKFORD.indexOf(c) >= 0);
        return todosNoAlfabeto ? Optional.of(canonico) : Optional.empty();
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
