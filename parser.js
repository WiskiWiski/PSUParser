const fit = require('./parsers/prs_fit.js');
const cheerio = require('cheerio');




module.exports.parse = function (req, res) {
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
};