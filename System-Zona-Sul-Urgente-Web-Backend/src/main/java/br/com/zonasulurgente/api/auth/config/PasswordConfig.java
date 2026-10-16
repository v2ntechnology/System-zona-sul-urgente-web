package br.com.zonasulurgente.api.auth.config;

import java.util.Map;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Senhas com Argon2id (ARCHITECTURE §8); o prefixo {id} permite trocar o algoritmo depois. */
@Configuration
public class PasswordConfig {

	@Bean
	PasswordEncoder passwordEncoder() {
		return new DelegatingPasswordEncoder("argon2", Map.of(
				"argon2", Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8(),
				"bcrypt", new BCryptPasswordEncoder(12)));
	}

}
