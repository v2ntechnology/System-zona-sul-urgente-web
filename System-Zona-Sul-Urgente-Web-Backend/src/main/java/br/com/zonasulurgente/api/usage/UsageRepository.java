package br.com.zonasulurgente.api.usage;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import br.com.zonasulurgente.api.usage.UsageProperties.Period;

/**
 * Estado e contadores do monitor (V12). Janelas sempre pelo relógio do banco. Cada recurso tem o contador da janela
 * ({@code resource}) e o do que foi gasto depois da última leitura da nuvem ({@code resource + ":delta"}), que zera a
 * cada leitura com sucesso (data-model.md, "Uso efetivo").
 */
@Repository
class UsageRepository {

	record State(Long cloudValue, OffsetDateTime cloudReadAt, String cloudError, String level, boolean locked) {
	}

	private final JdbcClient jdbc;

	UsageRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Início da janela atual, como expressão SQL sobre {@code now()}. */
	static String windowStart(Period period) {
		return switch (period) {
			case NONE -> "'epoch'::timestamptz";
			case MINUTE -> "date_trunc('minute', now())";
			case DAY_PACIFIC -> "(date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles')"
					+ " AT TIME ZONE 'America/Los_Angeles')";
			case MONTH -> "(date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')";
		};
	}

	/** Quando a janela atual acaba (nulo para {@code NONE}). */
	Optional<OffsetDateTime> windowEnd(Period period) {
		String end = switch (period) {
			case NONE -> null;
			case MINUTE -> "date_trunc('minute', now()) + interval '1 minute'";
			case DAY_PACIFIC -> "((date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') + interval '1 day')"
					+ " AT TIME ZONE 'America/Los_Angeles')";
			case MONTH -> "((date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC')";
		};
		if (end == null) {
			return Optional.empty();
		}
		return Optional.of(jdbc.sql("SELECT " + end).query(OffsetDateTime.class).single());
	}

	/** O que o sistema contou na janela atual (e, com {@code delta}, depois da última leitura da nuvem). */
	long counter(String resource, Period period, boolean delta) {
		return jdbc.sql("SELECT coalesce(sum(count), 0) FROM usage_counters WHERE resource = :r AND window_start = "
				+ windowStart(period))
			.param("r", delta ? resource + ":delta" : resource)
			.query(Long.class)
			.single();
	}

	void increment(String resource, Period period, long amount) {
		for (String key : new String[] { resource, resource + ":delta" }) {
			jdbc.sql("INSERT INTO usage_counters (resource, window_start, count) VALUES (:r, " + windowStart(period)
					+ ", :n) ON CONFLICT (resource, window_start) DO UPDATE SET count = usage_counters.count + :n")
				.param("r", key)
				.param("n", amount)
				.update();
		}
	}

	Optional<State> state(String resource) {
		return jdbc.sql("""
				SELECT cloud_value, cloud_read_at, cloud_error, level, locked FROM usage_state WHERE resource = :r""")
			.param("r", resource)
			.query((rs, n) -> new State(rs.getObject("cloud_value", Long.class),
					rs.getObject("cloud_read_at", OffsetDateTime.class), rs.getString("cloud_error"),
					rs.getString("level"), rs.getBoolean("locked")))
			.optional();
	}

	/** Leitura da nuvem com sucesso: guarda o número e zera o que foi contado depois da leitura anterior. */
	void saveCloud(String resource, long value) {
		jdbc.sql("""
				INSERT INTO usage_state (resource, cloud_value, cloud_read_at, cloud_error) VALUES (:r, :v, now(), NULL)
				ON CONFLICT (resource) DO UPDATE SET cloud_value = :v, cloud_read_at = now(), cloud_error = NULL""")
			.param("r", resource)
			.param("v", value)
			.update();
		jdbc.sql("DELETE FROM usage_counters WHERE resource = :r").param("r", resource + ":delta").update();
	}

	void saveCloudError(String resource, String error) {
		jdbc.sql("""
				INSERT INTO usage_state (resource, cloud_error) VALUES (:r, :e)
				ON CONFLICT (resource) DO UPDATE SET cloud_error = :e""")
			.param("r", resource)
			.param("e", error.length() > 300 ? error.substring(0, 300) : error)
			.update();
	}

	void saveLevel(String resource, String level, boolean locked) {
		jdbc.sql("""
				INSERT INTO usage_state (resource, level, locked, changed_at) VALUES (:r, :l, :k, now())
				ON CONFLICT (resource) DO UPDATE SET level = :l, locked = :k, changed_at = now()""")
			.param("r", resource)
			.param("l", level)
			.param("k", locked)
			.update();
	}

	/** Apaga janelas antigas de um recurso (o total de {@code NONE} nunca é apagado). */
	int cleanup(String resource, Period period) {
		if (period == Period.NONE) {
			return 0;
		}
		String keep = period == Period.MINUTE ? "1 day" : "90 days";
		return jdbc.sql("DELETE FROM usage_counters WHERE resource IN (:r, :d) AND window_start < now() - interval '"
				+ keep + "'")
			.param("r", resource)
			.param("d", resource + ":delta")
			.update();
	}

	OffsetDateTime now() {
		return jdbc.sql("SELECT now()").query(OffsetDateTime.class).single();
	}

}
