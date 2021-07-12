const redis = require('redis');


try {
    const rclient = redis.createClient({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
    });
    rclient.SETNX('GCNT', 0);
    console.log(`Connected to Redis`);
    
    module.exports = rclient;
} catch (error) {
    rclient = {};
    console.log(error);
    module.exports = {};
}
