# Academic Project Management & Collaboration Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/Built%20With-NestJS-red)](https://nestjs.com/)

A robust, multi-tenant SaaS backend designed to streamline academic project management, facilitate student-supervisor collaboration, and automate administrative workflows within educational institutions.

---

## 🚀 Key Features

*   **🏢 Multi-Tenancy**: Built-in support for multiple institutions with data isolation and tenant-specific configurations.
*   **🔐 Advanced Auth & RBAC**: Secure authentication using JWT and fine-grained Role-Based Access Control (Admin, Supervisor, Student).
*   **📂 Project Lifecycle**: End-to-end management of academic projects, from proposal submission to final evaluation.
*   **💬 Real-Time Communication**: Integrated messaging system for seamless interaction between team members and supervisors.
*   **📊 Analytics & Insights**: Comprehensive dashboards for administrators to monitor project progress and platform usage.
*   **📅 Milestone Tracking**: Structured timeline management with deadline notifications and progress indicators.
*   **📝 Evaluation System**: Configurable grading rubrics and evaluation criteria for academic assessments.
*   **🔔 Smart Notifications**: Real-time alerts for deadlines, new messages, and status updates via email and in-app channels.
*   **💳 Subscription Management**: Tenant subscription handling handling integrated with billing providers.
*   **⚡ High Performance**: Utilizing Redis for caching and Bull queues for background job processing.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | [NestJS](https://nestjs.com/) (Node.js) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/) |
| **Caching & Queues** | [Redis](https://redis.io/) / [Bull](https://github.com/OptimalBits/bull) |
| **Authentication** | [Passport](http://www.passportjs.org/) & JWT |
| **Real-time** | [Socket.IO](https://socket.io/) (via NestJS Gateways) |
| **Security** | Helmet, CORS, Rate Limiting |
| **Testing** | Jest, Supertest |

---

## 📂 Project Structure

The project follows a modular architecture to ensure scalability and maintainability.

```bash
src/
├── common/             # Shared utilities globally used
│   ├── constants/      # Global constants (e.g., Roles)
│   ├── decorators/     # Custom decorators (e.g., @Public, @GetUser)
│   ├── exceptions/     # Custom exception filters
│   ├── guards/         # Authentication & Authorization guards
│   ├── interceptors/   # Response interceptors
│   └── pipes/          # Validation pipes
├── config/             # Environment configuration (App, Auth, DB, etc.)
├── core/               # Core infrastructure services
│   ├── cache/          # Redis/Cache services
│   ├── database/       # Database connection modules
│   ├── health/         # Health check endpoints
│   ├── logger/         # Custom logging service
│   └── queue/          # Background job processing queues
├── modules/            # Feature-specific business logic
│   ├── admin/          # Administration utilities
│   ├── analytics/      # Data analytics & reporting
│   ├── auth/           # Authentication methods
│   ├── communication/  # Messaging & Chat
│   ├── department/     # Department management
│   ├── evaluation/     # Grading & Assessment logic
│   ├── milestone/      # Project milestones & tracking
│   ├── notification/   # Notification dispatchers
│   ├── project/        # Project CRUD & workflows
│   ├── subscription/   # SaaS subscription management
│   ├── tenant/         # Tenant resolution & isolation
│   └── user/           # User profile & management
├── prisma/             # Database schema, migrations, and seeds
├── app.module.ts       # Root module
└── main.ts             # Application entry point
```

---

## 🏁 Getting Started

### Prerequisites

Ensure you have the following installed:

*   **Node.js** (v18 or higher)
*   **pnpm** (preferred) or **npm**
*   **PostgreSQL** (v14+)
*   **Redis** (for caching & queues)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/kubsamelkamu/academic-project-platform-backend.git
    cd academic-project-platform-backend
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Environment Configuration**
    Copy the example environment file and configure it:
    ```bash
    cp .env.example .env
    ```
    *Update the `.env` file with your database credentials, Redis url, and JWT secrets.*

### Database Setup

Initialize the database using the provided scripts:

```bash
# Generate Prisma Client
pnpm prisma:generate

# Run Migrations
pnpm prisma:migrate

# Seed the database with initial data
pnpm db:seed
```

### Running the Application

| Environment | Command | Description |
| :--- | :--- | :--- |
| **Development** | `pnpm start:dev` | Starts the app in watch mode |
| **Debug** | `pnpm start:debug` | Starts with debug flags attached |
| **Production** | `pnpm start:prod` | Runs the compiled application |

The API will be available at `http://localhost:3000/api/v1` (depending on config).

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm build` | Compiles the application to the `dist` folder |
| `pnpm format` | Formats code using Prettier |
| `pnpm lint` | Lints code using ESLint |
| `pnpm test` | Runs unit tests |
| `pnpm test:e2e` | Runs end-to-end tests |
| `pnpm db:setup` | Complete database setup (migrate + seed) |
| `pnpm db:reset` | Resets the database (CAUTION: deletes data) |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Paddle
PADDLE_VENDOR_ID="your-vendor-id"
PADDLE_API_KEY="your-api-key"
PADDLE_PUBLIC_KEY="your-public-key"

# Application
PORT=3000
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:4200"
```

### Running the Application

```bash
# Development mode with hot reload
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod

# Debug mode
pnpm run start:debug
```

### Useful Scripts

```bash
# Prisma Studio (database GUI)
pnpm run prisma:studio

# Generate new migration
pnpm run prisma:migrate

# Format code
pnpm run format

# Run linter
pnpm run lint

# Run tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run e2e tests
pnpm run test:e2e
```

## API Documentation

Once running, access the API at:

- **Base URL:** `http://localhost:3000/api/v1`
- **Swagger Docs:** `http://localhost:3000/api/docs` (if configured)

## Key Architecture Decisions

- **Modular Design:** Feature-based modules for scalability and maintainability
- **RBAC over Role Modules:** Single users module with role guards instead of separate student/supervisor modules
- **Multi-Tenancy:** Tenant middleware ensures data isolation at the request level
- **Queue-Based Processing:** Background jobs for emails, notifications, and scheduled tasks
- **WebSocket Integration:** Real-time updates with Socket.IO for collaborative features

## Security Features

- JWT-based authentication with refresh tokens
- Helmet.js for HTTP security headers
- Rate limiting on sensitive endpoints
- Request validation with class-validator
- Tenant isolation middleware
- CORS configuration for allowed origins

## Development Guidelines

- Follow NestJS best practices and conventions
- Use DTOs for all request/response validation
- Implement guards for authorization checks
- Write descriptive commit messages
- Add JSDoc comments for complex business logic
- Use Prisma migrations for database schema changes

## Contributing

This is an academic project developed as part of a Bachelor of Science in Software Engineering program.

Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Security

For security-related issues, please see our [Security Policy](SECURITY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

College of Computing and Informatics - Department of Software Engineering

---

For detailed software requirements and specifications, refer to the SRS document in the repository.
