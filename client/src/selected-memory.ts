/**
 * ENGRAM — tiny pub/sub store for the currently-selected memory, plus the
 * real server payloads already fetched for it (custody chain and record).
 * Written by SelectionSystem, read by TraceSystem / CustodyChainSystem /
 * FieldSystem — mirrors session.ts's pattern so no system has to duplicate
 * another's ECS query or issue a second fetch for data already in hand.
 *
 * Nothing here derives or computes anything: it carries server values
 * verbatim and forgets them when the selection clears.
 */
import type { CustodyChain, MemoryDetail } from './engram-api.js';

let current: string | null = null;
let currentCustody: CustodyChain | null = null;
let currentDetail: MemoryDetail | null = null;
const listeners = new Set<(memoryId: string | null) => void>();
const recordListeners = new Set<(chain: CustodyChain | null, detail: MemoryDetail | null) => void>();

function emitRecord(): void {
  for (const fn of recordListeners) fn(currentCustody, currentDetail);
}

export const SelectedMemory = {
  get: (): string | null => current,
  set: (memoryId: string | null): void => {
    current = memoryId;
    if (memoryId === null) {
      currentCustody = null;
      currentDetail = null;
      emitRecord();
    }
    for (const fn of listeners) fn(current);
  },
  subscribe: (fn: (memoryId: string | null) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** The server-returned record for the selected memory (never synthesized). */
  getCustody: (): CustodyChain | null => currentCustody,
  getDetail: (): MemoryDetail | null => currentDetail,
  setRecord: (chain: CustodyChain | null, detail: MemoryDetail | null): void => {
    currentCustody = chain;
    currentDetail = detail;
    emitRecord();
  },
  subscribeRecord: (
    fn: (chain: CustodyChain | null, detail: MemoryDetail | null) => void,
  ): (() => void) => {
    recordListeners.add(fn);
    return () => recordListeners.delete(fn);
  },
};
