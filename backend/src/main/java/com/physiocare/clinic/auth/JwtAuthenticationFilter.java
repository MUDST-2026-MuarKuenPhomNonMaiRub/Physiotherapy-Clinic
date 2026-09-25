package com.physiocare.clinic.auth;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwt;
  private final CustomUserDetailsService users;
  private final AuthCookieService cookies;

  public JwtAuthenticationFilter(
      JwtService jwt, CustomUserDetailsService users, AuthCookieService cookies) {
    this.jwt = jwt;
    this.users = users;
    this.cookies = cookies;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      jakarta.servlet.http.HttpServletResponse response,
      FilterChain chain)
      throws ServletException, IOException {
    String token = cookies.resolveToken(request);

    if (token != null) {
      if (jwt.isValid(token) && SecurityContextHolder.getContext().getAuthentication() == null) {
        try {
          UserDetails details = users.loadUserByUsername(jwt.subject(token));
          if (details.isEnabled()) {
            SecurityContextHolder.getContext()
                .setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                        details, null, details.getAuthorities()));
          }
        } catch (RuntimeException ignored) {
        }
      }
    }

    chain.doFilter(request, response);
  }
}
