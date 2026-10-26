module.exports = (sequelize, DataTypes) => {
  const RatingEntry = sequelize.define(
    "RatingEntry",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      review_id: { type: DataTypes.UUID, allowNull: false },
      measurement_area_id: { type: DataTypes.UUID, allowNull: false },
      employee_rating: { type: DataTypes.INTEGER, allowNull: true }, 
      employee_comment: { type: DataTypes.TEXT, allowNull: true },
      supervisor_rating: { type: DataTypes.INTEGER, allowNull: true },
      supervisor_comment: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "rating_entries",
      underscored: true,
      timestamps: true,
    }
  );

  return RatingEntry;
};