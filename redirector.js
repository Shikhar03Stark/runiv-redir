const router = require('express').Router();
const sequelize = require('./database/index').init.sequelize;
const model = require('./database/index').model;
const Op = require('./database/index').init.Op;
const rc = require('./init');
const uri = require('url');
const promisify = require('util').promisify;

const validate_slug = (slug) => {
    if(slug.length == 0){
        return {
            valid: false,
            reason: `Slug can not be empty`,
        }
    }

    if(slug.length > 60){
        return {
            valid: false,
            reason: `Slug length must be less than 60 characters`,
        }
    }

    const re = /^[a-zA-Z0-9-*_]*$/;
    const match = re.test(slug);
    if(!match){
        return{
            valid: false,
            reason: `Slug can only include letters, numbers and special characters -_*`
        }
    }

    return {
        valid: true,
        reason: null,
    }
}

const validate_alias = (alias) => {
    if(alias.lenght < 3 || alias.length > 14){
        return {
            valid: false,
            reason: `Alias length must be between 3 to 14`,
        };
    }
    const last_re = /[a-z0-9]$/i;
    const start_re = /^[a-z]/i;
    const exclude_re = /^[a-zA-Z0-9-]*$/i;
    const match = start_re.test(alias) && last_re.test(alias) && exclude_re.test(alias);
    if(!match){
        return {
            valid: false,
            reason: `Alias can only include number, english letters, hyphens. Must start with letter, end with letter or number`,
        }
    }
    else{
        return {
            valid: true,
            reason: null,
        }
    }
}

const dest_hit = async (alias, slug) => {
    /**
     * 1. Validate alias and slug.
     * 2. Hit redis with alias:slug.
     * 3. If found, return destination, options
     * 4. If Not found, Hit postgres with alias:string
     * 5. return destination, options
     * 6. If not found on DB, return null, options.
     */
    return new Promise((resolve, reject) => {
        const v_slug = validate_slug(slug);
        if(!v_slug.valid){
            return resolve({
                valid: false,
                destination: null,
                reason: v_slug.reason,
            });
        }
        const v_alias = validate_alias(alias);
        if(!v_alias){
            return resolve({
                valid: false,
                destination: null,
                reason: v_alias.reason,
            });
        }
    
        const key = alias+':'+slug;
        rc.HGETALL(key,async (err, data) => {
            //console.log('redis:', data, err);
            if(err){
                return reject({
                    valid:true,
                    destination: null,
                    reason: err,
                    redis: true,
                });
            }
            if(data){
                //redis hit
                return resolve({
                    valid: true,
                    destination: data.dest,
                    redirects: data.redir,
                    link_id: data.lid,
                    redis: true,
                    alias,
                    slug
                });
            }
            else{
                //hit db
                const link = await model.link.findOne({
                    where:{
                        slug: slug,
                        status: 'ACTIVE',
                    },
                    include: {
                        model: model.user,
                        where: {
                            alias: alias,
                            banned: false,
                        }
                    }

                });

                if(link){
                    return resolve({
                        valid: true,
                        destination: link.destination,
                        redirects: link.redirects,
                        link_id: link.id,
                        redis: false,
                        alias,
                        slug
                    });

                }
                else{
                    return resolve({
                        valid: true,
                        destination: null,
                        redis: false,
                    });

                }
                
            }
        });
    })
}

const sync_db = async (options) => {
    /**
     * 0. Check valid.
     * 1. If destination was found on redis, INCR redir
     * ...  if redir%10 == 0
     * ...      Update metric in pg db
     * 2. else if destionation was found on PG
     * ...  SET HMSET alias:slug, INCR redir
     * ...  if redir%10 == 0
     * ...      Update metric in pg db
     * 3. else, do nothing
     */
    if(options.valid){
        if(options.destination){
            const key = options.alias+':'+options.slug;
            if(options.redis){
                rc.HINCRBY(key, 'redir', 1);
                if(options.redirects % 10 == 0){
                    //update metric
                    model.metric.update({
                        timestamps: sequelize.fn('array_append', sequelize.col('timestamps'), new Date().toISOString()),
                    }, {
                        where: {
                            link_id: options.link_id
                        }
                    });
                    //update link
                    model.link.update({
                        redirects: options.redirects,
                    }, {
                        where:{
                            id: options.link_id,
                        }
                    });
                }
            }
            else{
                //set object in redis
                rc.HMSET(key, {
                    dest: options.destination,
                    redir: options.redirects,
                    lid: options.link_id
                });
                rc.HINCRBY(key, 'redir', 1);

                if(options.redirects % 10 == 0){
                    //update metric
                    model.metric.update({
                        timestamps: sequelize.fn('array_append', sequelize.col('timestamps'), new Date().toISOString()),
                    }, {
                        where: {
                            link_id: options.link_id
                        }
                    });
                    //update link
                    model.link.update({
                        redirects: options.redirects,
                    }, {
                        where:{
                            id: options.link_id,
                        }
                    });
                }
            }

            rc.INCR('GCNT');
        }
        console.log(options);
    }
}

router.get('*', async (req, res, next) => {
    try {
        let slug = req.originalUrl;
        slug = slug.split('?')[0].substr(1);
    
        let alias = req.hostname;
        console.log('alias', alias, 'slug', slug);
        if(process.env.NODE_ENV=='production'){
            alias = alias.split('.runiv.in')[0];
        }
        else{
            alias = alias.split('.localhost')[0];
        }
        //console.log('slug and alias', slug, alias);
        const year = new Date().getFullYear();
        dest_hit(alias, slug).then((data) => {
            sync_db(data);
            if(data.valid){
                if(data.destination){
                    const re = /^(https?:\/\/)/;
                    if(!re.test(data.destination)) data.destination = 'http://'+data.destination;
                    const hostname = new URL(data.destination).hostname;
                    res.status(200).render('redirect', {alias, waiting:1, year, destination: data.destination, hostname});
                }
                else{
                    res.status(200).render('default', {alias, waiting:5, year, destination:null});
                }
            }
            else{
                res.status(200).render('invalid', {year, destination:null});
            }
            //console.log(data);
        });
        


    } catch (error) {
        res.send(error);
    }
});

module.exports = router;