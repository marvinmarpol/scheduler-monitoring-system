# System Architecture

## Overview

The Scheduler Monitoring System is built using a layered architecture with clear separation of concerns, making it maintainable, testable, and extensible.

## Architecture Principles

1. **Separation of Concerns**: Clear boundaries between layers
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Interface Segregation**: Small, focused interfaces
4. **Single Responsibility**: Each class has one reason to change
5. **Open/Closed**: Open for extension, closed for modification

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ REST API Controllers (scheduler.controller.ts)        │  │
│  │ - Request validation (DTOs)                           │  │
│  │ - Response formatting                                 │  │
│  │ - Error handling                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Business Logic Services                               │  │
│  │ - SchedulerService: Core business logic               │  │
│  │ - SlackWorkerService: Scheduled tasks                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       Domain Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Domain Entities                                       │  │
│  │ - Scheduler (with business methods)                   │  │
│  │ - StatusHistory                                       │  │
│  │                                                        │  │
│  │ Domain Interfaces (Abstractions)                      │  │
│  │ - ISchedulerRepository                                │  │
│  │ - IStatusHistoryRepository                            │  │
│  │ - INotificationService                                │  │
│  │ - IQueueService                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│  ┌────────────────┬─────────────────┬───────────────────┐  │
│  │ Database       │ Notification    │ Queue             │  │
│  │ - DynamoDB     │ - Slack         │ - SQS             │  │
│  │   Repository   │   Service       │   Service         │  │
│  └────────────────┴─────────────────┴───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Presentation Layer

**Responsibilities:**
- Accept HTTP requests
- Validate input using DTOs
- Route requests to appropriate services
- Format responses
- Handle HTTP-specific concerns (status codes, headers)

**Key Components:**
- `SchedulerController`: REST API endpoints
- DTOs: Request/response validation
- Guards: Authentication (API key)
- Interceptors: Logging, transformation
- Filters: Exception handling

### 2. Application Layer

**Responsibilities:**
- Implement business use cases
- Orchestrate domain objects
- Manage transactions
- Handle application-specific logic

**Key Components:**
- `SchedulerService`: Core scheduling logic
  - Register schedulers
  - Update status
  - Manage heartbeats
  - Check for stale schedulers
- `SlackWorkerService`: Scheduled tasks
  - Send periodic status updates
  - Monitor job health
  - Cleanup old data

### 3. Domain Layer

**Responsibilities:**
- Define business entities
- Implement business rules
- Define abstractions (interfaces)
- No dependencies on external frameworks

**Key Components:**

**Entities:**
```typescript
class Scheduler {
  // Properties with business meaning
  scheduler_id: string;
  status: SchedulerStatus;
  
  // Business methods
  isStale(timeoutMinutes: number): boolean;
  markAsFailed(errorMessage: string): void;
  // ...
}
```

**Interfaces:**
```typescript
interface ISchedulerRepository {
  create(scheduler: Scheduler): Promise<Scheduler>;
  findById(id: string): Promise<Scheduler | null>;
  // ... other methods
}
```

### 4. Infrastructure Layer

**Responsibilities:**
- Implement technical details
- Interact with external systems
- Implement repository interfaces
- Handle third-party integrations

**Key Components:**
- `DynamoDBSchedulerRepository`: DynamoDB implementation
- `SlackNotificationService`: Slack API integration
- `SQSQueueService`: AWS SQS integration

## Data Flow

### Request Flow (Update Status)

```
1. Client → POST /api/v1/schedulers/{id}/status
   ↓
2. ApiKeyGuard: Validate API key
   ↓
3. ValidationPipe: Validate DTO
   ↓
4. SchedulerController: Route to service
   ↓
5. SchedulerService:
   - Validate scheduler exists
   - Update status via repository
   - Create status history
   - Send alert if failed
   ↓
6. DynamoDBSchedulerRepository: Update in DynamoDB
   ↓
7. SlackNotificationService: Send alert (if needed)
   ↓
8. Response → Client
```

### Scheduled Job Flow (Slack Updates)

```
1. Cron triggers SlackWorkerService
   ↓
2. SlackWorkerService:
   - Fetch all schedulers
   - Format status table
   ↓
3. SlackNotificationService:
   - Build Slack blocks
   - Send/update message
   ↓
4. Slack API receives notification
```

## Design Patterns

### 1. Repository Pattern

Abstracts data access logic:

```typescript
// Interface (Domain Layer)
interface ISchedulerRepository {
  findById(id: string): Promise<Scheduler | null>;
}

// Implementation (Infrastructure Layer)
class DynamoDBSchedulerRepository implements ISchedulerRepository {
  async findById(id: string): Promise<Scheduler | null> {
    // DynamoDB-specific implementation
  }
}
```

**Benefits:**
- Easy to swap databases
- Testable (can mock repository)
- Clean separation of concerns

### 2. Dependency Injection

NestJS provides powerful DI:

```typescript
// Define provider with symbol
{
  provide: SCHEDULER_REPOSITORY,
  useClass: DynamoDBSchedulerRepository,
}

// Inject using symbol
constructor(
  @Inject(SCHEDULER_REPOSITORY)
  private repository: ISchedulerRepository
) {}
```

**Benefits:**
- Loose coupling
- Easy to test (inject mocks)
- Configuration-based switching

### 3. Strategy Pattern

Multiple implementations of same interface:

```typescript
// Can easily switch between implementations
{
  provide: NOTIFICATION_SERVICE,
  useClass: SlackNotificationService, // or EmailNotificationService
}
```

### 4. CRON Pattern

Scheduled tasks using decorators:

```typescript
@Cron('0 * * * *')
async updateStatusTable() {
  // Runs every hour
}
```

## Scalability Considerations

### Horizontal Scaling

The application is **stateless** and can be scaled horizontally:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Instance   │     │   Instance   │     │   Instance   │
│      1       │     │      2       │     │      N       │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       └──────────────┬──────┴──────────────────┘
                      ↓
              ┌───────────────┐
              │ Load Balancer │
              └───────────────┘
```

**Key Points:**
- No in-memory state shared between requests
- Slack message timestamp stored in memory is OK (each instance manages its own messages)
- DynamoDB handles concurrent writes with optimistic locking if needed

### Cron Job Coordination

For scheduled tasks, only one instance should run:

**Option 1: Leader Election**
```typescript
// Use DynamoDB or Redis for distributed lock
if (await acquireLock('slack-update-lock')) {
  await sendStatusUpdate();
  await releaseLock('slack-update-lock');
}
```

**Option 2: Dedicated Worker**
- Deploy separate ECS task or Pod for scheduled jobs
- Main API instances don't run cron jobs

### Database Scaling

DynamoDB auto-scales, but consider:

1. **Global Secondary Indexes** for common queries
2. **Partition key design** to avoid hot partitions
3. **Time-series data** - consider using separate tables per time period

### Queue-based Architecture (Phase 2)

For high volume:

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│ Service │ --> │   SQS   │ --> │ Consumer │ --> │ DynamoDB │
└─────────┘     └─────────┘     └──────────┘     └──────────┘
```

**Benefits:**
- Decouples producers from consumers
- Built-in retry mechanism
- Handles traffic spikes

## Security Architecture

### Authentication

```
Client Request
     ↓
[API Key in Header]
     ↓
ApiKeyGuard validates
     ↓
Request proceeds or 401 Unauthorized
```

**Recommendations:**
1. Rotate API keys regularly
2. Use different keys per service
3. Store keys in AWS Secrets Manager
4. Implement rate limiting per key

### Authorization (Future)

For multi-tenant support:

```typescript
@UseGuards(ApiKeyGuard, RoleGuard)
@Roles('admin', 'service-owner')
async getScheduler(@Param('id') id: string) {
  // Only admins or service owners can access
}
```

### Data Protection

1. **Encryption at rest**: DynamoDB encryption
2. **Encryption in transit**: HTTPS only
3. **Sensitive data**: No PII in logs
4. **Secret management**: AWS Secrets Manager

## Monitoring & Observability

### Logging Levels

```typescript
Logger.error()  // Critical errors requiring immediate attention
Logger.warn()   // Warning conditions
Logger.log()    // General informational messages
Logger.debug()  // Detailed debugging information
```

### Metrics to Track

1. **API Metrics:**
   - Request rate
   - Response time (p50, p95, p99)
   - Error rate
   - Status codes distribution

2. **Business Metrics:**
   - Number of registered schedulers
   - Active jobs
   - Failed jobs
   - Average execution time

3. **Infrastructure Metrics:**
   - CPU/Memory usage
   - DynamoDB read/write capacity
   - Network I/O

### Distributed Tracing

For request tracing across services:

```typescript
// Add correlation ID to all log messages
Logger.log(`[${correlationId}] Processing status update`);
```

## Error Handling Strategy

### Error Hierarchy

```
Error
├── HttpException (NestJS)
│   ├── BadRequestException (400)
│   ├── UnauthorizedException (401)
│   ├── NotFoundException (404)
│   └── InternalServerErrorException (500)
└── Domain Errors
    ├── SchedulerNotFoundError
    ├── InvalidStatusTransitionError
    └── StaleSchedulerError
```

### Error Response Format

```json
{
  "statusCode": 404,
  "timestamp": "2024-01-15T01:00:00.000Z",
  "path": "/api/v1/schedulers/unknown-id",
  "method": "GET",
  "error": "Not Found",
  "message": "Scheduler unknown-id not found"
}
```

## Testing Strategy

### Unit Tests

Test business logic in isolation:

```typescript
describe('SchedulerService', () => {
  let service: SchedulerService;
  let mockRepository: jest.Mocked<ISchedulerRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      // ...
    };
    service = new SchedulerService(mockRepository, ...);
  });

  it('should update scheduler status', async () => {
    mockRepository.findById.mockResolvedValue(mockScheduler);
    await service.updateStatus(dto);
    expect(mockRepository.update).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test with real dependencies:

```typescript
describe('Scheduler API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('/schedulers (GET)', () => {
    return request(app.getHttpServer())
      .get('/schedulers')
      .set('x-api-key', 'test-key')
      .expect(200);
  });
});
```

## Future Enhancements

### Phase 2 Features

1. **Queue-based Processing**
   - Implement SQS for async processing
   - Add dead letter queue for failed messages

2. **Advanced Alerting**
   - OpsGenie integration for critical alerts
   - PagerDuty integration for on-call rotation

3. **Analytics Dashboard**
   - Historical trend analysis
   - SLA reporting
   - Failure pattern detection

4. **Self-service Portal**
   - Web UI for scheduler registration
   - Status dashboard for stakeholders
   - Real-time updates via WebSocket

### Architectural Evolution

As the system grows:

1. **Microservices Split**: Separate notification service
2. **Event Sourcing**: Track all state changes as events
3. **CQRS**: Separate read and write models
4. **GraphQL**: More flexible API for dashboard

## Conclusion

This architecture provides:
- **Flexibility**: Easy to swap implementations
- **Maintainability**: Clear separation of concerns
- **Testability**: Dependency injection enables mocking
- **Scalability**: Stateless design supports horizontal scaling
- **Extensibility**: Open for new features without modification

The system is production-ready and designed for future growth.