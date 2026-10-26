const { Department, Employee } = require("../models");
const { validateDepartment, parseActiveFilter } = require("../utils/departmentValidation");

// true if an ACTIVE sibling (same parent) already uses this name
async function hasSiblingNameConflict(name, parentId, exceptId) {
  const siblings = await Department.findAll({
    where: { parent_dept_id: parentId, is_active: true },
  });
  const wanted = name.toLowerCase();
  return siblings.some((s) => s.id !== exceptId && s.name.toLowerCase() === wanted);
}

// Walks UP from the proposed parent. If it meets the department itself, the
// move would create a circle.
async function createsCycle(departmentId, parent) {
  const seen = new Set();
  let currentId = parent.parent_dept_id;
  while (currentId && !seen.has(currentId)) {
    if (currentId === departmentId) return true;
    seen.add(currentId);
    const node = await Department.findByPk(currentId);
    currentId = node ? node.parent_dept_id : null;
  }
  return false;
}

// Returns an error message, or null if the parent is acceptable.
// selfId is null when creating (a new department has no id yet).
async function checkParent(parentId, selfId) {
  if (!parentId) return null;
  if (selfId && parentId === selfId) return "A department cannot be its own parent";
  const parent = await Department.findByPk(parentId);
  if (!parent) return "parent_dept_id does not exist";
  if (!parent.is_active) return "The parent department is inactive";
  if (selfId && (await createsCycle(selfId, parent))) {
    return "parent_dept_id would create a circular hierarchy";
  }
  return null;
}

const NAME_CONFLICT = "An active department with this name already exists under the same parent";

// GET /api/departments?is_active=true|false
async function getAllDepartments(req, res, next) {
  try {
    const filter = parseActiveFilter(req.query.is_active);
    if (filter.error) return res.status(400).json({ error: filter.error });

    const where = {};
    if (filter.value !== undefined) where.is_active = filter.value;

    const departments = await Department.findAll({
      where,
      include: [{ model: Department, as: "parentDepartment" }],
      order: [["name", "ASC"]],
    });
    res.json(departments);
  } catch (err) {
    next(err);
  }
}

// GET /api/departments/:id
async function getDepartmentById(req, res, next) {
  try {
    const department = await Department.findByPk(req.params.id, {
      include: [
        { model: Department, as: "parentDepartment" },
        { model: Department, as: "subDepartments" },
      ],
    });
    if (!department) return res.status(404).json({ error: "Department not found" });
    res.json(department);
  } catch (err) {
    next(err);
  }
}

// POST /api/departments
async function createDepartment(req, res, next) {
  try {
    const { errors, data } = validateDepartment(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    const parentId = data.parent_dept_id ?? null;

    const parentError = await checkParent(parentId, null);
    if (parentError) return res.status(400).json({ error: parentError });

    if (await hasSiblingNameConflict(data.name, parentId, null)) {
      return res.status(409).json({ error: NAME_CONFLICT });
    }

    const department = await Department.create({ name: data.name, parent_dept_id: parentId });
    res.status(201).json(department);
  } catch (err) {
    next(err);
  }
}

// PUT /api/departments/:id
async function updateDepartment(req, res, next) {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ error: "Department not found" });

    const { errors, data } = validateDepartment(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    if (Object.keys(data).length === 0) return res.json(department); // nothing to change

    if ("parent_dept_id" in data) {
      const parentError = await checkParent(data.parent_dept_id, department.id);
      if (parentError) return res.status(400).json({ error: parentError });
    }

    // Renaming OR moving can both collide with an existing sibling's name
    const newName = "name" in data ? data.name : department.name;
    const newParent = "parent_dept_id" in data ? data.parent_dept_id : department.parent_dept_id;
    if (await hasSiblingNameConflict(newName, newParent ?? null, department.id)) {
      return res.status(409).json({ error: NAME_CONFLICT });
    }

    await department.update(data);
    res.json(department);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/departments/:id  (soft delete)
async function deactivateDepartment(req, res, next) {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ error: "Department not found" });

    if (department.is_active) {
      const activeChildren = await Department.count({
        where: { parent_dept_id: department.id, is_active: true },
      });
      if (activeChildren > 0) {
        return res.status(409).json({ error: "Department has active sub-departments" });
      }
      const activeEmployees = await Employee.count({
        where: { department_id: department.id, is_active: true },
      });
      if (activeEmployees > 0) {
        return res.status(409).json({ error: "Department has active employees" });
      }
      await department.update({ is_active: false });
    }
    // already inactive -> nothing to do, still 200 (same as employees)
    res.json({ message: "Department deactivated", department });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
};
