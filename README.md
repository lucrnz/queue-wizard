# QueueWizard API

A backend API for managing job queues built with Node.js, TypeScript, Express, Prisma, and SQLite.

## Features

- User authentication (signup/signin) with JWT tokens
- Password hashing with bcrypt
- Job queue management with custom HTTP request details
- Request validation with Zod
- SQLite database with Prisma ORM (better-sqlite3 driver)

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: SQLite via Prisma ORM with better-sqlite3 adapter
- **Authentication**: JWT (24h expiry)
- **Validation**: Zod
- **Development**: tsx for hot-reload

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Push database schema
npm run prisma:push
```

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=3000
```

### Running the Server

```bash
# Development (with hot-reload)
npm run dev

# Production
npm run build
npm run start

# Type checking
npm run typecheck
```

## API Endpoints

See [docs/ENDPOINTS.md](./docs/ENDPOINTS.md) for complete API reference.

## Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema to database

## License

[MIT License](./LICENSE)
