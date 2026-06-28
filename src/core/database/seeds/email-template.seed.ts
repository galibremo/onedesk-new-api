import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { TEMPLATE_REGISTRY, type TemplateKey } from '../../../app/email-template/email-template.registry';
import schema from '../schema';

type SeedDatabase = NodePgDatabase<typeof schema>;

const magicLinkEmailTemplate = {
	key: 'auth_magic_link' satisfies TemplateKey,
	version: 1,
	isActive: true,
	variables: TEMPLATE_REGISTRY.auth_magic_link,
	subject: 'Your secure sign-in link',
	html: `
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Your secure sign-in link</title>
	</head>
	<body style="margin:0;background:#f6f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
						<tr>
							<td style="padding:32px 32px 16px;">
								<p style="margin:0 0 12px;color:#6b7280;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Secure sign in</p>
								<h1 style="margin:0;color:#111827;font-size:28px;line-height:1.2;">Use this magic link to continue</h1>
							</td>
						</tr>
						<tr>
							<td style="padding:0 32px 8px;">
								<p style="margin:0;color:#374151;font-size:16px;line-height:1.6;">We received a request to sign in to your account. This link expires in {{expiresInMinutes}} minutes and can only be used once.</p>
							</td>
						</tr>
						<tr>
							<td align="center" style="padding:24px 32px 16px;">
								<a href="{{verificationUrl}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:15px;font-weight:700;">Sign in securely</a>
							</td>
						</tr>
						<tr>
							<td style="padding:8px 32px 32px;">
								<p style="margin:0 0 12px;color:#6b7280;font-size:13px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
								<p style="margin:0;word-break:break-all;color:#374151;font-size:13px;line-height:1.6;">{{verificationUrl}}</p>
							</td>
						</tr>
						<tr>
							<td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
								<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">If you did not request this email, you can safely ignore it. &copy; {{year}}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>
`.trim(),
	text: `
Use this magic link to sign in:

{{verificationUrl}}

This link expires in {{expiresInMinutes}} minutes and can only be used once.

If you did not request this email, you can safely ignore it.

(c) {{year}}
`.trim(),
};

const welcomeEmailTemplate = {
	key: 'auth_welcome' satisfies TemplateKey,
	version: 1,
	isActive: true,
	variables: TEMPLATE_REGISTRY.auth_welcome,
	subject: 'Welcome to your account',
	html: `
<!doctype html>
<html lang="en">
	<body style="margin:0;background:#f6f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
						<tr>
							<td style="padding:32px;">
								<p style="margin:0 0 12px;color:#6b7280;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Welcome</p>
								<h1 style="margin:0 0 16px;color:#111827;font-size:28px;line-height:1.2;">Your account is ready</h1>
								<p style="margin:0;color:#374151;font-size:16px;line-height:1.6;">Hi {{name}}, your account for {{email}} has been created successfully.</p>
							</td>
						</tr>
						<tr>
							<td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
								<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">&copy; {{year}}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>
`.trim(),
	text: `
Welcome, {{name}}.

Your account for {{email}} has been created successfully.

(c) {{year}}
`.trim(),
};

const accountApprovalEmailTemplate = {
	key: 'auth_account_approval' satisfies TemplateKey,
	version: 1,
	isActive: true,
	variables: TEMPLATE_REGISTRY.auth_account_approval,
	subject: 'Your account has been approved',
	html: `
<!doctype html>
<html lang="en">
	<body style="margin:0;background:#f6f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
						<tr>
							<td style="padding:32px;">
								<p style="margin:0 0 12px;color:#6b7280;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Account approved</p>
								<h1 style="margin:0 0 16px;color:#111827;font-size:28px;line-height:1.2;">You can now sign in</h1>
								<p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">Hi {{name}}, your account was approved by {{approvedByName}}.</p>
								<a href="{{appUrl}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:15px;font-weight:700;">Open dashboard</a>
							</td>
						</tr>
						<tr>
							<td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
								<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">&copy; {{year}}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>
`.trim(),
	text: `
Hi {{name}},

Your account was approved by {{approvedByName}}. You can now sign in:

{{appUrl}}

(c) {{year}}
`.trim(),
};

const invitationEmailTemplate = {
	key: 'auth_invitation' satisfies TemplateKey,
	version: 1,
	isActive: true,
	variables: TEMPLATE_REGISTRY.auth_invitation,
	subject: 'You have been invited',
	html: `
<!doctype html>
<html lang="en">
	<body style="margin:0;background:#f6f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
						<tr>
							<td style="padding:32px;">
								<p style="margin:0 0 12px;color:#6b7280;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Invitation</p>
								<h1 style="margin:0 0 16px;color:#111827;font-size:28px;line-height:1.2;">Your account has been created</h1>
								<p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">Hi {{name}}, {{createdByName}} created an account for you with the {{role}} role.</p>
								<a href="{{appUrl}}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 24px;font-size:15px;font-weight:700;">Open dashboard</a>
							</td>
						</tr>
						<tr>
							<td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
								<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">Use your email address to request a secure sign-in link. &copy; {{year}}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>
`.trim(),
	text: `
Hi {{name}},

{{createdByName}} created an account for you with the {{role}} role.

Open the dashboard and use your email address to request a secure sign-in link:
{{appUrl}}

(c) {{year}}
`.trim(),
};

const twoFactorAlertEmailTemplate = {
	key: 'auth_two_factor_alert' satisfies TemplateKey,
	version: 1,
	isActive: true,
	variables: TEMPLATE_REGISTRY.auth_two_factor_alert,
	subject: 'Two-factor authentication {{eventLabel}}',
	html: `
<!doctype html>
<html lang="en">
	<body style="margin:0;background:#f6f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
						<tr>
							<td style="padding:32px;">
								<p style="margin:0 0 12px;color:#6b7280;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Security alert</p>
								<h1 style="margin:0 0 16px;color:#111827;font-size:28px;line-height:1.2;">2FA was {{eventLabel}}</h1>
								<p style="margin:0 0 12px;color:#374151;font-size:16px;line-height:1.6;">Hi {{name}}, two-factor authentication on your account was {{eventLabel}}.</p>
								<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">IP address: {{ipAddress}}<br />User agent: {{userAgent}}</p>
							</td>
						</tr>
						<tr>
							<td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
								<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">If this was not expected, contact an administrator. &copy; {{year}}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>
`.trim(),
	text: `
Hi {{name}},

Two-factor authentication on your account was {{eventLabel}}.

IP address: {{ipAddress}}
User agent: {{userAgent}}

If this was not expected, contact an administrator.

(c) {{year}}
`.trim(),
};

const emailTemplates = [
	magicLinkEmailTemplate,
	welcomeEmailTemplate,
	accountApprovalEmailTemplate,
	invitationEmailTemplate,
	twoFactorAlertEmailTemplate,
];

export async function seedEmailTemplates(db: SeedDatabase): Promise<void> {
	for (const template of emailTemplates) {
		await db
			.insert(schema.emailTemplates)
			.values(template)
			.onConflictDoUpdate({
				target: [schema.emailTemplates.key, schema.emailTemplates.version],
				set: {
					subject: template.subject,
					html: template.html,
					text: template.text,
					variables: template.variables,
					isActive: template.isActive,
					updatedAt: sql`now()`,
				},
			});

		console.log(`Seeded email template: ${template.key}@v${template.version}`);
	}
}
