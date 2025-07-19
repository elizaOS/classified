import type { Plugin, ISchemaProvider } from '@elizaos/core';

import { FormsService } from './services/forms-service';
import { formsProvider } from './providers/forms-provider';
import { createFormAction } from './actions/create-form';
import { updateFormAction } from './actions/update-form';
import { cancelFormAction } from './actions/cancel-form';
import { FormsPluginTestSuite } from './tests';
import { formsSchema } from './schema';

// Export types
export * from './types';

// Export service
export { FormsService };

// Export provider
export { formsProvider };

// Export actions
export { createFormAction, updateFormAction, cancelFormAction };

// Export schema
export { formsSchema };

/**
 * Schema provider for forms plugin dynamic migration
 */
const formsSchemaProvider: ISchemaProvider = {
  getPluginName: () => '@elizaos/plugin-forms',
  getSchemaDefinition: () => ({
    version: '1.0.0',
    tables: [
      {
        name: 'forms',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'agent_id', type: 'uuid', notNull: true },
          { name: 'name', type: 'text', notNull: true },
          { name: 'description', type: 'text' },
          { name: 'status', type: 'text', notNull: true },
          { name: 'current_step_index', type: 'integer', notNull: true, defaultValue: 0 },
          { name: 'steps', type: 'json', notNull: true },
          { name: 'created_at', type: 'timestamp', notNull: true },
          { name: 'updated_at', type: 'timestamp', notNull: true },
          { name: 'completed_at', type: 'timestamp' },
          { name: 'metadata', type: 'json', notNull: true, defaultValue: '{}' }
        ],
        indexes: [
          { name: 'idx_forms_agent', columns: ['agent_id'] },
          { name: 'idx_forms_status', columns: ['status'] },
          { name: 'idx_forms_created_at', columns: ['created_at'] },
          { name: 'idx_forms_updated_at', columns: ['updated_at'] }
        ]
      },
      {
        name: 'form_fields',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'form_id', type: 'uuid', notNull: true, references: { table: 'forms', column: 'id', onDelete: 'CASCADE' } },
          { name: 'step_id', type: 'text', notNull: true },
          { name: 'field_id', type: 'text', notNull: true },
          { name: 'label', type: 'text', notNull: true },
          { name: 'type', type: 'text', notNull: true },
          { name: 'value', type: 'text' },
          { name: 'is_secret', type: 'boolean', notNull: true, defaultValue: false },
          { name: 'is_optional', type: 'boolean', notNull: true, defaultValue: false },
          { name: 'description', type: 'text' },
          { name: 'criteria', type: 'text' },
          { name: 'error', type: 'text' },
          { name: 'metadata', type: 'json', notNull: true, defaultValue: '{}' },
          { name: 'created_at', type: 'timestamp', notNull: true },
          { name: 'updated_at', type: 'timestamp', notNull: true }
        ],
        indexes: [
          { name: 'idx_form_fields_form', columns: ['form_id'] },
          { name: 'idx_form_fields_step', columns: ['step_id'] },
          { name: 'idx_form_fields_field', columns: ['field_id'] },
          { name: 'idx_form_step_field', columns: ['form_id', 'step_id', 'field_id'] }
        ],
        dependencies: ['forms']
      },
      {
        name: 'form_templates',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'agent_id', type: 'uuid' },
          { name: 'name', type: 'text', notNull: true },
          { name: 'description', type: 'text' },
          { name: 'steps', type: 'json', notNull: true },
          { name: 'metadata', type: 'json', notNull: true, defaultValue: '{}' },
          { name: 'created_at', type: 'timestamp', notNull: true },
          { name: 'updated_at', type: 'timestamp', notNull: true }
        ],
        indexes: [
          { name: 'idx_form_templates_name', columns: ['name'] },
          { name: 'idx_form_templates_agent', columns: ['agent_id'] }
        ]
      }
    ]
  })
};

/**
 * Forms Plugin for ElizaOS
 *
 * This plugin provides structured form collection capabilities for agents,
 * allowing them to gather information from users in a conversational manner.
 *
 * Features:
 * - Multi-step forms with field validation
 * - LLM-based value extraction from natural language
 * - Secret field handling for sensitive data
 * - Form templates for common use cases
 * - Step and form completion callbacks
 * - Provider for showing active form state
 * - Database persistence for form state
 *
 * Usage:
 * 1. Add the plugin to your agent's plugins array
 * 2. The agent will automatically recognize form-related requests
 * 3. Forms are filled through natural conversation
 * 4. Other plugins can use the FormsService to create custom forms
 */
export const formsPlugin: Plugin = {
  name: '@elizaos/plugin-forms',
  description: 'Structured form collection capabilities for conversational data gathering',

  services: [FormsService],
  providers: [formsProvider],
  actions: [createFormAction, updateFormAction, cancelFormAction],

  // Schema provider for database migrations
  schemaProvider: formsSchemaProvider,

  // Legacy schema for backward compatibility
  schema: formsSchema,

  // No evaluators needed for this plugin
  evaluators: [],

  // Test suite for the plugin
  tests: [FormsPluginTestSuite],

  // Dependencies
  dependencies: ['@elizaos/plugin-sql'],
  testDependencies: ['@elizaos/plugin-sql'],
};

export default formsPlugin;
