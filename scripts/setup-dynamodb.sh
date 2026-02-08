#!/usr/bin/env bash
set -e

AWS_REGION="ap-southeast-1"
ENDPOINT="http://localhost:8000"

export AWS_ACCESS_KEY_ID=fake
export AWS_SECRET_ACCESS_KEY=fake
export AWS_DEFAULT_REGION=$AWS_REGION

echo "Waiting for DynamoDB Local..."

until aws dynamodb list-tables \
  --endpoint-url $ENDPOINT \
  --region $AWS_REGION \
  >/dev/null 2>&1
do
  sleep 1
done

echo "DynamoDB Local is ready"

create_table_if_not_exists () {
  TABLE_NAME=$1
  CREATE_CMD=$2

  if aws dynamodb describe-table \
    --table-name "$TABLE_NAME" \
    --endpoint-url $ENDPOINT \
    --region $AWS_REGION \
    >/dev/null 2>&1
  then
    echo "Table '$TABLE_NAME' already exists"
  else
    echo "Creating table '$TABLE_NAME'..."
    eval "$CREATE_CMD"
    echo "Table '$TABLE_NAME' created"
  fi
}

create_table_if_not_exists "schedulers" "
aws dynamodb create-table \
  --table-name schedulers \
  --attribute-definitions AttributeName=scheduler_id,AttributeType=S \
  --key-schema AttributeName=scheduler_id,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --endpoint-url $ENDPOINT \
  --region $AWS_REGION
"

create_table_if_not_exists "scheduler_status_history" "
aws dynamodb create-table \
  --table-name scheduler_status_history \
  --attribute-definitions \
    AttributeName=scheduler_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=scheduler_id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --endpoint-url $ENDPOINT \
  --region $AWS_REGION
"

echo ""
echo "Tables:"
aws dynamodb list-tables \
  --endpoint-url $ENDPOINT \
  --region $AWS_REGION

echo ""
echo "DynamoDB Local setup complete"
