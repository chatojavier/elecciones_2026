/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useElectionData } from "../src/hooks/useElectionData";
import type { ElectionSnapshot, HealthStatus } from "../src/lib/types";

const { fetchAppDataMock, refreshAppDataMock, trackEventMock } = vi.hoisted(() => ({
  fetchAppDataMock: vi.fn(),
  refreshAppDataMock: vi.fn(),
  trackEventMock: vi.fn()
}));

vi.mock("../src/lib/api", () => ({
  fetchAppData: fetchAppDataMock,
  refreshAppData: refreshAppDataMock
}));

vi.mock("../src/lib/analytics", () => ({
  trackEvent: trackEventMock
}));

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}) {
  return {
    generatedAt: "2026-04-15T12:05:00.000Z",
    sourceLastUpdatedAt: "2026-04-15T12:00:00.000Z",
    ...overrides
  } as ElectionSnapshot;
}

function createHealth(overrides: Partial<HealthStatus> = {}) {
  return {
    lastSuccessAt: "2026-04-15T12:05:00.000Z",
    ...overrides
  } as HealthStatus;
}

describe("useElectionData", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hook: ReturnType<typeof useElectionData> | null = null;

  function Harness({ clockNow }: { clockNow: number }) {
    hook = useElectionData({ clockNow });
    return null;
  }

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchAppDataMock.mockReset();
    refreshAppDataMock.mockReset();
    trackEventMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    hook = null;
  });

  it("carga inicial, maneja errores y conserva snapshot en fallos de background", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:16:00.000Z"));
    const initialSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:00:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T11:58:00.000Z"
    });
    const refreshedSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:05:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T12:04:00.000Z"
    });
    const autoSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:17:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T12:16:00.000Z"
    });

    fetchAppDataMock.mockResolvedValue({
      snapshot: initialSnapshot,
      health: createHealth({ lastSuccessAt: initialSnapshot.generatedAt })
    });
    refreshAppDataMock
      .mockResolvedValueOnce({
        snapshot: refreshedSnapshot,
        health: createHealth({ lastSuccessAt: refreshedSnapshot.generatedAt })
      })
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({
        snapshot: autoSnapshot,
        health: createHealth({ lastSuccessAt: autoSnapshot.generatedAt })
      });

    await act(async () => {
      root.render(<Harness clockNow={new Date("2026-04-15T12:16:00.000Z").getTime()} />);
    });

    await act(async () => {
      await hook?.actions.loadInitial();
    });
    expect(hook?.data.loading).toBe(false);
    expect(hook?.data.snapshot?.generatedAt).toBe(initialSnapshot.generatedAt);

    await act(async () => {
      await hook?.actions.refreshManual();
    });
    expect(hook?.data.snapshot?.generatedAt).toBe(refreshedSnapshot.generatedAt);
    expect(hook?.data.refreshFeedback?.message).toBe("App actualizada correctamente.");
    expect(trackEventMock).toHaveBeenCalledWith(
      "refresh_manual_success",
      expect.objectContaining({
        snapshot_generated_at: refreshedSnapshot.generatedAt
      })
    );

    await act(async () => {
      await hook?.actions.refreshManual();
    });
    expect(hook?.data.snapshot?.generatedAt).toBe(refreshedSnapshot.generatedAt);
    expect(hook?.data.refreshFeedback?.message).toBe("No se pudo actualizar. Intenta nuevamente.");
    expect(trackEventMock).toHaveBeenCalledWith(
      "refresh_manual_error",
      expect.objectContaining({
        error_message: "timeout",
        snapshot_generated_at: refreshedSnapshot.generatedAt
      })
    );

    await act(async () => {
      await hook?.actions.maybeRefreshAuto({
        appLastSuccessAt: refreshedSnapshot.generatedAt,
        shouldRefresh: true,
        refreshKey: `${refreshedSnapshot.generatedAt}:${refreshedSnapshot.generatedAt}`,
        now: new Date("2026-04-15T12:16:00.000Z").getTime()
      });
    });
    expect(hook?.data.snapshot?.generatedAt).toBe(refreshedSnapshot.generatedAt);
    expect(hook?.data.refreshFeedback).toBeNull();
    expect(refreshAppDataMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      await hook?.actions.maybeRefreshAuto({
        appLastSuccessAt: refreshedSnapshot.generatedAt,
        shouldRefresh: true,
        refreshKey: `${refreshedSnapshot.generatedAt}:${refreshedSnapshot.generatedAt}`,
        now: new Date("2026-04-15T12:16:30.000Z").getTime()
      });
    });
    expect(refreshAppDataMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      await hook?.actions.maybeRefreshAuto({
        appLastSuccessAt: refreshedSnapshot.generatedAt,
        shouldRefresh: true,
        refreshKey: `${refreshedSnapshot.generatedAt}:${refreshedSnapshot.generatedAt}`,
        now: new Date("2026-04-15T12:21:00.000Z").getTime()
      });
    });
    expect(refreshAppDataMock).toHaveBeenCalledTimes(4);
    expect(hook?.data.snapshot?.generatedAt).toBe(autoSnapshot.generatedAt);
    expect(hook?.data.refreshFeedback).toBeNull();

    fetchAppDataMock.mockRejectedValueOnce(new Error("init failed"));
    await act(async () => {
      await hook?.actions.loadInitial();
    });
    expect(hook?.data.error).toBe("init failed");
    vi.useRealTimers();
  });
});
