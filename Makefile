.DEFAULT_GOAL := help

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "} /^[%a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

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

.PHONY: start
start: ## Start in development mode (no watch)
	NODE_ENV=development LOG_LEVEL=error pnpm exec nest start

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
