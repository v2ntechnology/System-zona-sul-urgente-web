package br.com.zonasulurgente.api.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

import br.com.zonasulurgente.api.TestcontainersConfiguration;
import br.com.zonasulurgente.api.auth.application.AuthenticatedUser;
import br.com.zonasulurgente.api.news.admin.AdminNewsService;

/**
 * BE-008: a auditoria vive e morre com a ação. Sem @Transactional na classe (de propósito): aqui as
 * transações são as de verdade, e tudo o que o teste faz é desfeito por ele mesmo.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@ActiveProfiles("local")
class AuditTransactionTests {

	@Autowired
	AdminNewsService news;

	@Autowired
	AuditLog audit;

	@Autowired
	TransactionTemplate tx;

	@Autowired
	JdbcClient jdbc;

	@Test
	void undoneActionLeavesNoAuditRecord() {
		String id = jdbc.sql("SELECT id::text FROM news WHERE status = 'PUBLISHED' AND deleted_at IS NULL LIMIT 1")
			.query(String.class).single();
		long before = jdbc.sql("SELECT count(*) FROM audit_logs WHERE entity_id = :id").param("id", id)
			.query(Long.class).single();
		AuthenticatedUser admin = jdbc.sql("SELECT id, name, email FROM users WHERE role_code = 'ADMIN' LIMIT 1")
			.query((rs, i) -> new AuthenticatedUser(rs.getObject("id", UUID.class), rs.getString("name"),
					rs.getString("email"), "ADMIN", List.of("news.edit.any", "news.publish", "news.delete"), null,
					null))
			.single();

		assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
			news.unpublish(UUID.fromString(id), admin);
			// Dentro da transação o registro existe...
			assertThat(jdbc.sql("SELECT count(*) FROM audit_logs WHERE entity_id = :id AND action = 'UNPUBLISH'")
				.param("id", id).query(Long.class).single()).isEqualTo(1);
			// ...e some junto quando algo depois da ação falha.
			throw new IllegalStateException("falha depois da ação");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(jdbc.sql("SELECT status FROM news WHERE id = :id::uuid").param("id", id).query(String.class).single())
			.isEqualTo("PUBLISHED");
		assertThat(jdbc.sql("SELECT count(*) FROM audit_logs WHERE entity_id = :id").param("id", id)
			.query(Long.class).single()).isEqualTo(before);
	}

	@Test
	void recordingOutsideATransactionIsAProgrammingError() {
		assertThatThrownBy(() -> audit.record(AuditEvent.of(AuditAction.UPDATE, "news", "x", "x")))
			.isInstanceOf(IllegalTransactionStateException.class);
	}

}
