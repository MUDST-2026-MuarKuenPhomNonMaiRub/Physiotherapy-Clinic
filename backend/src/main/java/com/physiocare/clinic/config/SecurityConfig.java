package com.physiocare.clinic.config;

import com.physiocare.clinic.auth.JwtAuthenticationFilter;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  AuthenticationManager authenticationManager(AuthenticationConfiguration configuration)
      throws Exception {
    return configuration.getAuthenticationManager();
  }

  @Bean
  AuthenticationProvider authenticationProvider(UserDetailsService users, PasswordEncoder encoder) {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(users);
    provider.setPasswordEncoder(encoder);
    return provider;
  }

  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http, JwtAuthenticationFilter jwtFilter, AuthenticationProvider provider)
      throws Exception {
    return http.csrf(csrf -> csrf.disable())
        .cors(cors -> {})
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authenticationProvider(provider)
        .exceptionHandling(
            exception ->
                exception.authenticationEntryPoint(
                    new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
        .authorizeHttpRequests(
            authorize ->
                authorize
                    .requestMatchers("/api/v1/auth/login", "/actuator/health")
                    .permitAll()
                    .requestMatchers("/api/v1/auth/users")
                    .hasRole("ADMIN")
                    // Everything else is checked per endpoint with @PreAuthorize, so
                    // that a read the whole clinic needs is not locked behind the
                    // same rule as the write that only an admin may make.
                    .anyRequest()
                    .authenticated())
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }
}
