import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { readLine } from "../Functions";
import { getIsPrintable } from "../Screen/getIsPrintable";
import {
  Vector,
  vectorAdd,
  vectorClone,
  vectorSubtract,
} from "../Toolbox/Vector";
import { Rect } from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

class TextBuffer {
  public rows: string[];
  private cursorPosition: Vector;

  constructor(originalText: string) {
    this.rows = originalText.split("\n");
    this.cursorPosition = { x: 0, y: 0 };
  }

  public getCursorPosition() {
    return vectorClone(this.cursorPosition);
  }

  public moveCursor(delta: Vector) {
    if (delta.x && delta.y) {
      throw new Error(
        "Cannot move cursor in both dimensions at the same time."
      );
    }

    if (delta.x) {
      this.cursorPosition.x += delta.x;
      if (this.cursorPosition.x < 0) {
        this.cursorPosition.x = 0;
      } else if (
        this.cursorPosition.x > this.rows[this.cursorPosition.y].length
      ) {
        this.cursorPosition.x = this.rows[this.cursorPosition.y].length;
      }
    }

    if (delta.y) {
      this.cursorPosition.y += delta.y;
      if (this.cursorPosition.y < 0) {
        this.cursorPosition.y = 0;
      } else if (this.cursorPosition.y >= this.rows.length) {
        this.cursorPosition.y = this.rows.length - 1;
      }

      if (this.cursorPosition.x < 0) {
        this.cursorPosition.x = 0;
      } else if (
        this.cursorPosition.x > this.rows[this.cursorPosition.y].length
      ) {
        this.cursorPosition.x = this.rows[this.cursorPosition.y].length;
      }
    }
  }

  public moveCursorDocumentHome() {
    this.cursorPosition.x = 0;
    this.cursorPosition.y = 0;
  }

  public moveCursorHome() {
    this.cursorPosition.x = 0;
  }

  public moveCursorEnd() {
    this.cursorPosition.x = this.rows[this.cursorPosition.y].length;
  }

  public moveCursorDocumentEnd() {
    this.cursorPosition.y = this.rows.length - 1;
    this.cursorPosition.x = this.rows[this.cursorPosition.y].length;
  }

  public insertCharacter(char: string) {
    const newLine = Array.from(this.rows[this.cursorPosition.y]);
    newLine.splice(this.cursorPosition.x, 0, char);
    this.rows[this.cursorPosition.y] = newLine.join("");
    this.cursorPosition.x += 1;
  }

  public backspace() {
    if (this.cursorPosition.x > 0) {
      const newLine = Array.from(this.rows[this.cursorPosition.y]);
      newLine.splice(this.cursorPosition.x - 1, 1);
      this.rows[this.cursorPosition.y] = newLine.join("");
      this.cursorPosition.x -= 1;
    } else if (this.cursorPosition.y > 0) {
      const [removedLine] = this.rows.splice(this.cursorPosition.y, 1);
      this.cursorPosition.y -= 1;
      this.cursorPosition.x = this.rows[this.cursorPosition.y].length;
      this.rows[this.cursorPosition.y] = `${
        this.rows[this.cursorPosition.y]
      }${removedLine}`;
    }
  }

  public delete() {
    if (this.cursorPosition.x < this.rows[this.cursorPosition.y].length) {
      const newLine = Array.from(this.rows[this.cursorPosition.y]);
      newLine.splice(this.cursorPosition.x, 1);
      this.rows[this.cursorPosition.y] = newLine.join("");
    } else if (this.cursorPosition.y < this.rows.length) {
      const [removedLine] = this.rows.splice(this.cursorPosition.y + 1, 1);
      this.rows[this.cursorPosition.y] = `${
        this.rows[this.cursorPosition.y]
      }${removedLine}`;
    }
  }

  public newLine() {
    const restOfLine = this.rows[this.cursorPosition.y].slice(
      this.cursorPosition.x
    );

    const newLine = Array.from(this.rows[this.cursorPosition.y]);
    newLine.splice(
      this.cursorPosition.x,
      this.rows[this.cursorPosition.y].length - this.cursorPosition.x
    );
    this.rows[this.cursorPosition.y] = newLine.join("");

    this.rows.splice(this.cursorPosition.y + 1, 0, restOfLine);
    this.cursorPosition.x = 0;
    this.cursorPosition.y += 1;
  }
}

export class Ped implements Executable {
  private pc: PC;
  private textBuffer: TextBuffer;

  private windowRect: Rect;
  private viewRect: Rect;

  constructor(pc: PC) {
    this.pc = pc;

    this.textBuffer = new TextBuffer(
      [
        "Hello, world!",
        "",
        "Installing windows... Installing windows... Installing windows... Installing windows... Installing windows... Installing windows...",
      ].join("\n")
    );

    const width = 78;
    const height = 23;
    this.windowRect = { x: 1, y: 1, w: width, h: height };
    this.viewRect = { x: 1, y: 1, w: width, h: height };
  }

  private updateViewRect() {
    const cursorPosition = this.textBuffer.getCursorPosition();

    if (cursorPosition.x >= this.viewRect.x + this.viewRect.w) {
      this.viewRect.x = cursorPosition.x - this.viewRect.w + 1;
    }
    if (cursorPosition.x < this.viewRect.x) {
      this.viewRect.x = cursorPosition.x;
    }
    if (cursorPosition.y >= this.viewRect.y + this.viewRect.h) {
      this.viewRect.y = cursorPosition.y - this.viewRect.h + 1;
    }
    if (cursorPosition.y < this.viewRect.y) {
      this.viewRect.y = cursorPosition.y;
    }
  }

  private async redrawScreen() {
    const { screen } = this.pc;
    const { textBuffer } = this;

    screen.clear();

    let windowY = 0;
    let viewY = this.viewRect.y;
    while (
      windowY < this.windowRect.h &&
      viewY < this.viewRect.y + this.viewRect.h &&
      viewY < textBuffer.rows.length
    ) {
      screen.displayString(
        vectorAdd(this.windowRect, { x: 0, y: windowY }),
        textBuffer.rows[viewY].slice(
          this.viewRect.x,
          this.viewRect.x + this.viewRect.w
        ),
        undefined,
        false
      );

      windowY += 1;
      viewY += 1;
    }

    this.pc.screen.setCursorPosition(
      vectorAdd(
        this.windowRect,
        vectorSubtract(this.textBuffer.getCursorPosition(), this.viewRect)
      )
    );
  }

  async run(args: string[]) {
    this.pc.screen.updateCurrentAttributes((cur) => ({
      ...cur,
      bgColor: CGA_PALETTE_DICT[CgaColors.Blue],
      fgColor: CGA_PALETTE_DICT[CgaColors.LightGray],
    }));
    this.pc.screen.clear();

    const { screen, keyboard } = this.pc;
    const { textBuffer } = this;

    const update = () => {
      this.updateViewRect();
      this.redrawScreen();
    };

    return new Promise<void>((resolve) => {
      update();
      const unsubKeyboard = keyboard.addTypeListener((char, keyCode, ev) => {
        if (keyCode === "ArrowLeft") {
          textBuffer.moveCursor({ x: -1, y: 0 });
          update();
        } else if (keyCode === "ArrowRight") {
          textBuffer.moveCursor({ x: 1, y: 0 });
          update();
        } else if (keyCode === "ArrowUp") {
          textBuffer.moveCursor({ x: 0, y: -1 });
          update();
        } else if (keyCode === "ArrowDown") {
          textBuffer.moveCursor({ x: 0, y: 1 });
          update();
        } else if (keyCode === "Home") {
          if (ev.getModifierState("Control")) {
            textBuffer.moveCursorDocumentHome();
          } else {
            textBuffer.moveCursorHome();
          }
          update();
        } else if (keyCode === "End") {
          if (ev.getModifierState("Control")) {
            textBuffer.moveCursorDocumentEnd();
          } else {
            textBuffer.moveCursorEnd();
          }
          update();
        } else if (keyCode === "F4") {
          unsubKeyboard();
          resolve();
        } else if (keyCode === "Backspace") {
          textBuffer.backspace();
          update();
        } else if (keyCode === "Enter") {
          textBuffer.newLine();
          update();
        } else if (keyCode === "Delete") {
          textBuffer.delete();
          update();
        } else if (ev.getModifierState("Control") && keyCode === "KeyV") {
          for (const char of "ab\ncd") {
            if (char === "\n") {
              textBuffer.newLine();
            } else {
              textBuffer.insertCharacter(char);
            }
          }
          update();
        } else if (char && getIsPrintable(char)) {
          textBuffer.insertCharacter(char);
          update();
        }
      });
    });
  }
}
