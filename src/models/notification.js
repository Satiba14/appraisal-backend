module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      recipient_id: { type: DataTypes.UUID, allowNull: false },
      review_id: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      sent_at: { type: DataTypes.DATE, allowNull: true },
      read_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "notifications",
      underscored: true,
      timestamps: true,
    }
  );

  return Notification;
};