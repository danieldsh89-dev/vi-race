import { beforeEach, vi } from "vitest";
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Red no simulada prohibida en pruebas locales");
    }),
  );
});
