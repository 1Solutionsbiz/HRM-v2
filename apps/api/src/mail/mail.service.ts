import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * SMTP is optional config (see environment.ts) so a mail outage or an
 * unconfigured environment never blocks startup or login. When unconfigured,
 * `send` logs and returns rather than throwing — callers (AuthService) treat
 * a reset request the same way regardless, so nothing user-facing leaks
 * whether mail is actually wired up.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.getOrThrow<string>('MAIL_FROM');
    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'SMTP_HOST is not set — outbound email is disabled; emails will be logged, not sent.',
      );
      return;
    }
    this.transporter = createTransport({
      host,
      port: this.configService.getOrThrow<number>('SMTP_PORT'),
      secure: this.configService.getOrThrow<boolean>('SMTP_SECURE'),
      auth: this.configService.get<string>('SMTP_USER')
        ? {
            user: this.configService.getOrThrow<string>('SMTP_USER'),
            pass: this.configService.getOrThrow<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  private async send(input: SendMailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`Mail not configured — would have sent "${input.subject}" to ${input.to}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
    } catch (error) {
      // Never throw out of a mail send: the caller already committed the
      // underlying state change (e.g. a reset token row) and a delivery
      // failure must not surface as a 500 to the end user.
      this.logger.error(
        `Failed to send "${input.subject}" to ${input.to}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your 1Solutions HRM password',
      text: `We received a request to reset your 1Solutions HRM password. Open this link to choose a new password (it expires in 30 minutes and can only be used once):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937;">
          <h2 style="margin:0 0 16px;font-size:20px;">Reset your password</h2>
          <p style="margin:0 0 16px;line-height:1.5;">
            We received a request to reset your 1Solutions HRM password. This link expires in
            30 minutes and can only be used once.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${resetUrl}" style="display:inline-block;background:#114171;color:#ffffff;
              text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
              Reset password
            </a>
          </p>
          <p style="margin:0 0 8px;line-height:1.5;color:#6b7280;font-size:13px;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <a href="${resetUrl}" style="color:#114171;">${resetUrl}</a>
          </p>
          <p style="margin:16px 0 0;line-height:1.5;color:#6b7280;font-size:13px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }
}
