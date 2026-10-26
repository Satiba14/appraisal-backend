
const express = require("express");
const router = express.Router();

const controller = require("../controllers/measurementArea.controller");

router.get("/", controller.getAllAreas);
router.get("/:id", controller.getAreaById);
router.post("/", controller.createArea);
router.put("/:id", controller.updateArea);
router.delete("/:id", controller.deactivateArea);
router.post("/:id/reactivate", controller.reactivateArea);

module.exports = router;
