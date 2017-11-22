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
    
    const path = DB_PATH + fac + '/' + course + '/';
	
	let reqCount = 0; // количество запросов на сохранение
	let resCount = 0; // количество ответов
	database.goOnline();
	for(let key in json){	
		reqCount++;
		database.ref(path).child(key).set(json[key], function(error) {
			resCount++;
			if (error){
				console.log("Saving aborted! Saving data for %s/ has faild (%d/%d): %s", path + key, resCount, reqCount, error);
				database.goOffline();
			} else {
				console.log("Data for %s/ has saved successfully (%d/%d).", path + key, resCount, reqCount);
				if (resCount >= reqCount){
					console.log("All data for %s has saved successfully (%d/%d).", path, resCount, reqCount);
					database.goOffline();
				}
			}
		});
	}	
};