/** Throws error if condition is falsy. Does not provide any type safety. */
export function assert(condition: unknown, reason: string = "") {
  if (!condition) {
    throw new Error(`Assertion failed${reason ? `: ${reason}` : ""}`);
  }
}

export function assertIsNull(value: unknown): asserts value is null {
  if (value !== null) {
    throw new Error(`Expected null, got ${value}`);
  }
}

export function assertIsNotNull<T>(
  value: T,
): asserts value is Exclude<T, null> {
  if (value === null) {
    throw new Error(`Expected non-null value, got null`);
  }
}

export function assertIsNil(value: unknown): asserts value is null | undefined {
  if (value !== null && value !== undefined) {
    throw new Error(`Expected null or undefined, got ${value}`);
  }
}

export function assertIsNotNil<T>(value: T): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`Expected defined value, got ${value}`);
  }
}

export function assertIsUndefined(value: unknown): asserts value is undefined {
  if (value !== undefined) {
    throw new Error(`Expected undefined, got ${value}`);
  }
}
export function assertIsDefined<T>(
  value: T,
): asserts value is Exclude<T, undefined> {
  if (value === undefined) {
    throw new Error(`Expected defined value, got undefined`);
  }
}

export function assertIsTrue(value: unknown): asserts value is true {
  if (value !== true) {
    throw new Error(`Expected true, got ${value}`);
  }
}

export function assertIsFalse(value: unknown): asserts value is false {
  if (value !== false) {
    throw new Error(`Expected false, got ${value}`);
  }
}
