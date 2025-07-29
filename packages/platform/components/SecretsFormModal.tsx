'use client';

import React, { useState, useEffect } from 'react';
import { X, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface SecretField {
  key: string;
  name: string;
  description: string;
  required: boolean;
  type: 'text' | 'password' | 'url' | 'token';
  validation?: string;
  placeholder?: string;
}

export interface SecretsFormRequest {
  id: string;
  title: string;
  description: string;
  secrets: SecretField[];
  projectId?: string;
  context: {
    action: string;
    details: string;
    priority: 'low' | 'medium' | 'high';
  };
}

interface SecretsFormModalProps {
  isOpen: boolean;
  formRequest: SecretsFormRequest | null;
  onSubmit: (secrets: Record<string, string>) => void;
  onCancel: () => void;
}

export const SecretsFormModal: React.FC<SecretsFormModalProps> = ({
  isOpen,
  formRequest,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitComplete, setSubmitComplete] = useState(false);

  useEffect(() => {
    if (formRequest && isOpen) {
      // Reset form state when a new form is opened
      setFormData({});
      setShowPassword({});
      setValidationErrors({});
      setIsSubmitting(false);
      setSubmitComplete(false);
    }
  }, [formRequest, isOpen]);

  if (!isOpen || !formRequest) {
    return null;
  }

  const validateField = (field: SecretField, value: string): string | null => {
    if (field.required && !value.trim()) {
      return `${field.name} is required`;
    }

    if (field.validation && value.trim()) {
      try {
        const regex = new RegExp(field.validation);
        if (!regex.test(value)) {
          return `${field.name} format is invalid`;
        }
      } catch (error) {
        console.warn('Invalid regex pattern:', field.validation);
      }
    }

    // Additional built-in validations
    if (field.type === 'url' && value.trim()) {
      try {
        new URL(value);
      } catch {
        return 'Please enter a valid URL';
      }
    }

    if (field.type === 'token' && value.trim()) {
      if (value.length < 10) {
        return 'Token appears to be too short';
      }
    }

    return null;
  };

  const handleFieldChange = (fieldKey: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));

    // Clear validation error when user starts typing
    if (validationErrors[fieldKey]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const errors: Record<string, string> = {};

    for (const field of formRequest.secrets) {
      const value = formData[field.key] || '';
      const error = validateField(field, value);
      if (error) {
        errors[field.key] = error;
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit the form data
      await onSubmit(formData);
      setSubmitComplete(true);

      // Auto-close after showing success
      setTimeout(() => {
        onCancel();
      }, 2000);
    } catch (error) {
      console.error('Error submitting secrets form:', error);
      setValidationErrors({
        _form: 'Failed to save configuration. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (
      confirm(
        'Are you sure you want to cancel? Your configuration will not be saved.',
      )
    ) {
      onCancel();
    }
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setShowPassword((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'high') {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return <Lock className="h-5 w-5 text-blue-600" />;
  };

  if (submitComplete) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        data-testid="secrets-form-modal"
      >
        <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-600" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Configuration Saved!
            </h3>
            <p className="text-gray-600">
              Your configuration has been securely saved and the setup will
              continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      data-testid="secrets-form-modal"
    >
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div
          className={`border-b border-l-4 p-6 ${getPriorityColor(formRequest.context.priority)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {getPriorityIcon(formRequest.context.priority)}
              <div>
                <h2
                  className="text-xl font-semibold text-gray-900"
                  data-testid="form-title"
                >
                  {formRequest.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {formRequest.description}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 transition-colors hover:text-gray-600"
              data-testid="close-button"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Context Info */}
          <div className="mt-4 rounded-md bg-gray-50 p-3">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Action:</span>{' '}
              {formRequest.context.action} - {formRequest.context.details}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {formRequest.secrets.map((field) => (
              <div key={field.key} className="space-y-2">
                <label
                  htmlFor={field.key}
                  className="block text-sm font-medium text-gray-700"
                >
                  {field.name}
                  {field.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>

                <p className="text-sm text-gray-600">{field.description}</p>

                <div className="relative">
                  <input
                    id={field.key}
                    name={field.key}
                    type={
                      field.type === 'password' && !showPassword[field.key]
                        ? 'password'
                        : 'text'
                    }
                    value={formData[field.key] || ''}
                    onChange={(e) =>
                      handleFieldChange(field.key, e.target.value)
                    }
                    placeholder={field.placeholder}
                    className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors[field.key]
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    data-testid={`input-${field.key}`}
                  />

                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600"
                      data-testid={`toggle-password-${field.key}`}
                    >
                      {showPassword[field.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>

                {validationErrors[field.key] && (
                  <p
                    className="text-sm text-red-600"
                    data-testid={`error-${field.key}`}
                  >
                    {validationErrors[field.key]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Form-level error */}
          {validationErrors._form && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600" data-testid="form-error">
                {validationErrors._form}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex justify-end space-x-3 border-t pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="submit-button"
            >
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {/* Security Notice */}
        <div className="px-6 pb-6">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start space-x-2">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
              <p className="text-xs text-gray-600">
                Your configuration values are encrypted and stored securely.
                They will only be used for this project and can be updated at
                any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
