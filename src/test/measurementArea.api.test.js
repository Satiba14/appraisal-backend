
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const areas = new Map();

const matches = (row, where = {}) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

function wrap(row) {
  Object.defineProperty(row, "update", {
    enumerable: false,
    value: async (data) => Object.assign(row, data),
  });
  return row;
}

const fakeModels = {
  MeasurementArea: {
    findAll: async ({ where = {}, order } = {}) => {
      const rows = [...areas.values()].filter((row) =>
        matches(row, where)
      );

      if (order) {
        rows.sort((a, b) => {
          for (const [field, direction] of order) {
            let result = 0;

            if (a[field] < b[field]) result = -1;
            if (a[field] > b[field]) result = 1;

            if (result !== 0) {
              return direction === "DESC" ? -result : result;
            }
          }
          return 0;
        });
      }

      return rows;
    },

    findByPk: async (id) => areas.get(id) || null,

    create: async (data) => {
      const row = wrap({
        id: crypto.randomUUID(),
        criteria_text: null,
        order: null,
        is_active: true,
        ...data,
      });

      areas.set(row.id, row);
      return row;
    },
  },
};

const modelsPath = require.resolve("../models");

require.cache[modelsPath] = {
  id: modelsPath,
  filename: modelsPath,
  loaded: true,
  exports: fakeModels,
};

const app = require("../app");

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
});

beforeEach(() => {
  areas.clear();
});

async function call(method, path, body, options = {}) {
  const headers = {};

  if (options.contentType !== null) {
    headers["Content-Type"] =
      options.contentType || "application/json";
  }

  const response = await fetch(base + path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : options.raw
          ? body
          : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    // Response was not JSON.
  }

  return {
    status: response.status,
    json,
    text,
  };
}

async function createArea(name, extra = {}) {
  const response = await call("POST", "/api/measurement-areas", {
    name,
    ...extra,
  });

  assert.equal(response.status, 201, response.text);
  return response.json;
}

const getAll = (query = "") =>
  call("GET", `/api/measurement-areas${query}`);

const getById = (id) =>
  call("GET", `/api/measurement-areas/${id}`);

const updateArea = (id, body) =>
  call("PUT", `/api/measurement-areas/${id}`, body);

const deactivateArea = (id) =>
  call("DELETE", `/api/measurement-areas/${id}`);

const reactivateArea = (id) =>
  call("POST", `/api/measurement-areas/${id}/reactivate`);

// ---------- GET /api/measurement-areas ----------

test("case 1: get all areas -> 200 and array", async () => {
  await createArea("Quality", { order: 2 });
  await createArea("Execution", { order: 1 });

  const response = await getAll();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.json));
  assert.equal(response.json.length, 2);
});

test("case 2: areas are ordered by order ascending", async () => {
  await createArea("Second", { order: 2 });
  await createArea("First", { order: 1 });

  const response = await getAll();

  assert.deepEqual(
    response.json.map((area) => area.name),
    ["First", "Second"]
  );
});

test("case 3: filter active areas", async () => {
  const active = await createArea("Active");
  await deactivateArea(active.id);
  await createArea("Another Active");

  const response = await getAll("?is_active=true");

  assert.equal(response.status, 200);
  assert.ok(response.json.every((area) => area.is_active === true));
  assert.equal(response.json.length, 1);
});

test("case 4: filter inactive areas", async () => {
  const area = await createArea("Inactive");
  await deactivateArea(area.id);

  const response = await getAll("?is_active=false");

  assert.equal(response.status, 200);
  assert.equal(response.json.length, 1);
  assert.equal(response.json[0].is_active, false);
});

test("case 5: invalid active filter -> 400", async () => {
  const response = await getAll("?is_active=invalid");

  assert.equal(response.status, 400);
});

// ---------- GET /api/measurement-areas/:id ----------

test("case 6: get an existing area -> 200", async () => {
  const area = await createArea("Execution");

  const response = await getById(area.id);

  assert.equal(response.status, 200);
  assert.equal(response.json.id, area.id);
  assert.equal(response.json.name, "Execution");
});

test("case 7: unknown area ID -> 404", async () => {
  const response = await getById(
    "00000000-0000-0000-0000-000000000000"
  );

  assert.equal(response.status, 404);
  assert.equal(response.json.error, "Measurement area not found");
});

// ---------- POST /api/measurement-areas ----------

test("case 8: create area with name only -> 201", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "Communication",
  });

  assert.equal(response.status, 201);
  assert.equal(response.json.name, "Communication");
  assert.equal(response.json.is_active, true);
  assert.equal(response.json.order, 1);
});

test("case 9: trim surrounding spaces from name", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "  Teamwork  ",
  });

  assert.equal(response.status, 201);
  assert.equal(response.json.name, "Teamwork");
});

test("case 10: missing name -> 400", async () => {
  const response = await call("POST", "/api/measurement-areas", {});

  assert.equal(response.status, 400);
  assert.ok(response.json.details.includes("name is required"));
});

test("case 11: empty name -> 400", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "   ",
  });

  assert.equal(response.status, 400);
});

test("case 12: name longer than 255 characters -> 400", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "a".repeat(256),
  });

  assert.equal(response.status, 400);
});

test("case 13: duplicate active name, ignoring case -> 409", async () => {
  await createArea("Teamwork");

  const response = await call("POST", "/api/measurement-areas", {
    name: "TEAMWORK",
  });

  assert.equal(response.status, 409);
});

test("case 14: create with criteria and order -> 201", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "Problem Solving",
    criteria_text: "Analyze issues",
    order: 5,
  });

  assert.equal(response.status, 201);
  assert.equal(response.json.criteria_text, "Analyze issues");
  assert.equal(response.json.order, 5);
});

test("case 15: invalid order -> 400", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "Leadership",
    order: 0,
  });

  assert.equal(response.status, 400);
});

test("case 16: invalid criteria type -> 400", async () => {
  const response = await call("POST", "/api/measurement-areas", {
    name: "Leadership",
    criteria_text: 123,
  });

  assert.equal(response.status, 400);
});

// ---------- PUT /api/measurement-areas/:id ----------

test("case 17: update area name -> 200", async () => {
  const area = await createArea("Old Name");

  const response = await updateArea(area.id, {
    name: "New Name",
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.name, "New Name");
});

test("case 18: update criteria text -> 200", async () => {
  const area = await createArea("Quality");

  const response = await updateArea(area.id, {
    criteria_text: "Updated criteria",
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.criteria_text, "Updated criteria");
});

test("case 19: empty update body leaves area unchanged", async () => {
  const area = await createArea("Teamwork");

  const response = await updateArea(area.id, {});

  assert.equal(response.status, 200);
  assert.equal(response.json.name, "Teamwork");
});

test("case 20: update to another active area's name -> 409", async () => {
  await createArea("Quality");
  const second = await createArea("Execution");

  const response = await updateArea(second.id, {
    name: "QUALITY",
  });

  assert.equal(response.status, 409);
});

test("case 21: update unknown area -> 404", async () => {
  const response = await updateArea(
    "00000000-0000-0000-0000-000000000000",
    { name: "New Name" }
  );

  assert.equal(response.status, 404);
});

test("case 22: invalid update order -> 400", async () => {
  const area = await createArea("Quality");

  const response = await updateArea(area.id, {
    order: -1,
  });

  assert.equal(response.status, 400);
});

// ---------- DELETE /api/measurement-areas/:id ----------

test("case 23: deactivate active area -> 200 and inactive", async () => {
  const area = await createArea("Quality");

  const response = await deactivateArea(area.id);

  assert.equal(response.status, 200);
  assert.equal(response.json.area.is_active, false);
});

test("case 24: deactivate unknown area -> 404", async () => {
  const response = await deactivateArea(
    "00000000-0000-0000-0000-000000000000"
  );

  assert.equal(response.status, 404);
});

test("case 25: deactivate an already inactive area", async () => {
  const area = await createArea("Quality");
  await deactivateArea(area.id);

  const response = await deactivateArea(area.id);

  assert.equal(response.status, 200);
  assert.equal(response.json.area.is_active, false);
});

// ---------- POST /api/measurement-areas/:id/reactivate ----------

test("case 26: reactivate inactive area -> 200 and active", async () => {
  const area = await createArea("Quality");
  await deactivateArea(area.id);

  const response = await reactivateArea(area.id);

  assert.equal(response.status, 200);
  assert.equal(response.json.area.is_active, true);
});

test("case 27: reactivate an already active area", async () => {
  const area = await createArea("Quality");

  const response = await reactivateArea(area.id);

  assert.equal(response.status, 200);
  assert.equal(response.json.area.is_active, true);
  assert.equal(
    response.json.message,
    "Measurement area is already active"
  );
});

test("case 28: cannot reactivate when another active area has same name", async () => {
  const original = await createArea("Quality");
  await deactivateArea(original.id);
  await createArea("Quality");

  const response = await reactivateArea(original.id);

  assert.equal(response.status, 409);
});

test("case 29: reactivate unknown area -> 404", async () => {
  const response = await reactivateArea(
    "00000000-0000-0000-0000-000000000000"
  );

  assert.equal(response.status, 404);
});
