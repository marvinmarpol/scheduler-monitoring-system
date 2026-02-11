# Technical Solution Document - Centralized Scheduler Monitoring System

**Document Status:** DRAFT  
**Last Updated:** February 09, 2026

---

## Table of Contents

1. [Reviewers](#reviewers)
2. [Important Links](#important-links)
3. [Overview](#overview)
   - 3.1. [Background](#background)
4. [Functional Requirements](#functional-requirements)
5. [Non-Functional Requirements](#non-functional-requirements)
6. [Out of Scope (Non-Goals)](#out-of-scope-non-goals)
7. [System Design & Architecture](#system-design--architecture)
   - 7.1. [High-Level Architecture](#high-level-architecture)
   - 7.2. [Component Design](#component-design)
   - 7.3. [Integration Flow](#integration-flow)
8. [Data Model](#data-model)
   - 8.1. [Data Relation](#data-relation)
   - 8.2. [Data Structure](#data-structure)
   - 8.3. [DB Indexes / Query Proposal](#db-indexes--query-proposal)
9. [API Specification](#api-specification)
   - 9.1. [Authentication](#authentication)
   - 9.2. [Endpoints](#endpoints)
10. [Rollout](#rollout)
    - 10.1. [Rollout Strategy](#rollout-strategy)
    - 10.2. [Migration Plan](#migration-plan)
11. [Risk & Mitigation](#risk--mitigation)
12. [Notes / Facts / For Future](#notes--facts--for-future)
13. [Q & A](#q--a)
14. [Appendix](#appendix)

---

## Reviewers

| Role | Name/Team |
|------|-----------|
| **Document Owner** |  |
| **Tech Lead** |  |
| **Engineering Manager** |  |
| **Product Manager** |  |
| **QA** |  |
| **JIRA** | [link to jira epic/story]() |

---

## Important Links

| Resource | Link |
|----------|------|
| **GitHub Repository** | [scheduler-monitoring-system]() |
| **API Documentation** | [https://monitoring.example.com/api/docs]() |
| **Architecture Diagram** | [Lucidchart]() |
| **PRD Document** | [PRODENG-Centralized_Scheduler_Monitoring_System]() |
| **Deployment Guide** | [docs/DEPLOYMENT.md](./DEPLOYMENT.md) |
| **API Usage Guide** | [docs/API_USAGE.md](./API_USAGE.md) |

---

## Overview

### Background

The **Centralized Scheduler Monitoring System** is a backend service designed to provide real-time visibility and monitoring for scheduler processes running across multiple services. Currently, teams lack a unified way to track the status of critical End-of-Day (EOD) processes, leading to delayed detection of failures and manual status checking.

**Current Challenges:**
- Dozens of services with independent schedulers
- No centralized visibility into scheduler status
- Delayed detection of EOD process failures
- Manual status checking required
- No proactive alerting for stakeholders

**This system addresses these challenges by providing:**

- ✅ A single source of truth for all scheduler statuses
- ✅ Real-time Slack notifications during EOD windows (00:00-06:00 WIB)
- ✅ Automated alerting for failed or stale jobs
- ✅ Historical tracking for analytics and debugging
- ✅ RESTful API for easy service integration
- ✅ Extensible architecture for future enhancements

---

## Functional Requirements

### FR-1: Scheduler Registration

**Description:** Services must be able to register their schedulers with unique IDs, service names, and job names. Registration is idempotent and can be called multiple times without side effects.

**Acceptance Criteria:**
- Unique scheduler_id required (prevents duplicates)
- Service name and job name are descriptive
- Optional owner email and Slack alert user ID
- Returns created scheduler with default "pending" status
- Duplicate registration updates existing record

### FR-2: Status Updates

**Description:** Services must be able to update scheduler status with the following states: `pending`, `running`, `completed`, `failed`. Each update includes timestamp, execution time, error messages, and custom metadata.

**Acceptance Criteria:**
- Four distinct status states supported
- Timestamp recorded for each status change
- Execution time captured in milliseconds
- Error messages stored for failed jobs
- Custom metadata supported (JSON object)
- Status history automatically created

### FR-3: Heartbeat Mechanism

**Description:** Long-running jobs should send periodic heartbeat signals (recommended every 5 minutes) to indicate the job is still active. This prevents false timeout alerts.

**Acceptance Criteria:**
- Heartbeat endpoint available
- Updates last_heartbeat timestamp
- Does not change job status
- Recommended interval: 5 minutes
- Timeout detection uses heartbeat timestamp

### FR-4: Slack Notifications

**Description:** The system sends automated Slack notifications during the EOD window and for critical events.

**Notification Schedule:**
- **00:00 WIB** - Initial status table posted
- **01:00-05:00 WIB** - Hourly status table updates (edit existing message)
- **06:00 WIB** - Final status summary with completion metrics
- **On Error** - Immediate alert with @mention
- **On Timeout** - Warning for stale schedulers (no heartbeat)

**Acceptance Criteria:**
- Color-coded status indicators (⬜ pending, 🟡 running, ✅ completed, ❌ failed)
- Status table shows all registered schedulers
- Failed job alerts include error details and @mention owner
- Timeout warnings sent for jobs without heartbeat > 10 minutes
- All clear summary shows execution metrics

### FR-5: Status History

**Description:** All status changes are recorded in a separate history table for analytics, debugging, and compliance purposes. History can be queried by scheduler ID and date range.

**Acceptance Criteria:**
- Every status update creates history entry
- History includes full context (status, timestamp, execution time, metadata)
- Query by scheduler ID
- Query by date range
- Limit number of results returned
- Automatic cleanup after 30 days

### FR-6: Stale Job Detection

**Description:** The system automatically detects schedulers that haven't sent heartbeats within the configured timeout period (default: 10 minutes) and sends warning notifications.

**Acceptance Criteria:**
- Configurable timeout threshold (default: 10 minutes)
- Periodic check every 5 minutes
- Only checks during EOD window (00:00-06:00 WIB)
- Slack warning includes last heartbeat time
- Does not auto-fail the job (manual investigation required)

---

## Non-Functional Requirements

| Requirement | Target | Measurement Method |
|-------------|--------|-------------------|
| **Performance** | API response time < 200ms (p99) | CloudWatch metrics / Application logs |
| **Availability** | 99.9% uptime | AWS CloudWatch / Datadog |
| **Scalability** | Support 100+ schedulers without degradation | Horizontal scaling via ECS/K8s |
| **Rate Limiting** | 100 requests/minute per API key | Built-in NestJS throttler |
| **Data Retention** | Status history retained for 30 days | Automated cleanup cron job |
| **Status Update Lag** | < 5 seconds from API call to persistence | Application logging |
| **Slack Update Frequency** | Every 60 minutes during EOD window | Cron job monitoring |
| **Security** | API key authentication on all endpoints | NestJS Guards |
| **Observability** | Structured logging with correlation IDs | CloudWatch Logs / Datadog |

---

## Out of Scope (Non-Goals)

The following features are explicitly **out of scope for Phase 1**:

- ❌ Multi-tenancy / user authentication (Phase 1 uses API keys only)
- ❌ Web dashboard UI (Phase 1 uses Slack integration only)
- ❌ Real-time WebSocket updates for live dashboards
- ❌ Integration with PagerDuty, OpsGenie beyond Slack
- ❌ Custom SLA definitions and automated SLA monitoring
- ❌ Self-service scheduler registration web portal
- ❌ Advanced analytics and trend analysis dashboard
- ❌ Queue-based architecture using SQS (infrastructure ready, disabled by default)
- ❌ Automated remediation actions for failed jobs
- ❌ Custom webhook support for third-party integrations

> **Note:** The system is architected to support these future enhancements through interface abstractions and modular design. Phase 2 features can be added without significant refactoring.

---

## System Design & Architecture

### High-Level Architecture

The system follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • REST API Controllers                                │ │
│  │  • Request Validation (DTOs)                           │ │
│  │  • Authentication (API Key Guard)                      │ │
│  │  • Response Formatting                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • SchedulerService (Business Logic)                   │ │
│  │  • SlackWorkerService (Scheduled Tasks)                │ │
│  │  • Use Case Orchestration                              │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Scheduler Entity (with business methods)            │ │
│  │  • StatusHistory Entity                                │ │
│  │  • Repository Interfaces (Abstractions)                │ │
│  │  • Service Interfaces                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
│  ┌──────────────┬─────────────────┬──────────────────────┐  │
│  │  DynamoDB    │  Slack Service  │  SQS Service         │  │
│  │  Repositories│  (Notification) │  (Optional Queue)    │  │
│  └──────────────┴─────────────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Architecture Principles:**

1. **Separation of Concerns** - Each layer has distinct responsibilities
2. **Dependency Inversion** - High-level modules depend on abstractions, not implementations
3. **Interface Segregation** - Small, focused interfaces for each concern
4. **Single Responsibility** - Each class/module has one reason to change
5. **Open/Closed** - Open for extension, closed for modification

### Component Design

#### Scheduler Controller
**Responsibility:** Handle all HTTP requests and responses

- Validates input using class-validator DTOs
- Enforces authentication via API Key Guard
- Routes requests to appropriate service methods
- Formats responses and error messages
- Applies rate limiting per API key

**Key Methods:**
- `registerScheduler()` - POST /api/v1/schedulers/register
- `updateStatus()` - PUT /api/v1/schedulers/:id/status
- `sendHeartbeat()` - POST /api/v1/schedulers/:id/heartbeat
- `getAllSchedulers()` - GET /api/v1/schedulers
- `getScheduler()` - GET /api/v1/schedulers/:id
- `getSchedulerHistory()` - GET /api/v1/schedulers/:id/history

#### Scheduler Service
**Responsibility:** Core business logic for scheduler management

- Manages scheduler lifecycle (create, update, delete)
- Coordinates between repositories and notification services
- Validates business rules (e.g., scheduler must exist before update)
- Creates status history entries
- Triggers alerts for failed jobs
- Checks for stale schedulers

**Key Methods:**
- `registerScheduler(dto)` - Creates or updates scheduler
- `updateStatus(dto)` - Updates status and creates history
- `updateHeartbeat(id)` - Records heartbeat timestamp
- `checkStaleSchedulers()` - Finds and alerts on stale jobs
- `checkAllClear()` - Verifies all jobs completed successfully

#### Slack Worker Service
**Responsibility:** Scheduled task execution for Slack updates

- Runs on cron schedules during EOD window
- Sends initial status table at 00:00 WIB
- Updates status table hourly (01:00-05:00 WIB)
- Sends final summary at 06:00 WIB
- Monitors for stale schedulers every 5 minutes

**Cron Jobs:**
- `@Cron('0 0 * * *')` - Send initial status table
- `@Cron('0 1-5 * * *')` - Update status table hourly
- `@Cron('0 6 * * *')` - Send final summary
- `@Cron('*/5 * * * *')` - Check for stale schedulers

#### DynamoDB Repositories
**Responsibility:** Data persistence abstraction

**SchedulerRepository:**
- `create()` - Insert new scheduler
- `findById()` - Get by ID
- `findAll()` - Get all schedulers
- `update()` - Update scheduler fields
- `updateHeartbeat()` - Update heartbeat timestamp
- `findByStatus()` - Filter by status
- `findStaleSchedulers()` - Find jobs without recent heartbeat

**StatusHistoryRepository:**
- `create()` - Insert history entry
- `findBySchedulerId()` - Get history for scheduler
- `findByDateRange()` - Filter by date range
- `deleteOlderThan()` - Cleanup old entries

#### Slack Notification Service
**Responsibility:** Slack API integration

- Builds formatted Slack block messages
- Sends status table with color-coded indicators
- Sends failed job alerts with @mentions
- Sends timeout warnings
- Sends all-clear summary with metrics
- Handles Slack API rate limits
- Manages message timestamps for updates

**Key Methods:**
- `sendStatusTable()` - Post new status table message
- `updateStatusTable()` - Edit existing message
- `sendFailedJobAlert()` - Alert for failed jobs
- `sendTimeoutWarning()` - Alert for stale jobs
- `sendAllClearSummary()` - Final completion summary

#### SQS Queue Service (Phase 2 - Optional)
**Responsibility:** Asynchronous message processing

- Send status updates to queue
- Receive and process messages in batches
- Handle message visibility and retries
- Delete processed messages
- Enables decoupled architecture for high volume

> **Status:** Infrastructure code included but disabled by default. Can be enabled via `SQS_ENABLED=true` configuration.

### Integration Flow

**Request Flow: Update Scheduler Status**

```
1. Client sends PUT request to /api/v1/schedulers/{id}/status
   Headers: x-api-key: service-api-key
   Body: { scheduler_id, service_name, job_name, status, ... }
   
2. NestJS Request Pipeline:
   ├─ API Key Guard validates authentication
   ├─ Rate Limiting Interceptor checks request quota
   ├─ Validation Pipe validates DTO schema
   └─ Logging Interceptor records request
   
3. Scheduler Controller
   ├─ Extracts and validates parameters
   └─ Calls SchedulerService.updateStatus(dto)
   
4. Scheduler Service (Business Logic)
   ├─ Validates scheduler exists via repository
   ├─ Updates scheduler status in DynamoDB
   ├─ Creates status history entry
   ├─ If status === 'failed':
   │  └─ Calls NotificationService.sendFailedJobAlert()
   └─ Returns updated scheduler entity
   
5. Notification Service (if job failed)
   ├─ Builds Slack message blocks
   ├─ Includes error message and @mention
   └─ Sends alert via Slack Web API
   
6. Controller formats response
   └─ Returns 200 OK with updated scheduler data

7. Logging Interceptor logs response time and status
```

**Scheduled Flow: Slack Status Updates**

```
1. Cron triggers at configured time (e.g., 01:00 WIB)
   └─ SlackWorkerService.updateStatusTable()
   
2. Slack Worker Service
   ├─ Retrieves all schedulers from repository
   ├─ Formats status table with current data
   └─ Calls NotificationService.updateStatusTable()
   
3. Notification Service
   ├─ Builds Slack blocks with status emojis
   │  ⬜ Pending | 🟡 Running | ✅ Completed | ❌ Failed
   ├─ Uses existing message timestamp
   └─ Calls Slack API chat.update
   
4. Slack displays updated table in channel
```

---

## Data Model

### Data Relation

The system uses **two main tables** with a one-to-many relationship:

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   Schedulers Table      │         │  StatusHistory Table     │
├─────────────────────────┤         ├──────────────────────────┤
│ scheduler_id (PK)       │ 1    ∞  │ id (PK)                  │
│ service_name            │─────────│ scheduler_id (FK)        │
│ job_name                │         │ timestamp (Sort Key)     │
│ status                  │         │ status                   │
│ timestamp               │         │ execution_time_ms        │
│ execution_time_ms       │         │ error_message            │
│ error_message           │         │ metadata                 │
│ metadata                │         └──────────────────────────┘
│ last_heartbeat          │
│ created_at              │
│ updated_at              │
│ owner_email             │
│ alert_user_id           │
└─────────────────────────┘
```

**Relationship:** One Scheduler has many StatusHistory entries

### Data Structure

#### Schedulers Table

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `scheduler_id` | String | ✅ | Unique identifier (Primary Key) |
| `service_name` | String | ✅ | Name of the service |
| `job_name` | String | ✅ | Name of the scheduled job |
| `status` | Enum | ✅ | Current status: `pending` \| `running` \| `completed` \| `failed` |
| `timestamp` | ISO8601 | ✅ | Last status update timestamp |
| `execution_time_ms` | Number | ❌ | Job execution duration in milliseconds |
| `error_message` | String | ❌ | Error message if status is failed |
| `metadata` | Object | ❌ | Custom metadata (JSON) - e.g., records_processed |
| `last_heartbeat` | ISO8601 | ❌ | Last heartbeat timestamp |
| `created_at` | ISO8601 | ✅ | Record creation timestamp |
| `updated_at` | ISO8601 | ✅ | Record last update timestamp |
| `owner_email` | String | ❌ | Service owner email for notifications |
| `alert_user_id` | String | ❌ | Slack user ID for @mentions in alerts |

**Example Record:**
```json
{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "status": "completed",
  "timestamp": "2024-01-15T01:30:00.000Z",
  "execution_time_ms": 15000,
  "error_message": null,
  "metadata": {
    "records_processed": 1000,
    "files_generated": 5
  },
  "last_heartbeat": "2024-01-15T01:28:00.000Z",
  "created_at": "2024-01-15T00:00:00.000Z",
  "updated_at": "2024-01-15T01:30:00.000Z",
  "owner_email": "team-a@example.com",
  "alert_user_id": "U1234567890"
}
```

#### StatusHistory Table

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | UUID | ✅ | Unique identifier (Primary Key) |
| `scheduler_id` | String | ✅ | Foreign key to Schedulers table |
| `timestamp` | ISO8601 | ✅ | Event timestamp (Sort Key for queries) |
| `status` | Enum | ✅ | Status at this point in time |
| `execution_time_ms` | Number | ❌ | Execution duration snapshot |
| `error_message` | String | ❌ | Error message snapshot |
| `metadata` | Object | ❌ | Metadata snapshot at this point |

**Example Record:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "scheduler_id": "service-a-eod-process",
  "timestamp": "2024-01-15T01:30:00.000Z",
  "status": "completed",
  "execution_time_ms": 15000,
  "error_message": null,
  "metadata": {
    "records_processed": 1000
  }
}
```

### DB Indexes / Query Proposal

#### DynamoDB Table Design

**Schedulers Table:**
- **Primary Key:** `scheduler_id` (Partition Key)
- **No GSI required for Phase 1** - All queries use partition key
- **Future Optimization (Phase 2):** GSI on `status` for "find all running jobs" queries

**StatusHistory Table:**
- **Primary Key:** Composite
  - `scheduler_id` (Partition Key)
  - `timestamp` (Sort Key)
- **Benefits:**
  - Efficient queries for all history of a scheduler
  - Date range queries using sort key conditions
  - Most recent entries (sort descending)
  - Automatic chronological ordering

#### Common Query Patterns

| Query | DynamoDB Operation | Performance |
|-------|-------------------|-------------|
| Get scheduler by ID | `GetItem` on `scheduler_id` | O(1) - Direct lookup |
| Get all schedulers | `Scan` | O(n) - Acceptable for <100 items |
| Get scheduler history | `Query` on `scheduler_id` | O(log n) - Efficient |
| Get history in date range | `Query` with `timestamp BETWEEN` | O(log n) - Efficient |
| Find stale schedulers | `Scan` with `FilterExpression` | O(n) - Phase 2: add GSI |
| Find schedulers by status | `Scan` with `FilterExpression` | O(n) - Phase 2: add GSI |

**Query Examples:**

```javascript
// Get scheduler by ID
const scheduler = await dynamoDB.get({
  TableName: 'schedulers',
  Key: { scheduler_id: 'service-a-eod-process' }
}).promise();

// Get all history for a scheduler (last 50 entries)
const history = await dynamoDB.query({
  TableName: 'scheduler_status_history',
  KeyConditionExpression: 'scheduler_id = :id',
  ExpressionAttributeValues: { ':id': 'service-a-eod-process' },
  ScanIndexForward: false, // Sort descending (newest first)
  Limit: 50
}).promise();

// Get history within date range
const rangeHistory = await dynamoDB.query({
  TableName: 'scheduler_status_history',
  KeyConditionExpression: 'scheduler_id = :id AND #ts BETWEEN :start AND :end',
  ExpressionAttributeNames: { '#ts': 'timestamp' },
  ExpressionAttributeValues: {
    ':id': 'service-a-eod-process',
    ':start': '2024-01-01T00:00:00.000Z',
    ':end': '2024-01-31T23:59:59.999Z'
  }
}).promise();

// Find stale schedulers (Scan operation)
const stale = await dynamoDB.scan({
  TableName: 'schedulers',
  FilterExpression: '#status = :running AND last_heartbeat < :threshold',
  ExpressionAttributeNames: { '#status': 'status' },
  ExpressionAttributeValues: {
    ':running': 'running',
    ':threshold': new Date(Date.now() - 10*60*1000).toISOString()
  }
}).promise();
```

#### Capacity Planning

**Phase 1 Estimate (100 schedulers):**
- **Read Capacity:** ~10 RCU (on-demand)
- **Write Capacity:** ~5 WCU (on-demand)
- **Storage:** < 1 GB (with 30-day retention)

**Recommendation:** Use **On-Demand Billing** for automatic scaling and cost optimization.

---

## API Specification

### Authentication

All API endpoints require authentication using **API keys** passed in the `x-api-key` header.

**Request Headers:**
```http
x-api-key: your-service-api-key
Content-Type: application/json
```

**Authentication Error Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "timestamp": "2024-01-15T01:00:00.000Z",
  "path": "/api/v1/schedulers",
  "method": "GET",
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

**Rate Limiting (429 Too Many Requests):**
```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "ThrottlerException"
}
```
- **Limit:** 100 requests per minute per API key
- **Window:** Rolling 60-second window

### Endpoints

#### 1. Register Scheduler

**POST** `/api/v1/schedulers/register`

Register a new scheduler to be monitored by the system. This operation is **idempotent** - calling it multiple times with the same `scheduler_id` will update the existing record.

**Request Body:**
```json
{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "owner_email": "team-a@example.com",
  "alert_user_id": "U1234567890"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheduler_id` | string | ✅ | Unique identifier (max 255 chars) |
| `service_name` | string | ✅ | Service name (max 255 chars) |
| `job_name` | string | ✅ | Job name (max 255 chars) |
| `owner_email` | string | ❌ | Owner email for notifications |
| `alert_user_id` | string | ❌ | Slack user ID for @mentions |

**Success Response (201 Created):**
```json
{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "status": "pending",
  "timestamp": "2024-01-15T00:00:00.000Z",
  "created_at": "2024-01-15T00:00:00.000Z",
  "updated_at": "2024-01-15T00:00:00.000Z",
  "owner_email": "team-a@example.com",
  "alert_user_id": "U1234567890"
}
```

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": [
    "scheduler_id must be a string",
    "scheduler_id should not be empty"
  ],
  "error": "Bad Request"
}
```

---

#### 2. Update Scheduler Status

**PUT** `/api/v1/schedulers/{id}/status`

Update the status of an existing scheduler. Creates a status history entry automatically.

**Path Parameters:**
- `id` - Scheduler ID (must match `scheduler_id` in body)

**Request Body:**
```json
{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "status": "completed",
  "timestamp": "2024-01-15T01:30:00Z",
  "execution_time_ms": 15000,
  "error_message": null,
  "metadata": {
    "records_processed": 1000,
    "files_generated": 5,
    "database": "production"
  }
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheduler_id` | string | ✅ | Must match path parameter |
| `service_name` | string | ✅ | Service name |
| `job_name` | string | ✅ | Job name |
| `status` | enum | ✅ | `pending` \| `running` \| `completed` \| `failed` |
| `timestamp` | ISO8601 | ✅ | Status update timestamp |
| `execution_time_ms` | number | ❌ | Duration in milliseconds (≥ 0) |
| `error_message` | string | ❌ | Error message (required if status=failed) |
| `metadata` | object | ❌ | Custom metadata (any valid JSON) |

**Success Response (200 OK):**
```json
{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "status": "completed",
  "timestamp": "2024-01-15T01:30:00.000Z",
  "execution_time_ms": 15000,
  "metadata": {
    "records_processed": 1000,
    "files_generated": 5
  },
  "updated_at": "2024-01-15T01:30:05.000Z"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Scheduler service-a-eod-process not found. Please register first.",
  "error": "Not Found"
}
```

**Side Effects:**
- If `status === 'failed'`: Sends Slack alert with @mention
- Creates entry in StatusHistory table
- Updates `last_heartbeat` timestamp

---

#### 3. Send Heartbeat

**POST** `/api/v1/schedulers/{id}/heartbeat`

Send a keep-alive signal to indicate the scheduler is still running. Recommended for long-running jobs (send every 5 minutes).

**Path Parameters:**
- `id` - Scheduler ID

**Request Body:**
```json
{
  "scheduler_id": "service-a-eod-process"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Heartbeat recorded",
  "scheduler_id": "service-a-eod-process",
  "timestamp": "2024-01-15T01:15:00.000Z"
}
```

**Usage Example:**
```typescript
// Send heartbeat every 5 minutes during long job
const heartbeatInterval = setInterval(async () => {
  await axios.post(
    `${API_URL}/schedulers/my-scheduler/heartbeat`,
    { scheduler_id: 'my-scheduler' },
    { headers: { 'x-api-key': API_KEY } }
  );
}, 5 * 60 * 1000);

// Stop when job completes
clearInterval(heartbeatInterval);
```

---

#### 4. Get All Schedulers

**GET** `/api/v1/schedulers`

Retrieve a list of all registered schedulers with their current status.

**Success Response (200 OK):**
```json
[
  {
    "scheduler_id": "service-a-eod-process",
    "service_name": "Service A",
    "job_name": "EOD Processing",
    "status": "completed",
    "timestamp": "2024-01-15T01:30:00.000Z",
    "execution_time_ms": 15000,
    "last_heartbeat": "2024-01-15T01:28:00.000Z",
    "created_at": "2024-01-15T00:00:00.000Z",
    "updated_at": "2024-01-15T01:30:00.000Z"
  },
  {
    "scheduler_id": "service-b-data-sync",
    "service_name": "Service B",
    "job_name": "Data Sync",
    "status": "running",
    "timestamp": "2024-01-15T01:00:00.000Z",
    "last_heartbeat": "2024-01-15T01:25:00.000Z",
    "created_at": "2024-01-15T00:00:00.000Z",
    "updated_at": "2024-01-15T01:00:00.000Z"
  }
]
```

---

#### 5. Get Scheduler by ID

**GET** `/api/v1/schedulers/{id}`

Retrieve detailed information about a specific scheduler.

**Path Parameters:**
- `id` - Scheduler ID

**Success Response (200 OK):**
```json
{
  "scheduler_id": "service-a-eod-process",
  "service_name": "Service A",
  "job_name": "EOD Processing",
  "status": "completed",
  "timestamp": "2024-01-15T01:30:00.000Z",
  "execution_time_ms": 15000,
  "error_message": null,
  "metadata": {
    "records_processed": 1000
  },
  "last_heartbeat": "2024-01-15T01:28:00.000Z",
  "created_at": "2024-01-15T00:00:00.000Z",
  "updated_at": "2024-01-15T01:30:00.000Z",
  "owner_email": "team-a@example.com",
  "alert_user_id": "U1234567890"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Scheduler service-a-eod-process not found",
  "error": "Not Found"
}
```

---

#### 6. Get Scheduler History

**GET** `/api/v1/schedulers/{id}/history`

Retrieve status change history for a specific scheduler. Results are sorted by timestamp descending (newest first).

**Path Parameters:**
- `id` - Scheduler ID

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | ❌ | 50 | Maximum number of entries to return |

**Example Request:**
```http
GET /api/v1/schedulers/service-a-eod-process/history?limit=100
```

**Success Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "scheduler_id": "service-a-eod-process",
    "status": "completed",
    "timestamp": "2024-01-15T01:30:00.000Z",
    "execution_time_ms": 15000,
    "metadata": {
      "records_processed": 1000
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "scheduler_id": "service-a-eod-process",
    "status": "running",
    "timestamp": "2024-01-15T01:00:00.000Z",
    "execution_time_ms": null,
    "metadata": {}
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "scheduler_id": "service-a-eod-process",
    "status": "pending",
    "timestamp": "2024-01-15T00:00:00.000Z",
    "execution_time_ms": null,
    "metadata": {}
  }
]
```

---

## Rollout

### Rollout Strategy

**Phased rollout approach over 5 weeks:**

#### Phase 1: Infrastructure Setup (Week 1)

**Objective:** Deploy core infrastructure and verify system health

**Tasks:**
1. ✅ Create DynamoDB tables in production AWS account
   - `schedulers-prod` table
   - `scheduler-status-history-prod` table
   - Enable point-in-time recovery
2. ✅ Deploy application to ECS/Kubernetes
   - Build and push Docker image to ECR
   - Create ECS task definition
   - Deploy with 2 replicas for HA
   - Configure auto-scaling (min: 2, max: 10)
3. ✅ Configure Slack integration
   - Create Slack bot and obtain token
   - Add bot to monitoring channel
   - Test message sending
4. ✅ Set up monitoring and alerting
   - CloudWatch dashboards
   - API response time alarms
   - Error rate alarms
   - DynamoDB capacity alarms
5. ✅ Generate and distribute API keys
   - Create API keys for pilot services
   - Store in AWS Secrets Manager
   - Document key rotation process

**Success Criteria:**
- Application healthy and responding to health checks
- Slack bot can post messages
- CloudWatch metrics flowing
- API accessible from internal network

#### Phase 2: Pilot Integration (Week 2)

**Objective:** Validate system with real services and gather feedback

**Pilot Services (2-3 services):**
1. Service A - Critical EOD processing
2. Service B - Data synchronization
3. Service C - Report generation

**Tasks:**
1. ✅ Onboard pilot services
   - Provide API keys and documentation
   - Review integration code
   - Assist with testing in sandbox
2. ✅ Monitor system performance
   - Track API response times
   - Monitor DynamoDB performance
   - Watch for errors or timeouts
3. ✅ Gather feedback
   - Daily sync with pilot teams
   - Document issues and feature requests
   - Measure integration effort (developer hours)
4. ✅ Address issues
   - Fix bugs discovered during pilot
   - Improve error messages
   - Optimize slow queries
5. ✅ Refine documentation
   - Update based on common questions
   - Add troubleshooting guide
   - Create FAQ section

**Success Criteria:**
- All pilot services successfully integrated
- No critical bugs or data loss
- API response time < 200ms p99
- Positive feedback from pilot teams

#### Phase 3: Gradual Rollout (Week 3-4)

**Objective:** Onboard remaining services in controlled batches

**Rollout Batches:**
- **Week 3:** Batch 1 (5 services) + Batch 2 (5 services)
- **Week 4:** Batch 3 (10 services) + Batch 4 (remaining services)

**Tasks per Batch:**
1. ✅ Send onboarding email with:
   - API documentation link
   - Integration examples
   - API key (via Secrets Manager)
   - Support channel information
2. ✅ Schedule integration workshop (optional)
   - Live coding demonstration
   - Q&A session
   - Best practices review
3. ✅ Monitor integration progress
   - Track which services have registered
   - Check for integration issues
   - Provide proactive support
4. ✅ Verify each service
   - Test status updates
   - Verify Slack notifications
   - Check history tracking
5. ✅ Gather metrics
   - Integration completion rate
   - Time to integrate
   - Support ticket volume

**Success Criteria:**
- 80%+ of target services integrated
- No service-impacting incidents
- System maintaining SLA (99.9% uptime)
- Support load manageable by team

#### Phase 4: Full Production (Week 5+)

**Objective:** Achieve 100% integration and continuous improvement

**Ongoing Activities:**
1. 📊 **Performance Monitoring**
   - Weekly review of key metrics
   - Monthly capacity planning
   - Quarterly performance reports
2. 🐛 **Issue Management**
   - Triage and prioritize bugs
   - Track resolution time
   - Root cause analysis for incidents
3. 📚 **Documentation Updates**
   - Keep API docs current
   - Document new patterns
   - Update troubleshooting guides
4. 💡 **Feature Planning**
   - Collect enhancement requests
   - Prioritize Phase 2 features
   - Plan implementation timeline
5. 🔄 **Continuous Improvement**
   - Review usage patterns
   - Optimize based on data
   - Solicit user feedback

**Success Criteria:**
- 100% of EOD schedulers monitored
- System meeting all SLAs
- No critical backlog items
- High user satisfaction score

### Migration Plan

**No data migration required** as this is a new system. However, preparation steps are needed:

#### Pre-Migration Preparation

**Week -2 to Week 0:**

1. **Inventory Existing Schedulers**
   - Survey all teams for EOD processes
   - Document scheduler details:
     - Service name
     - Job name
     - Typical execution time
     - Owner contact
   - Create master spreadsheet

2. **Prepare Integration Materials**
   - Code templates for common frameworks:
     - Node.js/TypeScript
     - Python
     - Java/Spring Boot
   - Example implementations
   - Testing guide

3. **Communication Plan**
   - Announce project to engineering teams
   - Share timeline and expectations
   - Create Slack support channel
   - Schedule town hall Q&A

4. **Sandbox Environment**
   - Deploy to staging environment
   - Provide test API keys
   - Allow teams to experiment
   - Gather early feedback

5. **Training Materials**
   - Create video tutorials
   - Write integration guide
   - Develop troubleshooting checklist
   - Prepare workshop slides

#### Post-Migration Activities

**Week 5+:**

1. **Validation**
   - Verify all services sending updates
   - Check Slack notifications working
   - Review history data completeness

2. **Optimization**
   - Analyze query patterns
   - Optimize slow endpoints
   - Adjust DynamoDB capacity if needed

3. **Documentation**
   - Publish lessons learned
   - Update runbooks
   - Create maintenance guide

---

## Risk & Mitigation

| Risk | Impact | Probability | Mitigation Strategy | Owner |
|------|--------|-------------|-------------------|-------|
| **DynamoDB throttling during peak hours** | High | Medium | Use on-demand billing mode; implement exponential backoff; monitor capacity metrics; pre-warm if needed | Platform Team |
| **Slack API rate limits exceeded** | Medium | Medium | Implement message batching; use message updates instead of new posts; respect rate limits (1 msg/sec); cache message timestamps | Platform Team |
| **Service integration failures** | Medium | High | Comprehensive API documentation with examples; integration templates; dedicated support channel; office hours | Platform Team |
| **Monitoring service downtime** | High | Low | Deploy multi-AZ for HA; implement health checks; set up PagerDuty alerts; document incident response | DevOps Team |
| **Incorrect/duplicate status updates** | Medium | Medium | Input validation with class-validator; idempotency checks; audit logging; version API responses | Platform Team |
| **API key leakage/compromise** | High | Low | 90-day key rotation policy; store in AWS Secrets Manager; monitor for unusual patterns; revocation process | Security Team |
| **Scheduler ID naming conflicts** | Low | Medium | Enforce naming convention (service-name-job-type); validate uniqueness on registration; provide examples | Platform Team |
| **Database schema changes needed** | Low | Low | DynamoDB is schema-less; new fields can be added without migration; versioned entities | Platform Team |
| **Slack channel overwhelmed with alerts** | Medium | Low | Smart alert grouping; rate limiting on alerts; summary messages instead of individual alerts | Platform Team |
| **High API response latency** | Medium | Low | Optimize DynamoDB queries; add read replicas if needed; implement caching; monitor p99 latency | Platform Team |
| **Inadequate testing coverage** | Medium | Medium | Unit tests for business logic; integration tests for API; E2E tests for critical flows; pre-deployment validation | QA Team |
| **Insufficient documentation** | Low | Medium | Maintain living documentation; update based on feedback; peer review all docs; video tutorials | Platform Team |

**Risk Response Actions:**

| Action Item | Description | Responsible | Timeline | Status |
|-------------|-------------|-------------|----------|--------|
| **Rollback Plan** | Document step-by-step rollback procedure for failed deployment | DevOps | Week 0 | ✅ Done |
| **Security Review** | Conduct security audit of API authentication and data handling | Security | Week 0 | ✅ Done |
| **Load Testing** | Perform load test with 200 schedulers and 100 req/min | QA | Week 1 | ✅ Done |
| **Disaster Recovery** | Test backup restoration and point-in-time recovery | DevOps | Week 2 | 🟡 In Progress |
| **Runbook Creation** | Document common operational procedures and troubleshooting | Platform | Week 2 | 🟡 In Progress |
| **API Versioning Strategy** | Define approach for breaking changes and deprecation | Platform | Week 3 | ⬜ Planned |

---

## Notes / Facts / For Future

### Current Facts

**System Capabilities:**
- ✅ Designed to handle **100+ schedulers** without architectural changes
- ✅ Repository pattern allows **easy database migration** (DynamoDB → PostgreSQL/MongoDB/etc.)
- ✅ Interface abstractions enable **adding new notification channels** (Email, PagerDuty, SMS)
- ✅ **SQS integration code included** but disabled - can be enabled via configuration
- ✅ **Horizontal scaling** supported through stateless design
- ✅ **All business logic testable** through dependency injection
- ✅ **Zero vendor lock-in** - all external services are abstracted behind interfaces

**Architecture Strengths:**
- 🎯 **Clean Architecture** - Clear layer separation (Presentation → Application → Domain → Infrastructure)
- 🔌 **Pluggable Components** - Swap database/queue/notification with one line of code
- 🧪 **High Testability** - Mock all dependencies for unit testing
- 📈 **Scalability** - Stateless design enables auto-scaling
- 🛡️ **Resilience** - Graceful degradation if external services fail

**Technology Decisions:**
- 💚 **NestJS** - Enterprise-grade Node.js framework with DI and decorators
- 📦 **DynamoDB** - Fully managed, auto-scaling NoSQL database
- 💬 **Slack** - Ubiquitous team communication platform
- 🐳 **Docker** - Containerization for consistent deployments
- ☁️ **AWS** - Cloud infrastructure (ECS/Lambda/CloudWatch)

### Future Enhancements (Phase 2+)

**Dashboard & UI:**
- [ ] Web dashboard for non-technical stakeholders
- [ ] Real-time status updates via WebSockets
- [ ] Mobile-responsive design
- [ ] Export reports to PDF/Excel
- [ ] Customizable widgets and views

**Advanced Alerting:**
- [ ] Integration with **PagerDuty** for on-call rotation
- [ ] Integration with **OpsGenie** for incident management
- [ ] Custom alert rules (e.g., "alert if job takes > 30 minutes")
- [ ] Alert escalation based on severity
- [ ] Snooze/acknowledge alerts

**Analytics & Reporting:**
- [ ] **SLA monitoring** with configurable thresholds
- [ ] Trend analysis and forecasting
- [ ] Performance degradation detection
- [ ] Automated weekly/monthly reports
- [ ] Custom metrics and KPIs
- [ ] Anomaly detection using ML

**API Enhancements:**
- [ ] **GraphQL API** for flexible queries
- [ ] Webhook support for custom integrations
- [ ] Batch status updates
- [ ] Conditional updates (optimistic locking)
- [ ] Pagination for large result sets

**Architecture Evolution:**
- [ ] **Queue-based processing** using SQS (infrastructure ready)
- [ ] Multi-tenancy support for different teams
- [ ] Read replicas for reporting queries
- [ ] Event sourcing for complete audit trail
- [ ] CQRS pattern for read/write separation

**Self-Service:**
- [ ] Self-service scheduler registration portal
- [ ] API key management UI
- [ ] Documentation portal with search
- [ ] Integration code generator
- [ ] Sandbox environment access

**Automation:**
- [ ] Auto-remediation actions (restart job, send notification, etc.)
- [ ] Automatic retry for transient failures
- [ ] Scheduled maintenance windows
- [ ] Automated capacity planning

**Security & Compliance:**
- [ ] OAuth 2.0 authentication
- [ ] Role-based access control (RBAC)
- [ ] Audit logging with immutable records
- [ ] Data encryption at rest and in transit
- [ ] Compliance reporting (SOC 2, GDPR)

---

## Q & A

### Frequently Asked Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | **How do I get an API key?** | Contact the Platform Engineering team via Slack (#scheduler-monitoring) with your service name and use case. Keys are generated and stored in AWS Secrets Manager. | ✅ Answered |
| 2 | **Can I use the same API key for multiple schedulers?** | Yes, one API key per service is recommended. Each service can register multiple schedulers using the same key. Rate limiting is per key (100 req/min). | ✅ Answered |
| 3 | **What happens if my heartbeat stops?** | The system sends a timeout warning via Slack after 10 minutes (configurable). However, the job status remains unchanged - you must explicitly update to 'failed' if needed. | ✅ Answered |
| 4 | **Can I customize the Slack notification format?** | Not in Phase 1. The standard format includes status tables and alerts. Custom formats are planned for Phase 2 as a configurable option. | ✅ Answered |
| 5 | **How long is history retained?** | Status history is retained for **30 days**. An automated cleanup job removes older entries. If you need longer retention, contact the platform team. | ✅ Answered |
| 6 | **What if the monitoring service is down?** | Your services continue running normally. Status updates may be lost during downtime, but jobs are unaffected. The system has 99.9% SLA and multi-AZ deployment. | ✅ Answered |
| 7 | **Can I query historical data via API?** | Yes, use `GET /api/v1/schedulers/{id}/history` with optional `limit` parameter. Results are sorted newest first. Date range filtering planned for Phase 2. | ✅ Answered |
| 8 | **Do I need to send heartbeats for short jobs?** | No, heartbeats are optional and recommended only for jobs longer than 10 minutes. Short jobs can just send 'running' → 'completed' status updates. | ✅ Answered |
| 9 | **What happens if I register the same scheduler twice?** | Registration is idempotent. The second call updates the existing scheduler (service_name, job_name, owner_email). The status and history are preserved. | ✅ Answered |
| 10 | **Can I delete a scheduler?** | Not via API in Phase 1. Contact the platform team to remove schedulers. Soft delete functionality planned for Phase 2. | ✅ Answered |
| 11 | **Is there a sandbox environment for testing?** | Yes, a staging environment is available at `https://monitoring-staging.example.com`. Request test API keys from the platform team. | ✅ Answered |
| 12 | **What programming languages are supported?** | Any language that can make HTTP requests. We provide integration examples for **TypeScript, Python, and Java**. Community contributions welcome. | ✅ Answered |
| 13 | **How do I handle transient API failures?** | Implement retry logic with exponential backoff (e.g., retry after 1s, 2s, 4s). The API is idempotent, so retries are safe. Don't let monitoring failures stop your job. | ✅ Answered |
| 14 | **Can I see who else is using the system?** | Use `GET /api/v1/schedulers` to see all registered schedulers. Owner emails are visible only to authenticated users. Full service catalog planned for Phase 2. | ✅ Answered |

### Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | **Should we support custom Slack channels per service?** | Under discussion. Currently all notifications go to #eod-monitoring. Custom channels would increase complexity but improve targeting. | 🟡 Under Review |
| 2 | **Do we need support for scheduled jobs outside EOD window?** | Monitoring window currently hardcoded to 00:00-06:00 WIB. Support for custom windows could be added if there's demand. | 🟡 Under Review |
| 3 | **Should we auto-mark jobs as failed after X hours?** | Risky - some legitimate jobs take hours. Better to require explicit status updates and alert on staleness. | 🟡 Under Review |

---

## Appendix

### A. Technology Stack

**Core Framework:**
- **NestJS 10.x** - Enterprise Node.js framework with DI, decorators, and modularity
- **TypeScript 5.x** - Type-safe development with modern ES features
- **Node.js 18 LTS** - Runtime environment

**Data Storage:**
- **Amazon DynamoDB** - Fully managed NoSQL database with auto-scaling
- **AWS S3** (future) - Object storage for large payloads or exports

**Integration Services:**
- **Slack Web API** - Team collaboration and notifications
- **AWS SQS** (optional) - Message queue for async processing

**Infrastructure:**
- **Docker** - Container packaging
- **AWS ECS** / **Kubernetes** - Container orchestration
- **AWS CloudWatch** - Logging and monitoring
- **Datadog** (optional) - Advanced observability

**Development Tools:**
- **Swagger/OpenAPI 3.0** - API documentation
- **Jest** - Testing framework
- **ESLint + Prettier** - Code quality
- **Husky** - Git hooks for pre-commit checks

### B. Key Design Decisions

#### 1. Repository Pattern

**Decision:** Abstract all data access behind repository interfaces

**Rationale:**
- Enables switching databases (DynamoDB → PostgreSQL → MongoDB) with zero business logic changes
- Improves testability - mock repositories in unit tests
- Adheres to Dependency Inversion Principle
- Future-proofs the architecture

**Example:**
```typescript
// Interface (domain layer)
interface ISchedulerRepository {
  findById(id: string): Promise<Scheduler | null>;
}

// Implementation (infrastructure layer)
class DynamoDBSchedulerRepository implements ISchedulerRepository {
  async findById(id: string): Promise<Scheduler | null> {
    // DynamoDB-specific code
  }
}

// Usage (application layer)
constructor(
  @Inject(SCHEDULER_REPOSITORY)
  private repo: ISchedulerRepository // No knowledge of DynamoDB
) {}
```

#### 2. Symbol-based Dependency Injection

**Decision:** Use TypeScript symbols for interface injection instead of string tokens

**Rationale:**
- Type-safe injection - compile-time checking
- Prevents naming conflicts
- Enables true interface-based programming
- Better IDE autocomplete and refactoring

**Example:**
```typescript
export const SCHEDULER_REPOSITORY = Symbol('ISchedulerRepository');

// Provider
{
  provide: SCHEDULER_REPOSITORY,
  useClass: DynamoDBSchedulerRepository,
}

// Injection
@Inject(SCHEDULER_REPOSITORY)
private repository: ISchedulerRepository
```

#### 3. Domain-Driven Design

**Decision:** Place business logic in domain entities, not services

**Rationale:**
- Entities encapsulate behavior, not just data
- Easier to test business rules
- More maintainable and readable
- Follows Object-Oriented principles

**Example:**
```typescript
class Scheduler {
  // Business method in entity
  isStale(timeoutMinutes: number): boolean {
    if (!this.last_heartbeat) return false;
    const threshold = Date.now() - (timeoutMinutes * 60 * 1000);
    return this.last_heartbeat.getTime() < threshold;
  }
  
  markAsFailed(errorMessage: string): void {
    this.status = SchedulerStatus.FAILED;
    this.error_message = errorMessage;
    this.updated_at = new Date();
  }
}

// Usage in service
if (scheduler.isStale(10)) {
  await this.notificationService.sendTimeoutWarning(scheduler);
}
```

#### 4. Stateless Architecture

**Decision:** No shared state between application instances

**Rationale:**
- Enables horizontal scaling without session management
- Simplifies deployment and rollback
- No sticky sessions required at load balancer
- Cloud-native architecture

**Trade-off:** Slack message timestamps stored in memory per instance, but this is acceptable as each instance manages its own messages independently.

#### 5. DynamoDB On-Demand Billing

**Decision:** Use on-demand billing instead of provisioned capacity

**Rationale:**
- Automatic scaling for variable load patterns
- No capacity planning required
- Pay only for what you use
- Simpler operational model
- Better for unpredictable workloads

**Cost Estimate:** ~$10-20/month for 100 schedulers with typical usage patterns

### C. Glossary

| Term | Definition |
|------|------------|
| **Scheduler** | A scheduled job or process that runs periodically (e.g., nightly batch jobs) |
| **EOD** | End of Day - critical batch processes that run during off-hours (typically midnight to 6 AM) |
| **Heartbeat** | Periodic keep-alive signal sent by a running process to indicate it's still active |
| **Stale Scheduler** | A scheduler marked as 'running' but hasn't sent a heartbeat within the timeout period |
| **DynamoDB** | AWS fully managed NoSQL database service with automatic scaling |
| **Repository Pattern** | Design pattern that abstracts data access logic behind interfaces |
| **DTO** | Data Transfer Object - object used for request/response validation and serialization |
| **Guard** | NestJS middleware component for authentication, authorization, and cross-cutting concerns |
| **Cron** | Time-based job scheduler (from Unix cron) |
| **Idempotent** | Operation that produces the same result no matter how many times it's executed |
| **GSI** | Global Secondary Index in DynamoDB for querying on non-key attributes |
| **Partition Key** | Primary key component in DynamoDB that determines data distribution |
| **Sort Key** | Secondary key component in DynamoDB that enables range queries and sorting |
| **Rate Limiting** | Technique to control the rate of requests to prevent abuse or overload |
| **p99 Latency** | 99th percentile latency - 99% of requests complete within this time |
| **HA** | High Availability - system design to minimize downtime |
| **Multi-AZ** | Multi-Availability Zone deployment for fault tolerance |
| **DI** | Dependency Injection - design pattern for loose coupling |
| **SOLID** | Five principles of object-oriented design (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion) |

### D. References

**Internal Documentation:**
- [Project PRD](https://docs.google.com/document/d/PRODENG-Centralized_Scheduler_Monitoring_System)
- [Architecture Decision Records](https://github.com/yourorg/scheduler-monitoring-system/tree/main/docs/adr)
- [API Changelog](https://github.com/yourorg/scheduler-monitoring-system/blob/main/CHANGELOG.md)

**External Resources:**
- [NestJS Documentation](https://docs.nestjs.com/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Slack API Documentation](https://api.slack.com/docs)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

### E. Contact Information

**Support Channels:**
- Slack: [#scheduler-monitoring](https://yourcompany.slack.com/archives/scheduler-monitoring)
- Email: platform-engineering@example.com
- On-call: PagerDuty (Platform Engineering rotation)

**Team:**
- Platform Engineering Team
- Engineering Manager: [Name]
- Tech Lead: [Name]
- Product Manager: [Name]

---

**End of Document**

*This technical solution document is a living document and will be updated as the system evolves.*
