/**
 * Schema utility functions for processing JSON schemas
 */

type JSONSchemaValue = string | number | boolean | null | JSONSchema | JSONSchemaValue[];

interface JSONSchema {
  type?: string;
  format?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  additionalProperties?: JSONSchema | boolean;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  [key: string]: JSONSchemaValue;
}

/**
 * Recursively traverse JSON schema and remove format: 'uri'
 */
export function removeUriFormat(schema: JSONSchema): JSONSchema;
export function removeUriFormat(schema: JSONSchema[]): JSONSchema[];
export function removeUriFormat(schema: JSONSchemaValue): JSONSchemaValue;
export function removeUriFormat(schema: JSONSchemaValue): JSONSchemaValue {
  if (!schema || typeof schema !== 'object') return schema;

  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map(item => removeUriFormat(item));
  }

  const schemaObj = schema as JSONSchema;

  // If this is a string type with uri format, remove the format
  if (schemaObj.type === 'string' && schemaObj.format === 'uri') {
    const { format, ...rest } = schemaObj;
    return rest;
  }

  // Recursively process all properties
  const result: JSONSchema = {};
  
  for (const key in schemaObj) {
    const value = schemaObj[key];
    
    if (key === 'properties' && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = {};
      const properties = value as Record<string, JSONSchema>;
      for (const propKey in properties) {
        const propValue = properties[propKey];
        if (propValue) {
          (result[key] as Record<string, JSONSchema>)[propKey] = 
            removeUriFormat(propValue) as JSONSchema;
        }
      }
    } else if (key === 'items' && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeUriFormat(value as JSONSchema) as JSONSchema;
    } else if (key === 'additionalProperties' && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeUriFormat(value as JSONSchema) as JSONSchema;
    } else if (['anyOf', 'allOf', 'oneOf'].includes(key) && Array.isArray(value)) {
      result[key] = (value as JSONSchema[]).map(item => item ? removeUriFormat(item) as JSONSchema : item).filter(Boolean);
    } else if (value !== undefined && value !== null) {
      result[key] = removeUriFormat(value);
    }
  }
  
  return result;
}

/**
 * Validate that a schema is a valid JSON Schema
 */
export function isValidJSONSchema(schema: unknown): schema is JSONSchema {
  if (typeof schema !== 'object' || schema === null) return false;
  
  const obj = schema as Record<string, unknown>;
  
  // Check for valid type if present
  if (obj.type && typeof obj.type !== 'string') return false;
  
  // Check that properties is an object if present
  if (obj.properties && (typeof obj.properties !== 'object' || Array.isArray(obj.properties))) {
    return false;
  }
  
  return true;
}

/**
 * Deep clone a JSON schema
 */
export function cloneSchema(schema: JSONSchema): JSONSchema {
  return JSON.parse(JSON.stringify(schema));
}

/**
 * Merge two JSON schemas
 */
export function mergeSchemas(base: JSONSchema, override: JSONSchema): JSONSchema {
  const result = cloneSchema(base);
  
  for (const key in override) {
    const value = override[key];
    
    if (value !== undefined) {
      if (key === 'properties' && typeof value === 'object' && !Array.isArray(value)) {
        result.properties = result.properties || {};
        Object.assign(result.properties, value);
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Extract required fields from a schema
 */
export function getRequiredFields(schema: JSONSchema): string[] {
  if (Array.isArray(schema.required)) {
    return schema.required as string[];
  }
  return [];
}

/**
 * Check if a field is required in a schema
 */
export function isFieldRequired(schema: JSONSchema, fieldName: string): boolean {
  const required = getRequiredFields(schema);
  return required.includes(fieldName);
}

/**
 * Convert Anthropic tool schema to OpenRouter format
 */
export function convertToolSchema(anthropicTool: {
  name: string;
  description: string;
  input_schema: any;
}): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
} {
  return {
    type: 'function',
    function: {
      name: anthropicTool.name,
      description: anthropicTool.description,
      parameters: removeUriFormat(anthropicTool.input_schema) as JSONSchema
    }
  };
}

/**
 * Validate schema against a minimal JSON Schema meta-schema
 */
export function validateSchemaStructure(schema: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!isValidJSONSchema(schema)) {
    errors.push('Invalid JSON Schema structure');
    return { valid: false, errors };
  }
  
  // Additional validation could be added here
  
  return { valid: errors.length === 0, errors };
}