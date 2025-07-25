export function isNil<T>(value: T): value is Extract<T, null | undefined> {
  return value === null || value === undefined;
}

/** Returns an element from an array in a type safe way. Throws if accessing out of bounds or element is unassigned (sparse array). */
export const safeAt = <T>(arr: T[], index: number): T => {
  if (index < 0 || index >= arr.length) {
    throw new Error("Attempting to access array out of bounds.");
  }

  if (!Object.keys(arr).includes(String(index))) {
    throw new Error("Array element is unassigned.");
  }

  return arr[index] as T;
};

/** Returns an element from a dict in a type safe way. Throws if there is no such key element is undefined. */
export const safeAtKey = <
  T extends Record<string | number | symbol, unknown>,
  K extends keyof T,
>(
  dict: T,
  key: K,
): T[K] => {
  if (!Object.keys(dict).includes(String(key))) {
    throw new Error("Record key is unassigned.");
  }

  return dict[key];
};
