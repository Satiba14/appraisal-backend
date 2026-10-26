
const { MeasurementArea } = require("../models");
const { validateMeasurementArea } = require("../utils/measurementAreaValidation");
const { parseActiveFilter } = require("../utils/departmentValidation");

const NAME_CONFLICT =
  "An active measurement area with this name already exists";

async function nameTakenByActive(name, exceptId = null) {
  const activeAreas = await MeasurementArea.findAll({
    where: { is_active: true },
  });

  return activeAreas.some(
    (area) =>
      area.id !== exceptId &&
      area.name.toLowerCase() === name.toLowerCase()
  );
}

async function getAllAreas(req, res, next) {
  try {
    const filter = parseActiveFilter(req.query.is_active);

    if (filter.error) {
      return res.status(400).json({ error: filter.error });
    }

    const where = {};
    if (filter.value !== undefined) {
      where.is_active = filter.value;
    }

    const areas = await MeasurementArea.findAll({
      where,
      order: [["order", "ASC"], ["name", "ASC"]],
    });

    return res.json(areas);
  } catch (err) {
    return next(err);
  }
}

async function getAreaById(req, res, next) {
  try {
    const area = await MeasurementArea.findByPk(req.params.id);

    if (!area) {
      return res.status(404).json({ error: "Measurement area not found" });
    }

    return res.json(area);
  } catch (err) {
    return next(err);
  }
}

async function createArea(req, res, next) {
  try {
    const { errors, data } = validateMeasurementArea(req.body);

    if (errors.length) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    if (await nameTakenByActive(data.name)) {
      return res.status(409).json({ error: NAME_CONFLICT });
    }

    let order = data.order;

    if (order === undefined) {
      const allAreas = await MeasurementArea.findAll();
      order = Math.max(0, ...allAreas.map((area) => area.order || 0)) + 1;
    }

    const area = await MeasurementArea.create({
      name: data.name,
      criteria_text: data.criteria_text ?? null,
      order,
    });

    return res.status(201).json(area);
  } catch (err) {
    return next(err);
  }
}

async function updateArea(req, res, next) {
  try {
    const area = await MeasurementArea.findByPk(req.params.id);

    if (!area) {
      return res.status(404).json({ error: "Measurement area not found" });
    }

    const { errors, data } = validateMeasurementArea(req.body, {
      partial: true,
    });

    if (errors.length) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    if (Object.keys(data).length === 0) {
      return res.json(area);
    }

    if (
      "name" in data &&
      area.is_active &&
      (await nameTakenByActive(data.name, area.id))
    ) {
      return res.status(409).json({ error: NAME_CONFLICT });
    }

    await area.update(data);
    return res.json(area);
  } catch (err) {
    return next(err);
  }
}

async function deactivateArea(req, res, next) {
  try {
    const area = await MeasurementArea.findByPk(req.params.id);

    if (!area) {
      return res.status(404).json({ error: "Measurement area not found" });
    }

    if (area.is_active) {
      await area.update({ is_active: false });
    }

    return res.json({
      message: "Measurement area deactivated",
      area,
    });
  } catch (err) {
    return next(err);
  }
}

async function reactivateArea(req, res, next) {
  try {
    const area = await MeasurementArea.findByPk(req.params.id);

    if (!area) {
      return res.status(404).json({ error: "Measurement area not found" });
    }

    if (area.is_active) {
      return res.json({
        message: "Measurement area is already active",
        area,
      });
    }

    if (await nameTakenByActive(area.name, area.id)) {
      return res.status(409).json({ error: NAME_CONFLICT });
    }

    await area.update({ is_active: true });

    return res.json({
      message: "Measurement area reactivated",
      area,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAllAreas,
  getAreaById,
  createArea,
  updateArea,
  deactivateArea,
  reactivateArea,
};
