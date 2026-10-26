
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Employee = require("./employee")(sequelize, DataTypes);
const Department = require("./department")(sequelize, DataTypes);
const MeasurementArea = require("./measurementArea")(sequelize, DataTypes);
const Review = require("./review")(sequelize, DataTypes);
const RatingEntry = require("./ratingEntry")(sequelize, DataTypes);
const Notification = require("./notification")(sequelize, DataTypes);
const EditLog = require("./editLog")(sequelize, DataTypes);

// ---- department (1) -> employee (*) ----
Department.hasMany(Employee, { foreignKey: "department_id", as: "employees" });
Employee.belongsTo(Department, { foreignKey: "department_id", as: "department" });

// ---- department (1) -> department (*)  [parent_dept_id, self-referencing] ----
Department.hasMany(Department, { foreignKey: "parent_dept_id", as: "subDepartments" });
Department.belongsTo(Department, { foreignKey: "parent_dept_id", as: "parentDepartment" });

// ---- employee (1) -> employee (*)  [reporting_to, self-referencing] ----
Employee.hasMany(Employee, { foreignKey: "reporting_to", as: "directReports" });
Employee.belongsTo(Employee, { foreignKey: "reporting_to", as: "manager" });

// ---- employee (1) -> review (*)  [emp_id — who the review is ABOUT] ----
Employee.hasMany(Review, { foreignKey: "emp_id", as: "reviewsReceived" });
Review.belongsTo(Employee, { foreignKey: "emp_id", as: "employee" });

// ---- employee (1) -> review (*)  [reviewed_by — who REVIEWS them] ----
Employee.hasMany(Review, { foreignKey: "reviewed_by", as: "reviewsToGive" });
Review.belongsTo(Employee, { foreignKey: "reviewed_by", as: "reviewer" });

// ---- review (1) -> rating_entry (*) ----
Review.hasMany(RatingEntry, { foreignKey: "review_id", as: "ratingEntries" });
RatingEntry.belongsTo(Review, { foreignKey: "review_id", as: "review" });

// ---- measurement_area (1) -> rating_entry (*) ----
MeasurementArea.hasMany(RatingEntry, { foreignKey: "measurement_area_id", as: "ratingEntries" });
RatingEntry.belongsTo(MeasurementArea, { foreignKey: "measurement_area_id", as: "measurementArea" });

// ---- review (1) -> notification (*) ----
Review.hasMany(Notification, { foreignKey: "review_id", as: "notifications" });
Notification.belongsTo(Review, { foreignKey: "review_id", as: "review" });

// ---- employee (1) -> notification (*)  [recipient_id] ----
Employee.hasMany(Notification, { foreignKey: "recipient_id", as: "notifications" });
Notification.belongsTo(Employee, { foreignKey: "recipient_id", as: "recipient" });

// ---- review (1) -> edit_log (*) ----
Review.hasMany(EditLog, { foreignKey: "review_id", as: "editLogs" });
EditLog.belongsTo(Review, { foreignKey: "review_id", as: "review" });

// ---- employee (1) -> edit_log (*)  [edited_by] ----
Employee.hasMany(EditLog, { foreignKey: "edited_by", as: "edits" });
EditLog.belongsTo(Employee, { foreignKey: "edited_by", as: "editor" });

module.exports = {
  sequelize,
  Employee,
  Department,
  MeasurementArea,
  Review,
  RatingEntry,
  Notification,
  EditLog,
};