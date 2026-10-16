package br.com.zonasulurgente.api.jobs;

import java.net.InetAddress;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Consome a fila no próprio processo da API (V1). Cada rodada pega um lote, executa em sequência
 * e marca o resultado; falha volta com espera crescente (10 s, 20 s, 40 s... até 30 min).
 */
@Component
public class JobWorker {

	private static final Logger log = LoggerFactory.getLogger(JobWorker.class);

	private final JobQueue queue;
	private final JobsProperties props;
	private final Map<String, JobHandler> handlers;
	private final String name;

	public JobWorker(JobQueue queue, JobsProperties props, List<JobHandler> handlers) {
		this.queue = queue;
		this.props = props;
		this.handlers = handlers.stream().collect(Collectors.toMap(JobHandler::type, Function.identity()));
		this.name = hostName() + "#" + UUID.randomUUID().toString().substring(0, 8);
	}

	@Scheduled(fixedDelayString = "${zsu.jobs.poll-interval:2s}", initialDelayString = "5s")
	void poll() {
		if (props.enabled()) {
			runOnce();
		}
	}

	@Scheduled(fixedDelayString = "1m", initialDelayString = "1m")
	void releaseStuck() {
		if (!props.enabled()) {
			return;
		}
		int released = queue.releaseStuck(props.stuckAfter());
		if (released > 0) {
			log.warn("{} job(s) travado(s) em PROCESSING há mais de {} voltaram para a fila", released,
					props.stuckAfter());
		}
	}

	/** Uma rodada: devolve quantos jobs foram processados. */
	public int runOnce() {
		List<JobQueue.Job> jobs = queue.claim(props.batchSize(), name);
		for (JobQueue.Job job : jobs) {
			run(job);
		}
		return jobs.size();
	}

	private void run(JobQueue.Job job) {
		JobHandler handler = handlers.get(job.type());
		try {
			if (handler == null) {
				throw new IllegalStateException("Nenhum handler para o tipo " + job.type());
			}
			handler.handle(job.payload());
			queue.complete(job.id());
		}
		catch (Exception e) {
			Duration retryIn = backoff(job.attempts());
			boolean dead = job.attempts() >= job.maxAttempts();
			String error = e.getClass().getSimpleName() + ": " + e.getMessage();
			queue.fail(job, error.length() > 2000 ? error.substring(0, 2000) : error, retryIn);
			if (dead) {
				log.error("Job {} {} desistiu após {} tentativas (DEAD): {}", job.type(), job.id(), job.attempts(), error);
			}
			else {
				log.warn("Job {} {} falhou (tentativa {}/{}), nova tentativa em {}: {}", job.type(), job.id(),
						job.attempts(), job.maxAttempts(), retryIn, error);
			}
		}
	}

	Duration backoff(int attempts) {
		Duration delay = props.firstRetry().multipliedBy(1L << Math.min(Math.max(attempts - 1, 0), 20));
		return delay.compareTo(props.maxRetry()) > 0 ? props.maxRetry() : delay;
	}

	private static String hostName() {
		try {
			return InetAddress.getLocalHost().getHostName();
		}
		catch (Exception e) {
			return "api";
		}
	}

}
