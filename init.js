const redis = require('redis');

let rclient;

try {
    rclient = redis.createClient({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
    });
    
    console.log(`Connected to Redis`);
    
} catch (error) {
    rclient = null;
    console.log(error);
}

module.exports = rclient;