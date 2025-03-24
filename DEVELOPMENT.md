# Development Guide

This document contains information for developers working on the Terraform
Module GCS Publisher.

## Prerequisites

- Node.js (version specified in `.node-version`)
- npm

## Setup Development Environment

1. Clone the repository:

   ```bash
   git clone https://github.com/infraspecdev/terraform-module-gcs-publisher.git
   cd terraform-module-gcs-publisher
   ```

1. Use the correct Node.js version:

   ```bash
   # If you use nodenv, nvm, asdf, volta, etc:
   # They will automatically read the version from .node-version
   ```

1. Install dependencies:

   ```bash
   npm ci
   ```

1. Set up Git hooks:

   ```bash
   npm run prepare
   ```

## Development Workflow

- `npm run verify` - Run all linting and formatting checks
- `npm run format` - Format all files with Prettier
- `npm test` - Run tests
- `npm run build` - Build the action

## Code Quality Tools

This project uses several code quality tools:

- **ESLint** - TypeScript/JavaScript linting
- **Prettier** - Code formatting
- **markdownlint** - Markdown linting
- **yamllint** - YAML linting

## Continuous Integration

Our CI workflow uses GitHub Super Linter, which runs all the linting tools in a
standardized environment. The Node.js version used in CI is managed through the
`.node-version` file to ensure consistency across all environments.

## Release Process

1. Update version in package.json
1. Create a new GitHub release
1. Tag the release (following semantic versioning)

The CI/CD pipeline will automatically build and test the code before publishing
to the GitHub Marketplace.
