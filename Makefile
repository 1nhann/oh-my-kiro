.PHONY: build build-types build-full clean test typecheck cases cases-sdd cases-edge install help

help:
	@echo "Available targets:"
	@echo "  build        - Build the project"
	@echo "  build-types  - Generate TypeScript declaration files"
	@echo "  build-full   - Build JS and types"
	@echo "  clean        - Remove dist directory"
	@echo "  test         - Run tests"
	@echo "  typecheck    - Type check without emitting"
	@echo "  cases        - Run all test cases"
	@echo "  cases-sdd    - Run SDD test cases"
	@echo "  cases-edge   - Run edge test cases"
	@echo "  install      - Install dependencies"

install:
	bun install

build:
	bun run build

build-types:
	bun run build:types

build-full:
	bun run build:full

clean:
	bun run clean

test:
	bun run test

typecheck:
	bun run typecheck

cases:
	bun run cases

cases-sdd:
	bun run cases:sdd

cases-edge:
	bun run cases:edge
