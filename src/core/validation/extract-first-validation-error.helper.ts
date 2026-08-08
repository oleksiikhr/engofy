import { ValidationError } from 'class-validator';

export interface FlattenedValidationError {
  field: string;
  message: string;
}

export function extractFirstValidationError(
  error: ValidationError,
  parentPath = '',
): FlattenedValidationError | null {
  const currentPath = parentPath
    ? `${parentPath}.${error.property}`
    : error.property;

  if (error.constraints && Object.keys(error.constraints).length > 0) {
    return {
      field: currentPath,
      message: Object.values(error.constraints)[0],
    };
  }

  if (error.children && error.children.length > 0) {
    return extractFirstValidationError(error.children[0], currentPath);
  }

  return null;
}
