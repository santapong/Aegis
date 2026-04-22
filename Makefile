.PHONY: help setup seed migrate test backend frontend dev up up-prod down logs

help:
	@echo "Aegis — common developer tasks"
	@echo
	@echo "  make setup     Generate .env with a fresh JWT secret (idempotent)"
	@echo "  make migrate   Apply Alembic migrations"
	@echo "  make seed      Populate the DB with demo user + 120 days of transactions"
	@echo "  make test      Run backend pytest suite"
	@echo "  make backend   Run the FastAPI backend natively (reload mode)"
	@echo "  make frontend  Run the Next.js frontend natively (dev mode)"
	@echo "  make dev       docker compose with the dev override (hot reload)"
	@echo "  make up        docker compose up -d --build (prod mode, HTTP)"
	@echo "  make up-prod   docker compose up -d --build with Caddy on https://localhost"
	@echo "  make down      docker compose down"
	@echo "  make logs      Tail docker compose logs"

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
