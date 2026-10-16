import { afterEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue } from "../lib/session-sync.js";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function deferred() { let resolve; const promise=new Promise((done)=>{resolve=done;}); return {promise,resolve}; }

describe("serialized session saving", () => {
  it("debounces to the latest snapshot", async () => {
    vi.useFakeTimers(); const send=vi.fn().mockResolvedValue("synced"), status=vi.fn();
    const queue=createSaveQueue({send,onStatus:status});
    queue.queue("a",{value:1}); queue.queue("a",{value:2});
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith({value:2},false);
    expect(status).toHaveBeenLastCalledWith("a","synced");
  });
  it("serializes same-session writes and ignores stale Saved responses", async () => {
    vi.useFakeTimers(); const first=deferred(),second=deferred();
    const send=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),status=vi.fn();
    const queue=createSaveQueue({send,onStatus:status});
    queue.queue("a",{value:1}); const finished=queue.flush("a"); await Promise.resolve();
    queue.queue("a",{value:2}); await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1);
    first.resolve("synced"); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(status.mock.calls.filter(([,value])=>value==="synced")).toHaveLength(0);
    second.resolve("synced"); await finished;
    expect(send.mock.calls.map(([payload])=>payload.value)).toEqual([1,2]);
    expect(status).toHaveBeenLastCalledWith("a","synced");
  });
  it("flushes separate sessions independently and forwards keepalive", async () => {
    vi.useFakeTimers(); const send=vi.fn().mockResolvedValue("local"),status=vi.fn();
    const queue=createSaveQueue({send,onStatus:status}); queue.queue("a",{value:1});queue.queue("b",{value:2});
    await queue.flushAll(true); expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.every(([,keepalive])=>keepalive===true)).toBe(true);
    expect(status).toHaveBeenLastCalledWith("b","local");
  });
  it("recovers after synchronous or asynchronous send failures", async () => {
    vi.useFakeTimers(); vi.spyOn(console,"warn").mockImplementation(()=>{});
    const send=vi.fn().mockImplementationOnce(()=>{throw new Error("offline");}).mockRejectedValueOnce(new Error("offline")).mockResolvedValue("synced"),status=vi.fn();
    const queue=createSaveQueue({send,onStatus:status});
    queue.queue("a",{});await queue.flush("a"); expect(status).toHaveBeenLastCalledWith("a","error");
    queue.queue("a",{});await queue.flush("a"); expect(status).toHaveBeenLastCalledWith("a","error");
    queue.queue("a",{});await queue.flush("a"); expect(status).toHaveBeenLastCalledWith("a","synced");
  });
});
