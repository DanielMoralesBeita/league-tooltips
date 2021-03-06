const path = require('path');
const express = require('express');
const leagueTips = require('../');
const config = require('./config.js');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use('/tooltips', leagueTips(config.key.riot, leagueTips.REGIONS.EUROPE_WEST, {
  cache: {
    TTL: 60 * 60 * 24,
    redis: {
      host: config.redis.host, // 'localhost'
      port: config.redis.port, // 6379
      prefix: config.redis.prefix // 'league-tooltips-demo_'
    },
  },
  prod: config.env === 'production'
}));

app.listen(config.port, () => {
  console.log('Listening to port', config.port);
});
