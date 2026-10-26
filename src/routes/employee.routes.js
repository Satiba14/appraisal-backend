// A "router" maps HTTP method + URL pattern -> controller function.
// This is the Express equivalent of Django's urls.py.

const express = require("express");
const router = express.Router();
const controller = require("../controllers/employee.controller");

router.get("/", controller.getAllEmployees);
router.get("/:id", controller.getEmployeeById);
router.post("/", controller.createEmployee);
router.put("/:id", controller.updateEmployee);
router.delete("/:id", controller.deactivateEmployee);

module.exports = router;