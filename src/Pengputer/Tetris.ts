/*
Sources:
- https://listfist.com/list-of-tetris-levels-by-speed-nes-ntsc-vs-pal
- https://tetris.wiki/Tetris_(NES)
*/

import _ from "lodash";
import { readKey, readLine, waitFor } from "../Functions";
import { getIsPositionInRect, Rect, Size } from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";
import { Screen } from "../Screen";
import { Vector, vectorAdd, vectorEqual, zeroVector } from "../Toolbox/Vector";

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
const HEIGHT = 20;
const CELL_WIDTH = 2;
const CELL_HEIGHT = 1;
const BORDER_SIZE = 1;
const NUM_CELLS = WIDTH * HEIGHT;
const BOARD_RECT: Rect = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

const DAS_DELAY_LENGTH = 16 * msPerFrame;
const DAS_LENGTH = 6 * msPerFrame;

enum Piece {
  I = "I",
  O = "O",
  J = "J",
  L = "L",
  S = "S",
  T = "T",
  Z = "Z",
}

interface PieceDescriptor {
  size: Size;
  rotations: Array<string>;
  spawnPosition: Vector;
}

const pieceDescriptors: Record<Piece, PieceDescriptor> = {
  [Piece.I]: {
    size: { w: 4, h: 4 },
    rotations: ["        XXXX    ", "  X   X   X   X "],
    spawnPosition: { x: 3, y: -2 },
  },
  [Piece.O]: {
    size: { w: 2, h: 2 },
    rotations: ["XXXX"],
    spawnPosition: { x: 4, y: 0 },
  },
  [Piece.J]: {
    size: { w: 3, h: 3 },
    rotations: ["   XXX  X", " X  X XX ", "X  XXX   ", " XX X  X "],
    spawnPosition: { x: 4, y: -1 },
  },
  [Piece.L]: {
    size: { w: 3, h: 3 },
    rotations: ["   XXXX  ", "XX  X  X ", "  XXXX   ", " X  X  XX"],
    spawnPosition: { x: 4, y: -1 },
  },
  [Piece.S]: {
    size: { w: 3, h: 3 },
    rotations: ["    XXXX ", " X  XX  X", "    XXXX ", " X  XX  X"],
    spawnPosition: { x: 4, y: -1 },
  },
  [Piece.T]: {
    size: { w: 3, h: 3 },
    rotations: ["   XXX X ", " X XX  X ", " X XXX   ", " X  XX X "],
    spawnPosition: { x: 4, y: -1 },
  },
  [Piece.Z]: {
    size: { w: 3, h: 3 },
    rotations: ["   XX  XX", "  X XX X ", "   XX  XX", "  X XX X "],
    spawnPosition: { x: 4, y: -1 },
  },
};

interface Cell {
  filled: boolean;
}

class FallingPiece {
  private descriptor: PieceDescriptor;
  private size: Size;
  private position: Vector;
  private currentRotation: number;
  private grid: string;

  private onCollide: Signal<void> = new Signal<void>();

  private msPerCell: number;
  private stepCounter: number;

  private direction: Vector;
  private dasDelayCounter: number;
  private dasCounter: number;

  private ctx: Tetris;

  constructor(ctx: Tetris, piece: Piece, level: Level) {
    this.ctx = ctx;
    this.descriptor = pieceDescriptors[piece];
    this.size = { ...this.descriptor.size };
    this.position = { ...this.descriptor.spawnPosition };

    this.currentRotation = 0;
    this.grid = this.descriptor.rotations[this.currentRotation];

    this.msPerCell = level.msPerCell;
    this.stepCounter = this.msPerCell;

    this.direction = { x: 0, y: 0 };
    this.dasDelayCounter = DAS_DELAY_LENGTH;
    this.dasCounter = 0;
  }

  public draw() {
    this.doForEachSquare((boardPosition) => {
      this.ctx.drawSquare(boardPosition);
    });
  }

  private doForEachSquare(fn: (boardPosition: Vector) => void) {
    for (let y = 0; y < this.size.h; y += 1) {
      for (let x = 0; x < this.size.w; x += 1) {
        if (this.grid[y * this.size.w + x] === "X") {
          fn({
            x: this.position.x + x,
            y: this.position.y + y,
          });
        }
      }
    }
  }

  private updateGrid() {
    this.grid = this.descriptor.rotations[this.currentRotation];
  }

  private _rotateRight() {
    this.currentRotation += 1;
    while (this.currentRotation >= this.descriptor.rotations.length) {
      this.currentRotation -= this.descriptor.rotations.length;
    }
    this.updateGrid();
  }

  public rotateRight() {
    this._rotateRight();
    if (this.getIsCollidingBoardEdges()) {
      this._rotateLeft();
    }
  }

  private _rotateLeft() {
    this.currentRotation -= 1;
    while (this.currentRotation < 0) {
      this.currentRotation += this.descriptor.rotations.length;
    }
    this.updateGrid();
  }

  public rotateLeft() {
    this._rotateLeft();
    if (this.getIsCollidingBoardEdges()) {
      this._rotateRight();
    }
  }

  private getIsCollidingBoardEdges() {
    let isColliding = false;
    this.doForEachSquare((pos) => {
      isColliding = isColliding || !getIsPositionInRect(pos, BOARD_RECT);
    });
    return isColliding;
  }

  private moveInDirection() {
    const oldPosition = this.position;
    this.position = vectorAdd(this.position, this.direction);
    if (this.getIsCollidingBoardEdges()) {
      this.position = oldPosition;
    }
  }

  public moveDown() {
    this.position.y += 1;
  }

  public step() {
    this.position.y += 1;
    if (this.getIsCollidingBoardEdges()) {
      // hit ground
      this.position.y -= 1;
    }
  }

  public update(dt: number) {
    this.stepCounter -= dt;
    while (this.stepCounter < 0) {
      this.stepCounter += this.msPerCell;
      this.step();
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
}

class Board {
  private board: Array<Cell>;

  constructor() {
    this.board = new Array(NUM_CELLS);
    for (let i = 0; i < NUM_CELLS; i += 1) {
      this.board[i] = { filled: false };
    }
  }

  private getBoardIndexFromBoardPosition(boardPosition: Vector): number {
    return boardPosition.y * WIDTH + boardPosition.x;
  }

  public getCell(pos: Vector): Cell {
    return this.board[this.getBoardIndexFromBoardPosition(pos)];
  }
}

export class Tetris implements Executable {
  private pc: PC;
  private board: Board;
  private boardScreenRect: Rect;
  private fallingPiece: FallingPiece | null = null;

  constructor(pc: PC) {
    this.pc = pc;

    const { screen } = this.pc;

    this.board = new Board();

    const screenSize = screen.getSizeInCharacters();

    this.boardScreenRect = {
      x: Math.floor((screenSize.w - WIDTH * CELL_WIDTH - 2 * BORDER_SIZE) / 2),
      y: screenSize.h - HEIGHT * CELL_HEIGHT - 2 * BORDER_SIZE,
      w: WIDTH * CELL_WIDTH,
      h: HEIGHT * CELL_HEIGHT,
    };
  }

  private init() {
    const { screen } = this.pc;
    screen.clear();
    screen.displayString(
      { x: 0, y: 0 },
      _.pad("======== P E N G T R I S ========", screen.getSizeInCharacters().w)
    );
  }

  private getScreenPositionFromBoardPosition(
    boardPosition: Vector
  ): Vector | null {
    if (!getIsPositionInRect(boardPosition, BOARD_RECT)) return null;

    return {
      x: this.boardScreenRect.x + boardPosition.x * CELL_WIDTH,
      y: this.boardScreenRect.y + boardPosition.y * CELL_HEIGHT,
    };
  }

  public drawSquare(boardPosition: Vector) {
    const { screen } = this.pc;
    const screenPos = this.getScreenPositionFromBoardPosition(boardPosition);
    if (screenPos) {
      screen.displayString(screenPos, "██");
    }
  }

  private drawBorder() {
    const { screen } = this.pc;
    screen.displayString(
      {
        x: this.boardScreenRect.x - 1,
        y: this.boardScreenRect.y - 1,
      },
      // "╔" + "═".repeat(WIDTH * CELL_WIDTH) + "╗"
      "╔00112233445566778899╗"
    );
    for (
      let y = this.boardScreenRect.y;
      y < this.boardScreenRect.y + HEIGHT * CELL_HEIGHT;
      y += 1
    ) {
      screen.displayString(
        { x: this.boardScreenRect.x - 1, y },
        "║" + " ".repeat(WIDTH * CELL_WIDTH) + "║"
      );
    }
    screen.displayString(
      {
        x: this.boardScreenRect.x - 1,
        y: this.boardScreenRect.y + HEIGHT * CELL_HEIGHT,
      },
      "╚" + "═".repeat(WIDTH * CELL_WIDTH) + "╝"
    );
  }

  private drawBoardPieces() {
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const boardPos = { x, y };
        const cell = this.board.getCell(boardPos);
        if (cell.filled) {
          this.drawSquare(boardPos);
        }
      }
    }
  }

  private drawBoard() {
    const { screen } = this.pc;
    this.drawBorder();
    this.drawBoardPieces();
  }

  async run(args: string[]) {
    return new Promise<void>((resolve) => {
      const { screen, keyboard } = this.pc;
      screen.hideCursor();
      this.init();
      this.fallingPiece = new FallingPiece(this, Piece.T, levels[7]);
      let lastTime = performance.now();

      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        // input

        const beenPressed = keyboard.getWasKeyPressed();
        if (beenPressed.has("ArrowUp")) {
          this.fallingPiece?.rotateRight();
        }
        if (beenPressed.has("Enter")) {
          resolve();
        }
        if (this.fallingPiece) {
          if (beenPressed.has("ArrowLeft")) {
            this.fallingPiece.setDirection({ x: -1, y: 0 });
          } else if (beenPressed.has("ArrowRight")) {
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

        this.fallingPiece?.update(dt);

        // rendering

        this.drawBoard();
        this.fallingPiece?.draw();

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}
