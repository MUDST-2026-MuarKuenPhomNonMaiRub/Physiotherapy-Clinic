package com.physiocare.clinic.security;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthCookiesTest {
  private final AuthCookies cookies = new AuthCookies(true, 3_600_000);

  @Test
  void sessionCookieIsOutOfReachOfPageScriptAndOtherSites() {
    ResponseCookie cookie = cookies.issue("signed.jwt.value");
    assertEquals(AuthCookies.NAME, cookie.getName());
    assertTrue(cookie.isHttpOnly());
    assertTrue(cookie.isSecure());
    assertEquals("Strict", cookie.getSameSite());
    assertEquals("/api", cookie.getPath());
    assertEquals(3600, cookie.getMaxAge().toSeconds());
  }

  @Test
  void clearingExpiresTheCookieImmediately() {
    ResponseCookie cookie = cookies.clear();
    assertEquals("", cookie.getValue());
    assertEquals(0, cookie.getMaxAge().toSeconds());
    assertTrue(cookie.isHttpOnly());
  }

  @Test
  void localDevelopmentCanTurnOffSecure() {
    assertFalse(new AuthCookies(false, 3_600_000).issue("t").isSecure());
  }

  @Test
  void readsOnlyTheSessionCookie() {
    MockHttpServletRequest request = new MockHttpServletRequest();
    assertTrue(cookies.read(request).isEmpty());

    request.setCookies(new Cookie("other", "x"), new Cookie(AuthCookies.NAME, "signed.jwt.value"));
    assertEquals("signed.jwt.value", cookies.read(request).orElseThrow());
  }

  @Test
  void aBearerHeaderIsNoLongerASession() {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader("Authorization", "Bearer signed.jwt.value");
    assertTrue(cookies.read(request).isEmpty());
  }
}
