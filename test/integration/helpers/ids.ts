/**
 * Unique instance ids for integration tests.
 *
 * `test-${Date.now()}` is not unique: two calls in the same millisecond return
 * the same id, and back-to-back calls collide every time. Tests that mint one
 * id in `beforeEach` and another inside the test therefore collide whenever the
 * intervening work takes under a millisecond. The duplicate create returns 409,
 * which those tests do not assert on, so the test silently goes on to operate on
 * the *other* instance - which is configured differently. That produced a real
 * intermittent failure in the webhook suite.
 *
 * A process-local counter makes ids unique regardless of clock resolution, and
 * the timestamp keeps them readable when one is left behind after a failure.
 */

let counter = 0;

/** A unique, readable identifier for any test fixture. */
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** A unique instance id. Lowercase, so it satisfies the createInstance schema. */
export function uniqueInstanceId(prefix = 'test'): string {
  return uniqueId(prefix);
}
