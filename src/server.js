require("dotenv").config();
const app = require("./app");
const { sequelize } = require("./models");

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // authenticate() just tests the DB connection, doesn't change anything
    await sequelize.authenticate();
    console.log("Database connection OK");

   
    console.log("Models initialized");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Unable to start server:", err);
    process.exit(1);
  }
}

start();