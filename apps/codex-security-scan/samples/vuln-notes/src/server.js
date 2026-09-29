// INTENTIONALLY VULNERABLE SAMPLE — do not deploy.
const express = require("express");
const config = require("./config");
const { register } = require("./routes");

const app = express();
app.use(express.json());
register(app);
app.listen(config.port, "0.0.0.0");
