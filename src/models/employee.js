module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    "Employee",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      first_name: { type: DataTypes.STRING, allowNull: false },
      last_name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      department_id: { type: DataTypes.UUID, allowNull: true },
      reporting_to: { type: DataTypes.UUID, allowNull: true }, 
      join_date: { type: DataTypes.DATEONLY, allowNull: true },
      employee_type: {
        type: DataTypes.ENUM("fresher", "experienced"),
        allowNull: true,
      },
      bond_duration_months: { type: DataTypes.INTEGER, allowNull: true },
      bond_completion_date: { type: DataTypes.DATEONLY, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      tableName: "employees",
      underscored: true, 
      timestamps: true,  
    }
  );

  return Employee;
};