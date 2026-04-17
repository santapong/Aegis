.PHONY: help seed migrate test backend frontend dev

help:
	@echo "Aegis — common developer tasks"
	@echo
	@echo "  make migrate   Apply Alembic migrations"
	@echo "  make seed      Populate the DB with demo user + 120 days of transactions"
	@echo "  make test      Run backend pytest suite"
	@echo "  make backend   Run the FastAPI backend (reload mode)"
	@echo "  make frontend  Run the Next.js frontend (dev mode)"
	@echo "  make dev       Run docker-compose with the dev override"

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
