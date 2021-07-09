const router = require('express').Router();
const model = require('./database/index').model;
const rc = require('./init');
const url = require('url');

router.get('*', (req, res, next) => {
    let slug = req.originalUrl;
    slug = slug.split('?')[0].substr(1);

    let alias = req.hostname;
    if(process.env.NODE_ENV=='production'){
        alias = alias.split('.runiv.in')[0];
    }
    else{
        alias = alias.split('.localhost')[0];
    }
    console.log(slug, alias);
    const year = new Date().getFullYear();
    let destination = 'https://linkedin.com/in/harshit-vishwakarma-2001';
    let hostname = new URL(destination).hostname || 'localhost';
    res.status(200).render('redirect', {alias, waiting:1, year, destination, hostname});
});

module.exports = router;