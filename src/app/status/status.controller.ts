import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class StatusController {
	constructor() {}

	@Get()
	getRoot(@Res() res: Response): void {
		const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Boilerplate API — Status</title>
	<style>
		:root {
			--bg: #0b0f1a;
			--surface: #111827;
			--surface-raised: #1a2235;
			--border: #1e293b;
			--border-light: #334155;
			--text: #f1f5f9;
			--text-muted: #94a3b8;
			--text-dim: #64748b;
			--accent: #6366f1;
			--accent-glow: rgba(99, 102, 241, 0.15);
			--green: #22c55e;
			--green-bg: rgba(34, 197, 94, 0.1);
			--amber: #f59e0b;
			--amber-bg: rgba(245, 158, 11, 0.1);
			--rose: #f43f5e;
			--rose-bg: rgba(244, 63, 94, 0.1);
			--cyan: #06b6d4;
			--cyan-bg: rgba(6, 182, 212, 0.1);
			--get: #06b6d4;
			--get-bg: rgba(6, 182, 212, 0.1);
			--post: #6366f1;
			--post-bg: rgba(99, 102, 241, 0.1);
			--put: #f59e0b;
			--put-bg: rgba(245, 158, 11, 0.1);
			--patch: #a855f7;
			--patch-bg: rgba(168, 85, 247, 0.1);
			--delete: #f43f5e;
			--delete-bg: rgba(244, 63, 94, 0.1);
			--radius: 12px;
			--radius-sm: 8px;
		}

		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

		html { background: var(--bg); }

		body {
			font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
			color: var(--text);
			background: var(--bg);
			background-image:
				radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.12), transparent),
				radial-gradient(ellipse 60% 40% at 80% 60%, rgba(6, 182, 212, 0.06), transparent);
			min-height: 100vh;
			padding: 24px;
			line-height: 1.6;
		}

		a { color: var(--accent); text-decoration: none; transition: color 0.15s; }
		a:hover { color: #818cf8; }

		.container { max-width: 1080px; margin: 0 auto; }

		/* Header */
		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			padding: 16px 0;
			margin-bottom: 32px;
		}

		.logo {
			display: flex;
			align-items: center;
			gap: 10px;
			font-weight: 700;
			font-size: 1rem;
			color: var(--text);
		}

		.logo-icon {
			width: 32px;
			height: 32px;
			border-radius: var(--radius-sm);
			background: var(--accent);
			display: grid;
			place-items: center;
			color: #fff;
		}

		.logo-icon svg { width: 18px; height: 18px; }

		.status-badge {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 6px 14px;
			border-radius: 999px;
			background: var(--green-bg);
			border: 1px solid rgba(34, 197, 94, 0.2);
			color: var(--green);
			font-size: 0.82rem;
			font-weight: 600;
		}

		.status-dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: var(--green);
			box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
			animation: pulse 2s ease-in-out infinite;
		}

		@keyframes pulse {
			0%, 100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2); }
			50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
		}

		/* Hero */
		.hero {
			display: grid;
			grid-template-columns: 1fr 340px;
			gap: 24px;
			margin-bottom: 32px;
		}

		.hero-main {
			padding: 40px;
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
		}

		.hero-label {
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--cyan);
			margin-bottom: 12px;
		}

		.hero h1 {
			font-size: clamp(2rem, 5vw, 3.2rem);
			font-weight: 800;
			line-height: 1.1;
			letter-spacing: -0.02em;
			margin-bottom: 16px;
		}

		.hero p {
			color: var(--text-muted);
			font-size: 1rem;
			max-width: 52ch;
			line-height: 1.7;
		}

		.hero-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 24px;
		}

		.btn {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 10px 18px;
			border-radius: var(--radius-sm);
			font-size: 0.88rem;
			font-weight: 600;
			border: 1px solid var(--border-light);
			background: var(--surface-raised);
			color: var(--text);
			transition: all 0.15s;
		}

		.btn:hover { border-color: var(--accent); background: var(--accent-glow); }

		.btn-primary {
			background: var(--accent);
			border-color: var(--accent);
			color: #fff;
		}

		.btn-primary:hover { background: #5558e6; }

		.btn svg { width: 16px; height: 16px; flex-shrink: 0; }

		/* Terminal */
		.terminal {
			background: #0d1117;
			border: 1px solid var(--border);
			border-radius: var(--radius);
			overflow: hidden;
		}

		.terminal-bar {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 12px 16px;
			border-bottom: 1px solid var(--border);
			background: rgba(255, 255, 255, 0.02);
		}

		.terminal-dot {
			width: 10px;
			height: 10px;
			border-radius: 50%;
		}

		.terminal-dot.red { background: #ff5f57; }
		.terminal-dot.yellow { background: #febc2e; }
		.terminal-dot.green { background: #28c840; }

		.terminal pre {
			padding: 20px;
			font: 0.82rem/1.7 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
			color: #c9d1d9;
			overflow-x: auto;
		}

		.terminal .comment { color: #8b949e; }
		.terminal .cmd { color: #79c0ff; }
		.terminal .url { color: #a5d6ff; }
		.terminal .method { color: #ffa657; }
		.terminal .path { color: #7ee787; }

		/* Stats */
		.stats {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 16px;
			margin-bottom: 32px;
		}

		.stat {
			padding: 20px;
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			text-align: center;
		}

		.stat-value {
			font-size: 1.8rem;
			font-weight: 800;
			letter-spacing: -0.02em;
			line-height: 1;
			margin-bottom: 6px;
		}

		.stat-label {
			font-size: 0.82rem;
			color: var(--text-muted);
		}

		/* Sections */
		.section {
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			margin-bottom: 24px;
			overflow: hidden;
		}

		.section-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 18px 24px;
			border-bottom: 1px solid var(--border);
			background: var(--surface-raised);
		}

		.section-title {
			font-size: 0.95rem;
			font-weight: 700;
		}

		.section-subtitle {
			font-size: 0.82rem;
			color: var(--text-dim);
		}

		.badge {
			font: 0.75rem/1 'JetBrains Mono', monospace;
			padding: 4px 10px;
			border-radius: 6px;
			background: var(--accent-glow);
			color: var(--accent);
			border: 1px solid rgba(99, 102, 241, 0.2);
		}

		/* Routes */
		.route-list { padding: 0; }

		.route-row {
			display: grid;
			grid-template-columns: 80px 1fr auto;
			align-items: center;
			gap: 16px;
			padding: 14px 24px;
			border-bottom: 1px solid var(--border);
			transition: background 0.1s;
		}

		.route-row:last-child { border-bottom: none; }
		.route-row:hover { background: var(--surface-raised); }

		.method-badge {
			display: inline-grid;
			place-items: center;
			min-width: 56px;
			padding: 4px 8px;
			border-radius: 6px;
			font: 0.7rem/1 'JetBrains Mono', monospace;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		.method-badge.get { background: var(--get-bg); color: var(--get); border: 1px solid rgba(6, 182, 212, 0.2); }
		.method-badge.post { background: var(--post-bg); color: var(--post); border: 1px solid rgba(99, 102, 241, 0.2); }
		.method-badge.put { background: var(--put-bg); color: var(--put); border: 1px solid rgba(245, 158, 11, 0.2); }
		.method-badge.patch { background: var(--patch-bg); color: var(--patch); border: 1px solid rgba(168, 85, 247, 0.2); }
		.method-badge.delete { background: var(--delete-bg); color: var(--delete); border: 1px solid rgba(244, 63, 94, 0.2); }

		.route-path {
			font: 0.88rem/1.4 'JetBrains Mono', 'Cascadia Code', monospace;
			color: var(--text);
		}

		.route-desc {
			display: block;
			font-size: 0.78rem;
			color: var(--text-dim);
			margin-top: 2px;
			font-family: 'Inter', sans-serif;
		}

		.route-auth {
			font-size: 0.75rem;
			color: var(--text-dim);
			white-space: nowrap;
			display: flex;
			align-items: center;
			gap: 5px;
		}

		.route-auth svg { width: 12px; height: 12px; opacity: 0.6; }

		/* Domain grid */
		.domain-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 16px;
			padding: 24px;
		}

		.domain-card {
			padding: 20px;
			border: 1px solid var(--border);
			border-radius: var(--radius-sm);
			background: var(--surface-raised);
			transition: border-color 0.15s;
		}

		.domain-card:hover { border-color: var(--border-light); }

		.domain-card h3 {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 0.9rem;
			font-weight: 700;
			margin-bottom: 8px;
		}

		.domain-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.domain-dot.indigo { background: var(--accent); }
		.domain-dot.cyan { background: var(--cyan); }
		.domain-dot.amber { background: var(--amber); }
		.domain-dot.rose { background: var(--rose); }
		.domain-dot.green { background: var(--green); }
		.domain-dot.purple { background: #a855f7; }

		.domain-card p {
			font-size: 0.82rem;
			color: var(--text-muted);
			line-height: 1.5;
		}

		.domain-card code {
			font: 0.75rem/1 'JetBrains Mono', monospace;
			padding: 2px 6px;
			border-radius: 4px;
			background: rgba(99, 102, 241, 0.1);
			color: var(--accent);
		}

		/* Docs list */
		.docs-list {
			list-style: none;
			padding: 20px 24px;
			display: grid;
			gap: 10px;
		}

		.docs-list li {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 14px 16px;
			border: 1px solid var(--border);
			border-radius: var(--radius-sm);
			background: var(--surface-raised);
			transition: border-color 0.15s;
		}

		.docs-list li:hover { border-color: var(--border-light); }

		.docs-list strong {
			display: block;
			font-size: 0.88rem;
			margin-bottom: 2px;
		}

		.docs-list span {
			font-size: 0.78rem;
			color: var(--text-dim);
		}

		.docs-list code {
			font: 0.72rem/1 'JetBrains Mono', monospace;
			padding: 3px 8px;
			border-radius: 5px;
			background: var(--accent-glow);
			color: var(--accent);
			border: 1px solid rgba(99, 102, 241, 0.15);
			white-space: nowrap;
		}

		/* Footer */
		.footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 20px 0;
			color: var(--text-dim);
			font-size: 0.82rem;
			border-top: 1px solid var(--border);
			margin-top: 8px;
		}

		/* Responsive */
		@media (max-width: 860px) {
			body { padding: 16px; }
			.hero { grid-template-columns: 1fr; }
			.stats { grid-template-columns: repeat(2, 1fr); }
			.route-row { grid-template-columns: 1fr; gap: 6px; }
			.route-auth { justify-self: start; }
		}

		@media (max-width: 540px) {
			.stats { grid-template-columns: 1fr 1fr; gap: 10px; }
			.domain-grid { grid-template-columns: 1fr; }
			.header { flex-direction: column; align-items: flex-start; }
			.footer { flex-direction: column; gap: 8px; }
		}
	</style>
</head>
<body>
	<div class="container">
		<header class="header">
			<div class="logo">
				<span class="logo-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3l7.5 4.25v8.5L12 20 4.5 15.75v-8.5L12 3z"/>
						<path d="M8.5 9.5l3.5 2 3.5-2"/>
						<path d="M12 11.5V16"/>
					</svg>
				</span>
				<span>Boilerplate API</span>
			</div>
			<span class="status-badge"><span class="status-dot"></span>Operational</span>
		</header>

		<main>
			<section class="hero">
				<div class="hero-main">
					<p class="hero-label">NestJS &middot; Drizzle ORM &middot; PostgreSQL</p>
					<h1>Backend Service Gateway</h1>
					<p>
						A production-ready backend for authentication, media management, user
						administration, system configuration, and CSRF-protected workflows.
						This page maps every route exposed by the running service.
					</p>
					<div class="hero-actions">
						<a class="btn btn-primary" href="/csrf">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-8 8.5C7.5 20.5 4 18 4 13V5l8-3 8 3v8z"/><path d="M9 12l2 2 4-5"/></svg>
							CSRF Token
						</a>
						<a class="btn" href="/auth/me">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
							Profile
						</a>
						<a class="btn" href="/health">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
							Health
						</a>
						<a class="btn" href="/routes.json">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
							Routes JSON
						</a>
					</div>
				</div>

				<div class="terminal" aria-label="Example requests">
					<div class="terminal-bar" aria-hidden="true">
						<span class="terminal-dot red"></span>
						<span class="terminal-dot yellow"></span>
						<span class="terminal-dot green"></span>
					</div>
					<pre><span class="comment"># health check</span>
<span class="cmd">curl</span> <span class="url">http://localhost:8080/health</span>

<span class="comment"># get CSRF token</span>
<span class="cmd">curl</span> <span class="url">http://localhost:8080/csrf</span>

<span class="comment"># protected routes</span>
<span class="method">GET</span>  <span class="path">/users</span>
<span class="method">GET</span>  <span class="path">/auth/me</span>
<span class="method">POST</span> <span class="path">/auth/magic-link/request</span></pre>
				</div>
			</section>

			<section class="stats" aria-label="API summary">
				<div class="stat">
					<div class="stat-value">7</div>
					<div class="stat-label">API modules</div>
				</div>
				<div class="stat">
					<div class="stat-value">39</div>
					<div class="stat-label">Route handlers</div>
				</div>
				<div class="stat">
					<div class="stat-value">JWT</div>
					<div class="stat-label">Auth mechanism</div>
				</div>
				<div class="stat">
					<div class="stat-value">CSRF</div>
					<div class="stat-label">Mutation guard</div>
				</div>
			</section>

			<section class="section" aria-labelledby="routes-heading">
				<div class="section-header">
					<div>
						<h2 class="section-title" id="routes-heading">Route Highlights</h2>
						<p class="section-subtitle">Common entry points for quick API checks.</p>
					</div>
					<span class="badge">GET /</span>
				</div>
				<div class="route-list">
					<div class="route-row">
						<span class="method-badge get">GET</span>
						<span>
							<span class="route-path">/csrf</span>
							<span class="route-desc">Issue a CSRF token cookie and response value.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
							Public
						</span>
					</div>
					<div class="route-row">
						<span class="method-badge post">POST</span>
						<span>
							<span class="route-path">/auth/login</span>
							<span class="route-desc">Create an authenticated session with email and password.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							Credentials
						</span>
					</div>
					<div class="route-row">
						<span class="method-badge get">GET</span>
						<span>
							<span class="route-path">/auth/me</span>
							<span class="route-desc">Read the current authenticated user profile.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							JWT
						</span>
					</div>
					<div class="route-row">
						<span class="method-badge post">POST</span>
						<span>
							<span class="route-path">/media</span>
							<span class="route-desc">Upload and register media assets via Cloudinary.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							JWT + CSRF
						</span>
					</div>
					<div class="route-row">
						<span class="method-badge get">GET</span>
						<span>
							<span class="route-path">/system/settings/public</span>
							<span class="route-desc">Read public access model and allowed roles.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
							Public
						</span>
					</div>
					<div class="route-row">
						<span class="method-badge get">GET</span>
						<span>
							<span class="route-path">/audit-logs</span>
							<span class="route-desc">List audit log entries with filtering and pagination.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							Admin JWT
						</span>
					</div>
					<div class="route-row">
						<span class="method-badge get">GET</span>
						<span>
							<span class="route-path">/health</span>
							<span class="route-desc">Database connectivity and memory health checks.</span>
						</span>
						<span class="route-auth">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
							Public
						</span>
					</div>
				</div>
			</section>

			<section class="section" aria-labelledby="domains-heading">
				<div class="section-header">
					<div>
						<h2 class="section-title" id="domains-heading">Service Domains</h2>
						<p class="section-subtitle">Modules wired into the API surface.</p>
					</div>
				</div>
				<div class="domain-grid">
					<article class="domain-card">
						<h3><span class="domain-dot indigo"></span>Auth</h3>
						<p>Magic-link login, Google OAuth, password auth, 2FA (TOTP), session management, and profile routes under <code>/auth</code>.</p>
					</article>
					<article class="domain-card">
						<h3><span class="domain-dot cyan"></span>Users</h3>
						<p>Admin user CRUD, role management, session revocation, and 2FA reset under <code>/users</code>.</p>
					</article>
					<article class="domain-card">
						<h3><span class="domain-dot amber"></span>Media</h3>
						<p>File upload via Cloudinary, listing, update, and delete under <code>/media</code>.</p>
					</article>
					<article class="domain-card">
						<h3><span class="domain-dot rose"></span>Audit Logs</h3>
						<p>Admin-only activity history for sensitive account and access events under <code>/audit-logs</code>.</p>
					</article>
					<article class="domain-card">
						<h3><span class="domain-dot green"></span>System</h3>
						<p>Application-level access model and role configuration under <code>/system</code>.</p>
					</article>
					<article class="domain-card">
						<h3><span class="domain-dot purple"></span>Security</h3>
						<p>Global CSRF protection, JWT guards, role guards, request throttling, and structured error handling.</p>
					</article>
				</div>
			</section>

			<section class="section" aria-labelledby="docs-heading">
				<div class="section-header">
					<div>
						<h2 class="section-title" id="docs-heading">API Documentation</h2>
						<p class="section-subtitle">Module-level docs under <code>docs/api/</code>.</p>
					</div>
				</div>
				<ul class="docs-list">
					<li>
						<div>
							<strong>Auth</strong>
							<span>Magic links, Google login, sessions, 2FA, and profile routes.</span>
						</div>
						<code>docs/api/auth.md</code>
					</li>
					<li>
						<div>
							<strong>Users</strong>
							<span>Admin user directory, CRUD, role updates, and session revocation.</span>
						</div>
						<code>docs/api/users.md</code>
					</li>
					<li>
						<div>
							<strong>Media</strong>
							<span>Upload, listing, update, and deletion of media assets.</span>
						</div>
						<code>docs/api/media.md</code>
					</li>
					<li>
						<div>
							<strong>Audit Logs</strong>
							<span>Admin activity history with filtering and pagination.</span>
						</div>
						<code>docs/api/audit-logs.md</code>
					</li>
					<li>
						<div>
							<strong>System</strong>
							<span>Access model and role configuration endpoints.</span>
						</div>
						<code>docs/api/system.md</code>
					</li>
					<li>
						<div>
							<strong>Health</strong>
							<span>Database and memory health check endpoint.</span>
						</div>
						<code>docs/api/health.md</code>
					</li>
					<li>
						<div>
							<strong>CSRF</strong>
							<span>Token issuing and unsafe-method protection.</span>
						</div>
						<code>docs/api/csrf.md</code>
					</li>
				</ul>
			</section>
		</main>

		<footer class="footer">
			<span>Boilerplate backend status page</span>
			<span>Built with NestJS, Drizzle ORM, and PostgreSQL</span>
		</footer>
	</div>
</body>
</html>`;
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.send(html);
	}
}
