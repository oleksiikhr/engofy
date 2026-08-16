.DEFAULT_GOAL := help

COMPOSE := docker compose -f compose.yaml

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "} /^[%a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ----------------------------------------------------------------------------------------------------------------------
# Docker
# ----------------------------------------------------------------------------------------------------------------------

.PHONY: up
up: ## Start all containers in background
	$(COMPOSE) up -d --remove-orphans

.PHONY: up-%
up-%: ## Start a specific container  (e.g. make up-postgres)
	$(COMPOSE) up -d $*

.PHONY: down
down: ## Stop and remove all containers
	$(COMPOSE) down --remove-orphans

.PHONY: down-volumes
down-volumes: ## Stop containers and delete all named volumes (destructive)
	$(COMPOSE) down --remove-orphans -v

.PHONY: stop
stop: ## Stop all containers
	$(COMPOSE) stop

.PHONY: stop-%
stop-%: ## Stop a specific container
	$(COMPOSE) stop $*

.PHONY: start
start: ## Start existing (stopped) containers
	$(COMPOSE) start

.PHONY: start-%
start-%: ## Start a specific stopped container
	$(COMPOSE) start $*

.PHONY: restart
restart: ## Restart all containers
	$(COMPOSE) restart

.PHONY: restart-%
restart-%: ## Restart a specific container
	$(COMPOSE) restart $*

.PHONY: exec-%
exec-%: ## Open a shell in a container  (e.g. make exec-app)
	$(COMPOSE) exec $* sh

.PHONY: ps
ps: ## Show container status
	$(COMPOSE) ps

.PHONY: logs
logs: ## Follow logs from all containers
	$(COMPOSE) logs -f

.PHONY: logs-%
logs-%: ## Follow logs from a specific container  (e.g. make logs-app)
	$(COMPOSE) logs -f $*

.PHONY: build-image
build-image: ## Build all container images
	$(COMPOSE) build

.PHONY: build-image-%
build-image-%: ## Build a specific container image
	$(COMPOSE) build $*

# ------------------------------------------------------------------------------
# Setup & Onboarding
# ------------------------------------------------------------------------------

.PHONY: setup
setup: ## Install dependencies, run pending database migrations
	$(MAKE) sync
	$(MAKE) migrate
	$(MAKE) seed

.PHONY: sync
sync: ## Update Node.js dependencies and run pending migrations after a branch switch
	pnpm i
	$(MAKE) migrate

.PHONY: reset
reset: ## Drop and recreate the database schema (destructive)
	$(MAKE) migrate-fresh
	$(MAKE) seed

# ------------------------------------------------------------------------------
# Development
# ------------------------------------------------------------------------------

.PHONY: watch
watch: ## Start in development mode with hot reload
	NODE_ENV=development pnpm exec nest start --type-check --watch

.PHONY: queue
worker: ## Start worker (all queues)
	pnpm worker $(filter-out $@,$(MAKECMDGOALS))

.PHONY: build
build: ## Build for production
	pnpm build

.PHONY: fix-metadata
fix-metadata: ## Reset metadata.ts stub so the next build regenerates it cleanly
	echo "export default async () => ({});" > src/metadata.ts
	pnpm build

# ------------------------------------------------------------------------------
# Testing
# ------------------------------------------------------------------------------

.PHONY: test
test: ## Run all tests
	pnpm test $(filter-out $@,$(MAKECMDGOALS))

.PHONY: test-watch
test-watch: ## Run tests in interactive watch mode
	pnpm exec vitest

# ------------------------------------------------------------------------------
# Linting & Code Quality
# ------------------------------------------------------------------------------

.PHONY: lint
lint: ## Run Biome linter and apply fixes
	pnpm lint $(filter-out $@,$(MAKECMDGOALS))

.PHONY: type
type: ## Run TypeScript type checking without emitting output
	pnpm type

# ------------------------------------------------------------------------------
# Database
# ------------------------------------------------------------------------------

.PHONY: migrate
migrate: ## Run all pending database migrations
	pnpm cli migrate up

.PHONY: migrate-rollback
migrate-rollback: ## Revert the last executed migration
	pnpm cli migrate down

.PHONY: migrate-fresh
migrate-fresh: ## Drop the database schema and re-run all migrations from scratch
	pnpm exec mikro-orm migration:fresh

.PHONY: migrate-create
migrate-create: ## Generate a new migration based on the current schema diff
	pnpm exec mikro-orm migration:create

.PHONY: orm-debug
orm-debug: ## Run MikroORM debug to inspect entities and configuration
	pnpm exec mikro-orm debug

.PHONY: seed
seed: ## Seed with dictionary data, dev fixtures, and job board data
	echo "Todo"
