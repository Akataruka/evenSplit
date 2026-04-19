# Evensplit

Evensplit is a personal, small-scale trip expense splitter built with Next.js App Router.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn-style UI components
- Prisma ORM + PostgreSQL (Neon-friendly)
- NextAuth credentials login

## Features

- Credentials login (`userid` + `password`)
- Trip CRUD
- Participant management
- Expense CRUD
- Split modes: even, exact amount, percentage
- Overview with paid/share/net balances
- Minimal-transfer settlement suggestions
- Finalize settlements
- Public read-only per-user bills at `/bills/[token]`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env values:

```bash
cp .env.example .env
```

3. Set a real PostgreSQL connection string in `DATABASE_URL`.

4. Run migrations and generate Prisma client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

5. Seed a login user:

```bash
npm run db:seed
```

6. Start dev server:

```bash
npm run dev
```

## Deploy on Vercel

- Add the same environment variables in Vercel project settings.
- Use a Neon PostgreSQL instance for `DATABASE_URL`.
- Run Prisma migrations as part of your deployment workflow.
