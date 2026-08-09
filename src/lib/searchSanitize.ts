// PostgREST's `.or()` filter syntax treats commas, periods, colons, and
// parentheses as structural characters (they separate/nest conditions).
// Per PostgREST's own rules, wrapping a value in double quotes neutralizes
// all of that — the only characters that then need escaping are the quote
// and backslash themselves. Without this, a search term containing e.g. a
// comma could break out of the intended `ilike` condition and inject an
// unrelated filter clause into the query.
export function escapePostgrestValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
