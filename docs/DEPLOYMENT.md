# Deployment Guide

This guide covers deploying the Scheduler Monitoring System to production.

## Pre-deployment Checklist

- [ ] AWS Account with appropriate permissions
- [ ] DynamoDB tables created
- [ ] Slack Bot token obtained
- [ ] API keys generated for each service
- [ ] Environment variables configured
- [ ] Docker image built and pushed to registry
- [ ] Monitoring/alerting configured

## AWS Infrastructure Setup

### 1. DynamoDB Tables

Create the required DynamoDB tables:

```bash
# Schedulers table
aws dynamodb create-table \
    --table-name schedulers-prod \
    --attribute-definitions \
        AttributeName=scheduler_id,AttributeType=S \
    --key-schema \
        AttributeName=scheduler_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-1

# Status History table
aws dynamodb create-table \
    --table-name scheduler-status-history-prod \
    --attribute-definitions \
        AttributeName=scheduler_id,AttributeType=S \
        AttributeName=timestamp,AttributeType=S \
    --key-schema \
        AttributeName=scheduler_id,KeyType=HASH \
        AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-1
```

### 2. IAM Role

Create an IAM role for the application with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/schedulers-prod",
        "arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/scheduler-status-history-prod"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:ChangeMessageVisibility"
      ],
      "Resource": "arn:aws:sqs:ap-southeast-1:ACCOUNT_ID:scheduler-monitoring-queue"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### 3. SQS Queue (Optional - Phase 2)

```bash
aws sqs create-queue \
    --queue-name scheduler-monitoring-queue \
    --attributes VisibilityTimeout=300,MessageRetentionPeriod=86400 \
    --region ap-southeast-1
```

## Deployment Options

### Option 1: AWS ECS (Recommended)

#### Step 1: Build and Push Docker Image

```bash
# Authenticate with ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com

# Create ECR repository
aws ecr create-repository \
    --repository-name scheduler-monitoring-system \
    --region ap-southeast-1

# Build image
docker build -t scheduler-monitoring-system:latest .

# Tag image
docker tag scheduler-monitoring-system:latest \
  ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/scheduler-monitoring-system:latest

# Push image
docker push ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/scheduler-monitoring-system:latest
```

#### Step 2: Create ECS Task Definition

Create `task-definition.json`:

```json
{
  "family": "scheduler-monitoring-system",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/scheduler-monitoring-task-role",
  "containerDefinitions": [
    {
      "name": "scheduler-monitoring",
      "image": "ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/scheduler-monitoring-system:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "APP_VERSION",
          "value": "1.0.1"
        },
        {
          "name": "AWS_REGION",
          "value": "ap-southeast-1"
        },
        {
          "name": "DYNAMODB_TABLE_SCHEDULERS",
          "value": "schedulers-prod"
        },
        {
          "name": "DYNAMODB_TABLE_STATUS_HISTORY",
          "value": "scheduler-status-history-prod"
        }
      ],
      "secrets": [
        {
          "name": "SLACK_BOT_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:ACCOUNT_ID:secret:slack-bot-token"
        },
        {
          "name": "API_KEYS",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:ACCOUNT_ID:secret:api-keys"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/scheduler-monitoring-system",
          "awslogs-region": "ap-southeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Register task definition:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

#### Step 3: Create ECS Service

```bash
aws ecs create-service \
    --cluster production-cluster \
    --service-name scheduler-monitoring-system \
    --task-definition scheduler-monitoring-system \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
    --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:ap-southeast-1:ACCOUNT_ID:targetgroup/scheduler-monitoring/xxx,containerName=scheduler-monitoring,containerPort=3000"
```

### Option 2: Kubernetes

#### Step 1: Create ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: scheduler-monitoring-config
  namespace: production
data:
  NODE_ENV: "production"
  PORT: "3000"
  APP_VERSION: "1.0.1"
  AWS_REGION: "ap-southeast-1"
  DYNAMODB_TABLE_SCHEDULERS: "schedulers-prod"
  DYNAMODB_TABLE_STATUS_HISTORY: "scheduler-status-history-prod"
  SLACK_CHANNEL_ID: "C1234567890"
  SLACK_ENABLED: "true"
  HEARTBEAT_TIMEOUT_MINUTES: "10"
```

#### Step 2: Create Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: scheduler-monitoring-secrets
  namespace: production
type: Opaque
stringData:
  SLACK_BOT_TOKEN: "xoxb-your-token"
  API_KEYS: "key1,key2,key3"
```

#### Step 3: Create Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scheduler-monitoring
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: scheduler-monitoring
  template:
    metadata:
      labels:
        app: scheduler-monitoring
    spec:
      serviceAccountName: scheduler-monitoring-sa
      containers:
      - name: scheduler-monitoring
        image: ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/scheduler-monitoring-system:latest
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: scheduler-monitoring-config
        - secretRef:
            name: scheduler-monitoring-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

#### Step 4: Create Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: scheduler-monitoring
  namespace: production
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  selector:
    app: scheduler-monitoring
```

#### Step 5: Deploy

```bash
kubectl apply -f k8s/
```

## Post-Deployment

### 1. Verify Deployment

```bash
# Check service health
curl https://monitoring.example.com/health

# Check API documentation
curl https://monitoring.example.com/api/docs
```

### 2. Set Up Monitoring

Configure CloudWatch alarms for:
- Container health
- API response time
- Error rate
- DynamoDB throttling

### 3. Test Integration

```bash
# Test with a sample scheduler
curl -X POST https://monitoring.example.com/api/v1/schedulers/register \
  -H "x-api-key: test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduler_id": "test-scheduler",
    "service_name": "Test Service",
    "job_name": "Test Job"
  }'
```

### 4. Configure Auto-scaling

For ECS:
```bash
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id service/production-cluster/scheduler-monitoring-system \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 10
```

For Kubernetes:
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: scheduler-monitoring-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: scheduler-monitoring
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Rollback Plan

If deployment issues occur:

### ECS:
```bash
# Rollback to previous task definition
aws ecs update-service \
    --cluster production-cluster \
    --service scheduler-monitoring-system \
    --task-definition scheduler-monitoring-system:PREVIOUS_REVISION
```

### Kubernetes:
```bash
# Rollback deployment
kubectl rollout undo deployment/scheduler-monitoring -n production

# Check rollout status
kubectl rollout status deployment/scheduler-monitoring -n production
```

## Backup & Recovery

### Backup DynamoDB Tables

Enable point-in-time recovery:
```bash
aws dynamodb update-continuous-backups \
    --table-name schedulers-prod \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### Create On-Demand Backup
```bash
aws dynamodb create-backup \
    --table-name schedulers-prod \
    --backup-name schedulers-prod-backup-$(date +%Y%m%d)
```

## Maintenance

### Update Application

1. Build new image with new tag
2. Update task definition/deployment with new image
3. Deploy and monitor
4. Verify health and functionality

### Database Maintenance

```bash
# Clean up old history (manually if needed)
# This is handled by the application's scheduled job
```

## Troubleshooting

### Check Logs

ECS:
```bash
aws logs tail /ecs/scheduler-monitoring-system --follow
```

Kubernetes:
```bash
kubectl logs -f deployment/scheduler-monitoring -n production
```

### Common Issues

1. **Connection to DynamoDB fails**: Check IAM role permissions
2. **Slack notifications not working**: Verify bot token and channel ID
3. **High response times**: Check DynamoDB provisioned capacity
4. **Memory issues**: Increase container memory allocation

## Support

For deployment issues, contact the DevOps team.