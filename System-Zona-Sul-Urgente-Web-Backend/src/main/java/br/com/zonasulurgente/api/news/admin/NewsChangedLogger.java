package br.com.zonasulurgente.api.news.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** Por enquanto só registra; o job CACHE_INVALIDATE (BE-010/011) entra aqui. */
@Component
class NewsChangedLogger {

	private static final Logger log = LoggerFactory.getLogger(NewsChangedLogger.class);

	@TransactionalEventListener
	void on(NewsChangedEvent event) {
		if (event.affectsSite()) {
			log.info("Notícia {} ({} → {}): site precisa revalidar news:{}", event.newsId(), event.previousStatus(),
					event.status(), event.slug());
		}
	}

}
