package br.com.rolo35.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "usuarios")
@Getter
@NoArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @Column(nullable = false)
    private String papel;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /**
     * Conta nova. `createdAt` é carimbado aqui, e não deixado a cargo de quem chama, porque a coluna
     * é `NOT NULL` e um esquecimento só apareceria como falha de constraint no insert. `senhaHash`
     * no nome do parâmetro é lembrete de contrato: quem constrói já traz o hash, este construtor
     * nunca vê senha em texto puro (AC1).
     */
    public Usuario(String nome, String email, String senhaHash, String papel) {
        this.nome = nome;
        this.email = email;
        this.senhaHash = senhaHash;
        this.papel = papel;
        this.createdAt = Instant.now();
    }
}
