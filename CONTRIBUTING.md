# Contributing to docschema

Thank you for your interest in contributing to docschema! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

This project follows a simple code of conduct:

- **Be respectful** — Treat everyone with respect and consideration
- **Be constructive** — Focus on what's best for the project and community
- **Be collaborative** — Work together to solve problems
- **Be patient** — Remember that maintainers are often volunteers

## Getting Started

### Finding Something to Work On

- Check the [Issues](https://github.com/ThePagePage/docschema/issues) for open tasks
- Look for issues labeled `good first issue` if you're new
- Issues labeled `help wanted` are actively seeking contributors
- Feel free to propose new features by opening an issue first

### Types of Contributions

We welcome:

- **Bug fixes** — Fix something that's broken
- **New features** — Add new functionality
- **Documentation** — Improve docs, examples, or comments
- **Tests** — Add or improve test coverage
- **Built-in schemas** — Add schemas for new document types
- **Validators** — Add new validation functions
- **Storage adapters** — Add support for new storage backends

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Git

### Setup Steps

1. **Fork the repository**
   
   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**
   
   ```bash
   git clone https://github.com/YOUR-USERNAME/docschema.git
   cd docschema
   ```

3. **Install dependencies**
   
   ```bash
   npm install
   ```

4. **Create a branch**
   
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Run tests to verify setup**
   
   ```bash
   npm test
   ```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-xml-parser` — New feature
- `fix/citation-offset-bug` — Bug fix
- `docs/improve-api-reference` — Documentation
- `refactor/simplify-extractor` — Code refactoring

### Commit Messages

Write clear, concise commit messages:

```
type: short description

Longer description if needed. Explain what and why,
not how (the code shows how).

Fixes #123
```

Types:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code refactoring
- `chore:` — Maintenance tasks

### Keep Changes Focused

- One feature or fix per pull request
- Keep PRs reasonably sized (under 500 lines ideally)
- Split large changes into multiple PRs

## Pull Request Process

1. **Update documentation** — If your change affects the API, update the docs
2. **Add tests** — New features need tests; bug fixes should add regression tests
3. **Run the test suite** — Ensure all tests pass: `npm test`
4. **Run linting** — Ensure code style is correct: `npm run lint`
5. **Update CHANGELOG** — Add your change to the Unreleased section
6. **Submit the PR** — Fill out the PR template completely

### PR Template

When you open a PR, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Testing
Describe how you tested the changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] All tests passing
```

### Review Process

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Once approved, the PR will be merged
4. Your contribution will be included in the next release

## Coding Standards

### JavaScript Style

We follow standard JavaScript conventions:

```javascript
// Use const/let, not var
const extractor = new SchemaExtractor({ schema });
let result;

// Use async/await for promises
async function extractData(text) {
  const result = await extractor.extract(text);
  return result;
}

// Use descriptive names
const documentRegister = new DocumentRegister();  // Good
const dr = new DocumentRegister();                // Avoid

// Use JSDoc comments for public APIs
/**
 * Extract structured data from text.
 * @param {string} text - The document text to extract from
 * @param {object} options - Extraction options
 * @returns {Promise<ExtractionResult>} The extraction result
 */
async extract(text, options = {}) {
  // ...
}
```

### File Organization

```
src/
├── index.js              # Main exports
├── SchemaBuilder.js      # One class per file
├── SchemaExtractor.js
├── parsers/              # Group related files
│   ├── index.js
│   ├── TextParser.js
│   └── StructuredParser.js
└── schemas/
    ├── index.js
    └── built-in.js
```

### Error Handling

- Use specific error classes
- Include helpful error messages
- Don't swallow errors silently

```javascript
class ExtractionError extends Error {
  constructor(message, field, cause) {
    super(message);
    this.name = 'ExtractionError';
    this.field = field;
    this.cause = cause;
  }
}

// Throw with context
throw new ExtractionError(
  `Failed to extract field '${fieldName}'`,
  fieldName,
  originalError
);
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "SchemaBuilder"

# Run with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in `test/` directory
- Name test files `*.test.js`
- Test both success and failure cases
- Use descriptive test names

```javascript
const { SchemaBuilder } = require('../src');

describe('SchemaBuilder', () => {
  describe('string()', () => {
    it('should add a string field to the schema', () => {
      const schema = new SchemaBuilder('test')
        .string('title')
        .build();
      
      expect(schema.fields.title).toBeDefined();
      expect(schema.fields.title.type).toBe('string');
    });

    it('should throw if field name is empty', () => {
      expect(() => {
        new SchemaBuilder('test').string('');
      }).toThrow('Field name cannot be empty');
    });
  });
});
```

### Test Coverage

- Aim for >80% coverage on new code
- Focus on testing behavior, not implementation
- Include edge cases and error conditions

## Documentation

### When to Update Docs

- Adding new public API methods
- Changing existing API behavior
- Adding new features
- Fixing bugs that affect documented behavior

### Documentation Locations

- `README.md` — Overview, quick start, examples
- `docs/API.md` — Full API reference
- `CHANGELOG.md` — Version history
- JSDoc comments — Inline documentation

### Documentation Style

- Use clear, concise language
- Include code examples
- Show both basic and advanced usage
- Keep examples runnable

## Issue Guidelines

### Reporting Bugs

Include:
- Node.js version
- docschema version
- Minimal reproduction code
- Expected vs actual behavior
- Error messages/stack traces

### Requesting Features

Include:
- Use case description
- Proposed API (if applicable)
- Alternatives considered
- Willingness to implement

### Questions

For questions about usage:
- Check existing documentation first
- Search closed issues
- Open an issue with the `question` label

## Recognition

Contributors are recognized in:
- CHANGELOG.md (for each release)
- GitHub contributors page
- README.md (for significant contributions)

Thank you for contributing to docschema! 🙏
