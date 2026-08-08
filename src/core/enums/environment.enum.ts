import { envEnum } from '../helpers/env.helper.js';

export enum Environment {
  Production = 'production',
  Development = 'development',
  Testing = 'test',
}

const ENVIRONMENT_VALUES = Object.values(Environment) as Environment[];

export function getEnvironment(): Environment {
  return envEnum('NODE_ENV', ENVIRONMENT_VALUES, Environment.Production);
}

export function isTestEnvironment(): boolean {
  return getEnvironment() === Environment.Testing;
}

export function isProdEnvironment(): boolean {
  return getEnvironment() === Environment.Production;
}
