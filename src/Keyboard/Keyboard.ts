import { ANSI_LAYOUT } from "./ansiLayout";

export class Keyboard {
  private pressed: Set<any>;
  private layout: any;

  private typeListeners: Array<(char: string | null, keyCode: string) => void>;
  private autorepeatDelay: number;
  private autorepeatDelayCounter: number;
  private autorepeatInterval: number;
  private autorepeatIntervalCounter: number;

  // CLEANUP(nic): maybe put this in an object
  private autorepeatKeyCode: string | null;
  private autorepeatKeyIsShiftDown: bool;
  private autorepeatKeyIsCapsOn: bool;

  constructor() {
    this.pressed = new Set();
    this.layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this.typeListeners = [];

    this.autorepeatDelay = 250;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatInterval = 50;
    this.autorepeatIntervalCounter = this.autorepeatInterval;
    this.autorepeatKeyCode = null;
  }

  _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    if (e.repeat) return;
    this.pressed.add(e.code);

    const isShiftDown = e.getModifierState("Shift");
    const isCapsOn = e.getModifierState("CapsLock");
    this._simulateKeyPress(e.code, isShiftDown, isCapsOn);
  }

  _onKeyUp(e: KeyboardEvent) {
    this.pressed.delete(e.code);
    if (this.autorepeatKeyCode === e.code) {
      this._resetAutorepeat();
    }
  }

  _resetAutorepeat() {
    this.autorepeatKeyCode = null;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatIntervalCounter = 0;
  }

  printState() {
    console["log"](this.pressed);
  }

  getIsKeyPressed(keyCode: any) {
    return this.pressed.has(keyCode);
  }

  addTypeListener(callback: any) {
    this.typeListeners.push(callback);
    return () => {
      this.typeListeners = this.typeListeners.filter(
        (cb: any) => cb !== callback
      );
    };
  }

  _getCharFromLayout(keyCode: string, isShiftDown: bool, isCapsOn: bool) {
    const shiftLayout = this.layout["@shift"];
    const capsLayout = this.layout["@caps"];
    const capsShiftLayout = this.layout["@caps-shift"];

    if (isCapsOn && capsLayout) {
      if (isShiftDown && capsShiftLayout && capsShiftLayout[keyCode]) {
        return capsShiftLayout[keyCode];
      }

      if (capsLayout[keyCode]) {
        return capsLayout[keyCode];
      }
    }

    if (isShiftDown) {
      if (shiftLayout && shiftLayout[keyCode]) {
        return shiftLayout[keyCode];
      }
      return null;
    }

    if (this.layout[keyCode]) {
      return this.layout[keyCode];
    }

    return null;
  }

  _simulateKeyPress(keyCode: string, isShiftDown: bool, isCapsOn: bool) {
    const char = this._getCharFromLayout(keyCode, isShiftDown, isCapsOn) ?? null;
    if (keyCode !== this.autorepeatKeyCode) {
      this._resetAutorepeat();
      this.autorepeatKeyCode = keyCode;
      this.autorepeatIsShiftDown = isShiftDown;
      this.autorepeatIsCapsOn = isCapsOn;
    }
    this.typeListeners.forEach((callback: any) => callback(char, keyCode));
  }

  simulateKeyDown(keyCode: string, isShiftDown: bool, isCapsOn: bool) {
    this.pressed.add(keyCode);
    this._simulateKeyPress(keyCode, isShiftDown, isCapsOn);
  }

  simulateKeyUp(keyCode: string) {
    if (this.autorepeatKeyCode === keyCode) {
      this._resetAutorepeat();
    }
  }

  update(dt: any) {
    if (this.autorepeatKeyCode != null) {
      this.autorepeatDelayCounter -= dt;
      if (this.autorepeatDelayCounter <= 0) {
        this.autorepeatIntervalCounter -= dt;
        while (this.autorepeatIntervalCounter <= 0) {
          this.autorepeatIntervalCounter += this.autorepeatInterval;
          this._simulateKeyPress(this.autorepeatKeyCode, this.autorepeatIsShiftDown, this.autorepeatIsCapsOn);
        }
      }
    }
  }
}
