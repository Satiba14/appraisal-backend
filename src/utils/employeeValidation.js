const EMPLOYEE_TYPES = ["fresher", "experienced"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEN = 255;

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// options.partial = true  -> PUT: every field is optional
// options.partial = false -> POST: first_name, last_name, email are required
function validateEmployee(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be a JSON object (send Content-Type: application/json)"], data };
  }

  // --- required text fields: first_name, last_name ---
  for (const field of ["first_name", "last_name"]) {
    if (body[field] === undefined) {
      if (!partial) errors.push(`${field} is required`);
      continue;
    }
    if (typeof body[field] !== "string" || body[field].trim() === "") {
      errors.push(`${field} must be a non-empty string`);
    } else if (body[field].trim().length > MAX_LEN) {
      errors.push(`${field} must be at most ${MAX_LEN} characters`);
    } else {
      data[field] = body[field].trim();
    }
  }

  // --- email ---
  if (body.email === undefined) {
    if (!partial) errors.push("email is required");
  } else if (typeof body.email !== "string" || body.email.trim() === "") {
    errors.push("email must be a non-empty string");
  } else if (body.email.trim().length > MAX_LEN || !EMAIL_RE.test(body.email.trim())) {
    errors.push("email must be a valid email address");
  } else {
    data.email = body.email.trim();
  }

  // --- optional foreign keys: department_id, reporting_to (null / "" clears) ---
  for (const field of ["department_id", "reporting_to"]) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") {
      data[field] = null;
    } else if (typeof body[field] !== "string" || !UUID_RE.test(body[field])) {
      errors.push(`${field} must be a valid UUID`);
    } else {
      data[field] = body[field];
    }
  }

  // --- join_date ---
  if (body.join_date !== undefined) {
    if (body.join_date === null || body.join_date === "") {
      data.join_date = null;
    } else if (typeof body.join_date !== "string" || !isRealDate(body.join_date)) {
      errors.push("join_date must be a real date in YYYY-MM-DD format");
    } else {
      data.join_date = body.join_date;
    }
  }

  // --- employee_type ---
  if (body.employee_type !== undefined) {
    if (body.employee_type === null || body.employee_type === "") {
      data.employee_type = null;
    } else if (!EMPLOYEE_TYPES.includes(body.employee_type)) {
      errors.push(`employee_type must be one of: ${EMPLOYEE_TYPES.join(", ")}`);
    } else {
      data.employee_type = body.employee_type;
    }
  }

  return { errors, data };
}

module.exports = { validateEmployee, isRealDate, EMPLOYEE_TYPES };
