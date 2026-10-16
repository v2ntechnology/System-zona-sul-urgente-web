package br.com.zonasulurgente.api.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import br.com.zonasulurgente.api.TestcontainersConfiguration;
import tools.jackson.databind.JsonNode;

/** BE-010: fila de jobs — sucesso, nova tentativa com espera, DEAD e job travado. */
@Import({ TestcontainersConfiguration.class, JobQueueTests.Handlers.class })
@SpringBootTest
@Transactional
class JobQueueTests {

	static final List<String> handled = new CopyOnWriteArrayList<>();

	@TestConfiguration(proxyBeanMethods = false)
	static class Handlers {

		@Bean
		JobHandler okHandler() {
			return new JobHandler() {
				public String type() {
					return "TEST_OK";
				}

				public void handle(JsonNode payload) {
					handled.add(payload.path("n").asString());
				}
			};
		}

		@Bean
		JobHandler failingHandler() {
			return new JobHandler() {
				public String type() {
					return "TEST_FAIL";
				}

				public void handle(JsonNode payload) {
					throw new IllegalStateException("serviço fora do ar");
				}
			};
		}

	}

	@Autowired
	JobQueue queue;

	@Autowired
	JobWorker worker;

	@Autowired
	JdbcClient jdbc;

	private String status(UUID id) {
		return jdbc.sql("SELECT status FROM job_queue WHERE id = :id").param("id", id).query(String.class).single();
	}

	@Test
	void runsReadyJobsAndCompletesThem() {
		handled.clear();
		UUID id = queue.enqueue("TEST_OK", Map.of("n", "um"));
		assertThat(worker.runOnce()).isEqualTo(1);
		assertThat(handled).containsExactly("um");
		assertThat(status(id)).isEqualTo("COMPLETED");
		assertThat(worker.runOnce()).isZero();
	}

	@Test
	void failureRetriesLaterAndGivesUpAsDead() {
		UUID id = queue.enqueue("TEST_FAIL", Map.of());
		worker.runOnce();
		assertThat(status(id)).isEqualTo("RETRYING");
		assertThat(jdbc.sql("SELECT run_at > now() FROM job_queue WHERE id = :id").param("id", id)
			.query(Boolean.class).single()).as("espera antes da nova tentativa").isTrue();
		assertThat(jdbc.sql("SELECT last_error FROM job_queue WHERE id = :id").param("id", id).query(String.class)
			.single()).contains("serviço fora do ar");
		assertThat(worker.runOnce()).as("ainda esperando").isZero();

		// Última tentativa: vira DEAD.
		jdbc.sql("UPDATE job_queue SET run_at = now(), attempts = max_attempts - 1 WHERE id = :id").param("id", id)
			.update();
		worker.runOnce();
		assertThat(status(id)).isEqualTo("DEAD");
	}

	@Test
	void unknownTypeFailsInsteadOfVanishing() {
		UUID id = queue.enqueue("NAO_EXISTE", Map.of());
		worker.runOnce();
		assertThat(status(id)).isEqualTo("RETRYING");
	}

	@Test
	void stuckJobGoesBackToTheQueue() {
		UUID id = queue.enqueue("TEST_OK", Map.of("n", "travado"));
		jdbc.sql("UPDATE job_queue SET status = 'PROCESSING', locked_at = now() - interval '1 hour' WHERE id = :id")
			.param("id", id).update();
		assertThat(queue.releaseStuck(Duration.ofMinutes(10))).isEqualTo(1);
		assertThat(status(id)).isEqualTo("RETRYING");
	}

	@Test
	void backoffDoublesUpToTheCap() {
		assertThat(worker.backoff(1)).isEqualTo(Duration.ofSeconds(10));
		assertThat(worker.backoff(2)).isEqualTo(Duration.ofSeconds(20));
		assertThat(worker.backoff(4)).isEqualTo(Duration.ofSeconds(80));
		assertThat(worker.backoff(30)).isEqualTo(Duration.ofMinutes(30));
	}

}
