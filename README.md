# Greenlit Software — website and contact backend

This package contains the complete website and a Node.js backend. The backend serves the pages and sends contact submissions to **markofino@yahoo.com** and **johnglivezey@gmail.com** through Resend. The visitor’s email becomes Reply-To, so replying reaches the visitor.

## Enable email delivery

1. Create an account at https://resend.com and add a domain you own, such as greenlitsoftware.com.
2. Add the DNS records Resend provides at your domain registrar and wait for verification. Use a sending subdomain if preferred; follow the exact records Resend supplies without replacing existing mail records.
3. Create a sending API key and configure RESEND_API_KEY on the server.
4. Set CONTACT_FROM to an address on the verified domain, for example `Greenlit Software <contact@greenlitsoftware.com>`. You do not need a mailbox at that address for sending. Do not use a visitor’s address as the sender.

Domain verification is required to send to both founders. The resend.dev test sender is restricted and is not the production setup. Keep the API key only in server environment variables; never put it in public/app.js or upload your .env to Git.

## Run locally

Install Node.js 22 or later. There are no npm dependencies to install.

Copy `.env.example` to `.env`, then fill in the key and sender.

```sh
npm run dev
```

Open http://localhost:3000. Open the site through the server, rather than double-clicking index.html.

## Deploy yourself

Upload this complete project to your own Git repository and deploy it on a host that runs Node.js web services.

- Runtime: Node.js 22 or later
- Build command: none (if the host requires one, use `npm install`)
- Start command: `npm start`
- Health check: `/health`
- Environment: RESEND_API_KEY, CONTACT_FROM, SITE_URL
- SITE_URL: your exact public origin, such as https://greenlitsoftware.com
- PORT: use the host-provided value
- TRUST_PROXY: leave at 0 unless requests come through a single trusted reverse proxy that sets X-Forwarded-For; then set to 1. Do not enable it when users can connect directly to the server.

Connect your domain using your hosting provider’s instructions. Deploy the frontend and backend together on this server. A static-only host cannot run server.mjs. The previously published ChatGPT preview is unchanged; use this package for your own deployment.

## Behavior and checks

The form has validation, a hidden spam trap, and a limit of five requests per client IP per ten minutes. Recipients are fixed on the server. Requests are limited to 16 KB and messages to 5,000 characters. The limit is in memory and resets on restart; use a shared limiter or host-level protection before scaling to multiple instances. No database or inquiry archive is included.

Successful submission means the email provider accepted the message; it does not guarantee inbox placement. Provider failures keep the message on screen and show an error. Check Resend’s delivery logs when diagnosing mail delivery.

```sh
npm test
```

Tests mock the email provider and never send actual email. Live delivery still needs your API key, verified sender domain, and a real test after deployment.

Documentation: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/domains/introduction
