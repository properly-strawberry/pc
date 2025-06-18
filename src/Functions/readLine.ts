import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";
import { TypeListener, VoidListener } from "../Keyboard/Keyboard";
import { getIsModifierKey } from "../Keyboard/isModifierKey";

export const readLine = (
  screen: Screen,
  keyboard: Keyboard,
  {
    autoCompleteStrings = [],
    previousEntries = [],
  }: {
    autoCompleteStrings?: string[];
    previousEntries?: string[];
  } = {}
): Promise<string | null> => {
  let unsubType: (() => void) | null = null;
  let isUsingPreviousEntry = false;
  let previousEntryIndex = 0;
  let savedResult = "";

  const promise = new Promise<string | null>((resolve) => {
    let result = "";
    let curIndex = 0;

    const onType: TypeListener = (char, key, ev) => {
      if (ev.getModifierState("Control")) {
        if (key === "KeyC") {
          resolve(null);
        }
      } else {
        if (
          key === "Tab" &&
          autoCompleteStrings.length > 0 &&
          curIndex === result.length
        ) {
          isUsingPreviousEntry = false;
          let tokens = result.split(" ");
          if (tokens.length === 0) return;
          let token = tokens[tokens.length - 1];
          if (token.length === 0) return;

          const matchingAutoCompleteStrings = autoCompleteStrings.filter((s) =>
            s.startsWith(token)
          );

          if (matchingAutoCompleteStrings.length === 1) {
            const autoCompleteString = matchingAutoCompleteStrings[0];
            let prefix = autoCompleteString.slice(0, token.length);
            if (prefix === token) {
              screen.setCursorPositionDelta(
                {
                  x: -token.length,
                  y: 0,
                },
                true
              );
              screen.printString(autoCompleteString);
              result =
                result.slice(0, result.length - token.length) +
                autoCompleteString;
              curIndex = result.length;
            }
          }
        } else if (key === "Home") {
          screen.setCursorPositionDelta({ x: -curIndex, y: 0 }, true);
          curIndex = 0;
        } else if (key === "End") {
          screen.setCursorPositionDelta(
            {
              x: result.length - curIndex,
              y: 0,
            },
            true
          );
          curIndex = result.length;
        } else if (char === "\n") {
          screen.printChar(char);
          resolve(result);
          return;
        } else if (char === "\b") {
          if (curIndex > 0) {
            isUsingPreviousEntry = false;
            const stringStart = result.slice(0, curIndex - 1);
            const stringEnd = result.slice(curIndex);
            result = stringStart + stringEnd;
            curIndex = curIndex - 1;
            screen.setCursorPositionDelta({ x: -1, y: 0 }, true);
            screen.printString(stringEnd + " ");
            screen.setCursorPositionDelta(
              { x: -(stringEnd.length + 1), y: 0 },
              true
            );
          }
        } else if (key === "Delete") {
          if (curIndex < result.length) {
            isUsingPreviousEntry = false;
            const stringStart = result.slice(0, curIndex);
            const stringEnd = result.slice(curIndex + 1);
            result = stringStart + stringEnd;
            screen.printString(stringEnd + " ");
            screen.setCursorPositionDelta(
              { x: -(stringEnd.length + 1), y: 0 },
              true
            );
          }
        } else if (key === "ArrowLeft") {
          if (curIndex > 0) {
            curIndex -= 1;
            screen.setCursorPositionDelta({ x: -1, y: 0 }, true);
          }
        } else if (key === "ArrowRight") {
          if (curIndex < result.length) {
            curIndex += 1;
            screen.setCursorPositionDelta({ x: 1, y: 0 }, true);
          }
        } else if (key === "ArrowUp") {
          if (previousEntries.length > 0) {
            let replaceWith = "";
            if (!isUsingPreviousEntry) {
              isUsingPreviousEntry = true;
              savedResult = result;
              previousEntryIndex = previousEntries.length - 1;
              replaceWith = previousEntries[previousEntryIndex];
            } else if (previousEntryIndex > 0) {
              previousEntryIndex -= 1;
              replaceWith = previousEntries[previousEntryIndex];
            }
            if (replaceWith) {
              screen.setCursorPositionDelta({ x: -curIndex, y: 0 }, true);
              screen.printString(" ".repeat(result.length));
              screen.setCursorPositionDelta({ x: -result.length, y: 0 }, true);
              screen.printString(replaceWith);
              result = replaceWith;
              curIndex = replaceWith.length;
            }
          }
        } else if (key === "ArrowDown") {
          if (
            isUsingPreviousEntry &&
            previousEntryIndex < previousEntries.length
          ) {
            let replaceWith = "";
            previousEntryIndex += 1;
            if (previousEntryIndex < previousEntries.length) {
              replaceWith = previousEntries[previousEntryIndex];
            } else {
              replaceWith = savedResult;
            }
            screen.setCursorPositionDelta({ x: -curIndex, y: 0 }, true);
            screen.printString(" ".repeat(result.length));
            screen.setCursorPositionDelta({ x: -result.length, y: 0 }, true);
            screen.printString(replaceWith);
            result = replaceWith;
            curIndex = replaceWith.length;
          }
        } else if (char) {
          isUsingPreviousEntry = false;
          const rest = char + result.slice(curIndex);
          screen.printString(rest);
          screen.setCursorPositionDelta({ x: -rest.length + 1, y: 0 }, true);
          result = result.slice(0, curIndex) + rest;
          curIndex += 1;
        }
      }
    };
    unsubType = keyboard.addTypeListener(onType);
  });

  return promise.finally(() => {
    unsubType?.();
  });
};

export const readKey = (keyboard: Keyboard) => {
  let unsubType: (() => void) | null = null;

  const promise = new Promise<{ char: string | null; key: string }>(
    (resolve) => {
      const onType: TypeListener = (char, key) => {
        if (!getIsModifierKey(key)) {
          resolve({ char, key });
        }
      };
      unsubType = keyboard.addTypeListener(onType);
    }
  );

  return promise.finally(() => {
    unsubType?.();
  });
};

export const waitForKeysUp = (keyboard: Keyboard) => {
  let unsub: (() => void) | null = null;

  const promise = new Promise<void>((resolve) => {
    const onType: VoidListener = () => {
      resolve();
    };
    unsub = keyboard.addAllKeysUpListener(onType);
  });

  return promise.finally(() => {
    unsub?.();
  });
};
