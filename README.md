# KYC Portal

A small web app for collecting and verifying customer KYC (Aadhaar) and tracking each customer through the steps that follow approval. Agents submit KYC for their customers, the admin reviews and approves it, and both can see where every customer is in the process.

Built with **Next.js 16** and **Supabase**, hosted on **Vercel**. Runs entirely on free tiers.

---

## Who uses it

| Role | How they sign in | What they can do |
|---|---|---|
| **Admin** | `/admin/login` with the phone number and password set in the environment variables | Create and manage agents, review every submission, approve or reject KYC, run or correct any step, mark entries as paid, delete customer data |
| **Agent** | `/agent/login` with the phone number and password the admin gave them | Submit KYC for their own customers, re-upload rejected ones, book slots and record each step. They only ever see their own customers |
| **Individual customer** | No login: `/kyc` | Submit their own KYC, then check status at `/status` with their reference ID and mobile number |

The home page (`/`) plays a short opening animation, then offers three choices: **Agent login**, **Admin** and **Individual**.

---

## How a customer moves through the system

```
Submitted ─▶ Pending ─▶ Approved ─▶ Slot booking ─▶ Scanner ─▶ OTP ─▶ Active KYC ─▶ Completed (unpaid) ─▶ Completed
               │                                     │          │
               ▼                                     ▼          ▼
           Rejected ◀───────────────── re-upload    fail:      fail:
       (re-upload → Pending)                        new slot   application rejected
```

| Step | Who acts | What happens |
|---|---|---|
| **Pending** | Admin | Opens the entry, checks the Aadhaar PDF against the name and mobile, then **Approve** or **Reject** (with a reason the agent or customer sees) |
| **Slot booking** | Agent (or admin) | Picks the date and start time agreed with the customer. Each slot is 20 minutes. One agent can't book two overlapping slots; different agents can use the same time. Can be rescheduled until the scanner is done |
| **Scanner** | Agent (or admin) | **Scanner done** moves to OTP. **Scanner failed** goes back to Slot booking for a new slot |
| **OTP** | Agent (or admin) | **OTP done** moves to Active KYC. **OTP failed** rejects the application; the Aadhaar must be re-uploaded and approved again |
| **Active KYC** | Agent (or admin) | **Active KYC done** moves to Completed (unpaid) |
| **Completed (unpaid)** | Admin only | **Mark as paid**, from the review page or straight from the submissions list |
| **Completed** | – | Finished. The admin can now delete the customer's data |

Agents can undo their own last "done" click within 10 minutes. Anything else is corrected by the admin under **Fix the step manually** on the review page. Every change is recorded in the entry's **History**.

---

## Features

**Admin**
- Submissions list with tabs for every status and step, search by name, mobile or reference ID, and a filter by agent or individual customers
- Review page with the Aadhaar PDF (opened through a link that expires after 10 minutes), step tracker, actions and full history
- **+ Add agent** in the top bar, which then shows a ready-to-send message with the agent's sign-in details and a **Copy message** button; the Agents page shows each agent's count per step, plus reset password, turn off/on and delete (only for agents with no entries)
- **Delete permanently** removes both the record and the PDF from storage

**Agents**
- Dashboard with their customers, status/step tabs, upcoming slots and how many customers still need a slot
- New customer form with upload progress, and a **Next customer** button for back-to-back entries
- Each entry shows a step tracker with the right buttons for the current step

**Everyone**
- Works on phones, tablets and desktops
- Page animations; all motion turns off automatically for people who have "Reduce motion" enabled

---

## Security

- **Server-only data access:** the database and file storage are only ever reached from the server using the Supabase secret key. Row Level Security is on with no policies, so the public key can't read or write anything.
- **Private PDFs:** Aadhaar PDFs live in a private bucket and are only viewable through short-lived signed links.
- **Hashed passwords:** admin and agent passwords are stored only as scrypt hashes.
- **Sessions:** sessions are signed, httpOnly cookies. The admin is signed out after 8 hours, agents after 12. Resetting an agent's password or turning them off signs them out everywhere.
- **Rate limits:** sign-in attempts, submissions and status lookups are limited per network.
- **Server-side rules:** every rule (agents only touch their own entries, one step at a time, only the admin marks paid, one KYC per mobile number) is enforced on the server, not just hidden in the UI.
- **Upload checks:** files must be real PDFs, checked by their contents, and at most 4 MB.

---

## Project structure

```
src/
  app/
    page.tsx              Home: three-way chooser (+ opening animation)
    kyc/                  Individual customer form
    status/               Customer status lookup and re-upload
    admin/                Admin: submissions, review page [id], agents, login, server actions
    agent/                Agent: dashboard, new KYC, entry page [id], login, server actions
    api/kyc/…             Upload and status endpoints for individuals
    api/agent/kyc/…       Upload endpoints for agents
  components/             UI (forms, step tracker, step actions, dialogs, icons)
  lib/
    stages.ts             Step names, order and labels
    stage-ops.ts          All step rules (slot booking, done/fail, paid, undo, admin fix)
    kyc-submit.ts         Shared submit / re-upload logic
    auth.ts, session.ts   Admin and agent sessions
    supabase.ts, env.ts   Database client and environment variables
  proxy.ts                Redirects signed-out visitors away from /admin and /agent
supabase/                 SQL to set up the database (run in order, see below)
scripts/hash-password.mjs Creates the admin password hash
```

---

## Setup from scratch

### 1. Install
Requires Node.js 20.9 or newer.
```bash
npm install
```

### 2. Supabase
1. Create a project at [supabase.com](https://supabase.com), choosing the **South Asia (Mumbai)** region.
2. In **SQL Editor**, run these files **in this order**, one at a time:
   1. `supabase/schema.sql` creates the submissions table, rate limiting and the private `kyc-documents` bucket
   2. `supabase/agents.sql` creates agents and links submissions to them
   3. `supabase/steps.sql` adds step tracking and history
   4. `supabase/steps-v2.sql` sets up the current step flow and slot booking

   Each should say "Success. No rows returned." All four are safe to re-run.
3. In **Project Settings → API Keys**, copy the **Project URL** and a **secret key** (`sb_secret_…`).

### 3. Environment variables
Create `.env.local` in the project root:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxx
ADMIN_PHONE=10-digit admin phone number
ADMIN_PASSWORD_HASH=scrypt:…        # from: npm run hash-password
SESSION_SECRET=64 random hex chars  # from the command below

# Optional
ADMIN_NAME=Viral                    # shown as "Hello Viral" after admin sign-in
NEXT_PUBLIC_BUSINESS_NAME=…         # replaces "Customer KYC" in the top bar and splash
```

Generate the two secrets:
```bash
npm run hash-password      # type the admin password; paste the scrypt:… value
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET
```

`.env.local` is ignored by git. **Never commit it or share the secret key.**

### 4. Run
```bash
npm run dev      # http://localhost:3000
npm run build    # production build; must pass before deploying
```

---

## Deploying to Vercel

1. Push the project to a **private** GitHub repository.
2. On [vercel.com](https://vercel.com), choose **Add New → Project** and import the repo. The framework is detected as Next.js.
3. Under **Environment Variables**, paste the contents of `.env.local`; Vercel splits it into separate variables. Check all five required ones are there.
4. Click **Deploy**.
5. Go to **Settings → Functions → Function Region**, choose **Mumbai (bom1)**, then **Redeploy**, so the server sits next to the database.

After that, every `git push` to `main` deploys automatically.

---

## Day-to-day operations

| Task | How |
|---|---|
| Add an agent | Admin → **+ Add agent** → name, phone and password → **Copy message** and paste it to the agent on WhatsApp or SMS. The password stays the same until the admin changes it; agents can't change it |
| Agent forgot their password | Admin → Agents → **Reset password** → **Copy message** and send it to them |
| Agent leaves | Admin → Agents → **Turn off**. History is kept; delete only works for agents with no entries |
| Remove customer data | Open the entry → **Delete permanently**. This removes the record and the PDF. Don't delete rows directly in Supabase, which would leave the PDF behind |
| Change the admin password | `npm run hash-password` → update `ADMIN_PASSWORD_HASH` in Vercel → **Redeploy** |
| Change the admin phone | Update `ADMIN_PHONE` in Vercel → **Redeploy** |

---

## Limits and things to know

- **PDF size:** maximum 4 MB per upload (Vercel's free plan caps requests at 4.5 MB). e-Aadhaar files are usually 100–500 KB.
- **Storage:** Supabase's free plan includes 1 GB, roughly 2,000 or more Aadhaar PDFs. Only the latest PDF per customer is kept.
- **Pausing:** free Supabase projects **pause after 7 days without activity**. If the site stops loading after a quiet week, open the Supabase dashboard and click **Restore**.
- **Password-protected e-Aadhaar:** the password is the first 4 letters of the name in capitals plus the year of birth.
- **Times:** all times are shown in Indian Standard Time.
- **Commercial use:** Vercel's Hobby plan is for non-commercial use. For long-term commercial use, consider Vercel Pro or another host.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Couldn't load submissions" | A SQL file hasn't been run. Run the `supabase/*.sql` files in order. The terminal running `npm run dev`, or Vercel → Logs, shows the exact database error |
| "Missing environment variable …" | Add it to `.env.local` locally or in Vercel → Settings → Environment Variables, then restart or redeploy |
| Build fails after updating files | Old files left behind. Replace the whole `src` folder rather than copying over it, then `rm -rf .next` and build again |
| `EACCES: permission denied` in `.next` | `sudo chown -R $(whoami) . && rm -rf .next` |
| Site down after a quiet week | The Supabase project paused; click **Restore** in the dashboard |
| Can't sign in as admin | Check `ADMIN_PHONE` (10 digits, no +91) and that `ADMIN_PASSWORD_HASH` was made from the password you're typing. After 5 wrong tries, wait 15 minutes |
