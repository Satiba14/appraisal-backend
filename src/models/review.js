module.exports = (sequelize, DataTypes) => {
  const Review = sequelize.define(
    "Review",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      emp_id: { type: DataTypes.UUID, allowNull: false },
      reviewed_by: { type: DataTypes.UUID, allowNull: true },
      review_type: {
        type: DataTypes.ENUM("bond", "annual"),
        allowNull: false,
      },
      cycle_year: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.ENUM("open", "completed"),
        defaultValue: "open",
      },
      is_extended: { type: DataTypes.BOOLEAN, defaultValue: false },
      due_date: { type: DataTypes.DATEONLY, allowNull: true },
      ready_by_date: { type: DataTypes.DATEONLY, allowNull: true },
      emp_submitted_at: { type: DataTypes.DATE, allowNull: true },
      mgr_submitted_at: { type: DataTypes.DATE, allowNull: true },
      overall_rating: { type: DataTypes.FLOAT, allowNull: true },
      strengths: { type: DataTypes.TEXT, allowNull: true },
      improvements: { type: DataTypes.TEXT, allowNull: true },
      short_term_goals: { type: DataTypes.TEXT, allowNull: true },
      long_term_goals: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "reviews",
      underscored: true,
      timestamps: true,
    }
  );

  return Review;
};