const functions = require('firebase-functions');
const parser = require('./parser.js');
const utils = require('./p_utils.js');
const cors = require('cors')({origin: true}); // https://medium.com/trisfera/using-cors-in-express-cac7e29b005b
//const cors = require('cors')({origin: 'http://wiskiw.esy.es'}); // https://medium.com/trisfera/using-cors-in-express-cac7e29b005b

// 'http://wiskiw.esy.es'
//  https://us-central1-psu-by.cloudfunctions.net/psu
// https://cloud.google.com/functions/docs/writing/http


exports.psu = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        if (req.method !== "POST" || req.body === undefined) {
            res.status(404).end();
        } else {
            if (req.body.action === 'show') {
                res.status(200).end(utils.tableStyle + '\n' + req.body.html);
            } else {
                parser.parse(req, res);
            }
        }
    });
});
