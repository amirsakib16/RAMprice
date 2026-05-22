# RAMprice — CI/CD Implementation Guide

This document explains the GitHub Actions CI/CD pipeline added to the RAMprice project.

---

## 📁 Files Added / Modified

```
RAMprice/
├── .github/
│   └── workflows/
│       ├── ci-cd.yml            ← Main pipeline (lint → test → build → deploy)
│       ├── pr-checks.yml        ← Fast quality gate on every Pull Request
│       ├── dependency-review.yml← Blocks PRs with HIGH/CRITICAL CVEs
│       └── security-scan.yml    ← Weekly automated security audit (cron)
├── tests/
│   ├── conftest.py              ← Shared pytest fixtures
│   └── test_app.py              ← Unit + integration tests for Flask app
├── .flake8                      ← Flake8 linting config
├── pyproject.toml               ← Black + isort formatter config
└── pytest.ini                   ← pytest settings
```

---

## 🔄 Pipeline Overview

```
Push / PR
   │
   ├─► lint          → Black, isort, Flake8
   │
   ├─► security      → Bandit, Safety  (parallel with lint)
   │
   └─► test          → pytest + coverage  (needs: lint)
          │
          └─► docker-build  → Build & push to GHCR  (needs: test + security)
                 │
                 ├─► deploy-staging    (develop branch only)
                 │
                 └─► deploy-production (main branch only)
```

### Workflow files

| File | Trigger | Purpose |
|------|---------|---------|
| `ci-cd.yml` | Push to `main` / `develop` | Full pipeline |
| `pr-checks.yml` | Pull Requests | Fast checks + Docker build test |
| `dependency-review.yml` | Pull Requests | Block CVE-vulnerable deps |
| `security-scan.yml` | Every Monday 03:00 UTC | Full security audit |

---

## 🔐 Required GitHub Secrets & Variables

Go to **Settings → Secrets and variables → Actions** in your repo.

### Secrets (sensitive — never logged)

| Secret | Description |
|--------|-------------|
| `STAGING_HOST` | IP / hostname of staging server |
| `STAGING_USER` | SSH username for staging |
| `STAGING_SSH_KEY` | Private SSH key for staging (PEM format) |
| `STAGING_PORT` | SSH port (default: 22) |
| `PROD_HOST` | IP / hostname of production server |
| `PROD_USER` | SSH username for production |
| `PROD_SSH_KEY` | Private SSH key for production |
| `PROD_PORT` | SSH port (default: 22) |

> **Note:** `GITHUB_TOKEN` is provided automatically — no setup needed.

### Variables (non-sensitive)

| Variable | Example value |
|----------|---------------|
| `STAGING_URL` | `http://staging.yourdomain.com:5001` |
| `PRODUCTION_URL` | `http://yourdomain.com:5000` |

### Setting up SSH keys (one-time)

```bash
# On your server
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
# Copy the private key (github_deploy) into the GitHub secret
```

---

## 🐳 Docker Image

Images are published to **GitHub Container Registry (GHCR)**:

```
ghcr.io/<your-github-username>/ramprice:latest    ← main branch
ghcr.io/<your-github-username>/ramprice:develop   ← develop branch
ghcr.io/<your-github-username>/ramprice:sha-<abc> ← per-commit SHA
```

To pull and run locally:

```bash
docker pull ghcr.io/<your-username>/ramprice:latest
docker run -p 5000:5000 ghcr.io/<your-username>/ramprice:latest
```

---

## 🌿 Branching Strategy

```
feature/* ──► develop ──► main
               │                │
           Staging         Production
```

- Work on `feature/*` branches, open a **PR to `develop`** → triggers PR checks.
- Merge to `develop` → deploys to **staging**.
- Merge to `main` → deploys to **production** (with environment protection rules).

### Recommended branch protection rules (Settings → Branches)

For `main`:
- ✅ Require status checks: `PR Quality Gate`, `Tests`
- ✅ Require at least 1 review
- ✅ Require linear history

---

## 🧪 Running Tests Locally

```bash
# Install dependencies
pip install -r requirements.txt
pip install pytest pytest-cov flake8 black isort bandit safety

# Run tests
pytest tests/ -v

# Check formatting
black --check app.py tests/
isort --check-only app.py tests/

# Lint
flake8 app.py tests/

# Security
bandit -r app.py
safety check -r requirements.txt
```

---

## 🚀 First-Time Setup Checklist

- [ ] Add all **Secrets** listed above in GitHub repo settings
- [ ] Add **Variables** (`STAGING_URL`, `PRODUCTION_URL`)
- [ ] Configure **Environments** (`staging`, `production`) under Settings → Environments
  - Add required reviewers for production if desired
- [ ] Ensure Docker is installed on your staging/production servers
- [ ] Push the `.github/` folder to your `main` branch — the pipeline activates immediately
- [ ] Check the **Actions** tab to confirm the first run succeeds
