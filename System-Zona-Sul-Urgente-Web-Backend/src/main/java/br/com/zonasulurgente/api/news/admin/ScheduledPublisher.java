package br.com.zonasulurgente.api.news.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import br.com.zonasulurgente.api.jobs.JobsProperties;

/** Publica as matérias agendadas cujo horário chegou (varredura a cada 30 s). */
@Component
class ScheduledPublisher {

	private static final Logger log = LoggerFactory.getLogger(ScheduledPublisher.class);

	private final AdminNewsService news;
	private final JobsProperties props;

	ScheduledPublisher(AdminNewsService news, JobsProperties props) {
		this.news = news;
		this.props = props;
	}

	@Scheduled(fixedDelayString = "${zsu.jobs.schedule-interval:30s}", initialDelayString = "10s")
	void run() {
		if (!props.enabled()) {
			return;
		}
		try {
			int published = news.publishDue();
			if (published > 0) {
				log.info("{} matéria(s) agendada(s) publicada(s)", published);
			}
		}
		catch (RuntimeException e) {
			log.error("Falha ao publicar agendadas", e);
		}
	}

}
