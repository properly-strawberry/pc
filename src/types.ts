export type StringLike = string | Array<string>;

export type Vector = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export const getIsPositionInRect = (pos: Vector, rect: Rect) => {
  return (
    pos.x >= rect.x &&
    pos.y >= rect.y &&
    pos.x < rect.x + rect.w &&
    pos.y < rect.y + rect.h
  );
};
