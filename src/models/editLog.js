module.exports = (sequelize, DataTypes) => {
  const EditLog = sequelize.define(
    "EditLog",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      review_id: { type: DataTypes.UUID, allowNull: false },
      edited_by: { type: DataTypes.UUID, allowNull: false },
      edited_role: {
        type: DataTypes.ENUM("emp", "mgr"),
        allowNull: false,
      },
      comment: { type: DataTypes.TEXT, allowNull: false }, // mandatory, per Nishanth's rule
      edited_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      tableName: "edit_logs",
      underscored: true,
      timestamps: false, 
    }
  );

  return EditLog;
};