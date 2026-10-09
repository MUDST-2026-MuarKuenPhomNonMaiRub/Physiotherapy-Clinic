package com.physiocare.clinic.service;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends the reset link off the request thread, so the API answers in the same
 * time whether or not the address belongs to an account.
 */
@Service
public class PasswordResetMailer {
  private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

  private final ObjectProvider<JavaMailSender> mailSender;
  private final String smtpHost;
  private final String from;
  private final ExecutorService executor =
      Executors.newSingleThreadExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "password-reset-mail");
            thread.setDaemon(true);
            return thread;
          });

  public PasswordResetMailer(
      ObjectProvider<JavaMailSender> mailSender,
      @Value("${spring.mail.host:}") String smtpHost,
      @Value("${app.mail.from}") String from) {
    this.mailSender = mailSender;
    this.smtpHost = smtpHost;
    this.from = from;
  }

  public void sendAsync(String to, String firstName, String resetLink, long ttlMinutes) {
    JavaMailSender sender = mailSender.getIfAvailable();
    if (smtpHost.isBlank() || sender == null) {
      log.warn("Password reset requested but SMTP_HOST is not configured; no email was sent");
      return;
    }
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(to);
    message.setSubject(
        "คำขอตั้งรหัสผ่านใหม่ บัญชี LA BALANCE / LA BALANCE Password Reset Request");
    message.setText(body(firstName, resetLink, ttlMinutes));
    executor.execute(
        () -> {
          try {
            sender.send(message);
          } catch (RuntimeException e) {
            log.error("Could not send the password reset email", e);
          }
        });
  }

  private static String body(String firstName, String link, long ttlMinutes) {
    return """
        เรียน คุณ%1$s

        ทางคลินิกได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีผู้ใช้งานระบบ LA BALANCE ของท่าน
        กรุณาคลิกลิงก์ด้านล่างเพื่อดำเนินการตั้งรหัสผ่านใหม่

        %2$s

        ลิงก์นี้สามารถใช้งานได้เพียงครั้งเดียว และจะหมดอายุภายใน %3$d นาที

        หากท่านมิได้เป็นผู้ส่งคำขอดังกล่าว ท่านสามารถละเว้นอีเมลฉบับนี้ได้
        รหัสผ่านเดิมของท่านยังคงใช้งานได้ตามปกติ

        ขอแสดงความนับถือ
        LA BALANCE Physical Therapy Clinic

        ------------------------------------------------------------

        Dear %1$s,

        We have received a request to reset the password for your LA BALANCE account.
        Please use the link above to set a new password.

        This link can be used only once and will expire in %3$d minutes.

        If you did not make this request, please disregard this email.
        Your current password will remain unchanged.

        Sincerely,
        LA BALANCE Physical Therapy Clinic

        ------------------------------------------------------------
        อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ
        This is an automated message. Please do not reply.
        """
        .formatted(firstName, link, ttlMinutes);
  }

  @PreDestroy
  void shutdown() {
    executor.shutdown();
  }
}
