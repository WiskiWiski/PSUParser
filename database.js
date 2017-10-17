/**
 * Created by WiskiW on 13.10.2017.
 */
const firebase = require("firebase");
const config = {
    apiKey: "AIzaSyALpqEcR7wNpWmPfvL2ka23TvQ3yTg7uKE",
    authDomain: "psu-by.firebaseapp.com",
    databaseURL: "https://psu-by.firebaseio.com",
    projectId: "psu-by",
    storageBucket: "psu-by.appspot.com",
    messagingSenderId: "361692093726"
};
firebase.initializeApp(config);
const database = firebase.database();

const DB_PATH = '/schedule/';


module.exports.save = function saveJson(fac, course, json) {
    database.ref(DB_PATH + fac + '/' + course + '/').set(json);
};