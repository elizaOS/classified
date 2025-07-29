#!/bin/bash

# Find all route files with exported handle* functions
echo "Finding routes with exported handle* functions..."

find app/api -name "*.ts" -type f | while read file; do
  # Check if file has exported handle* functions
  if grep -q "export async function handle\(GET\|POST\|PUT\|DELETE\|PATCH\|HEAD\|OPTIONS\)" "$file"; then
    # Check if already has proper exports
    if ! grep -q "export const { \(GET\|POST\|PUT\|DELETE\|PATCH\|HEAD\|OPTIONS\)" "$file" && \
       ! grep -q "export const \(GET\|POST\|PUT\|DELETE\|PATCH\|HEAD\|OPTIONS\) =" "$file" || \
       grep -q "export const \(GET\|POST\|PUT\|DELETE\|PATCH\|HEAD\|OPTIONS\) = handle" "$file"; then
      
      echo "Fixing $file..."
      
      # Create a temporary file
      tmp_file=$(mktemp)
      
      # Process the file
      awk '
        BEGIN { 
          has_wrapHandlers = 0
          import_added = 0
        }
        
        # Check if wrapHandlers is already imported
        /wrapHandlers/ { has_wrapHandlers = 1 }
        
        # Add import after next/server import if not present
        /import.*from.*next\/server/ && !import_added && !has_wrapHandlers {
          print
          print "import { wrapHandlers } from '\''@/lib/api/route-wrapper'\'';"
          import_added = 1
          next
        }
        
        # Remove export from handle* functions
        /export async function handle(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/ {
          gsub(/export /, "", $0)
        }
        
        # Skip direct exports like export const GET = handleGET
        /export const (GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) = handle/ { next }
        
        # Print all other lines
        { print }
      ' "$file" > "$tmp_file"
      
      # Find all handle* functions and add proper exports
      functions=$(grep -o "async function handle\(GET\|POST\|PUT\|DELETE\|PATCH\|HEAD\|OPTIONS\)" "$file" | sed 's/async function //')
      
      if [ ! -z "$functions" ]; then
        # Build export statement
        methods=""
        handlers=""
        for func in $functions; do
          method=${func#handle}
          if [ -z "$methods" ]; then
            methods="$method"
            handlers="$func"
          else
            methods="$methods, $method"
            handlers="$handlers, $func"
          fi
        done
        
        echo "" >> "$tmp_file"
        echo "export const { $methods } = wrapHandlers({ $handlers });" >> "$tmp_file"
      fi
      
      # Replace original file
      mv "$tmp_file" "$file"
    fi
  fi
done

echo "Done!" 