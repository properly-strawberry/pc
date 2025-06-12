/*
Sources:
- https://listfist.com/list-of-tetris-levels-by-speed-nes-ntsc-vs-pal
- https://tetris.wiki/Tetris_(NES)
- https://tetris.fandom.com/wiki/Nintendo_Rotation_System
- https://tetris.wiki/Tetris_Guideline
- https://tetris.wiki/Super_Rotation_System
*/

import _ from "lodash";
import { readKey, readLine, waitFor } from "../Functions";
import { getIsPositionInRect, Rect, Size } from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";
import { Screen } from "../Screen";
import {
  Vector,
  vectorAdd,
  vectorClone,
  vectorEqual,
  vectorMultiplyComponents,
  zeroVector,
} from "../Toolbox/Vector";
import { CgaColors } from "../Color/types";
import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { wrapMax } from "../Toolbox/Math";
import { padWithRightBias } from "../Toolbox/String";

const msPerFrame = 16.666666666;

interface Level {
  msPerCell: number;
}

const levels: Level[] = [
  { msPerCell: 48 * msPerFrame },
  { msPerCell: 43 * msPerFrame },
  { msPerCell: 38 * msPerFrame },
  { msPerCell: 33 * msPerFrame },
  { msPerCell: 28 * msPerFrame },
  { msPerCell: 23 * msPerFrame },
  { msPerCell: 18 * msPerFrame },
  { msPerCell: 13 * msPerFrame },
  { msPerCell: 8 * msPerFrame },
  { msPerCell: 6 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 5 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 4 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 3 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 2 * msPerFrame },
  { msPerCell: 1 * msPerFrame },
];

type SignalListener<D> = (data: D) => void;

class Signal<D> {
  private listeners: Array<SignalListener<D>>;
  constructor() {
    this.listeners = [];
  }

  public listen(l: SignalListener<D>) {
    this.listeners.push(l);

    return () => {
      this.listeners = this.listeners.filter(
        (currentListener) => currentListener !== l
      );
    };
  }

  public emit(data: D) {
    for (const l of this.listeners) {
      l(data);
    }
  }
}

const WIDTH = 10;
const HEIGHT = 40;
const TOP_PADDING = 20;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const BORDER_SIZE_H = 2;
const BORDER_SIZE_V = 1;
const NUM_CELLS = WIDTH * HEIGHT;
const BOARD_RECT: Rect = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

const DAS_DELAY_LENGTH = 10 * msPerFrame;
const DAS_LENGTH = 2 * msPerFrame;
const ARE_DELAY = 6 * msPerFrame;
const PUSHDOWN_LENGTH = 1 * msPerFrame;
const LOCK_DELAY = 30 * msPerFrame;

enum PieceKey {
  I = "I",
  O = "O",
  J = "J",
  L = "L",
  S = "S",
  T = "T",
  Z = "Z",
}

const sevenBag = [
  PieceKey.I,
  PieceKey.O,
  PieceKey.J,
  PieceKey.L,
  PieceKey.S,
  PieceKey.T,
  PieceKey.Z,
];

interface PieceColor {
  bgColor: string;
  fgColor: string;
}

interface PieceDescriptor {
  key: PieceKey;
  size: Size;
  rotations: Array<string>;
  spawnPosition: Vector;
  nextOffset: Vector;
  color: PieceColor;
}

enum Rotation {
  Zero = 0,
  Right = 1,
  Two = 2,
  Left = 3,
}
const NUM_ROTATIONS = 4;

const wallKickRegular: Record<
  Rotation,
  Partial<Record<Rotation, Array<Vector>>>
> = {
  [Rotation.Zero]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: +2 },
      { x: -1, y: +2 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: -1 },
      { x: 0, y: +2 },
      { x: +1, y: +2 },
    ],
  },
  [Rotation.Right]: {
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: +1 },
      { x: 0, y: -2 },
      { x: +1, y: -2 },
    ],
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: +1 },
      { x: 0, y: -2 },
      { x: +1, y: -2 },
    ],
  },
  [Rotation.Two]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: +2 },
      { x: -1, y: +2 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: +1, y: -1 },
      { x: 0, y: +2 },
      { x: +1, y: +2 },
    ],
  },
  [Rotation.Left]: {
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: +1 },
      { x: 0, y: -2 },
      { x: -1, y: -2 },
    ],
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: +1 },
      { x: 0, y: -2 },
      { x: -1, y: -2 },
    ],
  },
};

const wallKickI: Record<Rotation, Partial<Record<Rotation, Array<Vector>>>> = {
  [Rotation.Zero]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: +1 },
      { x: +1, y: -2 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: -2 },
      { x: +2, y: +1 },
    ],
  },
  [Rotation.Right]: {
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: -1 },
      { x: -1, y: +2 },
    ],
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: -2 },
      { x: +2, y: +1 },
    ],
  },
  [Rotation.Two]: {
    [Rotation.Right]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: +2 },
      { x: -2, y: -1 },
    ],
    [Rotation.Left]: [
      { x: 0, y: 0 },
      { x: +2, y: 0 },
      { x: -1, y: 0 },
      { x: +2, y: -1 },
      { x: -1, y: +2 },
    ],
  },
  [Rotation.Left]: {
    [Rotation.Two]: [
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: +1 },
      { x: +1, y: -2 },
    ],
    [Rotation.Zero]: [
      { x: 0, y: 0 },
      { x: +1, y: 0 },
      { x: -2, y: 0 },
      { x: +1, y: +2 },
      { x: -2, y: -1 },
    ],
  },
};

const pieceDescriptors: Record<PieceKey, PieceDescriptor> = {
  [PieceKey.I]: {
    key: PieceKey.I,
    size: { w: 4, h: 4 },
    rotations: [
      "    XXXX        ",
      "  X   X   X   X ",
      "        XXXX    ",
      " X   X   X   X  ",
    ],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 0 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Cyan],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightCyan],
    },
  },
  [PieceKey.O]: {
    key: PieceKey.O,
    size: { w: 2, h: 2 },
    rotations: ["XXXX"],
    spawnPosition: { x: 4, y: -1 + TOP_PADDING },
    nextOffset: { x: 1, y: 1 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Yellow],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightYellow],
    },
  },
  [PieceKey.J]: {
    key: PieceKey.J,
    size: { w: 3, h: 3 },
    rotations: ["X  XXX   ", " XX X  X ", "   XXX  X", " X  X XX "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Blue],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightBlue],
    },
  },
  [PieceKey.L]: {
    key: PieceKey.L,
    size: { w: 3, h: 3 },
    rotations: ["  XXXX   ", " X  X  XX", "   XXXX  ", "XX  X  X "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Orange],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightOrange],
    },
  },
  [PieceKey.S]: {
    key: PieceKey.S,
    size: { w: 3, h: 3 },
    rotations: [" XXXX    ", " X  XX  X", "    XXXX ", "X  XX  X "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Green],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightGreen],
    },
  },
  [PieceKey.T]: {
    key: PieceKey.T,
    size: { w: 3, h: 3 },
    rotations: [" X XXX   ", " X  XX X ", "   XXX X ", " X XX  X "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Violet],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightViolet],
    },
  },
  [PieceKey.Z]: {
    key: PieceKey.Z,
    size: { w: 3, h: 3 },
    rotations: ["XX  XX   ", "  X XX X ", "   XX  XX", " X XX X  "],
    spawnPosition: { x: 3, y: -1 + TOP_PADDING },
    nextOffset: { x: 0, y: 1 },
    color: {
      fgColor: CGA_PALETTE_DICT[CgaColors.Red],
      bgColor: CGA_PALETTE_DICT[CgaColors.LightRed],
    },
  },
};

interface Cell {
  filled: boolean;
  color: PieceColor;
}

const cellClone = (a: Cell): Cell => {
  return {
    filled: a.filled,
    color: a.color,
  };
};

class Piece {
  private descriptor: PieceDescriptor;
  private size: Size;
  public position: Vector;
  private currentRotation: Rotation;
  private grid: string;

  private ctx: Tetris;

  constructor(ctx: Tetris, piece: PieceKey) {
    this.ctx = ctx;
    this.descriptor = pieceDescriptors[piece];
    this.size = { ...this.descriptor.size };
    this.position = { ...this.descriptor.spawnPosition };

    this.currentRotation = 0;
    this.grid = this.descriptor.rotations[this.currentRotation];
  }

  public makeGhost() {
    this.descriptor = {
      ...this.descriptor,
      color: {
        fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
        bgColor: CGA_PALETTE_DICT[CgaColors.Black],
      },
    };
  }

  public getDescriptor() {
    return this.descriptor;
  }

  public draw() {
    this.doForEachSquare((boardPosition) => {
      this.ctx.drawBoardSquare(boardPosition, this.descriptor.color);
    });
  }

  public doForEachSquare(
    fn: (boardPosition: Vector, localSquarePosition: Vector) => void
  ) {
    for (let y = 0; y < this.size.h; y += 1) {
      for (let x = 0; x < this.size.w; x += 1) {
        if (this.grid[y * this.size.w + x] === "X") {
          fn(
            {
              x: this.position.x + x,
              y: this.position.y + y,
            },
            {
              x,
              y,
            }
          );
        }
      }
    }
  }

  private updateGrid() {
    this.grid = this.descriptor.rotations[this.currentRotation];
  }

  private _rotateRight() {
    this.currentRotation = wrapMax(
      this.currentRotation + 1,
      this.descriptor.rotations.length
    );
    this.updateGrid();
  }

  private getKickSet() {
    switch (this.descriptor.key) {
      case PieceKey.J:
      case PieceKey.L:
      case PieceKey.S:
      case PieceKey.T:
      case PieceKey.Z:
        return wallKickRegular;
      case PieceKey.I:
        return wallKickI;
      case PieceKey.O:
        return null;
    }
  }

  public rotateRight() {
    const originalPosition = vectorClone(this.position);
    const startRotation = this.currentRotation;
    this._rotateRight();
    const nextRotation = this.currentRotation;
    const kickSet = this.getKickSet()?.[startRotation][nextRotation];
    if (!kickSet) return;
    for (const kick of kickSet) {
      this.position = vectorAdd(originalPosition, kick);
      if (!this.getIsColliding()) {
        return;
      }
    }
    this.position = originalPosition;
    this._rotateLeft();
  }

  private _rotateLeft() {
    this.currentRotation = wrapMax(
      this.currentRotation - 1,
      this.descriptor.rotations.length
    );
    this.updateGrid();
  }

  public rotateLeft() {
    const originalPosition = vectorClone(this.position);
    const startRotation = this.currentRotation;
    this._rotateLeft();
    const nextRotation = this.currentRotation;
    const kickSet = this.getKickSet()?.[startRotation][nextRotation];
    if (!kickSet) return;
    for (const kick of kickSet) {
      this.position = vectorAdd(originalPosition, kick);
      if (!this.getIsColliding()) {
        return;
      }
    }
    this.position = originalPosition;
    this._rotateRight();
  }

  private getIsCollidingBoardEdges() {
    let isColliding = false;
    // add two rows to the top of the board rect for rotations
    this.doForEachSquare((pos) => {
      isColliding = isColliding || !getIsPositionInRect(pos, BOARD_RECT);
    });
    return isColliding;
  }

  private getIsCollidingBoard() {
    const board = this.ctx.getBoard();
    let isColliding = false;
    this.doForEachSquare((pos) => {
      isColliding = isColliding || Boolean(board.getCell(pos)?.filled);
    });
    return isColliding;
  }

  public getIsColliding() {
    return this.getIsCollidingBoardEdges() || this.getIsCollidingBoard();
  }

  public copyStateFrom(another: Piece) {
    this.position = vectorClone(another.position);
    this.currentRotation = another.currentRotation;
    this.updateGrid();
  }
}

class FallingPiece {
  private piece: Piece;
  private ghost: Piece;
  public onPlaced: Signal<void> = new Signal<void>();

  private msPerCell: number;
  private stepCounter: number;

  private direction: Vector;
  private dasDelayCounter: number;
  private dasCounter: number;

  private lockDelayCounter: number;
  private lockResetsLeft: number;

  private ctx: Tetris;

  private isPushdown: boolean;
  private pushdownLength: number;

  constructor(ctx: Tetris, piece: PieceKey, level: Level) {
    this.ctx = ctx;
    this.piece = new Piece(ctx, piece);
    this.ghost = new Piece(ctx, piece);
    this.ghost.makeGhost();

    this.msPerCell = level.msPerCell;
    this.stepCounter = this.msPerCell;

    this.direction = { x: 0, y: 0 };
    this.dasDelayCounter = DAS_DELAY_LENGTH;
    this.dasCounter = 0;

    this.isPushdown = false;
    this.pushdownLength = 0;

    this.lockDelayCounter = LOCK_DELAY;
    this.lockResetsLeft = 15;

    this.updateGhost();
  }

  public getPushdownLength() {
    return this.pushdownLength;
  }

  public draw() {
    this.ghost.draw();
    this.piece.draw();
  }

  public rotateRight() {
    this.pushdownLength = 0;
    this.resetLocking();
    this.piece.rotateRight();
    this.ghost.copyStateFrom(this.piece);
    this.updateGhost();
  }

  public rotateLeft() {
    this.pushdownLength = 0;
    this.resetLocking();
    this.piece.rotateLeft();
    this.ghost.copyStateFrom(this.piece);
    this.updateGhost();
  }

  private updateGhost() {
    this.ghost.position = vectorClone(this.piece.position);
    let hasMovedDown = false;
    while (!this.ghost.getIsColliding()) {
      this.ghost.position = vectorAdd(this.ghost.position, { x: 0, y: 1 });
      hasMovedDown = true;
    }
    if (hasMovedDown) {
      this.ghost.position = vectorAdd(this.ghost.position, { x: 0, y: -1 });
    }
  }

  private moveInDirection() {
    if (this.getIsMoving()) {
      const oldPosition = this.piece.position;
      this.piece.position = vectorAdd(this.piece.position, this.direction);
      if (this.piece.getIsColliding()) {
        this.piece.position = oldPosition;
      } else {
        this.pushdownLength = 0;
        this.updateGhost();
        this.resetLocking();
      }
    }
  }

  private getIsResting() {
    let resting = false;
    this.piece.position.y += 1;
    if (this.piece.getIsColliding()) {
      resting = true;
    }
    this.piece.position.y -= 1;
    return resting;
  }

  public step() {
    if (!this.getIsResting()) {
      this.piece.position.y += 1;
      if (this.isPushdown) {
        this.pushdownLength += 1;
      }
    }
  }

  private lock() {
    this.fillIn();
    this.onPlaced.emit();
  }

  private fillIn() {
    const board = this.ctx.getBoard();
    this.piece.doForEachSquare((pos) => {
      board.fillCell(pos, this.piece.getDescriptor().color);
    });
  }

  public setPushdown(isPushdown: boolean) {
    if (!isPushdown && !this.getIsResting()) {
      this.pushdownLength = 0;
    }

    if (this.isPushdown !== isPushdown) {
      this.isPushdown = isPushdown;
      this.stepCounter = this.isPushdown ? 0 : this.msPerCell;
    }
  }

  public update(dt: number) {
    this.stepCounter -= dt;
    while (this.stepCounter < 0) {
      this.stepCounter += this.isPushdown ? PUSHDOWN_LENGTH : this.msPerCell;
      this.step();
    }

    if (this.getIsResting()) {
      this.lockDelayCounter -= dt;
      if (this.lockDelayCounter <= 0) {
        this.lock();
      }
    }

    let moveDt = dt;
    if (this.getIsMoving()) {
      if (this.dasDelayCounter > 0) {
        this.dasDelayCounter = this.dasDelayCounter - moveDt;
      }
      if (this.dasDelayCounter <= 0) {
        moveDt += this.dasDelayCounter;
        this.dasDelayCounter = 0;
        this.dasCounter = Math.max(0, this.dasCounter - moveDt);
        if (this.dasCounter === 0) {
          this.moveInDirection();
          this.dasCounter = DAS_LENGTH;
        }
      }
    } else {
      this.dasDelayCounter = DAS_DELAY_LENGTH;
      this.dasCounter = 0;
    }
  }

  private getIsMoving() {
    return !vectorEqual(this.direction, zeroVector);
  }

  public setDirection(direction: Vector) {
    if (!vectorEqual(this.direction, direction)) {
      this.direction = direction;

      if (!vectorEqual(this.direction, zeroVector)) {
        this.dasDelayCounter = DAS_DELAY_LENGTH;
        this.dasCounter = 0;
        this.moveInDirection();
      }
    }
  }

  private resetLocking() {
    if (this.lockResetsLeft > 0) {
      this.lockResetsLeft -= 1;
      this.lockDelayCounter = LOCK_DELAY;
    }
  }

  public hardDrop() {
    while (!this.getIsResting()) {
      this.piece.position.y += 1;
      this.pushdownLength += 1;
    }
    this.lock();
  }

  public getPiece() {
    return this.piece;
  }
}

class Board {
  private board: Array<Cell>;

  constructor() {
    this.board = new Array(NUM_CELLS);
    for (let i = 0; i < NUM_CELLS; i += 1) {
      this.board[i] = this.getEmptyCell();
    }
  }

  private getEmptyCell(): Cell {
    return {
      filled: false,
      color: {
        bgColor: CGA_PALETTE_DICT[CgaColors.Black],
        fgColor: CGA_PALETTE_DICT[CgaColors.DarkGray],
      },
    };
  }

  private getBoardIndexFromBoardPosition(boardPosition: Vector): number {
    return boardPosition.y * WIDTH + boardPosition.x;
  }

  public getCell(pos: Vector): Cell | null {
    const idx = this.getBoardIndexFromBoardPosition(pos);
    if (idx < 0 || idx > this.board.length) return null;
    return this.board[idx];
  }

  public fillCell(pos: Vector, color: PieceColor): void {
    this.board[this.getBoardIndexFromBoardPosition(pos)].filled = true;
    this.board[this.getBoardIndexFromBoardPosition(pos)].color = color;
  }

  public clearLines() {
    let linesCleared = 0;

    let y = HEIGHT - 1;
    while (y > 0) {
      let isRowComplete = true;
      for (let x = 0; x < WIDTH; x += 1) {
        if (!this.board[this.getBoardIndexFromBoardPosition({ x, y })].filled) {
          isRowComplete = false;
        }
      }

      if (isRowComplete) {
        linesCleared += 1;
        for (let y2 = y; y2 > 0; y2 -= 1) {
          for (let x = 0; x < WIDTH; x += 1) {
            this.board[this.getBoardIndexFromBoardPosition({ x, y: y2 })] =
              cellClone(
                this.board[
                  this.getBoardIndexFromBoardPosition({ x, y: y2 - 1 })
                ]
              );
          }
        }

        for (let x = 0; x < WIDTH; x += 1) {
          this.board[this.getBoardIndexFromBoardPosition({ x, y: 0 })] =
            this.getEmptyCell();
        }
      } else {
        y -= 1;
      }
    }

    return linesCleared;
  }
}

export class Tetris implements Executable {
  private pc: PC;

  private board: Board;
  private boardScreenRect: Rect;

  private fallingPiece: FallingPiece | null = null;
  private nextOrigin: Vector = { x: 53, y: 4 };
  private holdOrigin: Vector = { x: 17, y: 4 };
  private heldPiece: PieceKey | null = null;
  private hasHeld: boolean = false;

  private bag: Array<PieceKey>;
  private bagIndex: number;

  private areCounter: number;

  private currentLevel: number;
  private linesCleared: number;
  private score: number;

  constructor(pc: PC) {
    this.pc = pc;

    const { screen } = this.pc;

    this.board = new Board();

    const screenSize = screen.getSizeInCharacters();

    this.boardScreenRect = {
      x: Math.round((screenSize.w - WIDTH * CELL_WIDTH - BORDER_SIZE_H) / 2),
      y: screenSize.h - HEIGHT * CELL_HEIGHT - 1 * BORDER_SIZE_V,
      w: WIDTH * CELL_WIDTH,
      h: HEIGHT * CELL_HEIGHT,
    };

    this.bag = [...sevenBag];
    this.bagIndex = 0;
    this.shuffleBag();

    this.areCounter = ARE_DELAY;

    this.currentLevel = 0;
    this.linesCleared = 0;
    this.score = 0;
  }

  private init() {
    const { screen } = this.pc;
    screen.clear();
    screen.displayString(
      { x: 0, y: 0 },
      _.pad("======== P E N G T R I S ========", screen.getSizeInCharacters().w)
    );
  }

  private shuffleBag() {
    this.bag = _.shuffle(this.bag);
    this.bagIndex = 0;
  }

  private getScreenPositionFromBoardPosition(
    boardPosition: Vector
  ): Vector | null {
    const { screen } = this.pc;
    if (!getIsPositionInRect(boardPosition, BOARD_RECT)) return null;

    const screenPos = {
      x: this.boardScreenRect.x + boardPosition.x * CELL_WIDTH,
      y: this.boardScreenRect.y + boardPosition.y * CELL_HEIGHT,
    };

    if (!getIsPositionInRect(screenPos, screen.getCharacterRect())) return null;

    return screenPos;
  }

  private drawSquare(
    screenPos: Vector,
    color: PieceColor,
    string: string = "[]"
  ) {
    const { screen } = this.pc;

    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: color.bgColor,
      fgColor: color.fgColor,
    });
    screen.displayString(screenPos, string);
  }

  public drawBoardSquare(boardPosition: Vector, color: PieceColor) {
    const screenPos = this.getScreenPositionFromBoardPosition(boardPosition);
    if (screenPos) {
      this.drawSquare(screenPos, color);
    }
  }

  private drawBorder() {
    const { screen } = this.pc;
    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
    });
    for (
      let y = this.boardScreenRect.y + TOP_PADDING - 2;
      y < this.boardScreenRect.y + TOP_PADDING;
      y += 1
    ) {
      screen.displayString(
        { x: this.boardScreenRect.x - BORDER_SIZE_H, y },
        "\x1Bsf08\x1Bsb00  " + "  ".repeat(WIDTH) + "  "
      );
    }
    for (
      let y = this.boardScreenRect.y + TOP_PADDING;
      y < this.boardScreenRect.y + HEIGHT * CELL_HEIGHT;
      y += 1
    ) {
      screen.displayString(
        { x: this.boardScreenRect.x - BORDER_SIZE_H, y },
        "\x1Bsb07\x1Bsf08<!\x1Bsf08\x1Bsb00" +
          " .".repeat(WIDTH) +
          "\x1Bsb07\x1Bsf08!>"
      );
    }
    screen.displayString(
      {
        x: this.boardScreenRect.x - BORDER_SIZE_H,
        y: this.boardScreenRect.y + HEIGHT * CELL_HEIGHT,
      },
      "\x1Bsb07\x1Bsf08<!" + "=".repeat(WIDTH * CELL_WIDTH) + "!>"
    );
  }

  private drawBoardPieces() {
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const boardPos = { x, y };
        const cell = this.board.getCell(boardPos);
        if (cell && cell.filled) {
          this.drawBoardSquare(boardPos, cell.color);
        }
      }
    }
  }

  private drawBoard() {
    this.drawBorder();
    this.drawBoardPieces();
  }

  public getBoard() {
    return this.board;
  }

  private drawStaticPiece(key: PieceKey | null, pos: Vector) {
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        this.drawSquare(
          vectorAdd(
            vectorMultiplyComponents(
              { x, y },
              {
                x: CELL_WIDTH,
                y: CELL_HEIGHT,
              }
            ),
            pos
          ),
          {
            bgColor: CGA_PALETTE_DICT[CgaColors.Black],
            fgColor: CGA_PALETTE_DICT[CgaColors.DarkGray],
          },
          " ."
        );
      }
    }
    if (key) {
      const piece = new Piece(this, key);
      const color = piece.getDescriptor().color;
      piece.doForEachSquare((boardPosition, localSquarePosition) => {
        this.drawSquare(
          vectorAdd(
            vectorMultiplyComponents(
              vectorAdd(localSquarePosition, piece.getDescriptor().nextOffset),
              {
                x: CELL_WIDTH,
                y: CELL_HEIGHT,
              }
            ),
            pos
          ),
          color
        );
      });
    }
  }

  private drawNext() {
    const { screen } = this.pc;

    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
    });
    screen.displayString(this.nextOrigin, "= NEXT =");

    this.drawStaticPiece(
      this.bag[this.bagIndex],
      vectorAdd(this.nextOrigin, { x: 0, y: 1 })
    );
  }

  private drawHeld() {
    const { screen } = this.pc;

    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
    });
    screen.displayString(this.holdOrigin, "= HOLD =");

    this.drawStaticPiece(
      this.heldPiece,
      vectorAdd(this.holdOrigin, { x: 0, y: 1 })
    );
  }

  private drawLevel() {
    const { screen } = this.pc;

    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
    });
    screen.displayString({ x: 14, y: 20 }, "== LEVEL ==");
    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.DarkGray],
      fgColor: CGA_PALETTE_DICT[CgaColors.White],
    });
    screen.displayString(
      { x: 14, y: 21 },
      ` ${_.padStart(String(this.currentLevel), 9)} `
    );
  }

  private drawLines() {
    const { screen } = this.pc;

    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
    });
    screen.displayString({ x: 14, y: 23 }, "== LINES ==");
    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.DarkGray],
      fgColor: CGA_PALETTE_DICT[CgaColors.White],
    });
    screen.displayString(
      { x: 14, y: 24 },
      ` ${_.padStart(String(this.linesCleared), 9)} `
    );
  }

  private drawScore() {
    const { screen } = this.pc;

    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.Black],
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
    });
    screen.displayString({ x: 14, y: 17 }, "== SCORE ==");
    screen.setCurrentAttributes({
      ...screen.getCurrentAttributes(),
      bgColor: CGA_PALETTE_DICT[CgaColors.DarkGray],
      fgColor: CGA_PALETTE_DICT[CgaColors.White],
    });
    screen.displayString(
      { x: 14, y: 18 },
      ` ${_.padStart(String(this.score), 9)} `
    );
  }

  private spawnPiece(key: PieceKey) {
    this.hasHeld = false;
    const fallingPiece = new FallingPiece(this, key, levels[this.currentLevel]);
    this.fallingPiece = fallingPiece;
    fallingPiece.onPlaced.listen(() => {
      this.areCounter = ARE_DELAY;
      this.fallingPiece = null;
      const linesCleared = this.board.clearLines();
      this.setLinesCleared(this.linesCleared + linesCleared);
      this.score += fallingPiece.getPushdownLength();
      this.score += this.getScoreForNumberOfLines(linesCleared);
    });
  }

  private getScoreForNumberOfLines(lines: number) {
    if (lines === 1) {
      return 40 * (this.currentLevel + 1);
    } else if (lines === 2) {
      return 100 * (this.currentLevel + 1);
    } else if (lines === 3) {
      return 300 * (this.currentLevel + 1);
    } else if (lines === 4) {
      return 1200 * (this.currentLevel + 1);
    }
    return 0;
  }

  private holdPiece() {
    if (!this.hasHeld) {
      let currentFallingPiece =
        this.fallingPiece?.getPiece().getDescriptor().key ?? null;
      if (this.heldPiece) {
        let currentHeldPiece = this.heldPiece;
        this.heldPiece = currentFallingPiece;
        this.spawnPiece(currentHeldPiece);
      } else {
        this.heldPiece = currentFallingPiece;
        this.spawnPiece(this.getNextPiece());
      }
      this.hasHeld = true;
    }
  }

  private getNextPiece(): PieceKey {
    let result = this.bag[this.bagIndex];
    this.bagIndex += 1;
    if (this.bagIndex === this.bag.length) {
      this.shuffleBag();
    }
    return result;
  }

  private setLinesCleared(linesCleared: number) {
    this.linesCleared = linesCleared;
    this.currentLevel = Math.floor(linesCleared / 10);
  }

  async run(args: string[]) {
    return new Promise<void>((resolve) => {
      let hasQuit = false;
      const { screen, keyboard } = this.pc;
      screen.hideCursor();

      this.init();

      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        // input

        const beenPressed = keyboard.getWasKeyPressed();
        if (beenPressed.has("ArrowUp")) {
          this.fallingPiece?.rotateRight();
        }
        if (beenPressed.has("KeyZ")) {
          this.fallingPiece?.rotateLeft();
        }
        if (beenPressed.has("KeyX")) {
          this.fallingPiece?.rotateRight();
        }
        if (beenPressed.has("KeyC")) {
          this.holdPiece();
        }
        if (beenPressed.has("Space")) {
          this.fallingPiece?.hardDrop();
        }
        if (beenPressed.has("Escape")) {
          resolve();
          return;
        }
        if (this.fallingPiece) {
          this.fallingPiece.setPushdown(keyboard.getIsKeyPressed("ArrowDown"));
          if (keyboard.getIsKeyPressed("ArrowLeft")) {
            this.fallingPiece.setDirection({ x: -1, y: 0 });
          } else if (keyboard.getIsKeyPressed("ArrowRight")) {
            this.fallingPiece.setDirection({ x: 1, y: 0 });
          } else if (
            !keyboard.getIsKeyPressed("ArrowLeft") &&
            !keyboard.getIsKeyPressed("ArrowRight")
          ) {
            this.fallingPiece.setDirection({ x: 0, y: 0 });
          }
        }
        keyboard.resetWereKeysPressed();

        // logic

        if (this.fallingPiece) {
          this.fallingPiece.update(dt);
        } else {
          this.areCounter -= dt;
          if (this.areCounter <= 0) {
            this.spawnPiece(this.getNextPiece());
          }
        }

        // rendering

        this.drawBoard();
        this.fallingPiece?.draw();
        this.drawNext();
        this.drawHeld();
        this.drawLevel();
        this.drawLines();
        this.drawScore();

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}
