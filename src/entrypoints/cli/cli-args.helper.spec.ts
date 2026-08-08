import { parseCommaSeparated } from './cli-args.helper.js';
import { InvalidCliFlagError } from './invalid-cli-flag.error.js';

describe('parseCommaSeparated', () => {
  it('splits a single value', () => {
    expect(parseCommaSeparated('resumes', '--index')).toEqual(['resumes']);
  });

  it('splits multiple comma-separated values', () => {
    expect(parseCommaSeparated('resumes,jobs', '--index')).toEqual([
      'resumes',
      'jobs',
    ]);
  });

  it('trims whitespace around entries', () => {
    expect(parseCommaSeparated(' resumes , jobs ', '--index')).toEqual([
      'resumes',
      'jobs',
    ]);
  });

  it('filters out empty entries from repeated commas', () => {
    expect(parseCommaSeparated('resumes,,jobs', '--index')).toEqual([
      'resumes',
      'jobs',
    ]);
  });

  it('throws when no valid entries remain', () => {
    expect(() => parseCommaSeparated('  ,  ', '--index')).toThrow(
      InvalidCliFlagError,
    );
  });

  it('throws when the value is an empty string', () => {
    expect(() => parseCommaSeparated('', '--index')).toThrow(
      InvalidCliFlagError,
    );
  });

  it('includes the flag name in the error', () => {
    let caught: unknown;
    try {
      parseCommaSeparated('', '--target');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidCliFlagError);
    expect((caught as InvalidCliFlagError).flag).toBe('--target');
  });
});
