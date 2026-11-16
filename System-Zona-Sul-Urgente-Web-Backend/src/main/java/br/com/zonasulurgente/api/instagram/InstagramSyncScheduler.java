package br.com.zonasulurgente.api.instagram;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.jobs.JobsProperties;

/**
 * Varredura periódica da conta do Instagram (spec 001, FR-005): a cada {@code zsu.instagram.sync-interval} (15 min).
 * Desligada com {@code zsu.jobs.enabled=false} — os testes chamam {@link InstagramSyncService#sync()} direto. Só
 * chamadas de saída: funciona no ambiente local (FR-018).
 */
@Component
class InstagramSyncScheduler {

	private static final Logger log = LoggerFactory.getLogger(InstagramSyncScheduler.class);

	private final InstagramSyncService sync;
	private final JobsProperties jobs;

	InstagramSyncScheduler(InstagramSyncService sync, JobsProperties jobs) {
		this.sync = sync;
		this.jobs = jobs;
	}

	@Scheduled(fixedDelayString = "${zsu.instagram.sync-interval:15m}", initialDelayString = "1m")
	void run() {
		if (!jobs.enabled()) {
			return;
		}
		try {
			sync.sync();
		}
		catch (RuntimeException e) {
			// A mensagem das falhas da Meta nunca traz o acesso (InstagramGraphClient).
			log.error("Falha inesperada na sincronização do Instagram: {}", e.getMessage());
		}
	}

}
