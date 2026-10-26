const express = require("express");
const cors = require("cors");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json()); 

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Emp routes
app.use("/api/employees", require("./routes/employee.routes"));

//Dept routes
app.use("/api/departments", require("./routes/department.routes"));

// Measurement routes
app.use("/api/measurement-areas", require("./routes/measurementArea.routes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;