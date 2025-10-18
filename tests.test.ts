import { compare } from "uint8arrays";
import { describe, expect, test, vi } from "vitest";
import * as Y from "yjs";
import { diff_position } from "./utils.js";

describe("Yjs tests", () => {
  test("two independent structurally equal documents do not have the same state", () => {
    const doc1 = new Y.Doc({ guid: "test-doc1" });
    const doc2 = new Y.Doc({ guid: "test-doc2" });
    doc1.getMap("v2").set("test", "hello");
    doc2.getMap("v2").set("test", "hello");

    expect(
      Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2)),
    ).length.greaterThan(0);
    expect(
      compare(Y.encodeStateAsUpdate(doc1), Y.encodeStateAsUpdate(doc2)),
    ).not.toBe(0);
  });

  test("updates always trigger callback even if it will not result on a visible change", () => {
    const doc1 = new Y.Doc();
    const spy = vi.fn();

    doc1.on("update", spy);

    doc1.getMap("v2").set("test", "hello");
    doc1.getMap("v2").set("test", "hello");

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("same object encodes as an update always", () => {
    const doc1 = new Y.Doc({ guid: "test-doc1" });
    expect(
      Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc1)),
    ).length.greaterThan(0);
  });

  test("two documents without changes have the same state vectos", () => {
    const doc1 = new Y.Doc({ guid: "test-doc1" });
    const doc2 = new Y.Doc({ guid: "test-doc1" });
    expect(Y.decodeStateVector(Y.encodeStateVector(doc2))).toStrictEqual(
      Y.decodeStateVector(Y.encodeStateVector(doc1)),
    );
  });

  test("state vectors converge", () => {
    const doc1 = new Y.Doc({ guid: "test-doc1" });
    const doc2 = new Y.Doc({ guid: "test-doc1" });

    doc1.getMap("v2").set("test", "hello");
    doc2.getMap("v2").set("test", "hello");

    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    expect(Y.decodeStateVector(Y.encodeStateVector(doc2))).toStrictEqual(
      Y.decodeStateVector(Y.encodeStateVector(doc1)),
    );
  });

  test("synced child types end up having the same JSON", () => {
    const doc1 = new Y.Doc({ guid: "test-doc1" });
    const doc2 = new Y.Doc({ guid: "test-doc1" });

    doc1.getMap("v2").set("test1", "hello");
    doc2.getMap("v2").set("test2", "hello");

    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));

    // compare the maps or docs to know if they have all updates of the rest
    expect(doc1.getMap("v2").toJSON()).toStrictEqual(
      doc2.getMap("v2").toJSON(),
    );
  });

  test("encodeStateAsUpdate is indempotent", () => {
    const doc1 = new Y.Doc({ guid: "test-doc1" });
    const state1 = Y.encodeStateAsUpdate(doc1);
    expect(state1).toEqual(Y.encodeStateAsUpdate(doc1));
    doc1.getMap("v2").set("test1", "hello");
    const state2 = Y.encodeStateAsUpdate(doc1);
    expect(state1).not.toEqual(state2);
  });

  test("non observable changes trigger updates", () => {
    const doc1 = new Y.Doc();
    const spy = vi.fn();

    doc1.on("update", spy);

    doc1.getMap("v2").set("test", "hello");
    doc1.getMap("v2").set("test", "hello");

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("non observable changes trigger observe", () => {
    const doc1 = new Y.Doc();
    const update_spy = vi.fn();
    const observe_spy = vi.fn();
    const map = doc1.getMap("v2");

    doc1.on("update", update_spy);
    map.observe(observe_spy);

    map.set("test", "hello");
    map.set("test", "hello");

    expect(update_spy).toHaveBeenCalledTimes(2);
    expect(observe_spy).toHaveBeenCalledTimes(2);
  });

  test("no flags to know if update will take effect", () => {
    const doc1 = new Y.Doc();
    const update_spy = vi.fn();
    const observe_spy = vi.fn();
    const map = doc1.getMap("v2");

    map.observe((event) => {
      update_spy(event.changes);
      let hasEffect = false;

      // For Maps
      if (event.changes.keys) {
        for (const key in event.changes.keys) {
          const change = event.changes.keys.get(key);
          if (
            change &&
            (change.action === "add" ||
              change.action === "update" ||
              change.action === "delete")
          ) {
            hasEffect = true;
            break;
          }
        }
      }

      // For Arrays/Text
      if (event.changes.delta) {
        hasEffect = event.changes.delta.some(
          (d) => d.insert || d.delete || d.retain,
        );
      }

      if (hasEffect) {
        observe_spy();
      }
    });

    map.set("test", "hello");
    map.set("test", "hello");
    map.set("test", "hello");

    expect(update_spy.mock.calls).toEqual([
      [
        expect.objectContaining({
          keys: new Map([["test", { action: "add" }]]),
        }),
      ],
      [
        expect.objectContaining({
          keys: new Map([["test", { action: "update", oldValue: "hello" }]]),
        }),
      ],
      [
        expect.objectContaining({
          keys: new Map([["test", { action: "update", oldValue: "hello" }]]),
        }),
      ],
    ]);
    expect(observe_spy).toHaveBeenCalledTimes(0);
  });

  test("messy sync between three states do not cause infinite updates", () => {
    const tracker1 = new Y.Doc();
    const tracker2 = new Y.Doc();

    // first run of the app

    // client 1 does update
    tracker1.getMap("v2").set("test 1", "hello");

    const tracker1_state_1 = Y.encodeStateAsUpdate(tracker1);
    const dropbox = new Y.Doc();

    // update dropbox with tracker1 changes
    Y.applyUpdate(dropbox, tracker1_state_1);

    // client 2 does changes
    tracker2.getMap("v2").set("test 2", "hello");

    // client 2 comes online and syncs with dropbox
    Y.applyUpdate(dropbox, Y.encodeStateAsUpdate(tracker2));
    Y.applyUpdate(tracker2, Y.encodeStateAsUpdate(dropbox));

    const dropbox_state_2 = Y.encodeStateAsUpdate(dropbox);
    const dropbox_vector_2 = Y.encodeStateVector(dropbox);

    // client 1 comes online and syncs with dropbox
    Y.applyUpdate(dropbox, Y.encodeStateAsUpdate(tracker1));
    Y.applyUpdate(tracker1, Y.encodeStateAsUpdate(dropbox));

    const dropbox_state_3 = Y.encodeStateAsUpdate(dropbox);
    const dropbox_vector_3 = Y.encodeStateVector(dropbox);

    // no updates fine
    expect(dropbox_state_2).toEqual(dropbox_state_3);
    expect(dropbox_vector_2).toEqual(dropbox_vector_3);

    // are they the same updates?
    expect(Y.encodeStateAsUpdate(tracker1)).toEqual(
      Y.encodeStateAsUpdate(dropbox),
    );
    expect(Y.encodeStateAsUpdate(tracker2)).toEqual(
      Y.encodeStateAsUpdate(dropbox),
    );
    expect(Y.encodeStateAsUpdate(tracker1)).toEqual(
      Y.encodeStateAsUpdate(tracker2),
    );

    // now what if we client 1 restarts
    const client1_restart = new Y.Doc();
    const dropbox2 = new Y.Doc();

    Y.applyUpdate(client1_restart, tracker1_state_1);
    Y.applyUpdate(dropbox2, dropbox_state_2);

    // and a client 2
  });

  test("buffer comparison", () => {
    expect(() =>
      expect(new Uint8Array([1, 2, 3])).toBe(new Uint8Array([1, 2, 3])),
    ).toThrow(); // ❌ fails
    expect(new Uint8Array([1, 2, 3])).toEqual(new Uint8Array([1, 2, 3])); // ✅ works
  });

  test("uint8arrays compare works", () => {
    expect(new Uint8Array([1, 2, 3])).instanceOf(Uint8Array);
    expect(compare(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(
      0,
    );

    expect(
      compare(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3, 4, 5])),
    ).toBe(-1);

    expect(compare(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(
      -1,
    );

    expect(compare(new Uint8Array([2, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(
      1,
    );
  });

  // test("clientID is not hydrated", () => {
  //   const doc = new Y.Doc();
  //   const doc2 = new Y.Doc();
  //   doc.getMap("v2").set("test1", "hello");
  //   Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc));
  //   expect(Y.encodeStateVector(doc)).toEqual(Y.encodeStateVector(doc));
  // });

  test("vector does not grow with each restart", () => {
    const doc = new Y.Doc();
    const state1 = Y.encodeStateAsUpdate(doc);
    // empty vector
    expect(Y.decodeStateVector(Y.encodeStateVector(doc))).toHaveProperty(
      "size",
      0,
    );
    doc.getMap("v2").set("test1", "hello");

    // vector with my changes
    expect(Y.decodeStateVector(Y.encodeStateVector(doc))).toHaveProperty(
      "size",
      1,
    );

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, state1);

    // empty vector
    expect(Y.decodeStateVector(Y.encodeStateVector(doc2))).toHaveProperty(
      "size",
      0,
    );

    doc2.getMap("v2").set("test1", "hello");

    // vector with my changes
    expect(Y.decodeStateVector(Y.encodeStateVector(doc2))).toHaveProperty(
      "size",
      1,
    );
  });

  test("state update comparison fails on the first byte (fast comparison)", () => {
    const doc1 = new Y.Doc();
    doc1.on("update", console.log);
    doc1.getMap("v2").set("test", "hello");
    const doc2 = new Y.Doc();
    const state1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, state1);
    const state2 = Y.encodeStateAsUpdate(doc2);

    // same state
    expect(diff_position(state1, state2)).toBe(-1);

    doc2.getMap("v2").set("test2", "hello");
    const state3 = Y.encodeStateAsUpdate(doc2);
    // different state
    expect(diff_position(state1, state3)).toBe(0);
  });
});
