# Puro Banking

This is the small banking app for the Puro.earth take-home.

You can sign in, see your balance, deposit, withdraw and transfer. The API only lets you touch your own account. Money is integer pence. A transfer runs in one PostgreSQL transaction.

I kept it small. Getting the money right, and making sure you cannot move someone else's, mattered more to me than building a whole bank.

## Architecture

```mermaid
flowchart TB
  SPA["React SPA · Vite :5173"]
  API["Express + TypeScript · :8081"]
  SVC["Accounts / transfers"]
  PG["PostgreSQL · Drizzle"]

  SPA -->|"cookie session + REST /api"| API
  API -->|"Zod, roles, session user"| SVC
  SVC -->|"one transaction, FOR UPDATE"| PG
```

The browser talks to Express with a signed cookie. Express does not take a source account id from the client. It loads the account from the logged-in user, then the services talk to Postgres. In-bank transfers lock both rows in id order so two people cannot deadlock. If it is outbound I only lock your account.

I split `frontend/` and `backend/` because they are two processes anyway. Express because that is the HTTP stack. TanStack Query for server state. I did not use Redux.

I used Drizzle because I wanted TypeScript types without losing the SQL. A transfer has to lock rows (`FOR UPDATE`) and either fully commit or fully roll back. I wanted to read that query in the file, not guess what an ORM was doing. Prisma is fine for normal CRUD.

---

## Prerequisites

- Node.js **20+**
- PostgreSQL **16+** running locally

## Installation

```bash
git clone <repo-url>
cd puro.earth

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## Environment variables

Copy the sample files to `.env` in the same folders.

[`backend/.env.example`](backend/.env.example):

```
DATABASE_URL=postgresql://puro:puro@localhost:5432/puro_banking
PORT=8081
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=dev-session-secret-change-in-production
```

[`frontend/.env.example`](frontend/.env.example):

```
# Leave empty to use the /api proxy in npm run dev.
VITE_API_URL=http://localhost:8081
```

| Variable         | File            | Purpose                                             |
| ---------------- | --------------- | --------------------------------------------------- |
| `DATABASE_URL`   | `backend/.env`  | Postgres. Default port is **5432**.                 |
| `PORT`           | `backend/.env`  | API. Default `8081`.                                |
| `FRONTEND_URL`   | `backend/.env`  | CORS. Has to match Vite: `http://localhost:5173`.   |
| `SESSION_SECRET` | `backend/.env`  | Signs the session cookie.                           |
| `VITE_API_URL`   | `frontend/.env` | Leave empty in dev. Vite proxies `/api` to `:8081`. |

## Database and seed data

Create a database `puro_banking`, user `puro`, password `puro`, on port **5432**.

```bash
cd backend
npm run db:setup
```

That runs migrations and puts in the demo users.

Password for every demo user is **`demo-pass`**.

| Role     | Name        | Email                     | In-bank payee                       |
| -------- | ----------- | ------------------------- | ----------------------------------- |
| Admin    | Puro Admin  | admin@puro.earth.task.com | Cannot move money                   |
| Customer | Yash Kapure | yash@puro.earth.task.com  | `04-00-11` / `20481233` · £4,280.50 |
| Customer | Alex Morgan | alex@puro.earth.task.com  | `04-00-11` / `31975512` · £1,750.00 |

To pay Alex in-bank use `04-00-11` / `31975512`. Outbound example: `11-11-11` / `11111111` (takes money off Yash, nothing is credited on our side). Demo PIN is `1234`.

## Running

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Log in with `yash@puro.earth.task.com` / `demo-pass`.

## Tests

```bash
cd backend && npm test
cd frontend && npm test
```

Backend tests need Postgres running and migrated. They wipe the database every time. After you run them, do `cd backend && npm run db:seed` before you click around in the UI, or the demo users will be gone.

On the frontend I only kept two test files. Money parsing (`"10.50"` should be `1050`) and the money dialog (sort code, PIN, a decline should not look like success).

---

## Notes (read this before we meet)

The brief was a small app, about six hours, mock auth is fine, not production, not a polished UI. I put the time into money moving correctly and into the authz boundary. The stuff below is what I cut or simplified so I could finish.

### Deliberately left out

- Production auth. No CSRF, no lockout, no IdP, no password reset.
- A proper double-entry ledger. Balance is a column I update, plus a list of transactions.
- Idempotency keys on deposit / withdraw / transfer.
- A real Faster Payments or Bacs rail. Outbound just debits you and stores the payee details.
- PCI. I store a demo PAN so the PIN reveal works. `GET /accounts/me` only returns last-four.
- Playwright. The bugs that actually hurt are in the API and the pence parser. Those I tested.
- Extra accounts per customer, product types, PDF statements.

### Shortcuts I took

- One bank, one sterling current account per customer. That is enough to show ownership and a transfer.
- Password + cookie session (scrypt, hashed token). The brief said mock login was enough. I still wanted a login I can talk about, not a dropdown of users.
- Password is `demo-pass`. PIN is `1234`. That PIN is not 2FA. Card reveal checks it on the server. Deposit, withdraw and transfer also ask for it in the browser.
- You pay with sort code + account number, not a list of other customers. If the sort code is ours and the number does not exist, that is a typo (404), not an outbound payment.
- The processing screen stays up for a short moment so localhost does not flash past it. The POST still starts straight away. If it declines, I do not make you wait.
- Admin can create a customer, change name/email, and close the account. Close is not a SQL delete. History stays. A closed account cannot move money.

### Known limitations

Sign-in, deposit, withdraw and in-bank transfer work on the path I demo. I would not ship it like this:

- Backend tests share one database and run one after another. They wipe seed data. Re-seed before a demo.
- Cookie session, no CSRF token. Fine on my machine. Not fine on the internet.
- No `Idempotency-Key`. If you double-click transfer, it can post twice.
- The short ref on the statement is the last 8 hex of the UUID. It is not its own unique column.
- Balances come back as JS numbers. Fine for this demo. Not a real money type.

### What I would do next

This is the order I would actually do it. The first ones are the ones that blow up, not the nicest ledger.

1. **Idempotency keys** on every money POST. Double submit / retry is the first production mess. I would do this before rewriting the ledger.
2. **CSRF and login lockout.** I picked a cookie. Without CSRF that choice is half done.
3. **Rate limits** on login and on deposit / withdraw / transfer. Lockout is per account. A limit per IP (and per session) stops someone spraying passwords or firing payments in a loop.
4. **Ledger as the source of truth, balance as a projection.** Updating `accounts.balance` next to the transaction row is easy to test. It is also easy for the two to drift. I would stop writing the balance in the same go.
5. **Stop storing PAN.** Last-four, or a token. The reveal endpoint is for the demo. I would not take that into a review.
6. **Drop the demo PIN** or replace it with a real step-up. Right now it is just `1234`.
7. **One Playwright smoke:** login, transfer to Alex, check both balances. Once the API is stable that is cheap.
8. **Metrics on the money paths:** insufficient funds, lock failures, outbound vs in-bank. I want to see a failed transfer, not a prettier screen.

How I used AI is in [AI_USAGE.md](./AI_USAGE.md).
