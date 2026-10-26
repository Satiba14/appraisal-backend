function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  // Malformed JSON body (e.g. a missing quote) -> the body parser throws this
  if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  // Sequelize / MySQL errors
  if (err.name === "SequelizeUniqueConstraintError") {
    const field = err.errors && err.errors[0] && err.errors[0].path;
    const message =
      field && field.includes("email")
        ? "An employee with this email already exists"
        : "A record with this value already exists";
    return res.status(409).json({ error: message });
  }
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({ error: "A referenced record does not exist" });
  }
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: (err.errors || []).map((e) => e.message),
    });
  }

  // Anything else is a genuine server fault: log the detail, hide it from the client
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = { notFound, errorHandler };
