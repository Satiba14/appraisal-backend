const express = require("express");
const router = express.Router();
const controller = require("../controllers/department.controller");

router.get("/", controller.getAllDepartments);
router.get("/:id", controller.getDepartmentById);
router.post("/", controller.createDepartment);
router.put("/:id", controller.updateDepartment);
router.delete("/:id", controller.deactivateDepartment);

module.exports = router;
