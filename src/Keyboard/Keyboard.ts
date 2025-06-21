import { ANSI_LAYOUT } from "./ansiLayout";

export type TypeListener = (
  char: string | null,
  keyCode: string,
  ev: KeyboardEvent
) => void;
export type VoidListener = () => void;

export class Keyboard {
  private pressed: string[];
  private werePressed: Set<string>;
  private layout: any;

  private typeListeners: Array<TypeListener>;
  private allKeysUpListeners: Array<VoidListener>;

  private autorepeatDelay: number;
  private autorepeatDelayCounter: number;
  private autorepeatInterval: number;
  private autorepeatIntervalCounter: number;
  private autorepeatEvent: KeyboardEvent | null;

  constructor() {
    this.pressed = [];
    this.werePressed = new Set();
    this.layout = ANSI_LAYOUT;

    window.addEventListener("keydown", this._onKeyDown.bind(this));
    window.addEventListener("keyup", this._onKeyUp.bind(this));

    this.typeListeners = [];
    this.allKeysUpListeners = [];

    this.autorepeatDelay = 250;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatInterval = 50;
    this.autorepeatIntervalCounter = this.autorepeatInterval;
    this.autorepeatEvent = null;
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.repeat) return;
    this.pressed.push(e.code);
    this.werePressed.add(e.code);
    this._onKeyTyped(e);
  }

  private _onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    this.pressed = this.pressed.filter((kc) => kc !== e.code);
    if (this.autorepeatEvent?.code === e.code) {
      this._resetAutorepeat();
    }
    if (this.pressed.length === 0) {
      this.allKeysUpListeners.forEach((callback) => callback());
    }
  }

  /** Get whether any key was pressed since last wasPressed reset. */
  public getWasKeyPressed(): Set<string> {
    return this.werePressed;
  }

  /** Reset wasPressed state. */
  public resetWereKeysPressed() {
    this.werePressed.clear();
  }

  private _resetAutorepeat() {
    this.autorepeatEvent = null;
    this.autorepeatDelayCounter = this.autorepeatDelay;
    this.autorepeatIntervalCounter = 0;
  }

  public printState() {
    console["log"](this.pressed);
  }

  public getIsKeyPressed(keyCode: string) {
    return this.pressed.includes(keyCode);
  }

  /** Takes a set of keyCodes. Returns the keyCode that was most recently pressed. Returns `null` otherwise. */
  public getLastPressedOf(keyCodes: string[]): string | null {
    let lastPressed = null;
    let lastPressedIndex = -1;

    for (const keyCode of keyCodes) {
      let index = this.pressed.findIndex((v) => v === keyCode);
      if (index > lastPressedIndex) {
        lastPressed = keyCode;
        lastPressedIndex = index;
      }
    }

    return lastPressed;
  }

  public addTypeListener(callback: TypeListener) {
    this.typeListeners.push(callback);
    return () => {
      this.typeListeners = this.typeListeners.filter((cb) => cb !== callback);
    };
  }

  public addAllKeysUpListener(callback: VoidListener) {
    this.allKeysUpListeners.push(callback);
    return () => {
      this.allKeysUpListeners = this.allKeysUpListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private _getCharFromLayout(ev: KeyboardEvent) {
    const { code: keyCode } = ev;
    const isShiftDown = ev.getModifierState("Shift");
    const isCapsOn = ev.getModifierState("CapsLock");

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

  private _onKeyTyped(ev: KeyboardEvent) {
    const char = this._getCharFromLayout(ev) ?? null;
    if (ev.code !== this.autorepeatEvent?.code) {
      this._resetAutorepeat();
      this.autorepeatEvent = ev;
    }
    this.typeListeners.forEach((callback) => callback(char, ev.code, ev));
  }

  public update(dt: any) {
    if (this.autorepeatEvent) {
      this.autorepeatDelayCounter -= dt;
      if (this.autorepeatDelayCounter <= 0) {
        this.autorepeatIntervalCounter -= dt;
        while (this.autorepeatIntervalCounter <= 0) {
          this.autorepeatIntervalCounter += this.autorepeatInterval;
          this._onKeyTyped(this.autorepeatEvent);
        }
      }
    }
  }
}
