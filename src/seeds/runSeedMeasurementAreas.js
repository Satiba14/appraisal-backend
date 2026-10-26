
const { sequelize } = require("../models");
const { seedMeasurementAreas } = require("./seedMeasurementAreas");

async function main() {
  try {
    await sequelize.authenticate();
    console.log("Database connection successful.");

    await seedMeasurementAreas();

    console.log("Measurement area seeding completed.");
  } catch (error) {
    console.error("Measurement area seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
