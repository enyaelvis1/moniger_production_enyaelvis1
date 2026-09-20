export const waitForUiFrame = async () => {
  if (typeof window === "undefined") {
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
};
