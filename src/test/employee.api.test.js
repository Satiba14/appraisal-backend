const { test, before, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const DEPT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ZERO_ID = "00000000-0000-0000-0000-000000000000";
const store = new Map();

function uniqueError() {
  const e = new Error("Validation error");
  e.name = "SequelizeUniqueConstraintError";
  e.errors = [{ path: "email" }];
  return e;
}
function emailTaken(email, exceptId) {
  return [...store.values()].some(
    (r) => r.id !== exceptId && r.email.toLowerCase() === String(email).toLowerCase()
  );
}
function wrap(row) {
  Object.defineProperty(row, "update", {
    enumerable: false,
    value: async (data) => {
      if (data.email !== undefined && emailTaken(data.email, row.id)) throw uniqueError();
      Object.assign(row, data);
      return row;
    },
  });
  return row;
}
const fakeModels = {
  Department: { findByPk: async (id) => (id === DEPT_ID ? { id: DEPT_ID, name: "Engineering" } : null) },
  Employee: {
    findAll: async () => [...store.values()],
    findByPk: async (id) => store.get(id) || null,
    create: async (data) => {
      if (emailTaken(data.email)) throw uniqueError();
      const row = wrap({
        id: crypto.randomUUID(),
        department_id: null,
        reporting_to: null,
        join_date: null,
        employee_type: null,
        bond_duration_months: null,
        bond_completion_date: null,
        is_active: true,
        ...data,
      });
      store.set(row.id, row);
      return row;
    },
  },
};
const modelsPath = require.resolve("../models");
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: fakeModels };

const app = require("../app");
let server;
let base;
let n = 0;
const email = () => `user${++n}@invenger.com`; 

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

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
const base3 = () => ({ first_name: "Test", last_name: "User", email: email() });
async function makeEmployee(extra = {}) {
  const r = await call("POST", "/api/employees", { ...base3(), ...extra });
  assert.strictEqual(r.status, 201, r.text);
  return r.json;
}

// ---------- POST /api/employees ----------
test("case 1: fresher + join_date -> 201, 18 months, 2027-07-15", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), employee_type: "fresher", join_date: "2026-01-15" });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.bond_duration_months, 18);
  assert.strictEqual(r.json.bond_completion_date, "2027-07-15");
});
test("case 2: experienced + join_date -> 201, 12 months, 2027-01-15", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), employee_type: "experienced", join_date: "2026-01-15" });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.bond_duration_months, 12);
  assert.strictEqual(r.json.bond_completion_date, "2027-01-15");
});
test("case 3: only required fields -> 201, bond fields null", async () => {
  const r = await call("POST", "/api/employees", base3());
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.bond_duration_months, null);
  assert.strictEqual(r.json.bond_completion_date, null);
});
test("case 4: employee_type without join_date -> duration set, completion null", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), employee_type: "fresher" });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.bond_duration_months, 18);
  assert.strictEqual(r.json.bond_completion_date, null);
});
test("case 5: each missing required field -> 400", async () => {
  for (const field of ["first_name", "last_name", "email"]) {
    const body = base3();
    delete body[field];
    assert.strictEqual((await call("POST", "/api/employees", body)).status, 400, field);
  }
});
test("case 6: empty body -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/employees", {})).status, 400);
});
test("case 7: duplicate email -> 409", async () => {
  const first = await makeEmployee();
  const r = await call("POST", "/api/employees", { ...base3(), email: first.email });
  assert.strictEqual(r.status, 409);
  assert.match(r.json.error, /already exists/);
});
test("case 8: same email, different case -> 409", async () => {
  const first = await makeEmployee();
  const r = await call("POST", "/api/employees", { ...base3(), email: first.email.toUpperCase() });
  assert.strictEqual(r.status, 409);
});
test("case 9: extra fields (id, is_active) are ignored", async () => {
  const fixed = "11111111-1111-1111-1111-111111111111";
  const r = await call("POST", "/api/employees", { ...base3(), id: fixed, is_active: false });
  assert.strictEqual(r.status, 201);
  assert.notStrictEqual(r.json.id, fixed);
  assert.strictEqual(r.json.is_active, true);
});
test("case 10: non-existent department_id -> 400", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), department_id: ZERO_ID });
  assert.strictEqual(r.status, 400);
  assert.match(r.json.error, /department_id/);
});
test("existing department_id is accepted", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), department_id: DEPT_ID });
  assert.strictEqual(r.status, 201);
});
test("case 11: employee_type 'intern' -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/employees", { ...base3(), employee_type: "intern" })).status, 400);
});
test("case 12: join_date 'not-a-date' -> 400", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), employee_type: "fresher", join_date: "not-a-date" });
  assert.strictEqual(r.status, 400);
});
test("case 13: email 'abc' -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/employees", { ...base3(), email: "abc" })).status, 400);
});
test("case 14: first_name of spaces -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/employees", { ...base3(), first_name: "   " })).status, 400);
});
test("case 15: 300-character name -> 400", async () => {
  assert.strictEqual((await call("POST", "/api/employees", { ...base3(), first_name: "a".repeat(300) })).status, 400);
});
test("case 16: body sent as text, not JSON -> 400", async () => {
  const r = await call("POST", "/api/employees", JSON.stringify(base3()), { raw: true, contentType: "text/plain" });
  assert.strictEqual(r.status, 400);
  assert.ok(r.json && r.json.error, "response should be JSON");
});
test("case 17: malformed JSON -> 400 with a JSON error body", async () => {
  const r = await call("POST", "/api/employees", '{"first_name":"Test, "last_name":"X"}', { raw: true });
  assert.strictEqual(r.status, 400);
  assert.ok(r.json && r.json.error, "response should be JSON, not an HTML page");
});
test("case 18: fresher joining 2026-08-31 -> completion 2028-02-29", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), employee_type: "fresher", join_date: "2026-08-31" });
  assert.strictEqual(r.json.bond_completion_date, "2028-02-29");
});
test("case 19: experienced joining 2024-02-29 -> completion 2025-02-28", async () => {
  const r = await call("POST", "/api/employees", { ...base3(), employee_type: "experienced", join_date: "2024-02-29" });
  assert.strictEqual(r.json.bond_completion_date, "2025-02-28");
});

// ---------- GET ----------
test("case 21: list returns an array containing created employees", async () => {
  await makeEmployee();
  const r = await call("GET", "/api/employees");
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json) && r.json.length > 0);
});
test("case 22: GET by id -> 200", async () => {
  const e = await makeEmployee();
  const r = await call("GET", `/api/employees/${e.id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.id, e.id);
});
test("case 23: valid-format id that does not exist -> 404", async () => {
  assert.strictEqual((await call("GET", `/api/employees/${ZERO_ID}`)).status, 404);
});
test("case 24: garbage id -> 404", async () => {
  assert.strictEqual((await call("GET", "/api/employees/abc")).status, 404);
});
test("unknown route -> JSON 404 (not Express's HTML page)", async () => {
  const r = await call("PUT", "/api/employees");
  assert.strictEqual(r.status, 404);
  assert.ok(r.json && r.json.error);
});

// ---------- PUT /api/employees/:id ----------
test("case 26: update last_name changes only that field", async () => {
  const e = await makeEmployee({ employee_type: "fresher", join_date: "2026-01-15" });
  const r = await call("PUT", `/api/employees/${e.id}`, { last_name: "Updated" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.last_name, "Updated");
  assert.strictEqual(r.json.first_name, e.first_name);
  assert.strictEqual(r.json.email, e.email);
  assert.strictEqual(r.json.bond_completion_date, "2027-07-15");
});
test("case 27: PUT on a non-existent id -> 404", async () => {
  assert.strictEqual((await call("PUT", `/api/employees/${ZERO_ID}`, { last_name: "X" })).status, 404);
});
test("case 28: PUT with empty body -> 200, nothing changed", async () => {
  const e = await makeEmployee();
  const r = await call("PUT", `/api/employees/${e.id}`, {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.last_name, e.last_name);
});
test("case 29: changing employee_type recalculates the bond fields", async () => {
  const e = await makeEmployee({ employee_type: "fresher", join_date: "2026-01-15" });
  const r = await call("PUT", `/api/employees/${e.id}`, { employee_type: "experienced" });
  assert.strictEqual(r.json.bond_duration_months, 12);
  assert.strictEqual(r.json.bond_completion_date, "2027-01-15");
});
test("case 29b: setting employee_type on an employee with a stored join_date works", async () => {
  const e = await makeEmployee({ join_date: "2026-01-15" });
  const r = await call("PUT", `/api/employees/${e.id}`, { employee_type: "fresher" });
  assert.strictEqual(r.json.bond_duration_months, 18);
  assert.strictEqual(r.json.bond_completion_date, "2027-07-15");
});
test("case 30: changing join_date recalculates bond_completion_date", async () => {
  const e = await makeEmployee({ employee_type: "fresher", join_date: "2026-01-15" });
  const r = await call("PUT", `/api/employees/${e.id}`, { join_date: "2026-06-01" });
  assert.strictEqual(r.json.bond_completion_date, "2027-12-01");
});
test("case 31: changing email to another employee's email -> 409", async () => {
  const a = await makeEmployee();
  const b = await makeEmployee();
  const r = await call("PUT", `/api/employees/${b.id}`, { email: a.email });
  assert.strictEqual(r.status, 409);
});
test("case 32: invalid employee_type or department_id on update -> 400", async () => {
  const e = await makeEmployee();
  assert.strictEqual((await call("PUT", `/api/employees/${e.id}`, { employee_type: "intern" })).status, 400);
  assert.strictEqual((await call("PUT", `/api/employees/${e.id}`, { department_id: ZERO_ID })).status, 400);
});
test("case 33: reporting_to set to own id -> 400", async () => {
  const e = await makeEmployee();
  const r = await call("PUT", `/api/employees/${e.id}`, { reporting_to: e.id });
  assert.strictEqual(r.status, 400);
});
test("reporting_to pointing at a real other employee is accepted", async () => {
  const mgr = await makeEmployee();
  const e = await makeEmployee();
  const r = await call("PUT", `/api/employees/${e.id}`, { reporting_to: mgr.id });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.reporting_to, mgr.id);
});
test("case 34: is_active, bond_duration_months, created_at in body are ignored", async () => {
  const e = await makeEmployee({ employee_type: "fresher", join_date: "2026-01-15" });
  const r = await call("PUT", `/api/employees/${e.id}`, {
    is_active: false,
    bond_duration_months: 99,
    created_at: "2000-01-01T00:00:00.000Z",
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.is_active, true);
  assert.strictEqual(r.json.bond_duration_months, 18);
  assert.notStrictEqual(r.json.created_at, "2000-01-01T00:00:00.000Z");
});
test("case 35: a different id in the body is ignored", async () => {
  const e = await makeEmployee();
  const other = "22222222-2222-2222-2222-222222222222";
  const r = await call("PUT", `/api/employees/${e.id}`, { id: other });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.id, e.id);
});

// ---------- DELETE (soft delete) ----------
test("case 36: DELETE -> 200 and is_active false", async () => {
  const e = await makeEmployee();
  const r = await call("DELETE", `/api/employees/${e.id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.employee.is_active, false);
});
test("case 37: DELETE on a non-existent id -> 404", async () => {
  assert.strictEqual((await call("DELETE", `/api/employees/${ZERO_ID}`)).status, 404);
});
test("case 38: deleting twice -> 200 both times", async () => {
  const e = await makeEmployee();
  assert.strictEqual((await call("DELETE", `/api/employees/${e.id}`)).status, 200);
  assert.strictEqual((await call("DELETE", `/api/employees/${e.id}`)).status, 200);
});
test("case 39: soft delete keeps the row (still fetchable)", async () => {
  const e = await makeEmployee();
  await call("DELETE", `/api/employees/${e.id}`);
  const r = await call("GET", `/api/employees/${e.id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.is_active, false);
});
