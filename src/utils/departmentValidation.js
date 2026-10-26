const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LEN = 255;

// partial = false -> POST (name required); partial = true -> PUT (everything optional)
function validateDepartment(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
    return { errors: ["Request body must be a JSON object (send Content-Type: application/json)"], data };
  }

  if (body.name === undefined) {
    if (!partial) errors.push("name is required");
  } else if (typeof body.name !== "string" || body.name.trim() === "") {
    errors.push("name must be a non-empty string");
  } else if (body.name.trim().length > MAX_LEN) {
    errors.push(`name must be at most ${MAX_LEN} characters`);
  } else {
    data.name = body.name.trim();
  }

  if (body.parent_dept_id !== undefined) {
    if (body.parent_dept_id === null || body.parent_dept_id === "") {
      data.parent_dept_id = null; // null / "" makes it a top-level department
    } else if (typeof body.parent_dept_id !== "string" || !UUID_RE.test(body.parent_dept_id)) {
      errors.push("parent_dept_id must be a valid UUID");
    } else {
      data.parent_dept_id = body.parent_dept_id;
    }
  }
  
  return { errors, data };
}

// ?is_active=true | false  (missing = no filter). Anything else is an error.
function parseActiveFilter(raw) {
  if (raw === undefined) return { value: undefined };
  if (raw === "true") return { value: true };
  if (raw === "false") return { value: false };
  return { error: "is_active must be true or false" };
}

module.exports = { validateDepartment, parseActiveFilter };
