package br.com.zonasulurgente.api.jobs;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Liga os {@code @Scheduled} (worker da fila e publicação automática dos agendados). */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class JobsConfig {

}
