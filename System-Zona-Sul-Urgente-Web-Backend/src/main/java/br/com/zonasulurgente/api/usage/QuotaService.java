package br.com.zonasulurgente.api.usage;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import br.com.zonasulurgente.api.audit.AuditAction;
import br.com.zonasulurgente.api.audit.AuditEvent;
import br.com.zonasulurgente.api.audit.AuditLog;
import br.com.zonasulurgente.api.usage.UsageProperties.Meter;
import br.com.zonasulurgente.api.usage.UsageProperties.Period;
import br.com.zonasulurgente.api.usage.UsageProperties.Resource;
import br.com.zonasulurgente.api.usage.UsageRepository.State;

/**
 * Coração do monitor (spec 004). Uso efetivo = {@code max(nuvem + gasto depois da leitura, conta do sistema)} — na
 * dúvida, o maior (FR-010). Nível 70/90 e trava são avaliados a cada leitura e a cada gasto; mudança vai para a
 * auditoria e para os {@link UsageNotifier} uma vez por mudança (FR-005, FR-012).
 */
@Service
public class QuotaService implements QuotaGuard {

	private static final Logger log = LoggerFactory.getLogger(QuotaService.class);

	private final UsageProperties props;
	private final UsageRepository repo;
	private final List<UsageMeter> meters;
	private final List<UsageNotifier> notifiers;
	private final AuditLog audit;
	private final TransactionTemplate tx;

	/** Limite que o próprio medidor informa (ex.: tamanho do disco), da última leitura. */
	private final Map<Meter, Long> meterLimits = new ConcurrentHashMap<>();

	private volatile OffsetDateTime refreshedAt;

	QuotaService(UsageProperties props, UsageRepository repo, List<UsageMeter> meters, List<UsageNotifier> notifiers,
			AuditLog audit, TransactionTemplate tx) {
		this.props = props;
		this.repo = repo;
		this.meters = meters;
		this.notifiers = notifiers;
		this.audit = audit;
		this.tx = tx;
		props.resources().forEach((key, r) -> {
			if (r.requireLimit() && r.limit() == null) {
				log.warn("Uso dos planos: \"{}\" sem limite configurado — aparece em vermelho e trava até configurar",
						r.label());
			}
		});
	}

	// ------------------------------------------------------------------------------------------------ QuotaGuard

	@Override
	public void check(String resource, long amount) {
		Resource r = props.resources().get(resource);
		if (r == null || r.lockAt() == null) {
			return;
		}
		Long limit = limitOf(r);
		boolean over;
		if (limit == null) {
			over = r.requireLimit();
		}
		else {
			Usage usage = usage(resource, r);
			over = (double) (usage.used() + amount) * 100 >= (double) r.lockAt() * limit;
		}
		if (!over) {
			return;
		}
		if (r.period() == Period.MINUTE || r.period() == Period.DAY_PACIFIC) {
			Instant retryAt = repo.windowEnd(r.period()).map(OffsetDateTime::toInstant)
				.orElse(Instant.now().plus(props.refresh()));
			throw new QuotaDeferredException(resource, retryAt,
					limit == null ? r.label() + ": sem limite configurado" : r.label() + ": limite do plano gratuito");
		}
		throw new QuotaBlockedException(resource, Instant.now().plus(props.refresh()), blockedMessage(r));
	}

	@Override
	public void record(String resource, long amount) {
		Resource r = props.resources().get(resource);
		if (r == null || amount <= 0) {
			return;
		}
		tx.executeWithoutResult(status -> {
			repo.increment(resource, r.period(), amount);
			evaluate(resource, r);
		});
	}

	static String blockedMessage(Resource r) {
		if (r.unit() == UsageProperties.Unit.BYTES) {
			return "O espaço gratuito de fotos está quase cheio. A notícia pode ser salva e publicada sem a foto; "
					+ "avise o Administrador.";
		}
		return "O limite gratuito de gravações de fotos deste mês acabou. A notícia pode ser salva e publicada sem a "
				+ "foto; as fotos voltam no próximo mês ou quando o Administrador liberar.";
	}

	// ------------------------------------------------------------------------------------------------ leitura

	/** Lê os medidores (nuvem, disco), grava e reavalia níveis e travas. Falha de um medidor não para os outros. */
	public void refresh() {
		Map<Meter, UsageMeter.Reading> readings = new EnumMap<>(Meter.class);
		Map<Meter, String> errors = new EnumMap<>(Meter.class);
		for (UsageMeter meter : meters) {
			if (meter.meters().isEmpty()) {
				continue;
			}
			try {
				readings.putAll(meter.read());
			}
			catch (Exception e) {
				String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
				log.warn("Leitura de uso falhou ({}): {}", meter.getClass().getSimpleName(), message);
				meter.meters().forEach(m -> errors.put(m, message));
			}
		}
		props.resources().forEach((key, r) -> tx.executeWithoutResult(status -> {
			UsageMeter.Reading reading = readings.get(r.meter());
			if (reading != null) {
				repo.saveCloud(key, reading.value());
				if (reading.limit() != null) {
					meterLimits.put(r.meter(), reading.limit());
				}
			}
			else if (errors.containsKey(r.meter())) {
				repo.saveCloudError(key, errors.get(r.meter()));
			}
			repo.cleanup(key, r.period());
			evaluate(key, r);
		}));
		refreshedAt = repo.now();
	}

	public UsageReport report() {
		List<UsageReport.Item> items = new ArrayList<>();
		props.resources().entrySet().stream()
			.sorted(Comparator.comparingInt((Map.Entry<String, Resource> e) -> e.getValue().order())
				.thenComparing(Map.Entry::getKey))
			.forEach(e -> items.add(item(e.getKey(), e.getValue())));
		return new UsageReport(items, props.warnAt(), props.criticalAt(), refreshedAt);
	}

	public List<UsageReport.Alert> alerts() {
		return report().resources().stream()
			.filter(i -> !"NORMAL".equals(i.level()) || i.locked())
			.map(i -> new UsageReport.Alert(i.key(), i.label(), i.percent(), i.level(), i.locked()))
			.toList();
	}

	// ------------------------------------------------------------------------------------------------ cálculo

	record Usage(long used, String source, OffsetDateTime readAt, boolean stale, String note) {
	}

	private boolean usesCloud(Resource r) {
		return r.meter() != Meter.COUNTER;
	}

	private Long limitOf(Resource r) {
		if (r.meter() == Meter.DISK) {
			return r.limit() != null ? r.limit() : meterLimits.get(Meter.DISK);
		}
		return r.limit();
	}

	Usage usage(String key, Resource r) {
		long system = repo.counter(key, r.period(), false);
		Optional<State> state = repo.state(key);
		if (!usesCloud(r)) {
			return new Usage(system, "system", null, false, null);
		}
		Long cloud = state.map(State::cloudValue).orElse(null);
		OffsetDateTime readAt = state.map(State::cloudReadAt).orElse(null);
		// Número da nuvem de um mês anterior não vale para o mês novo.
		if (cloud != null && readAt != null && r.period() == Period.MONTH && windowStartsAfter(readAt, r.period())) {
			cloud = null;
		}
		boolean stale = r.meter() != Meter.DISK && (state.map(State::cloudError).orElse(null) != null
				|| readAt == null || readAt.isBefore(repo.now().minus(props.refresh().multipliedBy(2))));
		if (cloud == null) {
			return new Usage(system, "system", readAt, stale, null);
		}
		if (r.meter() == Meter.DISK) {
			return new Usage(cloud, "system", readAt, false, null);
		}
		long cloudNow = cloud + repo.counter(key, r.period(), true);
		String note = null;
		if (system > 0 && cloudNow > system * 1.1) {
			note = "Inclui outros usos da conta da Cloudflare.";
		}
		else if (system > 0 && cloudNow < system * 0.9) {
			note = "A conta do sistema está %d%% acima do número da Cloudflare (pode ser atraso da Cloudflare)."
				.formatted(Math.round((system - cloudNow) * 100.0 / system));
		}
		return cloudNow >= system ? new Usage(cloudNow, "cloud", readAt, stale, note)
				: new Usage(system, "system", readAt, stale, note);
	}

	private boolean windowStartsAfter(OffsetDateTime readAt, Period period) {
		Optional<OffsetDateTime> end = repo.windowEnd(period);
		if (end.isEmpty()) {
			return false;
		}
		// A janela atual começa um período antes do fim; para MONTH basta comparar o mês (UTC).
		return readAt.withOffsetSameInstant(java.time.ZoneOffset.UTC).getMonthValue() != repo.now()
			.withOffsetSameInstant(java.time.ZoneOffset.UTC)
			.getMonthValue();
	}

	UsageReport.Item item(String key, Resource r) {
		Usage usage = usage(key, r);
		Long limit = limitOf(r);
		Double percent = limit == null || limit == 0 ? null : Math.round(usage.used() * 1000.0 / limit) / 10.0;
		String level;
		boolean locked;
		if (limit == null && r.requireLimit()) {
			level = "CRITICAL";
			locked = r.lockAt() != null;
		}
		else {
			level = percent == null ? "NORMAL"
					: percent >= props.criticalAt() ? "CRITICAL" : percent >= props.warnAt() ? "WARN" : "NORMAL";
			locked = percent != null && r.lockAt() != null && percent >= r.lockAt();
		}
		String note = usage.note();
		if (limit == null && r.requireLimit()) {
			note = "Sem limite configurado: defina o limite do plano gratuito na configuração.";
		}
		OffsetDateTime resetsAt = repo.windowEnd(r.period()).orElse(null);
		return new UsageReport.Item(key, r.label(), r.unit().name(), usage.used(), limit, percent, level, locked,
				r.lockAt(), usage.source(), usage.readAt(), usage.stale(), resetsAt, note);
	}

	/** Compara com o último estado gravado; mudou nível ou trava → grava, audita e avisa. Dentro da transação. */
	private void evaluate(String key, Resource r) {
		UsageReport.Item now = item(key, r);
		Optional<State> before = repo.state(key);
		String fromLevel = before.map(State::level).orElse("NORMAL");
		boolean wasLocked = before.map(State::locked).orElse(false);
		if (fromLevel.equals(now.level()) && wasLocked == now.locked()) {
			return;
		}
		repo.saveLevel(key, now.level(), now.locked());
		if (!fromLevel.equals(now.level())) {
			audit.recordSystem(event(AuditAction.USAGE_LEVEL, now).detail("from", fromLevel).detail("to", now.level()));
		}
		if (wasLocked != now.locked()) {
			audit.recordSystem(event(now.locked() ? AuditAction.USAGE_LOCK : AuditAction.USAGE_UNLOCK, now));
		}
		for (UsageNotifier notifier : notifiers) {
			try {
				notifier.changed(now, fromLevel, wasLocked);
			}
			catch (RuntimeException e) {
				log.warn("Aviso de uso não enviado ({}): {}", notifier.getClass().getSimpleName(), e.getMessage());
			}
		}
	}

	private static AuditEvent event(AuditAction action, UsageReport.Item item) {
		return AuditEvent.of(action, "usage", item.key(), item.label())
			.detail("used", item.used())
			.detail("limit", item.limit())
			.detail("percent", item.percent())
			.detail("source", item.source());
	}

}
