const express = require('express');
const bodyParser = require('body-parser');


const fs = require('fs');
const cheerio = require('cheerio');
const fit = require('./parsers/prs_fit.js');


const cors = require('cors'); // для междоменных запросов
const app = express(); // для запуска сервера
const port = 3000;


//autostart();

function autostart() {
    const offLineCourse = 2;
    const htmlStr = fs.readFileSync('./fits/fit-' + offLineCourse + '.html');
    const html = cheerio.load(htmlStr, {decodeEntities: false});
    const scheduleTable = html('table').eq(1).children('tbody');
    fit.parse(offLineCourse, scheduleTable);
}

function main(req, res) {
    const html = cheerio.load(req.body.html, {decodeEntities: false});
    const scheduleTable = html('table').eq(1).children('tbody');

    const course = req.body.course;
    switch (req.body.fac) {
        case fit.tag:
            res.setHeader('content-type', 'text/javascript');
            res.end(fit.parse(course, scheduleTable, res));
            break;
        default:
            console.log('unknown faculty');
            res.end('unknown faculty');
    }
}

/////////////////////////////////////// SERVER ///////////////////////////////////////////
app.use(cors({origin: true})); // одобрение междоменных запросов
app.use(bodyParser.json()); // одобрение междоменных запросов

app.post('/', (req, res) => {
    main(req, res);
    //res.end(main(DEFAULT_COURSE, DEFAULT_FAC));
});


// запуск сервера
app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
});