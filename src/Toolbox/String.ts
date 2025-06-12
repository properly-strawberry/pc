export const padWithRightBias = (
  string: string,
  length: number,
  character: string = " "
) => {
  const spaceLeft = length - string.length;
  if (spaceLeft <= 0) {
    return string;
  }
  if (spaceLeft % 2 === 0) {
    const pad = spaceLeft / 2;
    return `${character.repeat(pad)}${string}${character.repeat(pad)}`;
  } else {
    const pad = Math.floor(spaceLeft / 2);
    return `${character.repeat(pad + 1)}${string}${character.repeat(pad)}`;
  }
};
