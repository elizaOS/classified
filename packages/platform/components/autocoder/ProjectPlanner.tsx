'use client';

import { useState, useEffect } from 'react';
import { Project, ProjectSpecification } from './AutocoderWorkspace';

// Array field component for managing lists
const ArrayField = ({
  label,
  placeholder,
  items,
  onUpdate,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onUpdate: (items: string[]) => void;
}) => {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      onUpdate([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center space-x-2 rounded-md bg-gray-50 p-2"
          >
            <span className="flex-1">{item}</span>
            <button
              onClick={() => removeItem(index)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addItem();
            }
          }}
        />
        <button
          onClick={addItem}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>
    </div>
  );
};

interface ProjectPlannerProps {
  project: Project;
  onSpecificationUpdate: (specification: ProjectSpecification) => void;
  onStartBuild: (specification: ProjectSpecification) => void;
}

export function ProjectPlanner({
  project,
  onSpecificationUpdate,
  onStartBuild,
}: ProjectPlannerProps) {
  const [specification, setSpecification] = useState<ProjectSpecification>(
    project.specification || {
      name: project.name,
      description: project.description,
      type: project.type,
      dependencies: [],
      features: [],
      testCases: [],
      securityRequirements: [],
    },
  );

  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (project.specification) {
      setSpecification(project.specification);
    }
  }, [project.specification]);

  const updateSpecification = (updates: Partial<ProjectSpecification>) => {
    const newSpec = { ...specification, ...updates };
    setSpecification(newSpec);
    onSpecificationUpdate(newSpec);
  };

  const addArrayItem = (
    field: keyof Pick<
      ProjectSpecification,
      'dependencies' | 'features' | 'testCases' | 'securityRequirements'
    >,
    value: string,
  ) => {
    if (value.trim()) {
      const currentArray = specification[field] as string[];
      updateSpecification({
        [field]: [...currentArray, value.trim()],
      });
    }
  };

  const removeArrayItem = (
    field: keyof Pick<
      ProjectSpecification,
      'dependencies' | 'features' | 'testCases' | 'securityRequirements'
    >,
    index: number,
  ) => {
    const currentArray = specification[field] as string[];
    updateSpecification({
      [field]: currentArray.filter((_, i) => i !== index),
    });
  };

  const handleEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const saveField = (field: keyof ProjectSpecification) => {
    updateSpecification({ [field]: tempValue });
    setEditingField(null);
    setTempValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const validateSpecification = async () => {
    setIsValidating(true);
    try {
      // Mock validation - in real implementation, this would call the agent
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Add some sample suggestions
      if (specification.features.length === 0) {
        updateSpecification({
          features: ['Basic functionality', 'Error handling', 'User interface'],
        });
      }
      if (specification.testCases.length === 0) {
        updateSpecification({
          testCases: [
            'Unit tests for core functions',
            'Integration tests',
            'Error handling tests',
          ],
        });
      }
    } finally {
      setIsValidating(false);
    }
  };

  const isSpecificationReady = () => {
    return (
      specification.name.trim() &&
      specification.description.trim() &&
      specification.features.length > 0 &&
      specification.testCases.length > 0
    );
  };

  const renderEditableField = (
    field: keyof ProjectSpecification,
    label: string,
    value: string,
    multiline = false,
  ) => {
    const isEditing = editingField === field;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {isEditing ? (
          <div className="space-y-2">
            {multiline ? (
              <textarea
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={3}
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            )}
            <div className="flex space-x-2">
              <button
                onClick={() => saveField(field)}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="rounded bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => handleEditField(field, value)}
            className="cursor-pointer rounded-md border border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
          >
            {value || <span className="text-gray-400">Click to edit...</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Main Planning Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              Project Specification
            </h2>
            <p className="text-gray-600">
              Collaborate with the AI to plan your project in detail before
              building
            </p>
          </div>

          {/* Basic Information */}
          <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Basic Information
            </h3>

            {renderEditableField('name', 'Project Name', specification.name)}
            {renderEditableField(
              'description',
              'Description',
              specification.description,
              true,
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Project Type
              </label>
              <select
                value={specification.type}
                onChange={(e) => updateSpecification({ type: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="mcp">MCP Server</option>
                <option value="plugin">ElizaOS Plugin</option>
                <option value="service">Service Integration</option>
              </select>
            </div>
          </div>

          {/* Features */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Features & Requirements
            </h3>
            <ArrayField
              label="Core Features"
              placeholder="Add a feature..."
              items={specification.features}
              onUpdate={(items) =>
                setSpecification((prev) => ({ ...prev, features: items }))
              }
            />
          </div>

          {/* Dependencies */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Dependencies
            </h3>
            <ArrayField
              label="Required Packages"
              placeholder="Add a dependency (e.g., @e2b/code-interpreter)..."
              items={specification.dependencies}
              onUpdate={(items) =>
                setSpecification((prev) => ({ ...prev, dependencies: items }))
              }
            />
          </div>

          {/* Test Cases */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Testing Strategy
            </h3>
            <ArrayField
              label="Test Cases"
              placeholder="Add a test case..."
              items={specification.testCases}
              onUpdate={(items) =>
                setSpecification((prev) => ({ ...prev, testCases: items }))
              }
            />
          </div>

          {/* Security Requirements */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Security Requirements
            </h3>
            <ArrayField
              label="Security Considerations"
              placeholder="Add a security requirement..."
              items={specification.securityRequirements}
              onUpdate={(items) =>
                setSpecification((prev) => ({
                  ...prev,
                  securityRequirements: items,
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Actions */}
      <div className="w-80 border-l border-gray-200 bg-gray-50 p-6">
        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Actions
            </h3>

            <div className="space-y-3">
              <button
                onClick={validateSpecification}
                disabled={isValidating}
                className="w-full rounded-md bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isValidating ? 'Validating...' : '🔍 Ask AI to Review'}
              </button>

              <button
                onClick={() => onStartBuild(specification)}
                disabled={
                  !isSpecificationReady() || project.status === 'building'
                }
                className="w-full rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {project.status === 'building'
                  ? '⚡ Building...'
                  : '🚀 Start Build'}
              </button>
            </div>
          </div>

          {/* Specification Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Specification Status</h4>

            <div className="space-y-2">
              {[
                { label: 'Name', completed: !!specification.name.trim() },
                {
                  label: 'Description',
                  completed: !!specification.description.trim(),
                },
                {
                  label: 'Features',
                  completed: specification.features.length > 0,
                },
                {
                  label: 'Test Cases',
                  completed: specification.testCases.length > 0,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center space-x-2">
                  <div
                    className={`h-4 w-4 rounded-full ${
                      item.completed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      item.completed ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-md bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> The more detailed your specification,
                the better the AI can build exactly what you need.
              </p>
            </div>
          </div>

          {/* Recent Suggestions */}
          {isValidating && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">AI Suggestions</h4>
              <div className="rounded-md bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  Analyzing your specification and suggesting improvements...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
