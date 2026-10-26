
const { MeasurementArea } = require("../models");
const measurementAreas = require("./measurementAreas.data");

async function seedMeasurementAreas() {
  const summary = {
    inserted: 0,
    skipped: 0,
  };

  for (const area of measurementAreas) {
    const existing = await MeasurementArea.findOne({
      where: MeasurementArea.sequelize.where(
        MeasurementArea.sequelize.fn("LOWER", MeasurementArea.sequelize.col("name")),
        area.name.toLowerCase()
      ),
    });

    if (existing) {
      summary.skipped++;
      console.log(`Skipped existing area: ${area.name}`);
      continue;
    }

    await MeasurementArea.create({
      name: area.name,
      criteria_text: area.criteria_text,
      order: area.order,
      is_active: true,
    });

    summary.inserted++;
    console.log(`Inserted: ${area.name}`);
  }

  console.log("Measurement area seed summary:", summary);
  return summary;
}

module.exports = { seedMeasurementAreas };
