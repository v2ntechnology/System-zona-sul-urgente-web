package br.com.zonasulurgente.api.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestcontainersConfiguration;

/** Primeiro administrador de um servidor novo (ZSU_BOOTSTRAP_ADMIN_EMAIL). */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = { "zsu.bootstrap.admin.email=Chefe@ZonaSulUrgente.com.br",
		"zsu.bootstrap.admin.name=Chefe da Redação", "zsu.bootstrap.admin.site-url=https://zonasulurgente.com.br/" })
@ActiveProfiles("local")
@Transactional
class FirstAdminTests {

	static final String EMAIL = "chefe@zonasulurgente.com.br";

	@Autowired
	FirstAdmin firstAdmin;

	@Autowired
	InvitationService invitations;

	@Autowired
	JdbcClient jdbc;

	private long count(String sql) {
		return jdbc.sql(sql).param("e", EMAIL).query(Long.class).single();
	}

	@Test
	void withAnActiveAdminDoesNothing() {
		// A carga de exemplo já tem Administrador: ao subir, nada foi criado.
		assertThat(count("SELECT count(*) FROM users WHERE lower(email) = :e")).isZero();
		assertThat(firstAdmin.ensure()).isEmpty();
	}

	@Test
	void withoutAdminInvitesOnceAndStopsAfterAccept() {
		jdbc.sql("UPDATE users SET status = 'DISABLED' WHERE role_code = 'ADMIN'").update();

		String first = firstAdmin.ensure().orElseThrow();
		assertThat(jdbc.sql("SELECT role_code || '|' || status || '|' || name FROM users WHERE lower(email) = :e")
			.param("e", EMAIL).query(String.class).single()).isEqualTo("ADMIN|INVITED|Chefe da Redação");
		assertThat(invitations.check(first).email()).isEqualTo(EMAIL);
		assertThat(count("""
				SELECT count(*) FROM audit_logs a JOIN users u ON u.id::text = a.entity_id
				WHERE lower(u.email) = :e AND a.action = 'INVITE' AND a.origin = 'SYSTEM'""")).isEqualTo(1);

		// Reinício antes do aceite: link novo, o anterior deixa de valer.
		String second = firstAdmin.ensure().orElseThrow();
		assertThat(second).isNotEqualTo(first);
		assertThatThrownBy(() -> invitations.check(first)).hasMessageContaining("não vale mais");
		assertThat(count("""
				SELECT count(*) FROM user_invitations i JOIN users u ON u.id = i.user_id
				WHERE lower(u.email) = :e AND i.used_at IS NULL""")).isEqualTo(1);

		invitations.accept(second, "redacao-zona-sul-2026");
		assertThat(firstAdmin.ensure()).isEmpty();
		assertThat(count("SELECT count(*) FROM users WHERE lower(email) = :e AND status = 'ACTIVE'")).isEqualTo(1);
	}

	@Test
	void neverPromotesAnExistingAccount() {
		jdbc.sql("UPDATE users SET status = 'DISABLED' WHERE role_code = 'ADMIN'").update();
		jdbc.sql("UPDATE users SET email = :e WHERE email = 'ana.ribeiro@zonasulurgente.com.br'").param("e", EMAIL)
			.update();

		assertThat(firstAdmin.ensure()).isEmpty();
		assertThat(jdbc.sql("SELECT role_code FROM users WHERE email = :e").param("e", EMAIL).query(String.class)
			.single()).isEqualTo("REPORTER");
	}

}
