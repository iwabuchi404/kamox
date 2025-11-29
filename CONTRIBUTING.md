# Contributing to KamoX

We love your input! We want to make contributing to KamoX as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## Development Setup

KamoX is a monorepo managed by npm workspaces.

1. **Clone the repository**
   ```bash
   git clone https://github.com/iwabuchi404/kamox
   cd kamox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build all packages**
   ```bash
   npm run build
   ```

## Project Structure

- `packages/core`: Core logic, types, and base classes
- `packages/plugin-chrome`: Chrome Extension adapter and Playwright integration
- `cli`: Command line interface (`kamox` command)
- `examples`: Example projects for testing

## Development Workflow

1. Make changes in the relevant package(s).
2. Run `npm run build` to compile TypeScript.
3. Test your changes using the CLI with an example project:
   ```bash
   # Run the CLI from source/dist against an example
   npm run cli -- chrome --project-path=examples/chrome-extension/dist
   ```

## Pull Request Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
