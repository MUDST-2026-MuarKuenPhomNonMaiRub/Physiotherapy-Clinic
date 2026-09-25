package com.physiocare.clinic.auth;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthCookieServiceTest {
  private final AuthCookieService cookies = new AuthCookieService("physiocare_session", true, "Strict");

  @Test
  void sessionCookieIsOutOfReachOfPageScript() {
    ResponseCookie cookie = cookies.sessionCookie("jwt-value", 3600);
    assertEquals("physiocare_session", cookie.getName());
    assertEquals("jwt-value", cookie.getValue());
    assertTrue(cookie.isHttpOnly());
    assertTrue(cookie.isSecure());
    assertEquals("Strict", cookie.getSameSite());
    assertEquals("/api", cookie.getPath());
    assertEquals(3600, cookie.getMaxAge().getSeconds());
  }

  @Test
  void clearedCookieExpiresTheSameCookie() {
    ResponseCookie cookie = cookies.clearedCookie();
    assertEquals("physiocare_session", cookie.getName());
    assertEquals("/api", cookie.getPath());
    assertEquals(0, cookie.getMaxAge().getSeconds());
  }

  @Test
  void readsTokenFromSessionCookie() {
    var request = new MockHttpServletRequest();
    request.setCookies(new Cookie("other", "x"), new Cookie("physiocare_session", "from-cookie"));
    assertEquals("from-cookie", cookies.resolveToken(request));
  }

  @Test
  void cookieWinsOverAuthorizationHeader() {
    var request = new MockHttpServletRequest();
    request.setCookies(new Cookie("physiocare_session", "from-cookie"));
    request.addHeader("Authorization", "Bearer from-header");
    assertEquals("from-cookie", cookies.resolveToken(request));
  }

  @Test
  void fallsBackToBearerHeaderForNonBrowserClients() {
    var request = new MockHttpServletRequest();
    request.addHeader("Authorization", "Bearer from-header");
    assertEquals("from-header", cookies.resolveToken(request));
  }

  @Test
  void noTokenWhenNeitherIsPresent() {
    var request = new MockHttpServletRequest();
    request.addHeader("Authorization", "Basic abc");
    assertNull(cookies.resolveToken(request));
  }
}
