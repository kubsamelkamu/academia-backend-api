# GitHub Copilot Instructions for Academic Project Platform Backend

## Project Overview

This is a **NestJS-based backend API** for an academic project management and collaboration platform. It's a multi-tenant SaaS application designed to streamline academic project management, facilitate student-supervisor collaboration, and automate administrative workflows within educational institutions.

## Architecture & Tech Stack

### Core Framework
- **NestJS** with TypeScript
- **Modular architecture** with feature-based modules
- **Dependency injection** pattern throughout

### Database & ORM
- **PostgreSQL** as the primary database
- **Prisma ORM** for database operations
- Custom **PrismaService** wrapper in `src/prisma/prisma.service.ts`

### Authentication & Security
- **JWT-based authentication** with Passport
- **Role-Based Access Control (RBAC)** with predefined roles:
  - `PLATFORM_ADMIN`: Platform administrator with full system access
  - `DEPARTMENT_HEAD`: Department head with departmental oversight
  - `ADVISOR`: Academic advisor role
  - `COORDINATOR`: Program coordinator role
  - `DEPARTMENT_COMMITTEE`: Department committee member
  - `STUDENT`: Student user role
- **Multi-tenant architecture** with tenant isolation

### Key Technologies
- **Redis** for caching and session management
- **Bull queues** for background job processing
- **Cloudinary** for file upload and storage
- **Socket.IO** for real-time communication
- **Swagger/OpenAPI** for API documentation

## Project Structure

```
src/
├── common/                 # Shared utilities and cross-cutting concerns
│   ├── constants/          # Global constants (roles, etc.)
│   ├── decorators/         # Custom decorators (@Public, @Roles, @GetUser)
│   ├── dto/               # Shared DTOs (API responses)
│   ├── exceptions/        # Custom exception classes
│   ├── filters/           # Exception filters
│   ├── guards/            # Authentication & authorization guards
│   ├── interceptors/      # Response transformation interceptors
│   ├── middleware/        # Custom middleware
│   ├── pipes/             # Validation pipes
│   └── utils/             # Shared utility functions
├── config/                # Configuration modules
├── core/                  # Core services (database, email, storage, etc.)
├── modules/               # Feature-specific business logic
│   ├── admin/             # Admin-specific functionality
│   ├── auth/              # Authentication & user management
│   ├── tenant/            # Multi-tenant management
│   └── [feature]/         # Other domain modules
├── prisma/                # Database schema and migrations
└── main.ts               # Application entry point
```

## Coding Conventions

### Naming Conventions
- **Files**: kebab-case for file names (e.g., `auth.service.ts`, `user.repository.ts`)
- **Classes**: PascalCase (e.g., `AuthService`, `UserRepository`)
- **Methods**: camelCase (e.g., `findUserById()`, `validateCredentials()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `ROLES`, `JWT_SECRET`)
- **Interfaces**: PascalCase with 'I' prefix (e.g., `IUser`, `IAuthService`)

### Import Organization
```typescript
// 1. External libraries
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 2. Internal modules (relative imports)
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from './user.repository';

// 3. Types and interfaces
import { User } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
```

### Error Handling
- Use custom exception classes from `src/common/exceptions/`
- Follow HTTP status code conventions
- Provide meaningful error messages
- Use appropriate exception filters

## Database Patterns

### Repository Pattern
- Each module has its own repository class
- Repositories extend or use `PrismaService`
- Follow naming convention: `[Feature]Repository`

### Common Repository Methods
```typescript
class AuthRepository {
  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } }
    });
  }

  async updateUserAvatar(userId: string, data: { avatarUrl: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, avatarUrl: true }
    });
  }
}
```

## Authentication & Authorization

### JWT Token Structure
```typescript
interface JwtPayload {
  sub: string;        // User ID
  email: string;      // User email
  tenantId: string;   // Tenant identifier
  roles: string[];    // User roles
}
```

### Guard Usage
```typescript
// Public routes
@Public()
@Post('login')
async login(@Body() dto: LoginDto) { ... }

// Protected routes with role requirements
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN)
@Get('admin-data')
async getAdminData(@GetUser() user: any) { ... }
```

### User Context
Use `@GetUser()` decorator to access authenticated user:
```typescript
@GetUser() user: any          // Full user object
@GetUser('sub') userId: string // Specific property
```

## API Design Patterns

### Controller Structure
```typescript
@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

### DTO Patterns
```typescript
// Request DTOs
export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ required: false })
  tenantDomain?: string;
}

// Response DTOs
export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;
}
```

## File Upload Handling

### Cloudinary Integration
```typescript
// Service method
async uploadAvatar(user: any, file: Express.Multer.File) {
  const uploaded = await this.cloudinaryService.uploadAdminAvatar({
    userId: user.sub,
    buffer: file.buffer,
  });

  // Update database with secure_url and public_id
  await this.authRepository.updateUserAvatar(user.sub, {
    avatarUrl: uploaded.secureUrl,
    avatarPublicId: uploaded.publicId,
  });

  return { avatarUrl: uploaded.secureUrl };
}
```

### File Validation
```typescript
@Post('avatar')
@UseInterceptors(FileInterceptor('avatar', {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new BadRequestException('Invalid file type'), false);
    }
    cb(null, true);
  },
}))
async uploadAvatar(@UploadedFile() file: Express.Multer.File) { ... }
```

## Testing Patterns

### Unit Tests
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let mockRepository: MockType<AuthRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useFactory: jest.fn() },
      ],
    }).compile();

    service = module.get(AuthService);
    mockRepository = module.get(AuthRepository);
  });

  it('should validate user credentials', async () => {
    // Test implementation
  });
});
```

### E2E Tests
```typescript
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/login (POST) - should login user', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(200);
  });
});
```

## Common Patterns & Best Practices

### Service Layer
- Keep business logic in services
- Use repositories for data access
- Handle errors appropriately
- Return consistent response formats

### Validation
- Use class-validator decorators on DTOs
- Implement custom validators when needed
- Validate at controller level with pipes

### Logging
- Use NestJS Logger for consistent logging
- Log important business events
- Include relevant context in log messages

### Configuration
- Use `@nestjs/config` for environment variables
- Create typed configuration classes
- Validate required configuration

### Error Responses
```typescript
// Consistent error response format
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  },
  "timestamp": "2026-02-05T10:30:00.000Z",
  "path": "/api/v1/auth/login"
}
```

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run in development mode
npm run start:dev

# Run tests
npm run test

# Run linting
npm run lint

# Build for production
npm run build
```

### Database Operations
```bash
# Create and apply migrations
npm run prisma:migrate

# View database
npm run prisma:studio

# Reset database
npm run prisma:reset
```

## Key Files to Reference

- `src/main.ts` - Application bootstrap
- `src/app.module.ts` - Root module configuration
- `src/prisma/schema.prisma` - Database schema
- `src/common/constants/roles.constants.ts` - Role definitions
- `src/config/` - Configuration modules
- `.env.example` - Environment variables template

## Security Considerations

- Always validate user input
- Use parameterized queries (handled by Prisma)
- Implement proper CORS configuration
- Rate limiting on sensitive endpoints
- Secure file upload handling
- JWT token expiration and refresh
- Password hashing with bcrypt
- Input sanitization

Remember to follow these patterns and conventions to maintain code consistency and quality across the codebase!