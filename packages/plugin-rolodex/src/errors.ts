// Error classes for the rolodex plugin
// Isolated in a separate file to avoid initialization issues

export class EntityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityNotFoundError';
  }
}

export class WorldNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldNotFoundError';
  }
}
