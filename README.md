# Scheduler Monitoring System

A centralized monitoring system for tracking scheduler processes across multiple services with real-time Slack notifications.

## 🎯 Features

- **Centralized Monitoring**: Single source of truth for all scheduler processes
- **Real-time Notifications**: Hourly Slack updates during EOD window (00:00-06:00 WIB)
- **Automated Alerting**: Instant notifications for failed jobs
- **Flexible Architecture**: Easy to swap database or queue implementations
- **API Authentication**: Secure API key-based authentication
- **Comprehensive Logging**: Detailed logs for debugging and monitoring
- **Health Monitoring**: Heartbeat mechanism to detect stale schedulers
- **Historical Data**: Track status history for analytics

## 📋 Architecture

The system follows clean architecture principles with clear separation of concerns:

```
src/
├── common/                         # Shared components
│   ├── entities/                   # Domain models
│   ├── enums/                      # Enumerations
│   ├── interfaces/                 # Repository & service abstractions
│   ├── guards/                     # Authentication guards
│   ├── filters/                    # Exception filters
│   └── interceptors/               # HTTP interceptors
├── modules/                        # Feature modules
│   └── schedulers/
│       ├── dto/                    # Data transfer objects
│       ├── scheduler.controller.ts
│       ├── scheduler.service.ts
│       ├── slack-worker.service.ts
│       └── scheduler.module.ts
├── infrastructure/                 # External integrations
│   ├── database/
│   │   └── dynamodb/               # DynamoDB repositories
│   ├── queue/
│   │   └── sqs/                    # SQS queue service
│   └── notification/
│       └── slack/                  # Slack notification service
└── main.ts                         # Application entry point
```

### Key Design Decisions

1. **Repository Pattern**: All data access goes through interfaces, making it easy to switch implementations
2. **Dependency Injection**: Use of NestJS DI for loose coupling
3. **Symbol-based Tokens**: Interface injection using symbols prevents naming conflicts
4. **Worker Pattern**: Separate service for scheduled Slack updates
5. **DTO Validation**: Class-validator for request validation

## 🚀 Getting Started

### Prerequisites

- Node.js 20 LTS or higher
- Docker & Docker Compose (for local development)
- AWS Account (for production)
- Slack Bot Token

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd scheduler-monitoring-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start local DynamoDB (using Docker)**
```bash
docker-compose up -d dynamodb
```

5. **Create DynamoDB tables**
```bash
./scripts/setup-dynamodb.sh
```

6. **Run the application**
```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment | local | No |
| `PORT` | Application port | 3000 | No |
| `APP_VERSION` | Current App Version | 1.0.0 | No |
| `AWS_REGION` | AWS region | ap-southeast-1 | Yes |
| `DYNAMODB_TABLE_SCHEDULERS` | Schedulers table name | schedulers | Yes |
| `DYNAMODB_TABLE_STATUS_HISTORY` | History table name | scheduler_status_history | Yes |
| `DYNAMODB_ENDPOINT` | DynamoDB endpoint (local dev) | - | No |
| `SLACK_BOT_TOKEN` | Slack bot token | - | Yes |
| `SLACK_CHANNEL_ID` | Slack channel ID | - | Yes |
| `SLACK_ENABLED` | Enable Slack notifications | true | No |
| `API_KEYS` | Comma-separated API keys | - | Yes |
| `HEARTBEAT_TIMEOUT_MINUTES` | Heartbeat timeout threshold | 10 | No |

## 📡 API Endpoints

### Authentication
All endpoints require an API key in the `x-api-key` header.

### Endpoints

#### Register Scheduler
```http
POST /api/v1/schedulers/register
Content-Type: application/json
x-api-key: your-api-key

{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "owner_email": "owner@example.com",
  "alert_user_id": "U1234567890"
}
```

#### Update Status
```http
PUT /api/v1/schedulers/{scheduler_id}/status
Content-Type: application/json
x-api-key: your-api-key

{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "status": "running",
  "timestamp": "2024-01-15T00:30:00Z",
  "execution_time_ms": 15000,
  "error_message": null,
  "metadata": {
    "records_processed": 1000
  }
}
```

#### Send Heartbeat
```http
POST /api/v1/schedulers/{scheduler_id}/heartbeat
Content-Type: application/json
x-api-key: your-api-key

{
  "scheduler_id": "service-a-eod-process"
}
```

#### Get All Schedulers
```http
GET /api/v1/schedulers
x-api-key: your-api-key
```

#### Get Scheduler Details
```http
GET /api/v1/schedulers/{scheduler_id}
x-api-key: your-api-key
```

#### Get Status History
```http
GET /api/v1/schedulers/{scheduler_id}/history?limit=50
x-api-key: your-api-key
```

## 🔄 Slack Integration

### Notification Schedule

| Time | Action |
|------|--------|
| 00:00 | Initial status table post |
| 01:00-05:00 | Hourly update (edit message) |
| 06:00 | Final status + summary |
| On Error | Immediate alert with @mention |

### Status Visualization

```
📊 EOD Process Status - 15 Jan 2024 02:00
─────────────────────────────────────────
Service     │ Job Name      │ Status
────────────┼───────────────┼────────────
Service A   │ EOD Process   │ ✅ Complete
Service B   │ Data Sync     │ 🟡 Running
Service C   │ Reporting     │ ⬜ Pending
Service D   │ Backup        │ ❌ Failed

Legend: ⬜ Pending | 🟡 Running | ✅ Success | ❌ Failed
```

## 🏗️ Extending the System

### Adding a New Database Implementation

1. Create a new repository implementation:
```typescript
// src/infrastructure/database/mongodb/mongodb-scheduler.repository.ts
@Injectable()
export class MongoDBSchedulerRepository implements ISchedulerRepository {
  // Implement all methods from ISchedulerRepository
}
```

2. Update the module to use the new implementation:
```typescript
// src/modules/schedulers/scheduler.module.ts
{
  provide: SCHEDULER_REPOSITORY,
  useClass: MongoDBSchedulerRepository, // Changed from DynamoDBSchedulerRepository
}
```

### Adding a New Notification Channel

1. Create a new notification service:
```typescript
// src/infrastructure/notification/email/email-notification.service.ts
@Injectable()
export class EmailNotificationService implements INotificationService {
  // Implement all methods from INotificationService
}
```

2. Update the module:
```typescript
{
  provide: NOTIFICATION_SERVICE,
  useClass: EmailNotificationService,
}
```

### Adding Queue Processing (Phase 2)

1. Enable SQS in `.env`:
```
SQS_ENABLED=true
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/queue
```

2. Create a queue consumer:
```typescript
@Injectable()
export class QueueConsumerService {
  constructor(
    @Inject(QUEUE_SERVICE) private queueService: IQueueService,
    private schedulerService: SchedulerService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processMessages() {
    const messages = await this.queueService.receiveMessages(10);
    for (const message of messages) {
      await this.schedulerService.updateStatus(message.body);
      await this.queueService.deleteMessage(message.receiptHandle);
    }
  }
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Deployment

### Docker Deployment

```bash
# Build image
docker build -t scheduler-monitoring-system .

# Run container
docker run -p 3000:3000 \
  --env-file .env \
  scheduler-monitoring-system
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests.

### AWS ECS Deployment

1. Push Docker image to ECR
2. Create ECS task definition
3. Configure environment variables
4. Deploy service with desired count

## 🔍 Monitoring & Logging

The application uses structured logging with different log levels:
- `error`: Critical errors
- `warn`: Warning messages
- `log`: General information
- `debug`: Detailed debugging information

Logs include:
- Request/response logging
- Performance metrics
- Error stack traces
- Business events

## 🛡️ Security Best Practices

1. **API Keys**: Rotate regularly and use different keys per service
2. **Environment Variables**: Never commit `.env` files
3. **Rate Limiting**: Configured to 100 requests/minute
4. **Input Validation**: All DTOs are validated using class-validator
5. **Error Handling**: Generic error messages to prevent information leakage

## 📈 Performance Considerations

- **DynamoDB**: Provisioned capacity should be monitored and adjusted
- **Slack API**: Rate limits apply (check Slack documentation)
- **Cron Jobs**: Configured to run only during active hours
- **API Response Time**: Target <200ms p99

## 🤝 Contributing

1. Follow TypeScript and NestJS best practices
2. Write tests for new features
3. Update documentation
4. Use conventional commits

## 📞 Support

For issues or questions, please contact the engineering team.