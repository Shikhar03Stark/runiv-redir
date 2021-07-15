const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const redirector = require('./redirector');
const engine = require('mustache-express');
//Instansiate App
const app = express();
const PORT = process.env.PORT || 5000;

//Apply Middleware
app.set('trust proxy', true);
app.engine('mustache', engine());
app.set('view engine', 'mustache');
app.use(cors());
app.use(morgan('short'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use('/static', express.static(__dirname+'/static'));

//health handler
app.get('/check/health', (req, res, next) => {
    res.status(200).json({
        ok: true,
        message: 'Runiv Redirection server is live'
    });
})

//Main redirect handler
app.use('*', redirector);
//Error handler
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({
        ok: false,
        message
    });
    process.env.NODE_ENV === 'development'?console.log(err):null;
});

//Route not found
app.use((req, res, next) => {
    res.status(404).json({
        ok: false,
        message: `Supports GET requests only`,
    });
});

(async () => {
    const db = require('./database/init');
    await db.connect();
    if(process.env.NODE_ENV === 'development'){
        await db.sequelize.sync({
            alter: true,
            force: true,
        })
    }
    else{
        await db.sequelize.sync();
    }
})()

app.listen(PORT, () => {
    console.log(`Server running @:${PORT}`);
    console.log(`NODE_ENV ${process.env.NODE_ENV}`);
});

//testing server
module.exports = app;
