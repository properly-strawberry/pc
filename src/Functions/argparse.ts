interface TokenData {
  start: number;
  token: string;
  end: number;
}

const getCharacter = (
  argsString: string,
  index: number
): { character: string; nextIndex: number; isEscape: boolean } | null => {
  if (index < 0 || index >= argsString.length) {
    return null;
  }

  const curChar = argsString[index];

  if (index < argsString.length - 1 && curChar === "\\") {
    const nextChar = argsString[index + 1];
    if (nextChar === '"') {
      return { character: '"', nextIndex: index + 2, isEscape: true };
    } else if (nextChar === " ") {
      return { character: " ", nextIndex: index + 2, isEscape: true };
    } else if (nextChar === "\\") {
      return { character: "\\", nextIndex: index + 2, isEscape: true };
    }
  }

  return {
    character: curChar,
    nextIndex: index + 1,
    isEscape: false,
  };
};

const getToken = (argsString: string, index: number): TokenData | null => {
  let tokenStartIndex = index;
  let tokenEndIndex = index;
  let tokenData = "";

  // trim start
  while (
    tokenStartIndex < argsString.length &&
    argsString[tokenStartIndex] === " "
  ) {
    tokenStartIndex += 1;
  }

  tokenEndIndex = tokenStartIndex;

  if (tokenEndIndex === argsString.length) {
    return null;
  }

  if (argsString[tokenEndIndex] === '"') {
    // parse string token

    // skip double quotes
    tokenEndIndex += 1;
    let char = getCharacter(argsString, tokenEndIndex);
    while (
      char &&
      (char.character !== '"' || (char.character === '"' && char.isEscape))
    ) {
      tokenData += char.character;
      tokenEndIndex = char.nextIndex;
      char = getCharacter(argsString, tokenEndIndex);
    }
    // skip ending double quotes if any
    tokenEndIndex = Math.min(tokenEndIndex + 1, argsString.length);
  } else {
    let char = getCharacter(argsString, tokenEndIndex);
    while (
      char &&
      (char.character !== " " || (char.character === " " && char.isEscape))
    ) {
      tokenData += char.character;
      tokenEndIndex = char.nextIndex;
      char = getCharacter(argsString, tokenEndIndex);
    }
  }

  return {
    start: tokenStartIndex,
    end: tokenEndIndex,
    token: tokenData,
  };
};

export const argparse = (argsString: string) => {
  let i = 0;
  let args = [];
  let token = getToken(argsString, i);
  while (token) {
    const { end, token: tokenData } = token;
    i = end;
    args.push(tokenData);
    token = getToken(argsString, i);
  }
  return args;
};
