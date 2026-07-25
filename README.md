# Intelligent Document Management Platform — AWS Build Manual

A twelve-sprint manual for building a production-grade, multi-tenant document
platform on AWS, written for someone learning AWS by implementing it.

**Read it here: https://dhrubajitpc.github.io/aws-learn/**

## What the manual covers

Each sprint follows the same shape: requirements, architecture, trade-off
analysis, production code, the AWS fundamentals underneath it, then testing,
monitoring, and interview questions on the material. Every sprint ends with a
definition-of-done checklist that persists in your browser.

| Sprint | Subject |
|---|---|
| 00 | AWS foundations, account setup, cost guardrails |
| 01 | Domain model, Drizzle schema, migrations, local stack |
| 02 | Terraform foundations, S3, KMS, IAM |
| 03 | Identity with Cognito, JWT verification, tenant claims |
| 04 | Presigned uploads, EventBridge, SQS, idempotent workers |
| 05 | Textract: async OCR, block parsing, confidence handling |
| 06 | Bedrock: classification, structured extraction, embeddings, hybrid search |
| 07 | VPC networking, ECS Fargate, RDS, ALB, ECR |
| 08 | Observability: structured logs, EMF metrics, alarms, runbooks |
| 09 | CI/CD with GitHub Actions and OIDC federation |
| 10 | React frontend, CloudFront, upload UX |
| 11 | Hardening, threat model, DR drill, cost, teardown |
| A | Interview bank, glossary, debugging index, schedule |

## Target architecture

```
Browser ──► CloudFront ──► S3 (static SPA)
        └─► CloudFront ──► ALB ──► Fargate (Fastify API) ──► RDS Postgres + pgvector

Browser ──presigned PUT──► S3 raw
                            └─► EventBridge ──► SQS ──► Lambda ──► Textract
                                                                     └─► SNS ──► SQS
                                                                            └─► Lambda
                                                                                  └─► Bedrock
```

Stack: React + Vite + TypeScript, Fastify, PostgreSQL + Drizzle ORM,
node-pg-migrate, Docker, Terraform, GitHub Actions.

## Repository layout

```
docs/index.html      the manual (self-contained, no build step, no dependencies)
tools/slop-check.mjs  prose scanner (see below)
```

The manual is a single HTML file with inlined CSS and JS. Open it directly in a
browser, or serve the folder with any static server.

## Prose scanner

`tools/slop-check.mjs` scores each section of the manual for the statistical
fingerprints of AI-generated writing: negative parallelism ("not just X but Y"),
puffery vocabulary, reflexive hedging, false ranges, em-dash density, and runs of
uniform sentence length. Code blocks are excluded from scoring.

```bash
node tools/slop-check.mjs            # summary table
node tools/slop-check.mjs --verbose  # per-section findings with samples
```

Scores are weighted hits per 1,000 words, mapped onto 0–10 where lower is
better. The script exits non-zero if any section reaches 5, so it works as a
pre-commit or CI gate. Current state: average 2.8, worst section 4.2.

## License

The manual is prose and example code written for learning. Use it however is
useful to you.
