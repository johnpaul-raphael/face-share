# Week 1: AWS Account Setup & Configuration

> **Difficulty**: Beginner | **Time**: 2-3 hours | **Cost**: $0 (Free Tier)

## 🎯 Learning Objectives

By the end of this week, you will:
- ✅ Understand AWS IAM users, roles, and policies
- ✅ Set up AWS CLI for programmatic access
- ✅ Configure billing alerts to avoid surprise charges
- ✅ Implement multi-environment configuration strategy
- ✅ Master environment variable management for security

---

## 🏗️ Architecture Overview

```mermaid
flowchart TB
    subgraph "Security Layer"
        A[IAM User] -->|Has| B[Access Keys]
        A -->|Attached to| C[Policies]
        C -->|Grants| D[Permissions]
    end

    subgraph "Configuration Layer"
        E[.env File] -->|Loaded by| F[Application]
        F -->|Uses| G[AWS Services]
        B -->|Authenticates| G
    end

    subgraph "Monitoring Layer"
        H[Billing Alerts] -->|Triggers on| I[Cost Threshold]
        J[CloudWatch] -->|Logs| K[API Calls]
    end

    A -.->|Monitored by| H
    F -.->|Logged by| J
```

### Text-Based Architecture (For AWS Icon Reference)

```
┌─────────────────────────────────────────────────────────────┐
│                     WEEK 1 ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│  │   [IAM]  │      │   [CLI]  │      │   [.env] │         │
│  │   User   │─────▶│  Config  │─────▶│   File   │         │
│  └──────────┘      └──────────┘      └──────────┘         │
│       │                                   │                  │
│       │                                   │                  │
│       ▼                                   ▼                  │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│  │ [Policy] │      │  [S3]    │      │ [Dynamo] │         │
│  │S3FullAcc │      │  Bucket  │      │   DB     │         │
│  └──────────┘      └──────────┘      └──────────┘         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              [Billing Alert] $5/month               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**AWS Icons to use in draw.io**:
- IAM: `AWS / Security, Identity, & Compliance / IAM`
- CLI: `AWS / Developer Tools / AWS CLI`
- S3: `AWS / Storage / Simple Storage Service`
- DynamoDB: `AWS / Database / DynamoDB`
- Billing: `AWS / Management & Governance / AWS Cost Explorer`

---

## 🤔 Why This Architecture?

### The Problem
When starting with AWS, beginners often:
1. Use root account for everything (security risk!)
2. Hardcode credentials in code (breach risk!)
3. Get surprised by bills (no monitoring!)
4. Mix dev/prod credentials (accidental deletion!)

### The Solution
Our architecture provides:
| Feature | Benefit | AWS Service |
|---------|---------|-------------|
| **IAM User** | Least privilege access | IAM |
| **Environment Files** | Secure credential management | None (local) |
| **Billing Alerts** | Cost control | Billing & Cost Management |
| **Multi-Environment** | Dev/QA/Prod isolation | Environment Variables |

---

## 📋 Implementation Steps

### Step 1: Create AWS Account (If Not Done)

**Manual Steps:**
1. Go to [AWS Console](https://portal.aws.amazon.com/billing/signup)
2. Enter email, password, account name
3. Select "Personal" account type
4. Enter credit card (required but won't charge if under free tier)
5. Verify phone number
6. Select "Basic" support plan (free)

> ⚠️ **Important**: Use a unique email not used for other AWS accounts

### Step 2: Create IAM User (Security Best Practice)

**❌ DON'T**: Use root account for daily operations
**✅ DO**: Create IAM user with specific permissions

#### Manual (AWS Console)

1. **Navigate to IAM**:
   - URL: https://console.aws.amazon.com/iam/
   - Click "Users" in left sidebar
   - Click "Create user"

2. **User Details**:
   - User name: `face-share-dev`
   - Click "Next"

3. **Attach Policies**:
   - Select "Attach policies directly"
   - Search and select:
     - ☑️ `AmazonS3FullAccess`
     - ☑️ `AmazonDynamoDBFullAccess`
     - ☑️ `AmazonRekognitionFullAccess`
     - ☑️ `AWSLambda_FullAccess`
     - ☑️ `CloudWatchLogsFullAccess`
     - ☑️ `IAMFullAccess` (for Serverless Framework)
   - Click "Next" → "Create user"

4. **Create Access Keys**:
   - Click on user `face-share-dev`
   - Go to "Security credentials" tab
   - Click "Create access key"
   - Select "Command Line Interface (CLI)"
   - Check the box "I understand..." → "Next"
   - **COPY BOTH KEYS NOW** (you won't see the secret again!)
   - Access Key ID: `AKIA...`
   - Secret Access Key: `...`
   - Click "Done"

#### Verification

```bash
# Test IAM user works
aws sts get-caller-identity

# Expected output:
{
    "UserId": "AIDAXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/face-share-dev"
}
```

### Step 3: Install AWS CLI

**Windows (PowerShell)**:
```powershell
# Download and install MSI
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify
aws --version
# aws-cli/2.x.x Python/3.x.x Windows/10 exe/AMD64
```

**macOS**:
```bash
brew install awscli
aws --version
```

**Linux**:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

### Step 4: Configure AWS CLI

```bash
aws configure

# Enter your credentials:
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

**Verify Configuration**:
```bash
# Check credentials are working
aws sts get-caller-identity

# List S3 buckets
aws s3 ls

# Should show empty list or your buckets
```

### Step 5: Set Up Billing Alerts

**Why?** Prevent surprise bills! AWS can charge thousands if you make a mistake.

**Manual (AWS Console)**:

1. **Navigate to Billing**:
   - URL: https://console.aws.amazon.com/billing/
   - Click "Budgets" in left sidebar

2. **Create Budget**:
   - Click "Create budget"
   - Select "Use a template (simplified)"
   - Template: "Zero spend budget"
   - Email recipients: your-email@example.com
   - Click "Create budget"

3. **Create Custom Budget (Recommended)**:
   - Click "Create budget" again
   - Select "Customize (advanced)"
   - Budget name: `FaceShare-Monthly-Budget`
   - Period: Monthly
   - Budget amount: `$5.00`
   - Threshold: 80% of budgeted amount
   - Email: your-email@example.com
   - Click "Create budget"

#### Using AWS CLI

```bash
# Create budget (requires advanced setup)
aws budgets create-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget file://budget.json \
    --notifications-with-subscribers file://notifications.json
```

### Step 6: Multi-Environment Configuration

**The Problem**: How do we manage different settings for dev, QA, and production?

**The Solution**: Environment-specific `.env` files

#### Create Directory Structure

```bash
cd backend

# Create environment files
touch .env.example
touch .env          # Development (gitignored)
touch .gitignore    # Add .env to ignore
```

#### Environment File Template

Create `backend/.env.example`:

```bash
# ==========================================
# FaceShare API - Environment Configuration
# ==========================================

# Environment (development, qa, production)
ENVIRONMENT=development

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1

# S3 Configuration
S3_BUCKET_NAME=faceshare-dev-yourname
S3_PRESIGNED_URL_EXPIRATION=3600

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/faceshare

# Security
SECRET_KEY=your-secret-key-minimum-32-characters-long
ACCESS_TOKEN_EXPIRE_MINUTES=10080
REFRESH_TOKEN_EXPIRE_DAYS=30

# Application
PROJECT_NAME=FaceShare API
VERSION=1.0.0
API_V1_STR=/api/v1
ALGORITHM=HS256

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:9002
```

#### Create Configuration Loader

Create `backend/app/core/config.py`:

```python
"""
FaceShare Configuration Module

Handles loading configuration from environment files.
Supports multiple environments: development, qa, production
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Any
from pydantic import model_validator
import json
import os


class Settings(BaseSettings):
    """Application settings loaded from environment files."""
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Application
    PROJECT_NAME: str = "FaceShare API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/faceshare"
    
    # AWS
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "faceshare-events"
    S3_PRESIGNED_URL_EXPIRATION: int = 3600
    
    # CORS
    CORS_ORIGINS: Any = "http://localhost:3000"
    
    @model_validator(mode='after')
    def parse_cors_origins(self):
        """Convert CORS_ORIGINS from string to list."""
        if isinstance(self.CORS_ORIGINS, str):
            v = self.CORS_ORIGINS.strip()
            if v.startswith('['):
                try:
                    self.CORS_ORIGINS = json.loads(v)
                    return self
                except json.JSONDecodeError:
                    pass
            self.CORS_ORIGINS = [
                origin.strip() 
                for origin in v.split(',') 
                if origin.strip()
            ]
        return self
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    @property
    def is_qa(self) -> bool:
        return self.ENVIRONMENT == "qa"
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='ignore'
    )


def get_environment_file() -> str:
    """Determine which .env file to load."""
    if os.getenv("ENV_FILE"):
        return os.getenv("ENV_FILE")
    
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "qa":
        return ".env.qa"
    elif env in ["production", "prod"]:
        return ".env.prod"
    
    return ".env"


# Load settings
_env_file = get_environment_file()
settings = Settings(_env_file=_env_file)

print(f"✅ Loaded environment: {settings.ENVIRONMENT}")
print(f"📁 Config file: {_env_file}")
```

#### Create .gitignore

Create `backend/.gitignore`:

```gitignore
# Environment files (NEVER commit!)
.env
.env.dev
.env.qa
.env.prod
.env.local
!.env.example

# Python
__pycache__/
*.py[cod]
*$py.class
venv/
env/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
```

### Step 7: Test Configuration

Create `backend/test_config.py`:

```python
"""Test configuration loading."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings


def test_configuration():
    """Test and display all configuration settings."""
    
    print("\n" + "="*60)
    print("🧪 FACE SHARE CONFIGURATION TEST")
    print("="*60)
    
    print(f"\n📍 Environment: {settings.ENVIRONMENT}")
    print(f"   Development: {settings.is_development}")
    print(f"   QA:          {settings.is_qa}")
    print(f"   Production:  {settings.is_production}")
    
    print(f"\n☁️  AWS Region: {settings.AWS_REGION}")
    print(f"   S3 Bucket: {settings.S3_BUCKET_NAME}")
    
    # Mask credentials
    if settings.AWS_ACCESS_KEY_ID:
        masked = settings.AWS_ACCESS_KEY_ID[:4] + "****" + settings.AWS_ACCESS_KEY_ID[-4:]
        print(f"   Access Key: {masked}")
    
    print(f"\n🗄️  Database: {settings.DATABASE_URL}")
    print(f"   Is Local: {settings.is_local_database}")
    
    print(f"\n🔒 Secret Key: {'✅ Set' if len(settings.SECRET_KEY) > 10 else '❌ Too short'}")
    
    print("\n" + "="*60)
    
    # Validation
    errors = []
    if not settings.AWS_ACCESS_KEY_ID or "your-aws" in settings.AWS_ACCESS_KEY_ID:
        errors.append("❌ AWS_ACCESS_KEY_ID not configured")
    
    if not settings.AWS_SECRET_ACCESS_KEY:
        errors.append("❌ AWS_SECRET_ACCESS_KEY not configured")
    
    if errors:
        print("\n🚨 ERRORS:")
        for error in errors:
            print(f"  {error}")
    else:
        print("\n✅ Configuration looks good!")
    
    return len(errors) == 0


if __name__ == "__main__":
    success = test_configuration()
    sys.exit(0 if success else 1)
```

---

## 🔧 Troubleshooting

### Error: "The security token included in the request is invalid"

**Cause**: Wrong credentials or clock skew
**Solution**:
```bash
# Reconfigure AWS CLI
aws configure

# Sync system clock (Windows)
w32tm /resync

# Sync system clock (Linux/Mac)
sudo ntpdate -s time.nist.gov
```

### Error: "AccessDenied" when calling S3

**Cause**: IAM policy not attached
**Solution**:
1. Go to IAM → Users → face-share-dev
2. Check "Permissions" tab
3. Ensure `AmazonS3FullAccess` is attached

### Error: "Unable to locate credentials"

**Cause**: AWS CLI not configured
**Solution**:
```bash
aws configure
# Or set environment variables
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

---

## 💰 Cost Analysis

| Service | This Week's Usage | Cost |
|---------|-------------------|------|
| IAM | Free | $0 |
| AWS CLI | Free | $0 |
| Billing Alerts | Free | $0 |
| **TOTAL** | | **$0** |

---

## ✅ Week 1 Checklist

- [ ] AWS account created
- [ ] IAM user `face-share-dev` created
- [ ] Access keys generated and saved securely
- [ ] AWS CLI installed and configured
- [ ] Billing alerts set ($5 threshold)
- [ ] `.env.example` created
- [ ] `config.py` implemented
- [ ] `.gitignore` configured
- [ ] `test_config.py` passes

---

## 🎓 Key Takeaways

### For Your Resume
> "Implemented secure AWS credential management using IAM users with least-privilege access, environment-based configuration, and automated billing alerts to prevent cost overruns."

### For LinkedIn
> "Week 1 of my AWS learning journey complete! 🎉
> 
> Learned:
> ✅ IAM users & access management
> ✅ AWS CLI configuration
> ✅ Multi-environment setup
> ✅ Cost monitoring with billing alerts
> 
> Built a secure configuration system for my serverless face recognition app. Cost so far: $0!
> 
> #AWS #CloudComputing #Serverless #LearningInPublic"

### Skills Acquired
- AWS IAM (Users, Policies, Access Keys)
- AWS CLI configuration
- Environment variable management
- Security best practices
- Cost monitoring

---

## 🚀 Next Week

[Week 2: S3 Storage & Presigned URLs →](week2-s3-storage.md)

We'll set up S3 for image storage, implement presigned URLs for secure uploads, and configure lifecycle policies for cost optimization.