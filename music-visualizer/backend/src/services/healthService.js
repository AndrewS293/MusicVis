const checkHealth = () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
};

module.exports = { checkHealth };
