package com.physiocare.clinic.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;

@Service
public class JwtService {

    @Value("${app.security.jwt.secret}") private String secret;
    @Value("${app.security.jwt.expiration-ms:3600000}") private long expirationMs;
    private SecretKey key;

    @PostConstruct void init() {
        try {
            key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(secret));
        } catch (Exception e) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET must be a base64 secret of at least 32 bytes", e);
        }
    }

    public String generateToken(AppUser user) {
        Date now = new Date();
        return Jwts.builder()
                .subject(user.getEmail())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    public String subject(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().getSubject();
    }

    public boolean isValid(String token) {
        try {
            subject(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public long getExpirationMs() {
        return expirationMs;
    }
}
