"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const analyticsSource = fs.readFileSync(path.join(root, "docs/js/analytics.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "docs/js/profile.js"), "utf8");
const profileHtml = fs.readFileSync(path.join(root, "docs/profile.html"), "utf8");
const allowedElementIds = new Set([...profileHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));

class FakeElement {
  constructor(id) {
    this.id = id;
    this.textContent = "";
    this.innerHTML = "";
    this.value = id === "trend-range" ? "25" : id === "history-period" ? "all" : "";
    this.href = "";
    this.disabled = false;
    this.listeners = {};
    this.options = [];
    this.attributes = {};
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false
    };
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  appendChild(option) {
    this.options.push(option);
    if (this.options.length === 1 && !this.value) this.value = option.value;
  }

  get selectedOptions() {
    const selected = this.options.find(option => option.value === this.value);
    return selected ? [selected] : [];
  }
}

function makeBattle(number, score, rank, date) {
  const suffix = number % 10 === 1 && number % 100 !== 11 ? "st"
    : number % 10 === 2 && number % 100 !== 12 ? "nd"
    : number % 10 === 3 && number % 100 !== 13 ? "rd" : "th";
  return {
    id: "test-" + number,
    name: number + suffix + " ULTRAbullet Team Battle",
    startsAt: Date.parse(date),
    score,
    rank
  };
}

async function runProfileWithPayloads(type, id, entry, shard, periods, directoryOverride) {
  const elements = new Map();
  const getElement = key => {
    if (!allowedElementIds.has(key)) return null;
    if (!elements.has(key)) elements.set(key, new FakeElement(key));
    return elements.get(key);
  };

  const directory = directoryOverride || { [id.toLowerCase()]: entry };

  const fetch = async url => {
    let payload;
    if (String(url).includes("/profiles/index/")) payload = directory;
    else if (String(url).includes("/periods_index.json")) payload = periods;
    else if (String(url).includes("/profiles/")) payload = shard;
    else throw new Error("Unexpected test fetch: " + url);
    return { ok: true, status: 200, json: async () => payload };
  };

  const window = {
    location: { search: "?type=" + type + "&id=" + encodeURIComponent(id), href: "https://example.test/profile.html" },
    UBTAnalytics: undefined
  };
  const document = {
    title: "",
    getElementById: getElement,
    createElement: tag => new FakeElement(tag)
  };
  const context = {
    window,
    document,
    fetch,
    URLSearchParams,
    navigator: { clipboard: { writeText: async () => {} } },
    console: { info: () => {}, error: (...args) => { throw args[1] || new Error(String(args[0])); } },
    Date,
    Map,
    Math,
    Number,
    String,
    Array,
    Object,
    Promise,
    Error,
    encodeURIComponent,
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(analyticsSource, context, { filename: "analytics.js" });
  vm.runInNewContext(profileSource, context, { filename: "profile.js" });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return { elements, document };
}


async function runProfile(type, id, entry, history) {
  const shard = { [entry.profile_key]: { history } };
  const periods = {
    months: [{ key: "2026-10", label: "October 2026", battle_count: history.length }],
    seasons: [{ key: "season-13", label: "Season 13", battle_count: history.length, complete: false }]
  };
  return runProfileWithPayloads(type, id, entry, shard, periods);
}

test("full player-profile startup renders every new analytics module", async () => {
  const history = Array.from({ length: 24 }, (_, index) => {
    const n = 620 + index;
    const date = new Date(Date.UTC(2026, 8, 1 + index * 2, 12)).toISOString();
    return makeBattle(n, 100 + (index % 7) * 35, index % 5 === 0 ? 1 : index % 5 === 1 ? 2 : index % 5 === 2 ? 3 : 7, date);
  }).reverse();
  const entry = {
    username: "TestPlayer",
    rank: 1,
    points: 5000,
    last_played: Date.parse("2026-10-30T12:00:00Z"),
    profile_file: "profiles/players-000.json",
    profile_key: "TestPlayer",
    rank_history: [[550, 3], [600, 2], [643, 1]]
  };
  const { elements } = await runProfile("player", "TestPlayer", entry, history);

  assert.match(elements.get("profile-chart").innerHTML, /<svg/);
  elements.get("chart-mode-rank").listeners.click();
  assert.match(elements.get("profile-chart").innerHTML, /Cumulative all-time rank history/);
  assert.match(elements.get("profile-chart").innerHTML, /After Battle 643/);
  assert.equal(elements.get("chart-mode-rank").attributes["aria-pressed"], "true");
  elements.get("chart-mode-score").listeners.click();
  assert.match(elements.get("profile-chart").innerHTML, /<svg/);
  assert.equal(elements.get("chart-mode-score").attributes["aria-pressed"], "true");
  assert.match(elements.get("analytics-donut").innerHTML, /<svg/);
  assert.match(elements.get("analytics-monthly-chart").innerHTML, /<svg/);
  assert.match(elements.get("analytics-heatmap").innerHTML, /<svg/);
  assert.match(elements.get("analytics-season-rows").innerHTML, /Season 13/);
  assert.notEqual(elements.get("analytics-recent-average").textContent, "—");
  assert.notEqual(elements.get("analytics-recent-podium-rate").textContent, "—");
  assert.equal(elements.get("profile-name").textContent, "TestPlayer");
  assert.equal(elements.get("history-rows").innerHTML.includes("Loading"), false);
});

test("full team-profile startup renders the same analytics modules", async () => {
  const history = Array.from({ length: 12 }, (_, index) => {
    const n = 632 + index;
    return makeBattle(n, 300 + index * 10, index % 3 + 1, new Date(Date.UTC(2026, 9, index + 1, 12)).toISOString());
  }).reverse();
  const entry = {
    team_id: "test-team",
    team_name: "Test Team",
    rank: 2,
    points: 4000,
    last_played: Date.parse("2026-10-30T12:00:00Z"),
    profile_file: "profiles/teams-000.json",
    profile_key: "test-team"
  };
  const { elements } = await runProfile("team", "test-team", entry, history);

  assert.match(elements.get("profile-chart").innerHTML, /<svg/);
  assert.match(elements.get("analytics-donut").innerHTML, /<svg/);
  assert.match(elements.get("analytics-monthly-chart").innerHTML, /<svg/);
  assert.match(elements.get("analytics-heatmap").innerHTML, /<svg/);
  assert.match(elements.get("analytics-season-rows").innerHTML, /Season 13/);
  assert.equal(elements.get("profile-name").textContent, "Test Team");
});


test("every profile JavaScript DOM reference exists in profile.html", () => {
  const referencedIds = [...profileSource.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]);
  const missing = [...new Set(referencedIds)].filter(id => !allowedElementIds.has(id));
  assert.deepEqual(missing, [], "Missing profile DOM elements: " + missing.join(", "));
});

test("published player and team data shards render all analytics modules", async () => {
  const dataRoot = path.join(root, "docs/data");
  const periods = JSON.parse(fs.readFileSync(path.join(dataRoot, "periods_index.json"), "utf8"));
  const cases = [
    {
      type: "player",
      id: "Nathanael01",
      indexPath: path.join(dataRoot, "profiles/index/players-n.json"),
      key: "nathanael01"
    },
    {
      type: "team",
      id: "itachi-n-friends",
      indexPath: path.join(dataRoot, "profiles/index/teams-i.json"),
      key: "itachi-n-friends"
    }
  ];

  for (const item of cases) {
    const directory = JSON.parse(fs.readFileSync(item.indexPath, "utf8"));
    const entry = directory[item.key];
    assert.ok(entry, "Published profile index entry missing for " + item.id);
    const shard = JSON.parse(fs.readFileSync(path.join(dataRoot, entry.profile_file), "utf8"));
    assert.ok(Array.isArray(shard[entry.profile_key]?.history), "Published history missing for " + item.id);

    const { elements } = await runProfileWithPayloads(item.type, item.id, entry, shard, periods, directory);
    assert.match(elements.get("profile-chart").innerHTML, /<svg/);
    assert.match(elements.get("analytics-donut").innerHTML, /<svg/);
    assert.match(elements.get("analytics-monthly-chart").innerHTML, /<svg/);
    assert.match(elements.get("analytics-heatmap").innerHTML, /<svg/);
    assert.match(elements.get("analytics-season-rows").innerHTML, /<tr>/);
    assert.notEqual(elements.get("analytics-recent-average").textContent, "—");
    assert.equal(elements.get("profile-name").textContent, item.type === "team" ? "itachi-n-friends" : entry.username);
    assert.doesNotMatch(elements.get("history-rows").innerHTML, /Loading/);
  }
});
