"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "docs/js/performance-index.js"), "utf8");

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.value = "";
    this.attributes = {};
    this.listeners = {};
    this.classList = {
      values: new Set(),
      toggle: (name, active) => active ? this.classList.values.add(name) : this.classList.values.delete(name)
    };
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}

async function startPage(players, teams = []) {
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement());
    return elements.get(id);
  };
  const playerButton = new FakeElement({ type: "players" });
  const teamButton = new FakeElement({ type: "teams" });
  const document = {
    getElementById,
    querySelectorAll: selector => selector === "[data-type]" ? [playerButton, teamButton] : []
  };
  const context = {
    document,
    console: { error: () => {} },
    fetch: async url => ({
      ok: true,
      status: 200,
      json: async () => String(url).includes("leaderboard_players") ? players : teams
    }),
    Number,
    String,
    Math,
    Array,
    Object,
    Promise,
    encodeURIComponent
  };
  vm.runInNewContext(source, context, { filename: "performance-index.js" });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return { elements, playerButton, teamButton };
}

function playerRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    username: "Player" + String(index + 1).padStart(3, "0"),
    performance_index_eligible: true,
    performance_index_rank: index + 1,
    performance_index: 90 - index / 10,
    performance_index_battles: 20,
    performance_index_components: {
      average_performance: 90,
      consistency: 85,
      recent_performance: 91,
      participation: 40
    }
  }));
}

test("Performance Index pagination renders every eligible competitor in 100-row pages", async () => {
  const { elements } = await startPage(playerRows(235));
  const get = id => elements.get(id);

  assert.equal(get("pi-count").textContent, "235 eligible");
  assert.equal((get("pi-rows").innerHTML.match(/<tr>/g) || []).length, 100);
  assert.equal(get("pi-page-summary").textContent, "Showing 1–100 of 235");
  assert.equal(get("pi-page").textContent, "Page 1 of 3");
  assert.equal(get("pi-prev").disabled, true);
  assert.equal(get("pi-next").disabled, false);

  get("pi-next").listeners.click();
  assert.equal((get("pi-rows").innerHTML.match(/<tr>/g) || []).length, 100);
  assert.equal(get("pi-page-summary").textContent, "Showing 101–200 of 235");
  assert.equal(get("pi-page").textContent, "Page 2 of 3");

  get("pi-next").listeners.click();
  assert.equal((get("pi-rows").innerHTML.match(/<tr>/g) || []).length, 35);
  assert.equal(get("pi-page-summary").textContent, "Showing 201–235 of 235");
  assert.equal(get("pi-next").disabled, true);

  get("pi-prev").listeners.click();
  assert.equal(get("pi-page").textContent, "Page 2 of 3");
});

test("Performance Index search and competitor switch reset the page", async () => {
  const players = playerRows(235);
  players.push({
    username: "Provisional",
    performance_index_eligible: false,
    performance_index_rank: null,
    performance_index: 99,
    performance_index_battles: 3
  });
  const teams = [{
    team_id: "team-a",
    team_name: "Team A",
    performance_index_eligible: true,
    performance_index_rank: 1,
    performance_index: 88,
    performance_index_battles: 50,
    performance_index_components: {}
  }];
  const { elements, teamButton } = await startPage(players, teams);
  const get = id => elements.get(id);
  get("pi-next").listeners.click();
  assert.equal(get("pi-page").textContent, "Page 2 of 3");

  get("pi-search").listeners.input({ target: { value: "Player234" } });
  assert.equal(get("pi-count").textContent, "1 eligible");
  assert.equal(get("pi-page").textContent, "Page 1 of 1");
  assert.match(get("pi-rows").innerHTML, /Player234/);
  assert.doesNotMatch(get("pi-rows").innerHTML, /Provisional/);

  get("pi-search").listeners.input({ target: { value: "" } });
  teamButton.listeners.click();
  assert.equal(get("pi-count").textContent, "1 eligible");
  assert.match(get("pi-rows").innerHTML, /Team A/);
  assert.equal(teamButton.attributes["aria-pressed"], "true");
});
