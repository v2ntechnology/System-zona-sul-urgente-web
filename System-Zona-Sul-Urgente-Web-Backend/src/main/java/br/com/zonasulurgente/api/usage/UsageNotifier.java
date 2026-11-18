package br.com.zonasulurgente.api.usage;

/**
 * Aviso quando o nível de um recurso muda ou a trava liga/desliga (FR-005). Hoje só o painel ({@link
 * PanelOnlyNotifier}): a tela e a faixa leem o estado. O e-mail para os Administradores (resposta 2B) entra como outra
 * implementação na spec do envio de e-mails, sem mudar este módulo.
 */
public interface UsageNotifier {

	void changed(UsageReport.Item item, String fromLevel, boolean wasLocked);

}
