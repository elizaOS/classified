# E2B Code Interpreter Templates

This document provides comprehensive documentation for the JavaScript and Python
code execution templates available in the E2B plugin.

## Overview

The E2B plugin now includes a rich collection of pre-built code templates that
can be executed instantly through the Code Interpreter. These templates cover
common programming tasks and can serve as starting points for more complex
implementations.

## Features

- **Ready-to-Run Templates**: Over 30 templates across JavaScript and Python
- **Multiple Categories**: Basic, Data Science, Algorithms, Web Development, and
  more
- **Template Discovery**: List, search, and suggest templates based on keywords
- **Parameterized Execution**: Some templates support input parameters
- **Comprehensive Testing**: Full test coverage for all templates

## Quick Start

### List All Available Templates

```
List all available templates
```

### Execute a Template

```
Run template hello-world in Python
```

```
Run template array-operations in JavaScript
```

### Get Template Suggestions

```
Suggest templates for sorting algorithms
```

### Browse by Category

```
Show me JavaScript data processing templates
```

```
What categories are available for Python templates?
```

## JavaScript Templates

### Basic Templates

| Template              | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `hello-world`         | Simple Hello World example                             |
| `variables-and-types` | Demonstrates JavaScript variable types                 |
| `functions`           | JavaScript function examples including arrow functions |

#### Example: Variables and Types

```javascript
// JavaScript variable types
let stringVar = 'Hello';
let numberVar = 42;
let booleanVar = true;
let arrayVar = [1, 2, 3, 4, 5];
let objectVar = { name: 'John', age: 30 };

console.log('String:', stringVar, typeof stringVar);
console.log('Number:', numberVar, typeof numberVar);
// ... more examples
```

### Data Processing Templates

| Template              | Description                         |
| --------------------- | ----------------------------------- |
| `array-operations`    | Common array operations and methods |
| `object-manipulation` | Working with JavaScript objects     |
| `json-processing`     | JSON parsing and manipulation       |

#### Example: Array Operations

```javascript
const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Array methods
console.log(
  'Sum:',
  data.reduce((acc, curr) => acc + curr, 0)
);
console.log(
  'Average:',
  data.reduce((acc, curr) => acc + curr, 0) / data.length
);
console.log(
  'Even numbers:',
  data.filter((n) => n % 2 === 0)
);
```

### Algorithm Templates

| Template             | Description                              |
| -------------------- | ---------------------------------------- |
| `sorting-algorithms` | Common sorting algorithms implementation |
| `search-algorithms`  | Binary search implementation             |

### Web Development Templates

| Template           | Description                                    |
| ------------------ | ---------------------------------------------- |
| `dom-manipulation` | DOM manipulation examples (Node.js compatible) |
| `async-operations` | Asynchronous JavaScript patterns               |

### Utility Templates

| Template                  | Description                              |
| ------------------------- | ---------------------------------------- |
| `date-time-operations`    | Date and time manipulation               |
| `string-operations`       | String manipulation and regex            |
| `mathematical-operations` | Mathematical calculations and statistics |

## Python Templates

### Basic Templates

| Template                | Description                          |
| ----------------------- | ------------------------------------ |
| `hello-world`           | Simple Hello World example           |
| `variables-and-types`   | Python variable types and operations |
| `functions-and-classes` | Python functions and classes         |

#### Example: Functions and Classes

```python
# Function definition
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

# Class definition
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def introduce(self):
        return f"Hi, I'm {self.name} and I'm {self.age} years old."
```

### Data Science Templates

| Template               | Description                          | Requirements      |
| ---------------------- | ------------------------------------ | ----------------- |
| `basic-statistics`     | Statistical calculations with Python | numpy             |
| `data-visualization`   | Creating charts and plots            | matplotlib, numpy |
| `pandas-data-analysis` | Data analysis with pandas            | pandas, numpy     |

#### Example: Basic Statistics

```python
import numpy as np
import statistics

data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 8, 6, 4, 2, 5, 7, 9, 3, 1, 10]

print(f"Mean: {statistics.mean(data):.2f}")
print(f"Median: {statistics.median(data)}")
print(f"Standard deviation: {statistics.stdev(data):.2f}")
```

### Web Development Templates

| Template          | Description                | Requirements             |
| ----------------- | -------------------------- | ------------------------ |
| `web-scraping`    | Basic web scraping example | requests, beautifulsoup4 |
| `api-interaction` | Working with REST APIs     | requests                 |

### Algorithm Templates

| Template             | Description                      |
| -------------------- | -------------------------------- |
| `sorting-algorithms` | Common sorting algorithms        |
| `search-algorithms`  | Search algorithms implementation |

### File System Templates

| Template          | Description                             |
| ----------------- | --------------------------------------- |
| `file-operations` | File reading, writing, and manipulation |

### Mathematics Templates

| Template                    | Description                      | Requirements |
| --------------------------- | -------------------------------- | ------------ |
| `mathematical-computations` | Advanced mathematical operations | numpy, scipy |

### Text Processing Templates

| Template          | Description                  |
| ----------------- | ---------------------------- |
| `text-processing` | Text analysis and processing |

## Template Commands

### Listing Templates

```
# List all templates
List all available templates

# List templates by language
Show me all Python templates
Show me all JavaScript templates

# List templates by category
Show me data processing templates
List Python data-science templates
```

### Template Categories

```
# Get all categories
What categories are available?

# Get categories for specific language
What categories are available for Python templates?
Show JavaScript template categories
```

### Executing Templates

```
# Basic execution
Run template hello-world in Python
Execute template array-operations in JavaScript

# With explicit language
Use template sorting-algorithms in Python
Run JavaScript template async-operations
```

### Template Suggestions

```
# Get suggestions based on keywords
Suggest templates for data analysis
Recommend templates for sorting
Show me templates about statistics
```

## Advanced Usage

### Template Parameters

Some templates support input parameters (this feature is extensible):

```python
# Example of parameterized template usage
# (Implementation can be extended to support this)
Run template data-analysis with {"dataset": "sales_data.csv"}
```

### Custom Templates

The template system is designed to be extensible. New templates can be added by:

1. Adding template definitions to `src/templates/javascript-templates.ts` or
   `src/templates/python-templates.ts`
2. Following the template interface structure
3. Adding appropriate tests

### Template Structure

```typescript
interface CodeTemplate {
  name: string; // Unique identifier
  description: string; // Human-readable description
  code: string; // Executable code
  category: string; // Category for organization
  inputs?: InputDefinition[]; // Optional input parameters
  requirements?: string[]; // Required packages (Python)
  expectedOutput?: string; // Expected output for validation
}
```

## Error Handling

The template system includes comprehensive error handling:

- **Template Not Found**: Clear error messages for non-existent templates
- **Execution Errors**: Detailed error information with tracebacks
- **Invalid Parameters**: Validation of template parameters
- **Missing Requirements**: Information about missing dependencies

## Testing

All templates include comprehensive test coverage:

- **Unit Tests**: Template structure and functionality validation
- **E2E Tests**: Real execution in E2B sandboxes
- **Integration Tests**: Template action integration with agent runtime

### Running Tests

```bash
# Run all tests
elizaos test

# Run specific test suites
bun test src/__tests__/unit/templates.test.ts
```

## Best Practices

### When to Use Templates

- **Learning**: Explore language features and common patterns
- **Prototyping**: Quick start for common tasks
- **Reference**: Examples of best practices
- **Testing**: Validate environment capabilities

### Template Selection

- Use `suggest` commands to find relevant templates
- Browse categories to discover capabilities
- Start with basic templates before moving to advanced ones

### Customization

- Templates provide starting points - modify as needed
- Combine multiple templates for complex workflows
- Use template patterns in your own code

## Performance Considerations

- Templates are cached after first load
- Code generation is fast and lightweight
- E2B execution time depends on template complexity
- Some templates require additional packages (installation time)

## Contributing

To add new templates:

1. Define the template in the appropriate language file
2. Add comprehensive tests
3. Update documentation
4. Ensure code follows established patterns
5. Test in real E2B environment

## Support and Troubleshooting

### Common Issues

1. **Template Not Found**: Check spelling and available templates with
   `List all available templates`
2. **Execution Errors**: Review error messages and check requirements
3. **Missing Packages**: Some Python templates require additional packages
4. **Timeout Errors**: Complex templates may need more execution time

### Getting Help

- List all templates to see what's available
- Use suggestion commands to find relevant templates
- Check template categories for organized browsing
- Review error messages for specific guidance

## Examples

### Data Analysis Workflow

```
# 1. Explore available templates
Suggest templates for data analysis

# 2. Start with basic statistics
Run template basic-statistics in Python

# 3. Move to visualization
Run template data-visualization in Python

# 4. Advanced analysis
Run template pandas-data-analysis in Python
```

### Web Development Workflow

```
# 1. JavaScript fundamentals
Run template variables-and-types in JavaScript

# 2. Async patterns
Run template async-operations in JavaScript

# 3. API interaction (Python)
Run template api-interaction in Python
```

### Algorithm Learning

```
# 1. Start with sorting
Run template sorting-algorithms in Python

# 2. Compare with JavaScript
Run template sorting-algorithms in JavaScript

# 3. Search algorithms
Run template search-algorithms in Python
```

This template system significantly enhances the E2B plugin's capabilities,
providing users with immediate access to well-tested, documented code examples
that can be executed instantly in secure sandboxes.
