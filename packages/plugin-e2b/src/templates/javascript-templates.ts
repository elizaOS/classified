/**
 * JavaScript Code Execution Templates for E2B Code Interpreter
 * Provides ready-to-use templates for common JavaScript tasks
 */

export interface JavaScriptTemplate {
  name: string;
  description: string;
  code: string;
  category: string;
  inputs?: { name: string; type: string; description: string }[];
  expectedOutput?: string;
}

export const JAVASCRIPT_TEMPLATES: JavaScriptTemplate[] = [
  // Basic JavaScript Templates
  {
    name: 'hello-world',
    description: 'Simple Hello World example',
    category: 'basic',
    code: `console.log('Hello, World!');`,
    expectedOutput: 'Hello, World!',
  },
  {
    name: 'variables-and-types',
    description: 'Demonstrates JavaScript variable types',
    category: 'basic',
    code: `// JavaScript variable types
let stringVar = "Hello";
let numberVar = 42;
let booleanVar = true;
let arrayVar = [1, 2, 3, 4, 5];
let objectVar = { name: "John", age: 30 };

console.log("String:", stringVar, typeof stringVar);
console.log("Number:", numberVar, typeof numberVar);
console.log("Boolean:", booleanVar, typeof booleanVar);
console.log("Array:", arrayVar, Array.isArray(arrayVar));
console.log("Object:", objectVar, typeof objectVar);`,
  },
  {
    name: 'functions',
    description: 'JavaScript function examples',
    category: 'basic',
    code: `// Function declarations
function greet(name) {
    return \`Hello, \${name}!\`;
}

// Arrow functions
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;

// Higher-order functions
const numbers = [1, 2, 3, 4, 5];
const squared = numbers.map(x => x * x);
const filtered = numbers.filter(x => x % 2 === 0);

console.log(greet("World"));
console.log("Add:", add(5, 3));
console.log("Multiply:", multiply(4, 7));
console.log("Squared:", squared);
console.log("Even numbers:", filtered);`,
  },

  // Data Processing Templates
  {
    name: 'array-operations',
    description: 'Common array operations and methods',
    category: 'data-processing',
    code: `const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Array methods
console.log("Original array:", data);
console.log("Sum:", data.reduce((acc, curr) => acc + curr, 0));
console.log("Average:", data.reduce((acc, curr) => acc + curr, 0) / data.length);
console.log("Max:", Math.max(...data));
console.log("Min:", Math.min(...data));

// Filter, map, reduce
const evenNumbers = data.filter(n => n % 2 === 0);
const doubled = data.map(n => n * 2);
const product = data.reduce((acc, curr) => acc * curr, 1);

console.log("Even numbers:", evenNumbers);
console.log("Doubled:", doubled);
console.log("Product:", product);`,
  },
  {
    name: 'object-manipulation',
    description: 'Working with JavaScript objects',
    category: 'data-processing',
    code: `const person = {
    name: "Alice",
    age: 28,
    city: "San Francisco",
    hobbies: ["reading", "coding", "hiking"]
};

// Object operations
console.log("Original object:", person);
console.log("Keys:", Object.keys(person));
console.log("Values:", Object.values(person));
console.log("Entries:", Object.entries(person));

// Destructuring
const { name, age, ...rest } = person;
console.log("Destructured:", { name, age, rest });

// Object transformation
const personInfo = Object.entries(person)
    .map(([key, value]) => \`\${key}: \${value}\`)
    .join(", ");
console.log("Person info:", personInfo);`,
  },
  {
    name: 'json-processing',
    description: 'JSON parsing and manipulation',
    category: 'data-processing',
    code: `// Sample JSON data
const jsonString = '{"users":[{"id":1,"name":"John","active":true},{"id":2,"name":"Jane","active":false},{"id":3,"name":"Bob","active":true}]}';

// Parse JSON
const data = JSON.parse(jsonString);
console.log("Parsed data:", data);

// Filter active users
const activeUsers = data.users.filter(user => user.active);
console.log("Active users:", activeUsers);

// Transform data
const userNames = data.users.map(user => user.name.toUpperCase());
console.log("User names (uppercase):", userNames);

// Create new JSON
const summary = {
    totalUsers: data.users.length,
    activeUsers: activeUsers.length,
    userNames: userNames
};

console.log("Summary:", JSON.stringify(summary, null, 2));`,
  },

  // Algorithm Templates
  {
    name: 'sorting-algorithms',
    description: 'Common sorting algorithms implementation',
    category: 'algorithms',
    code: `// Bubble Sort
function bubbleSort(arr) {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            }
        }
    }
    return arr;
}

// Quick Sort
function quickSort(arr) {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter(x => x < pivot);
    const middle = arr.filter(x => x === pivot);
    const right = arr.filter(x => x > pivot);
    return [...quickSort(left), ...middle, ...quickSort(right)];
}

const numbers = [64, 34, 25, 12, 22, 11, 90];
console.log("Original:", numbers);
console.log("Bubble Sort:", bubbleSort([...numbers]));
console.log("Quick Sort:", quickSort([...numbers]));`,
  },
  {
    name: 'search-algorithms',
    description: 'Binary search implementation',
    category: 'algorithms',
    code: `// Binary Search
function binarySearch(arr, target) {
    let left = 0;
    let right = arr.length - 1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (arr[mid] === target) {
            return mid;
        } else if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    return -1;
}

const sortedArray = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const target = 7;

console.log("Array:", sortedArray);
console.log(\`Searching for \${target}\`);
console.log("Index:", binarySearch(sortedArray, target));

// Linear search for comparison
function linearSearch(arr, target) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === target) return i;
    }
    return -1;
}

console.log("Linear search index:", linearSearch(sortedArray, target));`,
  },

  // Web Development Templates
  {
    name: 'dom-manipulation',
    description: 'DOM manipulation examples (Node.js compatible)',
    category: 'web-development',
    code: `// Simulating DOM-like operations with objects
function createElement(tag, props = {}, children = []) {
    return {
        tag,
        props,
        children,
        appendChild(child) {
            this.children.push(child);
        },
        innerHTML() {
            return \`<\${this.tag}>\${this.children.map(c => 
                typeof c === 'string' ? c : c.innerHTML()
            ).join('')}</\${this.tag}>\`;
        }
    };
}

// Create virtual DOM structure
const div = createElement('div', { id: 'container' });
const h1 = createElement('h1', {}, ['Hello, World!']);
const p = createElement('p', {}, ['This is a paragraph.']);

div.appendChild(h1);
div.appendChild(p);

console.log("Virtual DOM structure:");
console.log(div.innerHTML());`,
  },
  {
    name: 'async-operations',
    description: 'Asynchronous JavaScript patterns',
    category: 'web-development',
    code: `// Promise-based operations
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchData(id) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (id > 0) {
                resolve({ id, name: \`User \${id}\`, timestamp: Date.now() });
            } else {
                reject(new Error('Invalid ID'));
            }
        }, 100);
    });
}

// Async/await example
async function processData() {
    try {
        console.log("Starting async operations...");
        
        const user1 = await fetchData(1);
        console.log("User 1:", user1);
        
        const user2 = await fetchData(2);
        console.log("User 2:", user2);
        
        // Parallel operations
        const [user3, user4] = await Promise.all([
            fetchData(3),
            fetchData(4)
        ]);
        
        console.log("Users 3 & 4:", { user3, user4 });
        
        console.log("All operations completed!");
    } catch (error) {
        console.error("Error:", error.message);
    }
}

// Execute async function
processData();`,
  },

  // Utility Templates
  {
    name: 'date-time-operations',
    description: 'Date and time manipulation',
    category: 'utilities',
    code: `const now = new Date();

console.log("Current date/time:", now);
console.log("ISO string:", now.toISOString());
console.log("Locale string:", now.toLocaleString());

// Date calculations
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);

const nextWeek = new Date(now);
nextWeek.setDate(nextWeek.getDate() + 7);

console.log("Tomorrow:", tomorrow.toDateString());
console.log("Next week:", nextWeek.toDateString());

// Time difference
const timeDiff = nextWeek - now;
const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
console.log("Days until next week:", daysDiff);

// Formatting
function formatDate(date) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

console.log("Formatted:", formatDate(now));`,
  },
  {
    name: 'string-operations',
    description: 'String manipulation and regex',
    category: 'utilities',
    code: `const text = "The quick brown fox jumps over the lazy dog";

// Basic string operations
console.log("Original:", text);
console.log("Length:", text.length);
console.log("Uppercase:", text.toUpperCase());
console.log("Words:", text.split(' '));

// String methods
console.log("Starts with 'The':", text.startsWith('The'));
console.log("Includes 'fox':", text.includes('fox'));
console.log("Index of 'fox':", text.indexOf('fox'));

// Regular expressions
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
const emails = "Contact us at: support@example.com or admin@test.org";
const foundEmails = emails.match(emailPattern);
console.log("Found emails:", foundEmails);

// String replacement
const replaced = text.replace(/fox|dog/g, 'animal');
console.log("Replaced:", replaced);

// Template literals
const name = "Alice";
const age = 30;
const message = \`Hello, my name is \${name} and I am \${age} years old.\`;
console.log("Template literal:", message);`,
  },

  // Mathematical Templates
  {
    name: 'mathematical-operations',
    description: 'Mathematical calculations and statistics',
    category: 'mathematics',
    code: `const numbers = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

// Basic statistics
function calculateStats(arr) {
    const sum = arr.reduce((a, b) => a + b, 0);
    const mean = sum / arr.length;
    const sorted = [...arr].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    
    const variance = arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
    const stdDev = Math.sqrt(variance);
    
    return { sum, mean, median, variance, stdDev, min: Math.min(...arr), max: Math.max(...arr) };
}

const stats = calculateStats(numbers);
console.log("Numbers:", numbers);
console.log("Statistics:", stats);

// Mathematical functions
console.log("\\nMath operations:");
console.log("π =", Math.PI);
console.log("e =", Math.E);
console.log("sin(π/2) =", Math.sin(Math.PI / 2));
console.log("log(10) =", Math.log10(10));
console.log("2^10 =", Math.pow(2, 10));
console.log("√64 =", Math.sqrt(64));`,
  },
];

/**
 * Get template by name
 */
export function getJavaScriptTemplate(name: string): JavaScriptTemplate | undefined {
  return JAVASCRIPT_TEMPLATES.find((template) => template.name === name);
}

/**
 * Get templates by category
 */
export function getJavaScriptTemplatesByCategory(category: string): JavaScriptTemplate[] {
  return JAVASCRIPT_TEMPLATES.filter((template) => template.category === category);
}

/**
 * Get all available categories
 */
export function getJavaScriptCategories(): string[] {
  return [...new Set(JAVASCRIPT_TEMPLATES.map((template) => template.category))];
}

/**
 * Generate runnable JavaScript code from template
 */
export function generateJavaScriptCode(templateName: string, inputs?: Record<string, any>): string {
  const template = getJavaScriptTemplate(templateName);
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  let code = template.code;

  // Replace input placeholders if provided
  if (inputs && template.inputs) {
    for (const input of template.inputs) {
      const placeholder = `{{${input.name}}}`;
      const value = inputs[input.name];
      if (value !== undefined) {
        code = code.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }
  }

  return code;
}
