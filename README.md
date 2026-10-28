# JA Group TMS

Internal HR and operations portal for JA Group: employee records, leave, payroll and payslips, petty cash, announcements, org structure and support requests.

## Stack

- **Next.js 16** (App Router, Server Actions, `proxy.ts` for session refresh and auth redirects)
- **React 19** with the React Compiler lint rules, **Tailwind CSS v4**, shadcn-style components on `@base-ui/react`
- **Supabase** for Postgres, auth and storage. Row-level security is the source of truth for data access.
- **Resend** + **react-email** for transactional email, **TipTap** for the announcement editor, **@react-pdf/renderer** for payslips

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Sign-in uses a 6-digit code emailed to an active employee's work address.

### Environment

Create `.env.local` with:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Server-only, used by `utils/supabase/admin.ts`. |
| `AUTH_OTP_SECRET` | **Required.** Secret mixed into stored sign-in code hashes. Sign-in fails without it. |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender, e.g. `JA Group TMS <noreply@example.com>` |
| `NEXT_PUBLIC_APP_URL` | Optional. Public base URL used in email links. |
| `NEXT_PUBLIC_AUTH_BYPASS` | Optional, dev only. `true` skips auth with a dummy CEO profile. Ignored in production builds. |

### Database

Schema changes live in `supabase/migrations` and are applied with the Supabase CLI (`supabase db push`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests via Node's built-in test runner (`lib/**/*.test.ts`) |
| `npm run email:dev` | Preview email templates on port 3001 |

## Layout

```
app/(app)/       Signed-in pages (dashboard, leave, admin/*, operations/petty-cash, ...)
app/api/         Route handlers: auth, file downloads, payslip PDFs, exports
app/login, org   Public pages
components/      UI by feature; components/ui holds shared primitives
lib/<feature>/   Data loading (get-*.ts), server actions (actions.ts), types and helpers
lib/auth/        Sign-in codes, current profile, permission tags
emails/          react-email templates
supabase/        Migrations and local config
```

## Permissions

Access is driven by permission tags (`super_admin`, `hr_admin`, `ceo`, `coo`, `finance`, `operations`, `comms`, ...) defined in `lib/auth/permissions.ts`. Server actions and route handlers check them, and matching RLS policies enforce the same rules in the database.
