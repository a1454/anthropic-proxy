/**
 * Schema utility functions for processing JSON schemas
 */

/**
 * Recursively traverse JSON schema and remove format: 'uri'
 * @param {Object} schema - The JSON schema to process
 * @returns {Object} - The processed schema without uri format
 */
export function removeUriFormat(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  // If this is a string type with uri format, remove the format
  if (schema.type === 'string' && schema.format === 'uri') {
    const { format, ...rest } = schema;
    return rest;
  }

  // Handle array of schemas (like in anyOf, allOf, oneOf)
  if (Array.isArray(schema)) {
    return schema.map(item => removeUriFormat(item));
  }

  // Recursively process all properties
  const result = {};
  for (const key in schema) {
    if (key === 'properties' && typeof schema[key] === 'object') {
      result[key] = {};
      for (const propKey in schema[key]) {
        result[key][propKey] = removeUriFormat(schema[key][propKey]);
      }
    } else if (key === 'items' && typeof schema[key] === 'object') {
      result[key] = removeUriFormat(schema[key]);
    } else if (key === 'additionalProperties' && typeof schema[key] === 'object') {
      result[key] = removeUriFormat(schema[key]);
    } else if (['anyOf', 'allOf', 'oneOf'].includes(key) && Array.isArray(schema[key])) {
      result[key] = schema[key].map(item => removeUriFormat(item));
    } else {
      result[key] = removeUriFormat(schema[key]);
    }
  }
  return result;
}