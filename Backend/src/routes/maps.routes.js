const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const mapsController = require('../controllers/mapsController');

router.use(authenticate);

router.get('/geocode', mapsController.geocodeQuery);
router.post('/geocode/batch', mapsController.geocodeBatch);

module.exports = router;
