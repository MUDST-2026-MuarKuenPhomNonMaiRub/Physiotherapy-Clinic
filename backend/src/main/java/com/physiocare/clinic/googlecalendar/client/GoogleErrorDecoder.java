package com.physiocare.clinic.googlecalendar.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RestClient;

/**
 * Turns Google's error replies into {@link GoogleApiException}. The OAuth
 * endpoints answer {@code {"error":"invalid_grant","error_description":…}};
 * the Calendar API answers {@code {"error":{"code":404,"message":…}}}.
 */
final class GoogleErrorDecoder implements RestClient.ResponseSpec.ErrorHandler {
  private static final ObjectMapper JSON = new ObjectMapper();

  @Override
  public void handle(HttpRequest request, ClientHttpResponse response) throws IOException {
    int status = response.getStatusCode().value();
    String body = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
    String code = null;
    String message = "Google replied " + status;
    try {
      JsonNode error = JSON.readTree(body).path("error");
      if (error.isTextual()) {
        code = error.asText();
        message = JSON.readTree(body).path("error_description").asText(code);
      } else if (error.isObject()) {
        code = error.path("status").asText(null);
        message = error.path("message").asText(message);
      }
    } catch (IOException ignored) {
      // Not JSON — keep the status-only message.
    }
    throw new GoogleApiException(status, code, message);
  }
}
