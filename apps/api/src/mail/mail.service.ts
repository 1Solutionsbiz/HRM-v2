import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
}

const GRAPH_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const GRAPH_SEND_MAIL_URL = (senderEmail: string) =>
  `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;

/**
 * Outbound mail is optional config (see environment.ts) so a mail outage or
 * an unconfigured environment never blocks startup or login. When neither
 * transport is configured, `send` logs and returns rather than throwing —
 * callers (AuthService) treat a reset request the same way regardless, so
 * nothing user-facing leaks whether mail is actually wired up.
 *
 * Two transports, tried in this order:
 * 1. Microsoft Graph (OAuth2 client-credentials) — preferred. Doesn't care
 *    whether the mailbox has MFA or whether the tenant has Basic-Auth SMTP
 *    disabled (most do, by default, as of when this was written).
 * 2. SMTP (nodemailer, optionally with a username/password) — kept as a
 *    fallback for a tenant/provider where Basic-Auth SMTP actually works.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private graph: GraphConfig | null = null;
  private cachedGraphToken: { value: string; expiresAt: number } | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.getOrThrow<string>('MAIL_FROM');

    const tenantId = this.configService.get<string>('MS_TENANT_ID');
    const clientId = this.configService.get<string>('MS_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MS_CLIENT_SECRET');
    if (tenantId && clientId && clientSecret) {
      this.graph = {
        tenantId,
        clientId,
        clientSecret,
        senderEmail: this.configService.getOrThrow<string>('MS_SENDER_EMAIL'),
      };
      return;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(
        'Neither Microsoft Graph nor SMTP_HOST is set — outbound email is disabled; emails will be logged, not sent.',
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
    return this.transporter !== null || this.graph !== null;
  }

  private async send(input: SendMailInput): Promise<void> {
    if (this.graph) {
      await this.sendViaGraph(this.graph, input);
      return;
    }
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
        `Failed to send "${input.subject}" to ${input.to} via SMTP`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async sendViaGraph(graph: GraphConfig, input: SendMailInput): Promise<void> {
    try {
      const token = await this.getGraphAccessToken(graph);
      const response = await fetch(GRAPH_SEND_MAIL_URL(graph.senderEmail), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: input.subject,
            body: { contentType: 'HTML', content: input.html },
            toRecipients: [{ emailAddress: { address: input.to } }],
          },
          // Sent through a shared service mailbox on the caller's behalf,
          // not a real interactive account — a growing Sent Items folder
          // there has no reader and no value.
          saveToSentItems: false,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Graph sendMail returned ${response.status}: ${body}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send "${input.subject}" to ${input.to} via Microsoft Graph`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Client-credentials tokens are valid ~1hr (Microsoft's `expires_in`) —
   * cached in memory rather than fetched per send, both to avoid hammering
   * the token endpoint and because it's rate-limited. The 60s safety margin
   * means a token is never used right at the edge of expiry.
   */
  private async getGraphAccessToken(graph: GraphConfig): Promise<string> {
    if (this.cachedGraphToken && this.cachedGraphToken.expiresAt > Date.now()) {
      return this.cachedGraphToken.value;
    }
    const params = new URLSearchParams({
      client_id: graph.clientId,
      client_secret: graph.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    const response = await fetch(GRAPH_TOKEN_URL(graph.tenantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Failed to acquire Graph access token: ${response.status} ${body}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedGraphToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
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
