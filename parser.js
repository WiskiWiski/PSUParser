const cheerio = require('cheerio');

const loger = require('./logs/loger.js');
const fit_p = require('./parsers/fit_p.js');
const pref = require('./preferences.js');
const utils = require('./p_utils.js');
const database = require('./database.js');

let parserPackage;

function getSpecificParserPackage(fac, course, html, loger) {
    switch (fac) {
        case fit_p.tag:
            return new fit_p.FitParser(course, html, loger);
        default:
            console.warn('Unknown faculty.');
    }
}


exports.start = function (req, res) {
    var startTime = new Date().getTime();

    const html = cheerio.load(req.body.html, {decodeEntities: false});
    const course = req.body.course;
    const fac = req.body.fac;

    const myLoger = new loger.Loger();

    parserPackage = getSpecificParserPackage(fac, course, html, myLoger);

    const groups = parserPackage.getGroups();
    const dayList = parserPackage.getRows();

    console.log('dayList: ' + dayList.length);

    const finalJson = {};

    /*
    let rowData = parserPackage.parseRow(47);
    const row = parserPackage.linkLessonsGroupsForRow(rowData, groups, 0);
    //saveLGRowToJson(finalJson, row, 0, 1, rowData.time);
    //console.log(JSON.stringify(finalJson));
    return;
    */

    dayList.forEach(function (dayRowsList, dayIndex) {
        // dayRowsList - строки для текущего дня

        if (pref.CONSOLE_LOGS_ENABLE) console.log(pref.STYLE_BRIGHT + pref.BG_COLOR_BLUE + pref.FG_COLOR_WHITE +
            '\n\t\t\tDAY: ' + utils.getDayByIndex(dayIndex) + '\t\t\t\t' + pref.COLORS_DEFAULT);

        dayRowsList.forEach(function (dayRow, rowIndex) {
            // lessons and groups
            const lAndG = parserPackage.linkLessonsGroupsForRow(dayRow, groups, dayIndex);
            saveLGRowToJson(finalJson, lAndG, dayIndex, rowIndex, dayRow.time);
        });
    });

    database.save(fac, course, finalJson);
    myLoger.printLogs(true, loger.LT_MSG);

    var endTime = new Date().getTime();
    console.log("The encryption/decryption took: " + (endTime - startTime) + "ms.");

    res.status(200).end(myLoger.logsToString(false, loger.LT_MSG, true));
};

function saveLGRowToJson(json, row, dayIndex, rowIndex, time) {
    // Сохраняет строку в json
    function forColorRow(colorRow, color) {
        colorRow.forEach(function (groupLessons) {
            const groupName = groupLessons.groupName;
            const len = groupLessons.lessons.length;

            // если массив lessons содержит только одну подгруппу, сохраняем её же для других
            for (let subGroupN = 0; subGroupN < len || (len === 1 && subGroupN < parserPackage.MAX_SUB_GROUPS_NUMB); subGroupN++) {
                const subGroupLesson = subGroupN >= len ? groupLessons.lessons[0] : groupLessons.lessons[subGroupN];

                const val = {
                    cell_html: subGroupLesson.element.html(),
                    lesson: subGroupLesson.text,
                    time: time
                };
                const jsonPath = [color, groupName, subGroupN + 1, dayIndex + 1, rowIndex + 1];
                pushToJson(json, val, jsonPath);
            };
        });
    }


    forColorRow(row[pref.WEEK_TITLE_WHITE], pref.WEEK_TITLE_WHITE);
    if (row[pref.WEEK_TITLE_GREEN] === undefined) {
        forColorRow(row[pref.WEEK_TITLE_WHITE], pref.WEEK_TITLE_GREEN);
    } else {
        forColorRow(row[pref.WEEK_TITLE_GREEN], pref.WEEK_TITLE_GREEN);
    }

}

function pushToJson(json, val, path) {
    // Записывает данные в json объект по указанному пути
    // json - объект, в который будут записаны данные
    // val - данные для записи
    // path - массив, содержащий путь для записи

    const firstPath = path[0];
    const secondPath = path[1];

    if (json[firstPath] === undefined) {
        json[firstPath] = {};
    }

    if (secondPath === undefined) {
        Object.assign(json[firstPath], val);
    } else {
        delete arguments[2];
        path = path.splice(1, path.length - 1);
        pushToJson(json[firstPath], val, path);
    }
}