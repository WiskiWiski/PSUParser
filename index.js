const functions = require('firebase-functions');
const parser = require('./parser.js');
const cors = require('cors')({origin: true}); // https://medium.com/trisfera/using-cors-in-express-cac7e29b005b
//const cors = require('cors')({origin: 'http://wiskiw.esy.es'}); // https://medium.com/trisfera/using-cors-in-express-cac7e29b005b

// 'http://wiskiw.esy.es'
//  https://us-central1-psu-by.cloudfunctions.net/psu
// https://cloud.google.com/functions/docs/writing/http

const tableStyle = '<style type="text/css">TABLE { border-collapse: collapse; /* Убираем двойные линии между ячейками */} TD, TH {padding: 3px; /* Поля вокруг содержимого таблицы */border: 1px solid black; /* Параметры рамки */}</style>'

exports.psu = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
		// req.body.fac
		// req.body.course
		if (req.method != "POST" || req.body === undefined) {
			 res.status(404).end();
		} else {
			// Everything is ok
			console.log('ok');
			parser.parse(req, res);
			//res.status(200).end(tableStyle + '\n'+req.body.html);
		}		
    });
});
