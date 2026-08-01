const express = require('express');
const { findCluster } = require('../controllers/clusterController');

const router = express.Router();

router.post('/find', findCluster);

module.exports = router;
