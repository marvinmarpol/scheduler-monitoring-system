# API Usage Guide

This guide provides practical examples for integrating your services with the Scheduler Monitoring System.

## Quick Start

### 1. Get Your API Key

Contact the operations team to get your unique API key for your service.

### 2. Register Your Scheduler

Before sending status updates, register your scheduler:

```typescript
// TypeScript/Node.js example
import axios from 'axios';

const API_URL = 'https://monitoring.example.com/api/v1';
const API_KEY = 'your-service-api-key';

async function registerScheduler() {
  try {
    const response = await axios.post(
      `${API_URL}/schedulers/register`,
      {
        scheduler_id: 'my-service-eod-process',
        service_name: 'My Service',
        job_name: 'EOD Processing',
        owner_email: 'team@example.com',
        alert_user_id: 'U1234567890' // Optional Slack user ID
      },
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Scheduler registered:', response.data);
  } catch (error) {
    console.error('Registration failed:', error.response?.data);
  }
}
```

### 3. Update Status During Job Execution

```typescript
async function updateJobStatus(status: 'running' | 'completed' | 'failed', error?: string) {
  const payload = {
    scheduler_id: 'my-service-eod-process',
    service_name: 'My Service',
    job_name: 'EOD Processing',
    status: status,
    timestamp: new Date().toISOString(),
    execution_time_ms: status === 'completed' ? 15000 : undefined,
    error_message: error,
    metadata: {
      records_processed: 1000,
      environment: 'production'
    }
  };

  try {
    await axios.put(
      `${API_URL}/schedulers/my-service-eod-process/status`,
      payload,
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Status update failed:', error.response?.data);
  }
}
```

### 4. Send Heartbeats (Optional but Recommended)

For long-running jobs, send periodic heartbeats:

```typescript
async function sendHeartbeat() {
  try {
    await axios.post(
      `${API_URL}/schedulers/my-service-eod-process/heartbeat`,
      {
        scheduler_id: 'my-service-eod-process'
      },
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Heartbeat failed:', error.response?.data);
  }
}

// Send heartbeat every 5 minutes during job execution
let heartbeatInterval: NodeJS.Timeout;

function startHeartbeat() {
  heartbeatInterval = setInterval(sendHeartbeat, 5 * 60 * 1000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
}
```

## Complete Integration Example

Here's a complete example of integrating the monitoring system into your EOD process:

```typescript
import axios from 'axios';

class SchedulerMonitoringClient {
  private apiUrl: string;
  private apiKey: string;
  private schedulerId: string;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: {
    apiUrl: string;
    apiKey: string;
    schedulerId: string;
    serviceName: string;
    jobName: string;
  }) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.schedulerId = config.schedulerId;
  }

  private async request(method: string, path: string, data?: any) {
    try {
      const response = await axios({
        method,
        url: `${this.apiUrl}${path}`,
        data,
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`API request failed: ${method} ${path}`, error.response?.data);
      throw error;
    }
  }

  async register(serviceName: string, jobName: string, ownerEmail?: string) {
    return this.request('POST', '/schedulers/register', {
      scheduler_id: this.schedulerId,
      service_name: serviceName,
      job_name: jobName,
      owner_email: ownerEmail
    });
  }

  async updateStatus(
    status: 'pending' | 'running' | 'completed' | 'failed',
    serviceName: string,
    jobName: string,
    options?: {
      executionTimeMs?: number;
      errorMessage?: string;
      metadata?: Record<string, any>;
    }
  ) {
    return this.request('PUT', `/schedulers/${this.schedulerId}/status`, {
      scheduler_id: this.schedulerId,
      service_name: serviceName,
      job_name: jobName,
      status,
      timestamp: new Date().toISOString(),
      execution_time_ms: options?.executionTimeMs,
      error_message: options?.errorMessage,
      metadata: options?.metadata
    });
  }

  async sendHeartbeat() {
    return this.request('POST', `/schedulers/${this.schedulerId}/heartbeat`, {
      scheduler_id: this.schedulerId
    });
  }

  startHeartbeat(intervalMinutes: number = 5) {
    this.heartbeatInterval = setInterval(
      () => this.sendHeartbeat(),
      intervalMinutes * 60 * 1000
    );
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
}

// Usage in your EOD process
async function runEODProcess() {
  const monitor = new SchedulerMonitoringClient({
    apiUrl: 'https://monitoring.example.com/api/v1',
    apiKey: process.env.MONITORING_API_KEY!,
    schedulerId: 'my-service-eod-process',
    serviceName: 'My Service',
    jobName: 'EOD Processing'
  });

  const startTime = Date.now();

  try {
    // Register scheduler (idempotent - safe to call every time)
    await monitor.register('My Service', 'EOD Processing', 'team@example.com');

    // Mark as running
    await monitor.updateStatus('running', 'My Service', 'EOD Processing');

    // Start heartbeat
    monitor.startHeartbeat(5);

    // Your actual EOD processing logic
    console.log('Starting EOD process...');
    const result = await performEODTasks();

    // Stop heartbeat
    monitor.stopHeartbeat();

    // Mark as completed
    const executionTime = Date.now() - startTime;
    await monitor.updateStatus('completed', 'My Service', 'EOD Processing', {
      executionTimeMs: executionTime,
      metadata: {
        records_processed: result.recordsProcessed,
        files_generated: result.filesGenerated
      }
    });

    console.log('EOD process completed successfully');
  } catch (error) {
    // Stop heartbeat on error
    monitor.stopHeartbeat();

    // Mark as failed
    await monitor.updateStatus('failed', 'My Service', 'EOD Processing', {
      errorMessage: error.message,
      metadata: {
        error_type: error.constructor.name,
        stack_trace: error.stack
      }
    });

    console.error('EOD process failed:', error);
    throw error;
  }
}

async function performEODTasks() {
  // Your actual business logic here
  return {
    recordsProcessed: 1000,
    filesGenerated: 5
  };
}

// Run the process
runEODProcess().catch(console.error);
```

## Python Integration Example

```python
import requests
import time
from datetime import datetime
from typing import Optional, Dict, Any

class SchedulerMonitoringClient:
    def __init__(self, api_url: str, api_key: str, scheduler_id: str):
        self.api_url = api_url
        self.api_key = api_key
        self.scheduler_id = scheduler_id
        self.headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }

    def register(self, service_name: str, job_name: str, owner_email: Optional[str] = None):
        url = f"{self.api_url}/schedulers/register"
        payload = {
            'scheduler_id': self.scheduler_id,
            'service_name': service_name,
            'job_name': job_name,
            'owner_email': owner_email
        }
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def update_status(
        self,
        status: str,
        service_name: str,
        job_name: str,
        execution_time_ms: Optional[int] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        url = f"{self.api_url}/schedulers/{self.scheduler_id}/status"
        payload = {
            'scheduler_id': self.scheduler_id,
            'service_name': service_name,
            'job_name': job_name,
            'status': status,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'execution_time_ms': execution_time_ms,
            'error_message': error_message,
            'metadata': metadata
        }
        response = requests.put(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def send_heartbeat(self):
        url = f"{self.api_url}/schedulers/{self.scheduler_id}/heartbeat"
        payload = {'scheduler_id': self.scheduler_id}
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage
def run_eod_process():
    monitor = SchedulerMonitoringClient(
        api_url='https://monitoring.example.com/api/v1',
        api_key='your-api-key',
        scheduler_id='python-service-eod'
    )

    start_time = time.time()

    try:
        # Register
        monitor.register('Python Service', 'EOD Processing', 'team@example.com')

        # Start
        monitor.update_status('running', 'Python Service', 'EOD Processing')

        # Process (with periodic heartbeats)
        # ... your logic here ...

        # Complete
        execution_time = int((time.time() - start_time) * 1000)
        monitor.update_status(
            'completed',
            'Python Service',
            'EOD Processing',
            execution_time_ms=execution_time,
            metadata={'records_processed': 1000}
        )

    except Exception as e:
        monitor.update_status(
            'failed',
            'Python Service',
            'EOD Processing',
            error_message=str(e)
        )
        raise

if __name__ == '__main__':
    run_eod_process()
```

## Error Handling

Always implement proper error handling:

```typescript
try {
  await monitor.updateStatus('running', 'My Service', 'Job');
} catch (error) {
  if (error.response?.status === 404) {
    // Scheduler not registered, register first
    await monitor.register('My Service', 'Job');
    await monitor.updateStatus('running', 'My Service', 'Job');
  } else if (error.response?.status === 401) {
    // Invalid API key
    console.error('Authentication failed. Check your API key.');
  } else if (error.response?.status === 429) {
    // Rate limit exceeded
    console.error('Rate limit exceeded. Slow down requests.');
  } else {
    // Other errors
    console.error('Monitoring update failed:', error.message);
    // Continue with your process - don't let monitoring failure stop your job
  }
}
```

## Best Practices

1. **Register Once**: Register your scheduler when your service starts, not on every job run
2. **Update Status Early**: Send "running" status as soon as the job starts
3. **Use Heartbeats**: For jobs longer than 10 minutes, send heartbeats every 5 minutes
4. **Include Metadata**: Add useful context in metadata (records processed, file paths, etc.)
5. **Handle Errors**: Don't let monitoring failures stop your actual job
6. **Use Descriptive IDs**: Use clear, consistent scheduler IDs (e.g., `service-name-job-type`)

## Testing

Test your integration in development:

```bash
# Test registration
curl -X POST https://monitoring-dev.example.com/api/v1/schedulers/register \
  -H "x-api-key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduler_id": "test-service-eod",
    "service_name": "Test Service",
    "job_name": "Test Job"
  }'

# Test status update
curl -X PUT https://monitoring-dev.example.com/api/v1/schedulers/test-service-eod/status \
  -H "x-api-key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduler_id": "test-service-eod",
    "service_name": "Test Service",
    "job_name": "Test Job",
    "status": "completed",
    "timestamp": "2024-01-15T01:00:00Z",
    "execution_time_ms": 5000
  }'
```

## Support

For integration support, contact the platform engineering team or check the API documentation at:
`https://monitoring.example.com/api/docs`