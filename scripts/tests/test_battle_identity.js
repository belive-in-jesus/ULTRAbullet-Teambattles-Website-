"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../../docs/js/battle.js"),
  "utf8"
);

class FakeElement {
  constructor(id) {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.href = "";
    this.hidden = false;
    this.classList = {
      toggle: () => {}
    };
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

test("battle results use the competitor's first letter rather than a leading flair", async () => {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };
  const report = {
    battle: {
      name: "643rd ULTRAbullet Team Battle",
      battle_number: 643,
      startsAt: Date.parse("2026-10-30T12:00:00Z"),
      nbPlayers: 2,
      url: "https://lichess.org/tournament/testbattle"
    },
    teams: [{ id: "the-house", name: "🏆 The House", rank: 1, score: 120 }],
    players: [{ id: "alice", name: "Alice", rank: 1, score: 45 }]
  };

  const context = {
    document: {
      getElementById: getElement,
      createElement: tag => new FakeElement(tag)
    },
    window: { location: { search: "?id=testbattle" } },
    URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => report }),
    encodeURIComponent,
    console
  };

  vm.runInNewContext(source, context, { filename: "battle.js" });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));

  const teamNameCell = elements.get("result-rows").children[0].children[1];
  const teamIdentity = teamNameCell.children[0];
  assert.equal(teamIdentity.children[0].textContent, "T");
  assert.equal(teamIdentity.children[1].textContent, "🏆 The House");

  elements.get("view-players").listeners.click();
  const playerNameCell = elements.get("result-rows").children[0].children[1];
  const playerIdentity = playerNameCell.children[0];
  assert.equal(playerIdentity.children[0].textContent, "A");
  assert.equal(playerIdentity.children[1].textContent, "Alice");
});
