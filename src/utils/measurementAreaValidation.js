
const MAX_NAME_LEN = 255;

// POST: name is required. PUT: fields are optional.
function validateMeasurementArea(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (
    body === undefined ||
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      errors: [
        "Request body must be a JSON object (send Content-Type: application/json)",
      ],
      data,
    };
  }

  if (body.name === undefined) {
    if (!partial) errors.push("name is required");
  } else if (typeof body.name !== "string" || body.name.trim() === "") {
    errors.push("name must be a non-empty string");
  } else if (body.name.trim().length > MAX_NAME_LEN) {
    errors.push(`name must be at most ${MAX_NAME_LEN} characters`);
  } else {
    data.name = body.name.trim();
  }

  if (body.criteria_text !== undefined) {
    if (body.criteria_text !== null && typeof body.criteria_text !== "string") {
      errors.push("criteria_text must be a string or null");
    } else {
      data.criteria_text =
        typeof body.criteria_text === "string"
          ? body.criteria_text.trim()
          : null;
    }
  }

  if (body.order !== undefined) {
    if (
      !Number.isInteger(body.order) ||
      body.order < 1
    ) {
      errors.push("order must be a positive integer");
    } else {
      data.order = body.order;
    }
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      errors.push("is_active must be a boolean");
    } else {
      data.is_active = body.is_active;
    }
  }

  return { errors, data };
}

module.exports = { validateMeasurementArea };
