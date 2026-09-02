package com.physiocare.clinic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootApplication
@EnableMethodSecurity
public class ClinicApplication {
  public static void main(String[] args) {
    SpringApplication.run(ClinicApplication.class, args);
  }
}
