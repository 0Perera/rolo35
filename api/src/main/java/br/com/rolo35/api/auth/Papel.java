package br.com.rolo35.api.auth;

/**
 * Papéis aceitos no cadastro. Existe como tipo do campo `CadastroRequest.papel` — é o que faz o
 * Bean Validation e a desserialização do Jackson recusarem um papel inventado antes de o service
 * rodar. `Usuario.papel` continua `String` (a coluna `usuarios.papel` sempre foi genérica pros
 * três), então a conversão na hora de persistir é `papel.name()`.
 */
public enum Papel {
    ORGANIZADOR,
    CLIENTE,
    PORTARIA
}
