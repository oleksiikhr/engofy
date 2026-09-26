.DEFAULT_GOAL := help

COMPOSE := docker compose -f compose.yaml
E2E_COMPOSE := docker compose -f compose.e2e.yaml

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "} /^[%a-zA-Z0-9_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

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
down-volumes: ## Stop containers and delete all named volumes, including compose.e2e.yaml's (destructive)
	$(E2E_COMPOSE) down --remove-orphans -v

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
setup: ## Install dependencies, seed dev data
	$(MAKE) sync
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

.PHONY: web
web: ## Start the Astro frontend (apps/web) in development mode
	$(MAKE) -C apps/web dev

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
seed: ## Seed grammar and word reference data
	pnpm cli grammar import-egp
	pnpm cli grammar import-irregular-verbs
	pnpm cli words import-frequency
	pnpm cli grammar import-usage-point-exercises

# ------------------------------------------------------------------------------
# Worktree isolation
# ------------------------------------------------------------------------------

.PHONY: ports
ports: ## Isolate this worktree's backend port/DB/Redis DB for offset N, e.g. `make ports OFFSET=1`
	@case "$(OFFSET)" in ''|*[!0-9]*) echo "OFFSET must be a non-negative integer (0-7), got '$(OFFSET)'. Usage: make ports OFFSET=<N>" >&2; exit 1 ;; esac
	@test "$(OFFSET)" -le 7 || { echo "OFFSET must be <= 7 (Redis has 16 logical DBs by default, 0-15, and each offset uses 2 of them)" >&2; exit 1; }
	@touch .env.development.local .env.test.local
	@set_var() { grep -q "^$$1=" "$$3" 2>/dev/null && sed -i.bak "s#^$$1=.*#$$1=$$2#" "$$3" && rm -f "$$3.bak" || echo "$$1=$$2" >> "$$3"; }; \
	N=$(OFFSET); \
	PORT=$$((8080 + N)); \
	REDIS_DB_DEV=$$((2 * N)); \
	REDIS_DB_TEST=$$((2 * N + 1)); \
	if [ "$$N" -eq 0 ]; then DB_DEV=engofy; DB_TEST=engofy-testing; else DB_DEV=engofy_wt$$N; DB_TEST=engofy-testing-wt$$N; fi; \
	set_var PORT $$PORT .env.development.local; \
	set_var MIKRO_ORM_DB_NAME $$DB_DEV .env.development.local; \
	set_var REDIS_DB $$REDIS_DB_DEV .env.development.local; \
	set_var MIKRO_ORM_DB_NAME $$DB_TEST .env.test.local; \
	set_var REDIS_DB $$REDIS_DB_TEST .env.test.local; \
	echo "----------------------------------------"; \
	echo " Worktree offset:  $$N"; \
	echo " Backend port:     $$PORT"; \
	echo " Postgres (dev):   $$DB_DEV"; \
	echo " Postgres (test):  $$DB_TEST"; \
	echo " Redis DB (dev):   $$REDIS_DB_DEV"; \
	echo " Redis DB (test):  $$REDIS_DB_TEST"; \
	echo "----------------------------------------"

# ------------------------------------------------------------------------------
# Isolated e2e stack (compose.e2e.yaml) — dev images, hot reload, own DB/Redis
# index/ports, alongside the normal dev stack. See
# .claude/plans/e2e-isolated-stack.md.
# ------------------------------------------------------------------------------

.PHONY: e2e-up
e2e-up: ## Start the isolated e2e stack (backend + web, dev images, hot reload) alongside the normal dev stack
	$(E2E_COMPOSE) up -d --wait backend-e2e web-e2e

.PHONY: e2e-down
e2e-down: ## Stop and remove the isolated e2e stack — the shared dev Postgres/Redis/etc. are untouched
	$(E2E_COMPOSE) rm -sf backend-e2e web-e2e

.PHONY: e2e-reset
e2e-reset: ## Drop and reseed the isolated e2e database (engofy-e2e) with deterministic Playwright fixtures
	MIKRO_ORM_DB_NAME=engofy-e2e pnpm exec mikro-orm migration:fresh
	MIKRO_ORM_DB_NAME=engofy-e2e node --import @swc-node/register/esm-register test/e2e/seed-web-e2e.ts

.PHONY: e2e
e2e: ## Run the Playwright e2e suite against the isolated e2e stack
	pnpm --dir apps/web run test:e2e

.PHONY: e2e-ui
e2e-ui: ## Run the Playwright e2e suite in UI mode against the isolated e2e stack
	pnpm --dir apps/web exec playwright test --ui

.PHONY: e2e-headed
e2e-headed: ## Run the Playwright e2e suite headed against the isolated e2e stack
	pnpm --dir apps/web exec playwright test --headed

.PHONY: e2e-report
e2e-report: ## Open the last Playwright HTML report
	pnpm --dir apps/web exec playwright show-report

.PHONY: e2e-full
e2e-full: ## Bring up the isolated e2e stack, reset its DB, and run the Playwright suite end-to-end
	$(MAKE) e2e-up
	$(MAKE) e2e-reset
	$(MAKE) e2e
