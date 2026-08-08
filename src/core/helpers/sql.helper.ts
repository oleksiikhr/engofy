/**
 * Replaces obvious SQL parameters with '?' for logging purposes.
 *
 * This is a very basic sanitization. It does NOT guarantee complete
 * removal of sensitive data. Complex queries, comments, JSON strings,
 * or unusual SQL syntax might still expose values.
 */
export function sanitizeSqlParams(sql: string) {
  return (
    sql
      // lines in single quotation marks
      .replace(/'(?:''|[^'])*'/g, '?')
      // TRUE / FALSE
      .replace(/\b(true|false)\b/gi, '?')
      // NULL
      .replace(/\bnull\b/gi, '?')
      // numbers (including floats)
      .replace(/\b\d+(\.\d+)?\b/g, '?')
  );
}
