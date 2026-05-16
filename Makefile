.PHONY: help setup seed migrate test backend frontend dev up up-prod down logs \
        image-backend image-frontend images push-ghcr push-ecr push-gar deploy-vercel

# Git short SHA used as the default image tag. Override with `make image-backend TAG=v1.2.3`.
TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)

help:
	@echo "Aegis — common developer tasks"
	@echo
	@echo "  make setup          Generate .env with a fresh JWT secret (idempotent)"
	@echo "  make migrate        Apply Alembic migrations"
	@echo "  make seed           Populate the DB with demo user + 120 days of transactions"
	@echo "  make test           Run backend pytest suite"
	@echo "  make backend        Run the FastAPI backend natively (reload mode)"
	@echo "  make frontend       Run the Next.js frontend natively (dev mode)"
	@echo "  make dev            docker compose with the dev override (hot reload)"
	@echo "  make up             docker compose up -d --build (prod mode, HTTP)"
	@echo "  make up-prod        docker compose up -d --build with Caddy on https://localhost"
	@echo "  make down           docker compose down"
	@echo "  make logs           Tail docker compose logs"
	@echo
	@echo "  Deployment (see docs/deployment/):"
	@echo "  make images                                    Build backend + frontend images"
	@echo "  make image-backend                             Build backend image"
	@echo "  make image-frontend                            Build frontend image"
	@echo "  make push-ghcr OWNER=…                         Push both to ghcr.io/OWNER"
	@echo "  make push-ecr REGION=… ACCOUNT=…               Push both to AWS ECR"
	@echo "  make push-gar REGION=… PROJECT=… REPO=…        Push both to GCP Artifact Registry"
	@echo "  make deploy-vercel                             Run \`vercel --prod\` in frontend/"

setup:
	@bash scripts/bootstrap.sh

migrate:
	cd backend && alembic upgrade head

seed: migrate
	python -m backend.app.seeds.demo

test:
	cd backend && pytest -q

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && bun run dev

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

up:
	docker compose up -d --build
	@echo ""
	@echo "Backend:  http://localhost:8000/api/health"
	@echo "Frontend: http://localhost:3000"

up-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@echo ""
	@echo "HTTPS:    https://localhost   (accept Caddy local-CA cert on first visit)"

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

# ---------- Deployment ----------
# Image build targets — produce locally-tagged images keyed on the current
# git short SHA (override with TAG=...). Re-run on every code change before
# pushing.

image-backend:
	docker build -t aegis-backend:$(TAG) ./backend

image-frontend:
	docker build -t aegis-frontend:$(TAG) ./frontend

images: image-backend image-frontend
	@echo "Built aegis-backend:$(TAG) and aegis-frontend:$(TAG)"

# Push to GitHub Container Registry. Requires `docker login ghcr.io` first.
# Usage: make push-ghcr OWNER=santapong [TAG=v1.2.3]
push-ghcr: images
	@test -n "$(OWNER)" || (echo "ERROR: pass OWNER=<github-org-or-user>"; exit 1)
	docker tag aegis-backend:$(TAG)  ghcr.io/$(OWNER)/aegis-backend:$(TAG)
	docker tag aegis-frontend:$(TAG) ghcr.io/$(OWNER)/aegis-frontend:$(TAG)
	docker push ghcr.io/$(OWNER)/aegis-backend:$(TAG)
	docker push ghcr.io/$(OWNER)/aegis-frontend:$(TAG)

# Push to AWS Elastic Container Registry. Requires `aws ecr get-login-password`
# wired into Docker. Both repos must exist (`aws ecr create-repository`).
# Usage: make push-ecr REGION=us-east-1 ACCOUNT=123456789012 [TAG=v1.2.3]
push-ecr: images
	@test -n "$(REGION)"  || (echo "ERROR: pass REGION=<aws-region>"; exit 1)
	@test -n "$(ACCOUNT)" || (echo "ERROR: pass ACCOUNT=<aws-account-id>"; exit 1)
	$(eval REGISTRY=$(ACCOUNT).dkr.ecr.$(REGION).amazonaws.com)
	docker tag aegis-backend:$(TAG)  $(REGISTRY)/aegis-backend:$(TAG)
	docker tag aegis-frontend:$(TAG) $(REGISTRY)/aegis-frontend:$(TAG)
	docker push $(REGISTRY)/aegis-backend:$(TAG)
	docker push $(REGISTRY)/aegis-frontend:$(TAG)

# Push to GCP Artifact Registry. Requires `gcloud auth configure-docker`.
# Usage: make push-gar REGION=us-central1 PROJECT=my-project REPO=aegis [TAG=v1.2.3]
push-gar: images
	@test -n "$(REGION)"  || (echo "ERROR: pass REGION=<gcp-region>"; exit 1)
	@test -n "$(PROJECT)" || (echo "ERROR: pass PROJECT=<gcp-project-id>"; exit 1)
	@test -n "$(REPO)"    || (echo "ERROR: pass REPO=<artifact-registry-repo>"; exit 1)
	$(eval REGISTRY=$(REGION)-docker.pkg.dev/$(PROJECT)/$(REPO))
	docker tag aegis-backend:$(TAG)  $(REGISTRY)/aegis-backend:$(TAG)
	docker tag aegis-frontend:$(TAG) $(REGISTRY)/aegis-frontend:$(TAG)
	docker push $(REGISTRY)/aegis-backend:$(TAG)
	docker push $(REGISTRY)/aegis-frontend:$(TAG)

# Vercel — assumes the user is logged in (`vercel login`) and the project is linked.
# Run from the repo root; the target cd's into frontend/.
deploy-vercel:
	cd frontend && vercel --prod
