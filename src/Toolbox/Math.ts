export const wrapMax = (value: number, max: number) => {
  while (value >= max) {
    value -= max;
  }
  while (value < 0) {
    value += max;
  }

  return value;
};
