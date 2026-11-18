package br.com.zonasulurgente.api.usage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Sem envio de e-mail configurado: o painel já mostra o estado; aqui só fica o registro no log. */
@Component
class PanelOnlyNotifier implements UsageNotifier {

	private static final Logger log = LoggerFactory.getLogger(PanelOnlyNotifier.class);

	@Override
	public void changed(UsageReport.Item item, String fromLevel, boolean wasLocked) {
		log.warn("Uso de {}: {} → {} ({}%{})", item.label(), fromLevel, item.level(), item.percent(),
				item.locked() ? ", travado" : wasLocked ? ", destravado" : "");
	}

}
