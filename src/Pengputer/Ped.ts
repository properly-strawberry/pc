import { CGA_PALETTE_DICT } from "../Color/cgaPalette";
import { CgaColors } from "../Color/types";
import { readLine } from "../Functions";
import { getIsPrintable } from "../Screen/getIsPrintable";
import { Vector, vectorAdd, vectorSubtract } from "../Toolbox/Vector";
import { Rect } from "../types";
import { Executable } from "./FileSystem";
import { PC } from "./PC";

export class Ped implements Executable {
  private pc: PC;

  private fileData: string[];
  private cursorPosition: Vector;
  private windowRect: Rect;
  private viewRect: Rect;

  constructor(pc: PC) {
    this.pc = pc;

    this.fileData = [
      "Hello, world!",
      "",
      "Installing windows... Installing windows... Installing windows... Installing windows... Installing windows... Installing windows...",
    ];
    this.cursorPosition = {
      x: 0,
      y: 0,
    };
    const width = 5;
    const height = 5;
    this.windowRect = { x: 0, y: 0, w: width, h: height };
    this.viewRect = { x: 0, y: 0, w: width, h: height };
  }

  private updateViewRect() {
    if (this.cursorPosition.x >= this.viewRect.x + this.viewRect.w) {
      this.viewRect.x = this.cursorPosition.x - this.viewRect.w + 1;
    }
    if (this.cursorPosition.x < this.viewRect.x) {
      this.viewRect.x = this.cursorPosition.x;
    }
    if (this.cursorPosition.y >= this.viewRect.y + this.viewRect.h) {
      this.viewRect.y = this.cursorPosition.y - this.viewRect.h + 1;
    }
    if (this.cursorPosition.y < this.viewRect.y) {
      this.viewRect.y = this.cursorPosition.y;
    }
  }

  private async redrawScreen() {
    const { screen } = this.pc;

    screen.clear();

    let windowY = 0;
    let viewY = this.viewRect.y;
    while (
      windowY < this.windowRect.h &&
      viewY < this.viewRect.y + this.viewRect.h &&
      viewY < this.fileData.length
    ) {
      screen.displayString(
        vectorAdd(this.windowRect, { x: 0, y: windowY }),
        this.fileData[viewY].slice(
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
        vectorSubtract(this.cursorPosition, this.viewRect)
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

    const update = () => {
      this.updateViewRect();
      this.redrawScreen();
    };

    return new Promise<void>((resolve) => {
      update();
      const unsubKeyboard = keyboard.addTypeListener((char, keyCode, ev) => {
        if (keyCode === "ArrowLeft") {
          this.cursorPosition.x -= 1;
          if (this.cursorPosition.x < 0) {
            this.cursorPosition.x = 0;
          }
          update();
        } else if (keyCode === "ArrowRight") {
          this.cursorPosition.x += 1;
          update();
        } else if (keyCode === "ArrowUp") {
          this.cursorPosition.y -= 1;
          if (this.cursorPosition.y < 0) {
            this.cursorPosition.y = 0;
          }
          update();
        } else if (keyCode === "ArrowDown") {
          this.cursorPosition.y += 1;
          update();
        } else if (keyCode === "KeyQ") {
          unsubKeyboard();
          resolve();
        } else if (char && getIsPrintable(char)) {
          const newLine = Array.from(this.fileData[this.cursorPosition.y]);
          newLine.splice(this.cursorPosition.x, 0, char);
          this.fileData[this.cursorPosition.y] = newLine.join("");
          this.cursorPosition.x += 1;
          update();
        }
      });
    });
  }
}
