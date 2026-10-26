const { Employee, Department } = require("../models");
const { validateEmployee } = require("../utils/employeeValidation");
const { computeBond } = require("../utils/bond");

async function checkReferences(data) {
  if (data.department_id) {
    const department = await Department.findByPk(data.department_id);
    if (!department) return "department_id does not exist";
  }
  if (data.reporting_to) {
    const manager = await Employee.findByPk(data.reporting_to);
    if (!manager) return "reporting_to does not exist";
  }
  return null;
}

// GET /api/employees
async function getAllEmployees(req, res, next) {
  try {
    const employees = await Employee.findAll({
      include: [{ model: Department, as: "department" }],
    });
    res.json(employees);
  } catch (err) {
    next(err);
  }
}

// GET /api/employees/:id
async function getEmployeeById(req, res, next) {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: [{ model: Department, as: "department" }],
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json(employee);
  } catch (err) {
    next(err);
  }
}

// POST /api/employees
async function createEmployee(req, res, next) {
  try {
    const { errors, data } = validateEmployee(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    const referenceError = await checkReferences(data);
    if (referenceError) {
      return res.status(400).json({ error: referenceError });
    }

    // bond_duration_months / bond_completion_date are derived, never taken from the body
    const employee = await Employee.create({
      ...data,
      ...computeBond(data.employee_type, data.join_date),
    });
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
}

// PUT /api/employees/:id
async function updateEmployee(req, res, next) {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const { errors, data } = validateEmployee(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    if (data.reporting_to && data.reporting_to === employee.id) {
      return res.status(400).json({ error: "An employee cannot report to themselves" });
    }

    const referenceError = await checkReferences(data);
    if (referenceError) {
      return res.status(400).json({ error: referenceError });
    }

    // If the bond inputs changed, recalculate the derived bond fields from
    // the new value (or the stored one for whichever input was not sent).
    if ("employee_type" in data || "join_date" in data) {
      const type = "employee_type" in data ? data.employee_type : employee.employee_type;
      const joined = "join_date" in data ? data.join_date : employee.join_date;
      Object.assign(data, computeBond(type, joined));
    }

    await employee.update(data);
    res.json(employee);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/employees/:id  (soft delete: the row stays, is_active becomes false)
async function deactivateEmployee(req, res, next) {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    await employee.update({ is_active: false });
    res.json({ message: "Employee deactivated", employee });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
};
