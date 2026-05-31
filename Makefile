# Variables
APP_NAME := mycheet
BIN_DIR := bin
FRONTEND_DIR := frontend
PACKAGE_MANAGER := npm

# Go settings
GO_CMD := go
GO_MOD_TIDY := $(GO_CMD) mod tidy

# Wails settings
WAILS_CMD := wails3
CONFIG := ./build/config.yml

.PHONY: all build dev clean deps tidy help

all: build

# Build the application
build: tidy deps
	$(WAILS_CMD) build

# Run the application in development mode
dev: tidy
	$(WAILS_CMD) dev -config $(CONFIG)

# Clean build artifacts
clean:
	@if exist $(BIN_DIR) rd /s /q $(BIN_DIR)
	@if exist $(FRONTEND_DIR)\dist rd /s /q $(FRONTEND_DIR)\dist

# Install dependencies
deps: deps-frontend deps-go

deps-frontend:
	cd $(FRONTEND_DIR) && $(PACKAGE_MANAGER) install

deps-go: tidy

tidy:
	$(GO_MOD_TIDY)

# Help
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build         Build the application"
	@echo "  dev           Run in development mode"
	@echo "  clean         Remove build artifacts"
	@echo "  deps          Install all dependencies"
	@echo "  tidy          Run go mod tidy"
