const { test } = require("node:test");
const assert = require("node:assert");
const { validateEmployee } = require("../utils/employeeValidation");

const valid = { first_name: "Test", last_name: "User", email: "test@invenger.com" };

test("valid minimal body passes", () => {
  const { errors, data } = validateEmployee(valid);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(data.email, "test@invenger.com");
});

test("case 5: each required field missing is reported", () => {
  for (const field of ["first_name", "last_name", "email"]) {
    const body = { ...valid };
    delete body[field];
    const { errors } = validateEmployee(body);
    assert.ok(errors.some((e) => e.includes(field)), `${field} should be reported`);
  }
});

test("case 6: empty object fails with 3 errors", () => {
  assert.strictEqual(validateEmployee({}).errors.length, 3);
});

test("case 16: missing / non-object body fails", () => {
  assert.ok(validateEmployee(undefined).errors.length > 0);
  assert.ok(validateEmployee("text").errors.length > 0);
  assert.ok(validateEmployee([]).errors.length > 0);
});

test("case 9 and 34: extra fields are dropped by the whitelist", () => {
  const { data } = validateEmployee({
    ...valid,
    id: "11111111-1111-1111-1111-111111111111",
    is_active: false,
    bond_duration_months: 99,
    created_at: "2000-01-01T00:00:00.000Z",
  });
  for (const key of ["id", "is_active", "bond_duration_months", "created_at"]) {
    assert.ok(!(key in data), `${key} must not pass through`);
  }
});

test("case 11: invalid employee_type is rejected", () => {
  assert.ok(validateEmployee({ ...valid, employee_type: "intern" }).errors.length > 0);
});

test("case 12: invalid and impossible dates are rejected", () => {
  for (const bad of ["not-a-date", "2026-13-01", "2026-02-30", "15/01/2026"]) {
    assert.ok(validateEmployee({ ...valid, join_date: bad }).errors.length > 0, bad);
  }
  assert.deepStrictEqual(validateEmployee({ ...valid, join_date: "2024-02-29" }).errors, []);
});

test("case 13: invalid email is rejected", () => {
  assert.ok(validateEmployee({ ...valid, email: "abc" }).errors.length > 0);
});

test("case 14: whitespace-only name is rejected; names are trimmed", () => {
  assert.ok(validateEmployee({ ...valid, first_name: "   " }).errors.length > 0);
  assert.strictEqual(validateEmployee({ ...valid, first_name: "  Priya " }).data.first_name, "Priya");
});

test("case 15: names over 255 characters are rejected", () => {
  assert.ok(validateEmployee({ ...valid, first_name: "a".repeat(256) }).errors.length > 0);
  assert.deepStrictEqual(validateEmployee({ ...valid, first_name: "a".repeat(255) }).errors, []);
});

test("department_id and reporting_to must be UUIDs; null clears them", () => {
  assert.ok(validateEmployee({ ...valid, department_id: "abc" }).errors.length > 0);
  assert.strictEqual(validateEmployee({ ...valid, reporting_to: null }).data.reporting_to, null);
});

test("partial mode (PUT): empty body is fine, but present fields are still checked", () => {
  assert.deepStrictEqual(validateEmployee({}, { partial: true }).errors, []);
  assert.ok(validateEmployee({ email: "abc" }, { partial: true }).errors.length > 0);
  assert.ok(validateEmployee({ first_name: null }, { partial: true }).errors.length > 0);
});
