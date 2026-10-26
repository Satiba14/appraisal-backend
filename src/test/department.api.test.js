const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

const ZERO_ID = "00000000-0000-0000-0000-000000000000";
const departments = new Map();
const employees = new Map();

const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
function wrap(row) {
  Object.defineProperty(row, "update", {
    enumerable: false,
    value: async (data) => Object.assign(row, data),
  });
  return row;
}
const fakeModels = {
  Department: {
    findAll: async ({ where = {}, order } = {}) => {
      const rows = [...departments.values()].filter((r) => matches(r, where));
      if (order) rows.sort((a, b) => a.name.localeCompare(b.name));
      return rows;
    },
    findByPk: async (id) => departments.get(id) || null,
    count: async ({ where = {} } = {}) => [...departments.values()].filter((r) => matches(r, where)).length,
    create: async (data) => {
      const row = wrap({ id: crypto.randomUUID(), parent_dept_id: null, is_active: true, ...data });
      departments.set(row.id, row);
      return row;
    },
  },
  Employee: {
    count: async ({ where = {} } = {}) => [...employees.values()].filter((r) => matches(r, where)).length,
  },
};
const modelsPath = require.resolve("../models");
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: fakeModels };

const app = require("../app");
let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  departments.clear();
  employees.clear();
});

async function call(method, path, body, opts = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": opts.contentType || "application/json" },
    body: body === undefined ? undefined : opts.raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}
async function mk(name, parent_dept_id) {
  const r = await call("POST", "/api/departments", { name, ...(parent_dept_id ? { parent_dept_id } : {}) });
  assert.strictEqual(r.status, 201, r.text);
  return r.json;
}
const del = (id) => call("DELETE", `/api/departments/${id}`);
const seedEmployee = (department_id, is_active) =>
  employees.set(crypto.randomUUID(), { department_id, is_active });

// ---------- POST /api/departments ----------
test("case 1: name only -> 201, active, top-level", async () => {
  const r = await call("POST", "/api/departments", { name: "Engineering" });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.is_active, true);
  assert.strictEqual(r.json.parent_dept_id, null);
});
test("case 2: sub-department with a valid parent -> 201", async () => {
  const parent = await mk("Engineering");
  const r = await call("POST", "/api/departments", { name: "Backend", parent_dept_id: parent.id });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.parent_dept_id, parent.id);
});
test("case 3: missing name -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/departments", { parent_dept_id: null })).status, 400);
});
test("case 4: empty body -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/departments", {})).status, 400);
});
test("case 5: name of spaces -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/departments", { name: "   " })).status, 400);
});
test("case 6: 300-character name -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/departments", { name: "a".repeat(300) })).status, 400);
});
test("case 7: surrounding spaces are trimmed", async () => {
  const r = await call("POST", "/api/departments", { name: "  Sales  " });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.name, "Sales");
});
test("case 8: duplicate name, both top-level -> 409", async () => {
  await mk("Sales");
  const r = await call("POST", "/api/departments", { name: "Sales" });
  assert.strictEqual(r.status, 409);
});
test("case 9: same name, different case -> 409", async () => {
  await mk("Engineering");
  assert.strictEqual((await call("POST", "/api/departments", { name: "engineering" })).status, 409);
});
test("case 10: same name under a different parent -> 201", async () => {
  const a = await mk("A");
  const b = await mk("B");
  await mk("Ops", a.id);
  assert.strictEqual((await call("POST", "/api/departments", { name: "Ops", parent_dept_id: b.id })).status, 201);
  assert.strictEqual((await call("POST", "/api/departments", { name: "Ops" })).status, 201); // top-level vs child
});
test("case 11: same name as a deactivated sibling -> 201", async () => {
  const old = await mk("Sales");
  assert.strictEqual((await del(old.id)).status, 200);
  assert.strictEqual((await call("POST", "/api/departments", { name: "Sales" })).status, 201);
});
test("case 12: non-existent parent_dept_id -> 400", async () => {
  const r = await call("POST", "/api/departments", { name: "X", parent_dept_id: ZERO_ID });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /parent_dept_id/);
});
test("case 13: parent_dept_id 'abc' -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/departments", { name: "X", parent_dept_id: "abc" })).status, 400);
});
test("case 14: deactivated parent -> 400", async () => {
  const p = await mk("Old");
  await del(p.id);
  const r = await call("POST", "/api/departments", { name: "Child", parent_dept_id: p.id });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /inactive/);
});
test("case 15: extra fields (id, is_active) are ignored", async () => {
  const fixed = "11111111-1111-1111-1111-111111111111";
  const r = await call("POST", "/api/departments", { name: "X", id: fixed, is_active: false });
  assert.strictEqual(r.status, 201);
  assert.notStrictEqual(r.json.id, fixed);
  assert.strictEqual(r.json.is_active, true);
});
test("case 16: body sent as text -> 400 JSON error", async () => {
  const r = await call("POST", "/api/departments", JSON.stringify({ name: "X" }), { raw: true, contentType: "text/plain" });
  assert.strictEqual(r.status, 400);
  assert.ok(r.json && r.json.error);
});
test("case 17: malformed JSON -> 400 JSON error", async () => {
  const r = await call("POST", "/api/departments", '{"name":"X}', { raw: true });
  assert.strictEqual(r.status, 400);
  assert.ok(r.json && r.json.error);
});

// ---------- GET /api/departments ----------
test("case 18: empty database -> []", async () => {
  const r = await call("GET", "/api/departments");
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.json, []);
});
test("case 19: list is sorted by name", async () => {
  await mk("Gamma");
  await mk("Alpha");
  await mk("Beta");
  const r = await call("GET", "/api/departments");
  assert.deepStrictEqual(r.json.map((d) => d.name), ["Alpha", "Beta", "Gamma"]);
});
test("case 20: ?is_active=true returns only active", async () => {
  await mk("A");
  const b = await mk("B");
  await del(b.id);
  const r = await call("GET", "/api/departments?is_active=true");
  assert.deepStrictEqual(r.json.map((d) => d.name), ["A"]);
});
test("case 21: ?is_active=false returns only deactivated", async () => {
  await mk("A");
  const b = await mk("B");
  await del(b.id);
  const r = await call("GET", "/api/departments?is_active=false");
  assert.deepStrictEqual(r.json.map((d) => d.name), ["B"]);
});
test("case 22: ?is_active=maybe -> 400", async () => {
  const r = await call("GET", "/api/departments?is_active=maybe");
  assert.strictEqual(r.status, 400);
  assert.ok(r.json.error);
});

// ---------- GET /api/departments/:id ----------
test("case 23: valid id -> 200", async () => {
  const d = await mk("Sales");
  const r = await call("GET", `/api/departments/${d.id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.id, d.id);
});
test("case 24: valid-format id that does not exist -> 404", async () => {
  assert.strictEqual((await call("GET", `/api/departments/${ZERO_ID}`)).status, 404);
});
test("case 25: garbage id -> 404", async () => {
  assert.strictEqual((await call("GET", "/api/departments/abc")).status, 404);
});

// ---------- PUT /api/departments/:id ----------
test("case 26: rename changes only the name", async () => {
  const p = await mk("Parent");
  const d = await mk("Sales", p.id);
  const r = await call("PUT", `/api/departments/${d.id}`, { name: "Revenue" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.name, "Revenue");
  assert.strictEqual(r.json.parent_dept_id, p.id);
});
test("case 27: PUT on a non-existent id -> 404", async () => {
  assert.strictEqual((await call("PUT", `/api/departments/${ZERO_ID}`, { name: "X" })).status, 404);
});
test("case 28: empty body -> 200, no change", async () => {
  const d = await mk("Sales");
  const r = await call("PUT", `/api/departments/${d.id}`, {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.name, "Sales");
});
test("case 29: renaming to the name it already has -> 200", async () => {
  const d = await mk("Sales");
  assert.strictEqual((await call("PUT", `/api/departments/${d.id}`, { name: "Sales" })).status, 200);
});
test("case 30: renaming to an active sibling's name -> 409", async () => {
  await mk("Sales");
  const ops = await mk("Ops");
  assert.strictEqual((await call("PUT", `/api/departments/${ops.id}`, { name: "sales" })).status, 409);
});
test("case 31: change parent to another valid department -> 200", async () => {
  const a = await mk("A");
  const b = await mk("B");
  const c = await mk("C");
  assert.strictEqual((await call("PUT", `/api/departments/${c.id}`, { parent_dept_id: a.id })).status, 200);
  const r = await call("PUT", `/api/departments/${c.id}`, { parent_dept_id: b.id });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.parent_dept_id, b.id);
});
test("case 32: parent set to its own id -> 400", async () => {
  const d = await mk("Sales");
  const r = await call("PUT", `/api/departments/${d.id}`, { parent_dept_id: d.id });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /own parent/);
});
test("case 33: parent set to its own child (circle) -> 400", async () => {
  const a = await mk("A");
  const b = await mk("B", a.id);
  const r = await call("PUT", `/api/departments/${a.id}`, { parent_dept_id: b.id });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /circular/);
});
test("case 34: parent set to its own grandchild (longer circle) -> 400", async () => {
  const a = await mk("A");
  const b = await mk("B", a.id);
  const c = await mk("C", b.id);
  const r = await call("PUT", `/api/departments/${a.id}`, { parent_dept_id: c.id });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /circular/);
});
test("case 35: parent_dept_id null makes it top-level", async () => {
  const a = await mk("A");
  const b = await mk("B", a.id);
  const r = await call("PUT", `/api/departments/${b.id}`, { parent_dept_id: null });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.parent_dept_id, null);
});
test("case 36: moving under a parent that has a same-named child -> 409", async () => {
  const a = await mk("A");
  await mk("X", a.id);
  const topX = await mk("X");
  assert.strictEqual((await call("PUT", `/api/departments/${topX.id}`, { parent_dept_id: a.id })).status, 409);
});
test("case 37: is_active in the body is ignored", async () => {
  const d = await mk("Sales");
  const r = await call("PUT", `/api/departments/${d.id}`, { is_active: false });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.is_active, true);
});
test("case 38: blank name -> 400", async () => {
  const d = await mk("Sales");
  assert.strictEqual((await call("PUT", `/api/departments/${d.id}`, { name: "  " })).status, 400);
});
test("case 39: non-existent parent on update -> 400", async () => {
  const d = await mk("Sales");
  assert.strictEqual((await call("PUT", `/api/departments/${d.id}`, { parent_dept_id: ZERO_ID })).status, 400);
});

// ---------- DELETE /api/departments/:id (soft delete) ----------
test("case 40: leaf department -> 200, is_active false", async () => {
  const d = await mk("Sales");
  const r = await del(d.id);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.department.is_active, false);
});
test("case 41: non-existent id -> 404", async () => {
  assert.strictEqual((await del(ZERO_ID)).status, 404);
});
test("case 42: deleting twice -> 200 both times", async () => {
  const d = await mk("Sales");
  assert.strictEqual((await del(d.id)).status, 200);
  assert.strictEqual((await del(d.id)).status, 200);
});
test("case 43: soft delete keeps the row", async () => {
  const d = await mk("Sales");
  await del(d.id);
  const r = await call("GET", `/api/departments/${d.id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.is_active, false);
});
test("case 44: active sub-department blocks deactivation -> 409", async () => {
  const p = await mk("Parent");
  await mk("Child", p.id);
  const r = await del(p.id);
  assert.strictEqual(r.status, 409);
  assert.match(r.json.error, /sub-departments/);
  assert.strictEqual((await call("GET", `/api/departments/${p.id}`)).json.is_active, true);
});
test("case 45: active employees block deactivation -> 409", async () => {
  const d = await mk("Sales");
  seedEmployee(d.id, true);
  const r = await del(d.id);
  assert.strictEqual(r.status, 409);
  assert.match(r.json.error, /employees/);
});
test("case 46: sub-departments already deactivated -> 200", async () => {
  const p = await mk("Parent");
  const c = await mk("Child", p.id);
  assert.strictEqual((await del(c.id)).status, 200);
  assert.strictEqual((await del(p.id)).status, 200);
});
test("case 47: employees already deactivated -> 200", async () => {
  const d = await mk("Sales");
  seedEmployee(d.id, false);
  assert.strictEqual((await del(d.id)).status, 200);
});
