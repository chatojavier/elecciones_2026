import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStoreMock } = vi.hoisted(() => ({
  getStoreMock: vi.fn()
}));

vi.mock("@netlify/blobs", () => ({
  getStore: getStoreMock
}));

import { readHealth, readSnapshot } from "../netlify/functions/_shared/storage";

describe("storage runtime contracts", () => {
  const blobs = new Map<string, unknown>();

  beforeEach(() => {
    blobs.clear();
    vi.clearAllMocks();
    getStoreMock.mockReturnValue({
      async get(key: string) {
        return blobs.get(key) ?? null;
      },
      async setJSON() {},
      async delete() {},
      async list() {
        return {
          blobs: [],
          directories: []
        };
      }
    });
  });

  it("devuelve null si snapshot en blob está corrupto", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    blobs.set("snapshot", {
      generatedAt: "2026-04-21T12:01:00.000Z"
    });

    const snapshot = await readSnapshot();

    expect(snapshot).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("blob inválido snapshot")
    );
  });

  it("devuelve null si health en blob está corrupto", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    blobs.set("health", {
      status: "healthy",
      source: "onpe",
      staleMinutes: "0"
    });

    const health = await readHealth();

    expect(health).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("blob inválido health")
    );
  });
});
