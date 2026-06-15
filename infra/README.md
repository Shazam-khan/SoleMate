# SoleMate — Infrastructure (AWS, CloudFormation)

Infrastructure as Code for deploying SoleMate to AWS: **ECS Fargate + Lambda +
RDS + S3 + CloudFront**. See [`../docs/DESIGN.md`](../docs/DESIGN.md) for the
architecture and diagrams.

```
infra/
├── cloudformation/
│   ├── network.yml      # VPC, subnets, NAT, security groups
│   ├── database.yml     # RDS PostgreSQL + Secrets Manager
│   ├── backend.yml      # ECR, ECS cluster/service, ALB, IAM, autoscaling
│   ├── frontend.yml     # S3 + CloudFront (SPA), /api/* → ALB
│   └── lambda.yml       # stripe-webhook, image-processor, order-email
└── lambdas/             # Lambda source (zipped & uploaded by CI)
```

## Prerequisites

- AWS CLI configured with an admin/deploy profile
- An S3 bucket for Lambda artifacts (`LAMBDA_CODE_BUCKET`)
- Docker (to build & push the API image)

## Deploy order

Stacks reference each other via exports, so order matters.

```bash
PROJECT=solemate
REGION=us-east-1

# 1) Network
aws cloudformation deploy --stack-name $PROJECT-network \
  --template-file infra/cloudformation/network.yml \
  --parameter-overrides ProjectName=$PROJECT --region $REGION

# 2) Database (RDS + generated secret)
aws cloudformation deploy --stack-name $PROJECT-database \
  --template-file infra/cloudformation/database.yml \
  --parameter-overrides ProjectName=$PROJECT --region $REGION

# 3) Build & push the API image to ECR
#    (ECR repo is created by backend.yml; create it first or push after step 4)
aws cloudformation deploy --stack-name $PROJECT-backend \
  --template-file infra/cloudformation/backend.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides ProjectName=$PROJECT ImageTag=latest --region $REGION

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build -f backend/Dockerfile -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$PROJECT-api:latest .
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$PROJECT-api:latest

# 4) Apply schema (one-off ECS task)
aws ecs run-task --cluster $PROJECT-cluster --launch-type FARGATE \
  --task-definition $PROJECT-api \
  --overrides '{"containerOverrides":[{"name":"api","command":["npm","run","db:migrate"]}]}'

# 5) Lambdas
for fn in stripe-webhook image-processor order-email; do
  (cd infra/lambdas/$fn && npm install --omit=dev && zip -rq ../$fn.zip .)
  aws s3 cp infra/lambdas/$fn.zip s3://$LAMBDA_CODE_BUCKET/lambdas/$fn.zip
done
aws cloudformation deploy --stack-name $PROJECT-lambda \
  --template-file infra/cloudformation/lambda.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides ProjectName=$PROJECT LambdaCodeBucket=$LAMBDA_CODE_BUCKET --region $REGION

# 6) Frontend
aws cloudformation deploy --stack-name $PROJECT-frontend \
  --template-file infra/cloudformation/frontend.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides ProjectName=$PROJECT --region $REGION
# then: build, aws s3 sync Frontend/dist, CloudFront invalidate (see deploy.yml)
```

After this, the GitHub Actions [`deploy.yml`](../.github/workflows/deploy.yml)
pipeline handles steps 3–6 automatically on every push to `main`.

## Teardown

Delete in reverse order: `frontend → lambda → backend → database → network`.
Empty S3 buckets first; RDS leaves a final snapshot (DeletionPolicy: Snapshot).

## Notes

- Production hardening to add: HTTPS:443 listener on the ALB with an ACM cert
  and HTTP→HTTPS redirect; `MultiAz=true` + `DeletionProtection` on RDS; a custom
  domain + ACM cert (us-east-1) on CloudFront; Secrets Manager rotation.
- `database.yml` and the secrets are referenced by `backend.yml`/`lambda.yml`
  via CloudFormation exports — never copied or hardcoded.
