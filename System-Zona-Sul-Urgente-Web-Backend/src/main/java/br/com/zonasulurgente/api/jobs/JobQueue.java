package br.com.zonasulurgente.api.jobs;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Fila de jobs no PostgreSQL (BE-010). Horários sempre pelo relógio do banco. */
@Repository
public class JobQueue {

	public record Job(UUID id, String type, JsonNode payload, int attempts, int maxAttempts) {
	}

	private final JdbcClient jdbc;
	private final JsonMapper json;

	public JobQueue(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/** Entra na transação de quem chama: o job só existe se a mudança que o gerou for gravada. */
	@Transactional
	public UUID enqueue(String type, Object payload) {
		return jdbc.sql("INSERT INTO job_queue (type, payload) VALUES (:type, :payload::jsonb) RETURNING id")
			.param("type", type)
			.param("payload", json.writeValueAsString(payload))
			.query(UUID.class)
			.single();
	}

	/** Pega até {@code limit} jobs prontos; outra instância nunca pega os mesmos (SKIP LOCKED). */
	@Transactional
	public List<Job> claim(int limit, String worker) {
		return jdbc.sql("""
				UPDATE job_queue j SET status = 'PROCESSING', attempts = j.attempts + 1, locked_at = now(),
				  locked_by = :worker, updated_at = now()
				WHERE j.id IN (
				  SELECT id FROM job_queue WHERE status IN ('PENDING', 'RETRYING') AND run_at <= now()
				  ORDER BY run_at LIMIT :limit FOR UPDATE SKIP LOCKED)
				RETURNING j.id, j.type, j.payload::text, j.attempts, j.max_attempts""")
			.param("worker", worker)
			.param("limit", limit)
			.query((rs, i) -> new Job(rs.getObject(1, UUID.class), rs.getString(2), json.readTree(rs.getString(3)),
					rs.getInt(4), rs.getInt(5)))
			.list();
	}

	@Transactional
	public void complete(UUID id) {
		jdbc.sql("""
				UPDATE job_queue SET status = 'COMPLETED', completed_at = now(), updated_at = now(), locked_at = NULL,
				  last_error = NULL WHERE id = :id""")
			.param("id", id)
			.update();
	}

	/** Falhou: volta para a fila depois de {@code retryIn}, ou vira DEAD sem mais tentativas. */
	@Transactional
	public void fail(Job job, String error, Duration retryIn) {
		boolean dead = job.attempts() >= job.maxAttempts();
		jdbc.sql("""
				UPDATE job_queue SET status = :status, last_error = :error, locked_at = NULL, updated_at = now(),
				  run_at = now() + make_interval(secs => :secs) WHERE id = :id""")
			.param("status", dead ? "DEAD" : "RETRYING")
			.param("error", error)
			.param("secs", retryIn.toSeconds())
			.param("id", job.id())
			.update();
	}

	/** Jobs presos em PROCESSING há mais de {@code after} (worker caiu): voltam para a fila. */
	@Transactional
	public int releaseStuck(Duration after) {
		return jdbc.sql("""
				UPDATE job_queue SET status = 'RETRYING', locked_at = NULL, updated_at = now(), run_at = now(),
				  last_error = 'Travado em PROCESSING; devolvido à fila.'
				WHERE status = 'PROCESSING' AND locked_at < now() - make_interval(secs => :secs)""")
			.param("secs", after.toSeconds())
			.update();
	}

}
