import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface MailAttachment {
  filename: string;
  contentType: string;
  /** Base64-encoded file content. */
  contentBase64: string;
}

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
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

// Served by apps/web (the only public static host this project has) -
// flattened onto a white background at build time so it's safe in an email
// regardless of the client's own background colour, unlike the app's own
// transparent-PNG / dark-background assets.
const LOGO_URL = 'https://hrm.1solutions.biz/email-logo.png';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PRESENT: { bg: '#dcfce7', text: '#166534' },
  HALF_DAY: { bg: '#dcfce7', text: '#166534' },
  LATE: { bg: '#fef9c3', text: '#854d0e' },
  ABSENT: { bg: '#fee2e2', text: '#991b1b' },
  ON_LEAVE: { bg: '#ffedd5', text: '#9a3412' },
  HOLIDAY: { bg: '#f1f5f9', text: '#475569' },
  WEEKEND: { bg: '#f1f5f9', text: '#475569' },
};
const DEFAULT_STATUS_COLOR = { bg: '#f1f5f9', text: '#475569' };

function statusPill(statusKey: string, label: string): string {
  const color = STATUS_COLORS[statusKey] ?? DEFAULT_STATUS_COLOR;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:${color.bg};color:${color.text};">${label}</span>`;
}

function statChip(label: string, value: string | number, color: { bg: string; text: string }): string {
  return `
    <td width="25%" style="padding:4px;">
      <div style="background:${color.bg};color:${color.text};border-radius:8px;padding:10px 6px;text-align:center;">
        <div style="font-size:18px;font-weight:700;line-height:1.2;">${value}</div>
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;opacity:0.85;">${label}</div>
      </div>
    </td>`;
}

/**
 * Shared header (logo) + footer (confidentiality notice) for the weekly
 * attendance emails - not used by sendPasswordResetEmail, which is a
 * different, unrelated email and out of scope for this branding pass.
 * The `format-detection` meta is what stops Apple/iOS Mail turning every
 * "10:25 am"-looking string in the table into a blue auto-linked "event" -
 * confirmed as the cause of the blue-underlined times in the original
 * report (a real screenshot showed it), not something any table styling
 * alone can fix.
 */
function wrapAttendanceEmail(bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
<style>
  /* The format-detection meta tag above doesn't reliably stop iOS Mail's
     own "Data Detectors" from turning things like "10:25 am" into a blue,
     underlined, tappable link - confirmed on a real device (a screenshot
     showed every check-in/out time linked, meta tag alone not enough).
     Apple Mail marks detected text with x-apple-data-detectors and
     specifically honours overriding its styling via CSS - this neutralises
     the link's appearance (still technically tappable, but reads as plain
     text, which is what actually matters here). */
  .x-apple-data-detectors,
  .x-apple-data-detectors *,
  a[x-apple-data-detectors="true"],
  a[x-apple-data-detectors="true"] * {
    color: inherit !important;
    text-decoration: none !important;
    font-size: inherit !important;
    font-family: inherit !important;
    font-weight: inherit !important;
    line-height: inherit !important;
  }
</style>
</head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:28px 32px 16px;text-align:center;">
        <img src="${LOGO_URL}" width="160" alt="1Solutions HRM" style="display:block;margin:0 auto;max-width:160px;height:auto;border:0;" />
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 28px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">
          This email is confidential and intended only for the internal employees of 1Solutions.
          If you received it in error, please delete it and notify us.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
          encoding: 'base64',
          contentType: a.contentType,
        })),
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
            attachments: input.attachments?.map((a) => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: a.filename,
              contentType: a.contentType,
              contentBytes: a.contentBase64,
            })),
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

  async sendWeeklyAttendanceReport(
    to: string,
    input: {
      employeeName: string;
      weekLabel: string;
      rows: WeeklyAttendanceDayRow[];
      totals: WeeklyAttendanceTotals;
    },
  ): Promise<void> {
    const rowsHtml = input.rows
      .map((r, i) => {
        const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
        return `
          <tr style="background:${rowBg};">
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1f2937;white-space:nowrap;">${r.dayLabel}, ${r.date}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">${statusPill(r.statusKey, r.status)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#4b5563;">${r.checkIn ?? '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#4b5563;">${r.checkOut ?? '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#4b5563;">${r.hours ?? '—'}</td>
          </tr>`;
      })
      .join('');

    const thStyle =
      'padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.03em;color:#64748b;border-bottom:1px solid #e5e7eb;';

    const bodyHtml = `
      <h2 style="margin:0 0 4px;font-size:19px;color:#111827;">Weekly Attendance Summary</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">${input.employeeName} &middot; ${input.weekLabel}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="${thStyle}">Day</th>
            <th style="${thStyle}">Status</th>
            <th style="${thStyle}">Check-in</th>
            <th style="${thStyle}">Check-out</th>
            <th style="${thStyle}">Hours</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr>
          ${statChip('Present', input.totals.present, STATUS_COLORS.PRESENT)}
          ${statChip('Late', input.totals.late, STATUS_COLORS.LATE)}
          ${statChip('Absent', input.totals.absent, STATUS_COLORS.ABSENT)}
          ${statChip('On leave', input.totals.onLeave, STATUS_COLORS.ON_LEAVE)}
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#374151;text-align:center;">
        Total hours worked: <strong>${input.totals.totalHours}</strong>
      </p>
    `;

    await this.send({
      to,
      subject: `Your weekly attendance summary (${input.weekLabel})`,
      text: `Your attendance for ${input.weekLabel}: ${input.totals.present} present, ${input.totals.late} late, ${input.totals.absent} absent, ${input.totals.onLeave} on leave. Total hours worked: ${input.totals.totalHours}.`,
      html: wrapAttendanceEmail(bodyHtml),
    });
  }

  async sendAdminWeeklyAttendanceReport(
    to: string,
    input: {
      weekLabel: string;
      employeeCount: number;
      csvBase64: string;
      csvFilename: string;
    },
  ): Promise<void> {
    const bodyHtml = `
      <h2 style="margin:0 0 4px;font-size:19px;color:#111827;">Weekly Attendance — All Employees</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">${input.weekLabel}</p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#374151;">
        Attendance for ${input.weekLabel}, all ${input.employeeCount} active employees, one row each —
        see the attached sheet.
      </p>
    `;

    await this.send({
      to,
      subject: `Weekly attendance — all employees (${input.weekLabel})`,
      text: `Attached: attendance for all ${input.employeeCount} active employees for ${input.weekLabel}, one row per employee.`,
      html: wrapAttendanceEmail(bodyHtml),
      attachments: [
        { filename: input.csvFilename, contentType: 'text/csv', contentBase64: input.csvBase64 },
      ],
    });
  }
}

export interface WeeklyAttendanceDayRow {
  dayLabel: string;
  date: string;
  status: string;
  /** The underlying enum value (see AttendanceDayStatus) - status is only the display label, this is what actually drives the colour. */
  statusKey: string;
  checkIn: string | null;
  checkOut: string | null;
  hours: string | null;
}

export interface WeeklyAttendanceTotals {
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  totalHours: string;
}
