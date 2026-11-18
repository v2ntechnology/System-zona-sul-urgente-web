package br.com.zonasulurgente.api.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.jobs.JobsProperties;

/**
 * Leitura periódica do uso (FR-003: no máximo a cada 1 h; padrão 30 min). Desligada com {@code zsu.jobs.enabled=false}
 * — os testes chamam {@link QuotaService#refresh()} direto.
 */
@Component
class UsageRefreshJob {

	private static final Logger log = LoggerFactory.getLogger(UsageRefreshJob.class);

	private final QuotaService quota;
	private final JobsProperties jobs;

	UsageRefreshJob(QuotaService quota, JobsProperties jobs) {
		this.quota = quota;
		this.jobs = jobs;
	}

	@Scheduled(fixedDelayString = "${zsu.usage.refresh:30m}", initialDelayString = "30s")
	void run() {
		if (!jobs.enabled()) {
			return;
		}
		try {
			quota.refresh();
		}
		catch (RuntimeException e) {
			log.error("Falha inesperada na leitura do uso dos planos: {}", e.getMessage());
		}
	}

}
