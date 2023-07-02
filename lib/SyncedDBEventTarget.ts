import { SyncedDBEventMap } from "./SyncedDBEventMap.ts";

export interface SyncedDBEventTarget<T> extends EventTarget {
  addEventListener<K extends keyof SyncedDBEventMap<T>>(
    type: K,
    listener: (ev: SyncedDBEventMap<T>[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener<K extends keyof SyncedDBEventMap<T>>(
    type: K,
    listener: ((ev: SyncedDBEventMap<T>[K]) => void) | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
}
