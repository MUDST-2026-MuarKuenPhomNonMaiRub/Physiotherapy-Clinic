package com.physiocare.clinic.auth;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.physiocare.clinic.config.SecurityConfig;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Runs sign-in, an authenticated call and sign-out through the real security filter chain. */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtService.class, AuthCookieService.class})
@TestPropertySource(
    properties = "app.security.jwt.secret=Gm3BtrgxmwVdnZiACjeuxzEZBQ4UZV2h45hD6XQhbZ4=")
class AuthCookieFlowTest {
  private static final String EMAIL = "admin@example.com";

  @Autowired private MockMvc mvc;
  @Autowired private JwtService jwt;

  @MockitoBean private AuthService auth;
  @MockitoBean private CustomUserDetailsService users;

  private String tokenFor(String email) {
    AppUser user = new AppUser();
    user.setEmail(email);
    return jwt.generateToken(user);
  }

  private void userExists() {
    when(users.loadUserByUsername(EMAIL))
        .thenReturn(User.withUsername(EMAIL).password("n/a").authorities(List.of()).build());
    when(auth.me(anyString()))
        .thenReturn(
            new AuthDtos.MeResponse(
                1L, EMAIL, "Admin", "User", true, Set.of("ADMIN"), Set.of(), null, List.of()));
  }

  @Test
  void loginSetsHttpOnlyCookieAndKeepsTokenOutOfTheBody() throws Exception {
    when(auth.login(any())).thenReturn(new AuthDtos.LoginResult("issued.jwt.value", 3600));

    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@example.com\",\"password\":\"secret\"}"))
        .andExpect(status().isOk())
        .andExpect(
            header()
                .string(
                    HttpHeaders.SET_COOKIE,
                    allOf(
                        startsWith("physiocare_session=issued.jwt.value"),
                        containsString("HttpOnly"),
                        containsString("Secure"),
                        containsString("SameSite=Strict"),
                        containsString("Path=/api"))))
        .andExpect(jsonPath("$.expiresIn").value(3600))
        .andExpect(jsonPath("$.accessToken").doesNotExist())
        .andExpect(content().string(not(containsString("issued.jwt.value"))));
  }

  @Test
  void sessionCookieAuthenticatesTheRequest() throws Exception {
    userExists();
    mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("physiocare_session", tokenFor(EMAIL))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(EMAIL));
  }

  @Test
  void requestWithoutCookieIsRejected() throws Exception {
    mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void tamperedCookieIsRejected() throws Exception {
    userExists();
    mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("physiocare_session", tokenFor(EMAIL) + "x")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void logoutClearsTheCookieEvenWithoutASession() throws Exception {
    mvc.perform(post("/api/v1/auth/logout"))
        .andExpect(status().isNoContent())
        .andExpect(
            header()
                .string(
                    HttpHeaders.SET_COOKIE,
                    allOf(startsWith("physiocare_session=;"), containsString("Max-Age=0"))));
  }
}
