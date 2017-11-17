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

// /firebase.database.enableLogging(true);

const DB_PATH = '/schedule/';


module.exports.save = function saveJson(fac, course, json) {
    // некорректно работает с несколькими запросами из-за goOffline()
    database.goOnline();
    const path = DB_PATH + fac + '/' + course + '/';
    database.ref(path).set(json, listener);

    function listener(error) {
        if (error) {
            console.log("Data could for " + path + "not be saved." + error);
        } else {
            console.log("Data for " + path + " saved successfully.");
        }
        database.goOffline();
    }
};