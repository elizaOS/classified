/**
 * Python Code Execution Templates for E2B Code Interpreter
 * Provides ready-to-use templates for common Python tasks
 */

export interface PythonTemplate {
  name: string;
  description: string;
  code: string;
  category: string;
  inputs?: { name: string; type: string; description: string }[];
  requirements?: string[];
  expectedOutput?: string;
}

export const PYTHON_TEMPLATES: PythonTemplate[] = [
  // Basic Python Templates
  {
    name: 'hello-world',
    description: 'Simple Hello World example',
    category: 'basic',
    code: `print("Hello, World!")`,
    expectedOutput: 'Hello, World!',
  },
  {
    name: 'variables-and-types',
    description: 'Python variable types and operations',
    category: 'basic',
    code: `# Python variable types
string_var = "Hello"
int_var = 42
float_var = 3.14
bool_var = True
list_var = [1, 2, 3, 4, 5]
dict_var = {"name": "John", "age": 30}
tuple_var = (1, 2, 3)
set_var = {1, 2, 3, 4, 5}

print(f"String: {string_var} (type: {type(string_var).__name__})")
print(f"Integer: {int_var} (type: {type(int_var).__name__})")
print(f"Float: {float_var} (type: {type(float_var).__name__})")
print(f"Boolean: {bool_var} (type: {type(bool_var).__name__})")
print(f"List: {list_var} (type: {type(list_var).__name__})")
print(f"Dictionary: {dict_var} (type: {type(dict_var).__name__})")
print(f"Tuple: {tuple_var} (type: {type(tuple_var).__name__})")
print(f"Set: {set_var} (type: {type(set_var).__name__})")`,
  },
  {
    name: 'functions-and-classes',
    description: 'Python functions and classes',
    category: 'basic',
    code: `# Function definition
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

# Lambda function
square = lambda x: x ** 2

# Class definition
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def introduce(self):
        return f"Hi, I'm {self.name} and I'm {self.age} years old."
    
    def have_birthday(self):
        self.age += 1
        return f"Happy birthday! {self.name} is now {self.age}."

# Usage examples
print(greet("World"))
print(greet("Alice", "Hi"))
print(f"5 squared is {square(5)}")

person = Person("Bob", 25)
print(person.introduce())
print(person.have_birthday())`,
  },

  // Data Science Templates
  {
    name: 'basic-statistics',
    description: 'Statistical calculations with Python',
    category: 'data-science',
    requirements: ['numpy'],
    code: `import numpy as np
import statistics

# Sample data
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 8, 6, 4, 2, 5, 7, 9, 3, 1, 10]

# Basic statistics
print("Data:", data)
print(f"Count: {len(data)}")
print(f"Sum: {sum(data)}")
print(f"Mean: {statistics.mean(data):.2f}")
print(f"Median: {statistics.median(data)}")
print(f"Mode: {statistics.mode(data)}")
print(f"Standard deviation: {statistics.stdev(data):.2f}")
print(f"Variance: {statistics.variance(data):.2f}")
print(f"Min: {min(data)}")
print(f"Max: {max(data)}")

# Using numpy
np_data = np.array(data)
print(f"\\nUsing NumPy:")
print(f"Mean: {np.mean(np_data):.2f}")
print(f"Std: {np.std(np_data):.2f}")
print(f"25th percentile: {np.percentile(np_data, 25)}")
print(f"75th percentile: {np.percentile(np_data, 75)}")`,
  },
  {
    name: 'data-visualization',
    description: 'Creating charts and plots',
    category: 'data-science',
    requirements: ['matplotlib', 'numpy'],
    code: `import matplotlib.pyplot as plt
import numpy as np

# Generate sample data
x = np.linspace(0, 10, 100)
y1 = np.sin(x)
y2 = np.cos(x)

# Create plots
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

# Line plot
ax1.plot(x, y1, label='sin(x)', linewidth=2)
ax1.plot(x, y2, label='cos(x)', linewidth=2)
ax1.set_title('Trigonometric Functions')
ax1.set_xlabel('x')
ax1.set_ylabel('y')
ax1.legend()
ax1.grid(True)

# Bar chart
categories = ['A', 'B', 'C', 'D', 'E']
values = [23, 45, 56, 78, 32]
ax2.bar(categories, values, color=['red', 'blue', 'green', 'orange', 'purple'])
ax2.set_title('Sample Bar Chart')
ax2.set_xlabel('Categories')
ax2.set_ylabel('Values')

plt.tight_layout()
plt.savefig('plots.png', dpi=150, bbox_inches='tight')
print("Plots saved as 'plots.png'")
plt.show()`,
  },
  {
    name: 'pandas-data-analysis',
    description: 'Data analysis with pandas',
    category: 'data-science',
    requirements: ['pandas', 'numpy'],
    code: `import pandas as pd
import numpy as np

# Create sample dataset
np.random.seed(42)
data = {
    'Name': ['Alice', 'Bob', 'Charlie', 'Diana', 'Eva', 'Frank', 'Grace', 'Henry'],
    'Age': np.random.randint(20, 60, 8),
    'Department': ['IT', 'HR', 'IT', 'Finance', 'IT', 'HR', 'Finance', 'IT'],
    'Salary': np.random.randint(40000, 120000, 8),
    'Experience': np.random.randint(1, 20, 8)
}

df = pd.DataFrame(data)

print("Dataset:")
print(df)
print()

print("Dataset Info:")
print(df.info())
print()

print("Statistical Summary:")
print(df.describe())
print()

print("Group by Department:")
dept_summary = df.groupby('Department').agg({
    'Salary': ['mean', 'min', 'max'],
    'Age': 'mean',
    'Experience': 'mean'
})
print(dept_summary)
print()

print("Top 3 highest salaries:")
print(df.nlargest(3, 'Salary')[['Name', 'Department', 'Salary']])`,
  },

  // Web Development Templates
  {
    name: 'web-scraping',
    description: 'Basic web scraping example',
    category: 'web-development',
    requirements: ['requests', 'beautifulsoup4'],
    code: `import requests
from bs4 import BeautifulSoup
import json

# Note: This is a demonstration - actual web scraping should respect robots.txt
# Using a mock HTML structure for demonstration

html_content = """
<html>
<head><title>Sample Page</title></head>
<body>
    <h1>News Headlines</h1>
    <div class="article">
        <h2>Technology News</h2>
        <p>Latest developments in AI and machine learning.</p>
        <span class="date">2024-01-15</span>
    </div>
    <div class="article">
        <h2>Science Discovery</h2>
        <p>New breakthrough in quantum computing research.</p>
        <span class="date">2024-01-14</span>
    </div>
    <div class="article">
        <h2>Business Update</h2>
        <p>Market trends and economic indicators.</p>
        <span class="date">2024-01-13</span>
    </div>
</body>
</html>
"""

# Parse HTML
soup = BeautifulSoup(html_content, 'html.parser')

# Extract data
articles = []
for article in soup.find_all('div', class_='article'):
    title = article.find('h2').text
    content = article.find('p').text
    date = article.find('span', class_='date').text
    
    articles.append({
        'title': title,
        'content': content,
        'date': date
    })

print("Extracted Articles:")
for i, article in enumerate(articles, 1):
    print(f"\\n{i}. {article['title']}")
    print(f"   Date: {article['date']}")
    print(f"   Content: {article['content']}")

print(f"\\nTotal articles found: {len(articles)}")`,
  },
  {
    name: 'api-interaction',
    description: 'Working with REST APIs',
    category: 'web-development',
    requirements: ['requests'],
    code: `import requests
import json

# Mock API responses for demonstration
def mock_api_call(endpoint):
    # Simulating different API endpoints
    responses = {
        'users': [
            {'id': 1, 'name': 'John Doe', 'email': 'john@example.com'},
            {'id': 2, 'name': 'Jane Smith', 'email': 'jane@example.com'}
        ],
        'posts': [
            {'id': 1, 'title': 'First Post', 'userId': 1, 'content': 'Hello world!'},
            {'id': 2, 'title': 'Second Post', 'userId': 2, 'content': 'Python is great!'}
        ]
    }
    return responses.get(endpoint, {})

# Simulate API calls
print("Fetching users...")
users = mock_api_call('users')
print(json.dumps(users, indent=2))

print("\\nFetching posts...")
posts = mock_api_call('posts')
print(json.dumps(posts, indent=2))

# Data processing
print("\\nCombining user and post data:")
for post in posts:
    user = next((u for u in users if u['id'] == post['userId']), None)
    if user:
        print(f"Post '{post['title']}' by {user['name']} ({user['email']})")
        print(f"Content: {post['content']}\\n")

# Error handling example
def safe_api_call(endpoint):
    try:
        data = mock_api_call(endpoint)
        if not data:
            raise ValueError(f"No data found for endpoint: {endpoint}")
        return data
    except Exception as e:
        print(f"Error fetching {endpoint}: {e}")
        return None

print("Testing error handling:")
result = safe_api_call('invalid_endpoint')
print(f"Result: {result}")`,
  },

  // Algorithms and Problem Solving
  {
    name: 'sorting-algorithms',
    description: 'Common sorting algorithms',
    category: 'algorithms',
    code: `import time
import random

def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    result = []
    i = j = 0
    
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    
    result.extend(left[i:])
    result.extend(right[j:])
    return result

# Test with sample data
data = [64, 34, 25, 12, 22, 11, 90, 88, 76, 50, 42]
print("Original array:", data)

# Test each algorithm
algorithms = [
    ("Bubble Sort", bubble_sort),
    ("Quick Sort", quick_sort),
    ("Merge Sort", merge_sort),
    ("Built-in Sort", lambda x: sorted(x))
]

for name, algorithm in algorithms:
    test_data = data.copy()
    start_time = time.time()
    sorted_data = algorithm(test_data)
    end_time = time.time()
    
    print(f"\\n{name}:")
    print(f"Result: {sorted_data}")
    print(f"Time: {(end_time - start_time) * 1000:.4f} ms")`,
  },
  {
    name: 'search-algorithms',
    description: 'Search algorithms implementation',
    category: 'algorithms',
    code: `def linear_search(arr, target):
    """Linear search - O(n) time complexity"""
    for i, value in enumerate(arr):
        if value == target:
            return i
    return -1

def binary_search(arr, target):
    """Binary search - O(log n) time complexity (requires sorted array)"""
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1

def binary_search_recursive(arr, target, left=0, right=None):
    """Recursive binary search"""
    if right is None:
        right = len(arr) - 1
    
    if left > right:
        return -1
    
    mid = (left + right) // 2
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, right)
    else:
        return binary_search_recursive(arr, target, left, mid - 1)

# Test data
unsorted_data = [64, 34, 25, 12, 22, 11, 90, 88, 76, 50, 42]
sorted_data = sorted(unsorted_data)
target = 22

print("Unsorted array:", unsorted_data)
print("Sorted array:", sorted_data)
print(f"Searching for: {target}")

# Linear search (works on unsorted data)
linear_result = linear_search(unsorted_data, target)
print(f"\\nLinear search result: {linear_result}")
if linear_result != -1:
    print(f"Found {target} at index {linear_result}")
else:
    print(f"{target} not found")

# Binary search (requires sorted data)
binary_result = binary_search(sorted_data, target)
print(f"\\nBinary search result: {binary_result}")
if binary_result != -1:
    print(f"Found {target} at index {binary_result}")
else:
    print(f"{target} not found")

# Recursive binary search
recursive_result = binary_search_recursive(sorted_data, target)
print(f"\\nRecursive binary search result: {recursive_result}")`,
  },

  // File and System Operations
  {
    name: 'file-operations',
    description: 'File reading, writing, and manipulation',
    category: 'file-system',
    code: `import os
import json
import csv
from datetime import datetime

# Create sample data
sample_data = {
    'timestamp': datetime.now().isoformat(),
    'user_id': 12345,
    'action': 'login',
    'metadata': {
        'ip_address': '192.168.1.1',
        'browser': 'Chrome'
    }
}

# JSON file operations
print("JSON File Operations:")
with open('sample_data.json', 'w') as f:
    json.dump(sample_data, f, indent=2)
print("✓ Created sample_data.json")

with open('sample_data.json', 'r') as f:
    loaded_data = json.load(f)
print("✓ Loaded data:", loaded_data['action'])

# CSV file operations
print("\\nCSV File Operations:")
csv_data = [
    ['Name', 'Age', 'City'],
    ['Alice', 30, 'New York'],
    ['Bob', 25, 'San Francisco'],
    ['Charlie', 35, 'Chicago']
]

with open('sample_data.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(csv_data)
print("✓ Created sample_data.csv")

with open('sample_data.csv', 'r') as f:
    reader = csv.reader(f)
    rows = list(reader)
    print("✓ CSV data:")
    for row in rows:
        print("  ", row)

# Text file operations
print("\\nText File Operations:")
text_content = """This is a sample text file.
It contains multiple lines.
Each line is separated by newline characters.
This is useful for logging and data storage."""

with open('sample.txt', 'w') as f:
    f.write(text_content)
print("✓ Created sample.txt")

with open('sample.txt', 'r') as f:
    lines = f.readlines()
print(f"✓ Read {len(lines)} lines")

# File system operations
print("\\nFile System Operations:")
print(f"Current directory: {os.getcwd()}")
print(f"Files in directory: {os.listdir('.')}")

# Clean up
for filename in ['sample_data.json', 'sample_data.csv', 'sample.txt']:
    if os.path.exists(filename):
        os.remove(filename)
        print(f"✓ Cleaned up {filename}")`,
  },

  // Mathematics and Scientific Computing
  {
    name: 'mathematical-computations',
    description: 'Advanced mathematical operations',
    category: 'mathematics',
    requirements: ['numpy', 'scipy'],
    code: `import numpy as np
import math
from scipy import optimize, integrate

# Basic mathematical operations
print("Basic Math Operations:")
print(f"π = {math.pi:.6f}")
print(f"e = {math.e:.6f}")
print(f"sin(π/2) = {math.sin(math.pi/2):.6f}")
print(f"ln(e) = {math.log(math.e):.6f}")
print(f"2^10 = {2**10}")
print(f"√64 = {math.sqrt(64)}")

# NumPy array operations
print("\\nNumPy Array Operations:")
a = np.array([1, 2, 3, 4, 5])
b = np.array([6, 7, 8, 9, 10])

print(f"Array a: {a}")
print(f"Array b: {b}")
print(f"a + b = {a + b}")
print(f"a * b = {a * b}")
print(f"dot product = {np.dot(a, b)}")

# Matrix operations
print("\\nMatrix Operations:")
matrix1 = np.array([[1, 2], [3, 4]])
matrix2 = np.array([[5, 6], [7, 8]])

print(f"Matrix 1:\\n{matrix1}")
print(f"Matrix 2:\\n{matrix2}")
print(f"Matrix multiplication:\\n{np.matmul(matrix1, matrix2)}")
print(f"Matrix 1 determinant: {np.linalg.det(matrix1):.2f}")

# Polynomial operations
print("\\nPolynomial Operations:")
# Polynomial: x^2 - 5x + 6 = (x-2)(x-3)
coeffs = [1, -5, 6]  # coefficients for x^2 - 5x + 6
roots = np.roots(coeffs)
print(f"Roots of x² - 5x + 6: {roots}")

# Numerical integration
print("\\nNumerical Integration:")
def integrand(x):
    return x**2

result, error = integrate.quad(integrand, 0, 2)
print(f"∫₀² x² dx = {result:.6f} (error: {error:.2e})")
print(f"Analytical result: {2**3/3:.6f}")

# Function optimization
print("\\nFunction Optimization:")
def objective(x):
    return (x - 2)**2 + 1

result = optimize.minimize_scalar(objective)
print(f"Minimum of (x-2)² + 1: x = {result.x:.6f}, f(x) = {result.fun:.6f}")`,
  },

  // Text Processing and NLP
  {
    name: 'text-processing',
    description: 'Text analysis and processing',
    category: 'text-processing',
    code: `import re
import string
from collections import Counter

# Sample text
text = """
Natural Language Processing (NLP) is a fascinating field that combines 
computer science, artificial intelligence, and linguistics. It enables 
computers to understand, interpret, and generate human language in a 
valuable way. Applications of NLP include machine translation, sentiment 
analysis, chatbots, and text summarization.
"""

print("Original text:")
print(text.strip())

# Basic text statistics
print("\\nText Statistics:")
print(f"Character count: {len(text)}")
print(f"Word count: {len(text.split())}")
print(f"Line count: {len(text.strip().split('\\n'))}")

# Text cleaning
print("\\nText Cleaning:")
clean_text = text.lower().strip()
clean_text = re.sub(r'[^a-zA-Z\\s]', '', clean_text)
words = clean_text.split()
print(f"Cleaned words: {words[:10]}...")  # Show first 10 words

# Word frequency analysis
print("\\nWord Frequency Analysis:")
word_freq = Counter(words)
most_common = word_freq.most_common(5)
print("Most common words:")
for word, count in most_common:
    print(f"  {word}: {count}")

# Text patterns
print("\\nPattern Matching:")
email_pattern = r'\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b'
phone_pattern = r'\\b\\d{3}-\\d{3}-\\d{4}\\b'

sample_contact = "Contact John at john.doe@email.com or call 555-123-4567"
emails = re.findall(email_pattern, sample_contact)
phones = re.findall(phone_pattern, sample_contact)

print(f"Found emails: {emails}")
print(f"Found phone numbers: {phones}")

# Simple sentiment analysis (basic approach)
print("\\nBasic Sentiment Analysis:")
positive_words = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic']
negative_words = ['bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointing']

test_sentences = [
    "This product is amazing and wonderful!",
    "The service was terrible and disappointing.",
    "It's okay, nothing special.",
    "Excellent quality and great value!"
]

for sentence in test_sentences:
    words_in_sentence = sentence.lower().split()
    positive_count = sum(1 for word in words_in_sentence if word in positive_words)
    negative_count = sum(1 for word in words_in_sentence if word in negative_words)
    
    if positive_count > negative_count:
        sentiment = "Positive"
    elif negative_count > positive_count:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"
    
    print(f"'{sentence}' -> {sentiment}")`,
  },
];

/**
 * Get template by name
 */
export function getPythonTemplate(name: string): PythonTemplate | undefined {
  return PYTHON_TEMPLATES.find((template) => template.name === name);
}

/**
 * Get templates by category
 */
export function getPythonTemplatesByCategory(category: string): PythonTemplate[] {
  return PYTHON_TEMPLATES.filter((template) => template.category === category);
}

/**
 * Get all available categories
 */
export function getPythonCategories(): string[] {
  return [...new Set(PYTHON_TEMPLATES.map((template) => template.category))];
}

/**
 * Generate runnable Python code from template
 */
export function generatePythonCode(templateName: string, inputs?: Record<string, any>): string {
  const template = getPythonTemplate(templateName);
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
