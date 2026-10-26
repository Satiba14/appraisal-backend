module.exports = (sequelize, DataTypes) => {
  const MeasurementArea = sequelize.define(
    "MeasurementArea",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      criteria_text: { type: DataTypes.TEXT, allowNull: true },
      order: { type: DataTypes.INTEGER, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      tableName: "measurement_areas",
      underscored: true,
      timestamps: true,
    }
  );

  return MeasurementArea;
};