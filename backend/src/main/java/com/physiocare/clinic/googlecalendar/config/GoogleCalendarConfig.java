package com.physiocare.clinic.googlecalendar.config;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Executor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestClient;

/**
 * Wiring for the Google Calendar sync: a dedicated HTTP client with short
 * timeouts, and a small thread pool so calls to Google never hold up the
 * request that booked the appointment.
 */
@Configuration
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties(GoogleCalendarProperties.class)
public class GoogleCalendarConfig {
  public static final String EXECUTOR = "googleCalendarExecutor";

  @Bean
  RestClient googleRestClient() {
    HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
    factory.setReadTimeout(Duration.ofSeconds(15));
    return RestClient.builder().requestFactory(factory).build();
  }

  @Bean(name = EXECUTOR)
  Executor googleCalendarExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(4);
    executor.setQueueCapacity(500);
    executor.setThreadNamePrefix("google-calendar-");
    executor.initialize();
    return executor;
  }
}
