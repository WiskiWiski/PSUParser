const express = require('express');
const bodyParser = require('body-parser');


const fs = require('fs');
const cheerio = require('cheerio');
const utils = require('./p_utils.js');
const parser = require('./parser.js');


const cors = require('cors'); // для междоменных запросов
const app = express(); // для запуска сервера
const port = 3000;


autostart();

function autostart() {
    // для локального запуска
    const offLineCourse = 4;
    const htmlStr = fs.readFileSync('./fits/fit-' + offLineCourse + '.html');
    const html = cheerio.load(htmlStr, {decodeEntities: false});

    const req = {
        body:{
            html: html.html(),
            course: offLineCourse,
            fac: 'fit',
            sgpg: 2 // subgroups per group
        }
    };

    const res = {
        status: function (code) {
            // ...do nothing
            return this;
        },
        end: function (msg) {
            // ...do nothing
            return this;
        }
    };
    parser.start(req, res);
}

function main(req, res) {
    if (req.body.action === 'show') {
        res.status(200).end(utils.tableStyle + '\n' + req.body.html);
    } else {
        parser.start(req, res);
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