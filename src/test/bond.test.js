const { test } = require("node:test");
const assert = require("node:assert");
const { addMonthsClamped, computeBond } = require("../utils/bond");

test("case 1: fresher joining 2026-01-15 -> 18 months, completes 2027-07-15", () => {
  assert.deepStrictEqual(computeBond("fresher", "2026-01-15"), {
    bond_duration_months: 18,
    bond_completion_date: "2027-07-15",
  });
});

test("case 2: experienced joining 2026-01-15 -> 12 months, completes 2027-01-15", () => {
  assert.deepStrictEqual(computeBond("experienced", "2026-01-15"), {
    bond_duration_months: 12,
    bond_completion_date: "2027-01-15",
  });
});

test("case 4: employee_type without join_date -> duration set, completion null", () => {
  assert.deepStrictEqual(computeBond("fresher", null), {
    bond_duration_months: 18,
    bond_completion_date: null,
  });
});

test("case 3: no employee_type -> both bond fields null", () => {
  assert.deepStrictEqual(computeBond(null, "2026-01-15"), {
    bond_duration_months: null,
    bond_completion_date: null,
  });
});

test("case 18: month-end 2026-08-31 + 18 months clamps to 2028-02-29", () => {
  assert.strictEqual(addMonthsClamped("2026-08-31", 18), "2028-02-29");
});

test("case 19: leap day 2024-02-29 + 12 months clamps to 2025-02-28", () => {
  assert.strictEqual(addMonthsClamped("2024-02-29", 12), "2025-02-28");
});

test("year rollover: 2026-11-30 + 3 months = 2027-02-28", () => {
  assert.strictEqual(addMonthsClamped("2026-11-30", 3), "2027-02-28");
});

test("exact multiple of 12 months keeps the same day", () => {
  assert.strictEqual(addMonthsClamped("2026-03-31", 12), "2027-03-31");
});
