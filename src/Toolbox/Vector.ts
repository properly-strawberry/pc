export type Vector = { x: number; y: number };

export const vectorAdd = (a: Vector, b: Vector) => {
  return { x: a.x + b.x, y: a.y + b.y };
};

export const vectorSubtract = (a: Vector, b: Vector) => {
  return { x: a.x - b.x, y: a.y - b.y };
};

export const vectorEqual = (a: Vector, b: Vector) => {
  return a.x === b.x && a.y === b.y;
};

export const vectorClone = (a: Vector): Vector => {
  return { x: a.x, y: a.y };
};

export const zeroVector = { x: 0, y: 0 };
