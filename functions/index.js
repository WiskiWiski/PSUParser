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
                parser.start(req, res);
            }
        }
    });
});


exports.psu_saver = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        if (req.method !== "POST" || req.body === undefined) {
            res.status(404).end();
        } else {
            const user = req.body.user;
            const dataJson = req.body.data;
            const fac = req.body.fac;
            const course = req.body.course;

            const database = require('./database.js');
            database.saveSchedule(user, fac, course, dataJson, function (databaseResponse) {
                res.status(200).end(JSON.stringify(databaseResponse));
            });
        }
    });
});

exports.init_timetebale_test = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        console.log('hello world');
        res.status(200).end('hello world');
        /*
                //process.env["NTBA_FIX_319"] = 1;
                const TelegramBot = require('node-telegram-bot-api');

                // replace the value below with the Telegram token you receive from @BotFather
                const token = '464995288:AAHB66GiZs2Pr7cDsP3IWkOZRFAdipzgMY4';

                // Create a bot that uses 'polling' to fetch new updates
                const bot = new TelegramBot(token, {polling: true});
                bot.getMe().then((botInfo) => {
                    console.log("------------------");
                    console.log("Bot is running:");
                    console.log(botInfo);
                    console.log("------------------");
                });

                // IDs:
                const ID_wiski_w =  182144055;

                console.log('hello1');
                bot.sendMessage(ID_wiski_w, 'Received your message').then(()=>{
                    console.log('hello2');
                    res.status(200).end();
                });
                console.log('hello3');
                */

    });
});
