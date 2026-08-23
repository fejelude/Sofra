import("./src/index.js").catch((error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[Sofra] Fatal startup failure:\n${detail}`);
  process.exitCode = 1;
});
