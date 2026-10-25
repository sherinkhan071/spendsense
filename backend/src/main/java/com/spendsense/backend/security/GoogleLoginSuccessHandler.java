
package com.spendsense.backend.security;

import com.spendsense.backend.entity.AppUser;
import com.spendsense.backend.repository.AppUserRepository;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
public class GoogleLoginSuccessHandler
        implements AuthenticationSuccessHandler {

    private final AppUserRepository users;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public GoogleLoginSuccessHandler(
            AppUserRepository users,
            JwtService jwtService,
            PasswordEncoder passwordEncoder) {
        this.users = users;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication)
            throws IOException, ServletException {

        OAuth2User googleUser =
                (OAuth2User) authentication.getPrincipal();

        String email = googleUser.getAttribute("email");

        if (email == null || email.isBlank()) {
            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Google did not provide an email address.");
            return;
        }

        final String normalizedEmail =
                email.trim().toLowerCase();

        AppUser user = users.findByEmail(normalizedEmail)
                .orElseGet(() -> {
                    AppUser newUser = new AppUser();
                    newUser.setEmail(normalizedEmail);
                    newUser.setPassword(
                            passwordEncoder.encode(
                                    UUID.randomUUID().toString()));
                    newUser.setRole("USER");
                    return users.save(newUser);
                });

        String token = jwtService.generateToken(user);

        String frontendUrl = "http://localhost:5175/oauth-callback";

        String redirectUrl = frontendUrl
                + "?token=" + encode(token)
                + "&email=" + encode(user.getEmail())
                + "&role=" + encode(user.getRole());

        response.sendRedirect(redirectUrl);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
