const { checkHealth } = require('../services/healthService');

const getHealth = (req, res) => {
  const result = checkHealth();
  res.json(result);
};

module.exports = { getHealth };
