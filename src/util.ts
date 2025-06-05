export const dataURLToImageBitmap = async (url: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await createImageBitmap(blob);
};
