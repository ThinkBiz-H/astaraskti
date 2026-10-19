const express = require("express");

const router = express.Router();

const { calculateShipping } = require("../controllers/shipping.controller");

router.post("/calculate", calculateShipping);

module.exports = router;
