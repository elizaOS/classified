# ElizaOS Agent Server

The agent server provides a complete runtime environment for ElizaOS agents with PostgreSQL database support.

## Development Commands

### `bun run dev`
- **Resets the PostgreSQL database** by dropping and recreating `eliza_game`
- Runs all migrations from scratch
- Ensures a clean development environment
- Use this when you want a fresh start or encounter database issues

### `bun run dev:no-reset`
- Starts the server without resetting the database
- Preserves existing data
- Use this for iterative development when you want to keep your data

### `bun run start`
- Production mode - never resets the database
- Use this for production deployments

## Database Reset Behavior

When running `bun run dev`, the following happens:

1. **Drop existing database** - All data is deleted
2. **Create fresh database** - New `eliza_game` database created
3. **Install extensions**:
   - `uuid-ossp` - For UUID generation
   - `vector` - For embeddings/vector search
   - `fuzzystrmatch` - For fuzzy text matching
4. **Run server migrations** - Creates server-specific tables
5. **Run plugin migrations** - Creates core ElizaOS tables
6. **Start agent** - Agent runtime initializes with clean database

## Database Connection

The server expects PostgreSQL to be running on:
- **Docker/Container**: `eliza-postgres:5432`
- **Local Development**: `localhost:5433`

Default credentials:
- Database: `eliza_game`
- Username: `eliza`
- Password: `eliza_secure_pass`

## Environment Variables

- `RESET_DB=true` - Forces database reset (set automatically by `bun run dev`)
- `DATABASE_URL` or `POSTGRES_URL` - Override default PostgreSQL connection
- `NODE_ENV=development` - Development mode (allows database reset)
- `NODE_ENV=production` - Production mode (prevents database reset)

## Troubleshooting

### Database Tables Show Duplicates
If you see duplicate columns in database inspection output, the database schema may be corrupted. Run `bun run dev` to reset.

### Entity Creation Fails
This usually indicates a schema mismatch or corrupted migrations. Run `bun run dev` to reset the database.

### Array Type Errors
PostgreSQL arrays require proper formatting. The system handles this automatically, but if you see array-related errors, ensure you're using PostgreSQL (not PGLite). 