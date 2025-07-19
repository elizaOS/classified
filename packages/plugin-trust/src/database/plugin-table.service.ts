import type { IDatabaseAdapter, UUID } from '@elizaos/core';

/**
 * Service for providing type-safe access to plugin tables
 */
export class PluginTableService {
  constructor(
    private readonly db: IDatabaseAdapter,
    private readonly pluginName: string
  ) {}

  /**
   * Get a type-safe table accessor
   * @param tableName The name of the table
   * @returns A table accessor with CRUD operations
   */
  table<T extends { id: UUID }>(tableName: string) {
    const fullTableName = this.db.getPluginTableName(this.pluginName, tableName);
    const schema = this.db.getPluginSchema(this.pluginName);
    const db = this.db;

    return {
      /**
       * Find records matching the given criteria
       */
      async find(params?: {
        where?: Partial<T>;
        orderBy?: Array<{ column: keyof T; direction: 'asc' | 'desc' }>;
        limit?: number;
        offset?: number;
      }): Promise<T[]> {
        return db.getFromTable<T>({
          tableName: fullTableName,
          schema,
          where: params?.where as Record<string, any>,
          orderBy: params?.orderBy?.map((o) => ({
            column: o.column as string,
            direction: o.direction,
          })),
          limit: params?.limit,
          offset: params?.offset,
        });
      },

      /**
       * Find a single record matching the criteria
       */
      async findOne(where: Partial<T>): Promise<T | null> {
        return db.getOneFromTable<T>({
          tableName: fullTableName,
          schema,
          where: where as Record<string, any>,
        });
      },

      /**
       * Find a record by ID
       */
      async findById(id: UUID): Promise<T | null> {
        return this.findOne({ id } as Partial<T>);
      },

      /**
       * Insert new records
       */
      async insert(data: Omit<T, 'id'> | Array<Omit<T, 'id'>>): Promise<T[]> {
        const dataArray = Array.isArray(data) ? data : [data];
        const withIds = dataArray.map((d) => ({
          ...d,
          id: (d as any).id || (`${Date.now()}-${Math.random()}` as UUID),
        }));

        return db.insertIntoTable<T>({
          tableName: fullTableName,
          schema,
          data: withIds as Partial<T>[],
          returning: ['*'],
        });
      },

      /**
       * Update records matching the criteria
       */
      async update(where: Partial<T>, data: Partial<Omit<T, 'id'>>): Promise<T[]> {
        return db.updateTable<T>({
          tableName: fullTableName,
          schema,
          where: where as Record<string, any>,
          data: data as Partial<T>,
          returning: ['*'],
        });
      },

      /**
       * Update a record by ID
       */
      async updateById(id: UUID, data: Partial<Omit<T, 'id'>>): Promise<T | null> {
        const results = await this.update({ id } as Partial<T>, data);
        return results[0] || null;
      },

      /**
       * Delete records matching the criteria
       */
      async delete(where: Partial<T>): Promise<number> {
        return db.deleteFromTable({
          tableName: fullTableName,
          schema,
          where: where as Record<string, any>,
        });
      },

      /**
       * Delete a record by ID
       */
      async deleteById(id: UUID): Promise<boolean> {
        const count = await this.delete({ id } as Partial<T>);
        return count > 0;
      },

      /**
       * Count records matching the criteria
       */
      async count(where?: Partial<T>): Promise<number> {
        const results = await this.find({ where });
        return results.length;
      },

      /**
       * Check if a record exists
       */
      async exists(where: Partial<T>): Promise<boolean> {
        const record = await this.findOne(where);
        return record !== null;
      },
    };
  }
}
