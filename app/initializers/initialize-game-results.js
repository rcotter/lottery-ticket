const { fetch, initializeCache } = require('../game-results');

async function initialize({ log = false } = {}) {
  log && console.log('Fetching and caching initial game results');

  const gameResultsWereCached = !!await initializeCache();
  if (!gameResultsWereCached) throw new Error('Unable to fetch and cache initial game results');

  if (log && process.env.NODE_ENV !== 'production') {
    console.log(`${JSON.stringify(fetch(), null, 2)}\n`);
  }

  return gameResultsWereCached;
}

module.exports = initialize;