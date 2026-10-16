package br.com.zonasulurgente.api.auth.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * SÓ no perfil local: dá a senha de desenvolvimento às contas ativas da carga de exemplo
 * (que vem sem senha). Nunca existe em produção.
 */
@Component
@Profile("local")
class LocalDevUsers implements ApplicationRunner {

	static final String DEV_PASSWORD = "zonasul-local";
	private static final Logger log = LoggerFactory.getLogger(LocalDevUsers.class);

	private final JdbcClient jdbc;
	private final PasswordEncoder passwords;

	LocalDevUsers(JdbcClient jdbc, PasswordEncoder passwords) {
		this.jdbc = jdbc;
		this.passwords = passwords;
	}

	@Override
	public void run(ApplicationArguments args) {
		int updated = jdbc.sql("""
				UPDATE users SET password_hash = :hash, password_changed_at = now()
				WHERE status = 'ACTIVE' AND password_hash IS NULL""")
			.param("hash", passwords.encode(DEV_PASSWORD))
			.update();
		if (updated > 0) {
			log.warn("Perfil local: {} contas de exemplo com a senha de desenvolvimento \"{}\".", updated, DEV_PASSWORD);
		}
	}

}
