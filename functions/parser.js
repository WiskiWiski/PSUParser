const cheerio = require('cheerio');

const loger = require('./loger.js');
const root_p = require('./parsers/root_p.js');
const pref = require('./preferences.js');
const utils = require('./p_utils.js');
const database = require('./database.js');

let course;
let fac;
let sgpg;

function getSpecificParserPackage(html, mLoger) {
    switch (fac) {
        case 'gf':
        case 'fit':
            return new root_p.RootParser(mLoger, course, sgpg, html);
        default:
            throw Error('Unknown faculty.');
    }
}

// Основной метод анализа документа
exports.start = function (req, res) {
    const startTime = new Date().getTime();

    const html = cheerio.load(req.body.html, {decodeEntities: false});
    course = req.body.course;
    fac = req.body.fac;
    sgpg = req.body.sgpg; // Максимальное количество подгрупп в группе

    const mLoger = new loger.Loger();
    const parserPackage = getSpecificParserPackage(html, mLoger);

    try {
        const groups = parserPackage.getGroups();
        const dayList = parserPackage.getTimeRows();

        const finalJson = {};

        /*
        const rowInfo = parserPackage.getRowInfo(12);
        let  clearDoubleTimeRow = parserPackage.getDoubleSimpleTimeRow(rowInfo);
        const row = parserPackage.linkLessonsGroupsForRow(clearDoubleTimeRow, groups);
        console.log(row['white'][2]);
        //saveLGRowToJson(finalJson, row, 0, 1, rowData.time);
        //console.log(JSON.stringify(finalJson));
        return;
        */

        dayList.forEach(function (dayRowsList, dayIndex) {
            // dayRowsList - строки для текущего дня

            if (pref.CONSOLE_LOGS_ENABLE) console.log(pref.STYLE_BRIGHT + pref.BG_COLOR_BLUE + pref.FG_COLOR_WHITE +
                '\n\t\t\tDAY: ' + utils.getDayByIndex(dayIndex) + '\t\t\t\t' + pref.COLORS_DEFAULT);

            mLoger.logPos.weekDayIndex = dayIndex;

            dayRowsList.forEach(function (dayRow, rowIndex) {
                // lessons and groups
                mLoger.logPos.rowTime = dayRow.time;
                mLoger.logPos.dayLessonIndex = rowIndex;

                const lAndG = parserPackage.linkLessonsGroupsForRow(dayRow, groups);
                saveLGRowToJson(finalJson, lAndG, dayIndex, rowIndex, dayRow.time);
            });
        });

        database.save(fac, course, finalJson);
    } catch (err) {
        if (err.name === loger.NAME_LOG_ERROR) {
            console.error('========= Processing aborted! =========');
        } else {
            throw err;
        }
    }


    const jsonLogs = mLoger.logsToJSONList();

    mLoger.printLogs(true);
    //database.save('logs', '', jsonLogs);

    const endTime = new Date().getTime();
    console.log("The analyze took: " + (endTime - startTime) + "ms.");
    res.status(200).end(JSON.stringify(jsonLogs));


    function saveLGRowToJson(json, row, dayIndex, rowIndex, time) {
        // Сохраняет строку в json
        function forColorRow(colorRow, color) {
            colorRow.forEach(function (groupLessons) {
                const groupName = groupLessons.groupName;
                const len = groupLessons.lessons.length;

                // если массив lessons содержит только одну подгруппу, сохраняем её же для других
                for (let subGroupN = 0; subGroupN < len || (len === 1 && subGroupN < sgpg); subGroupN++) {
                    const subGroupLesson = subGroupN >= len ? groupLessons.lessons[0] : groupLessons.lessons[subGroupN];

                    if (subGroupN + 1 > sgpg) {
                        const logObj = new loger.LogObject();
                        logObj.setCode(3006);
                        logObj.toShow = ['dl', 'di', 'dt', 'sb'];
                        logObj.setPayload(subGroupLesson.text);
                        logObj.setDisplayText('Проверьте правильность соответствия границ групп и предметов');
                        logObj.setMessage('У группы найдено ' + (subGroupN + 1) +
                            ' подгруппы при максимально кол-ве подгрупп ' + sgpg);
                        mLoger.log(logObj);
                    }

                    const val = {
                        cellHtml: subGroupLesson.element.html(),
                        lesson: subGroupLesson.text,
                        cellLesson: subGroupLesson.cellLesson,
                        time: time
                    };
                    const jsonPath = [color, groupName, subGroupN + 1, dayIndex + 1, rowIndex + 1];
                    pushToJson(json, val, jsonPath);
                }
            });
        }


        mLoger.logPos.subRow = loger.SUB_ROW_TITLE_A;
        forColorRow(row[loger.SUB_ROW_TITLE_A], 'white');
        if (row[loger.SUB_ROW_TITLE_B] === undefined) {
            forColorRow(row[loger.SUB_ROW_TITLE_A], 'green');
        } else {
            mLoger.logPos.subRow = loger.SUB_ROW_TITLE_B;
            forColorRow(row[loger.SUB_ROW_TITLE_B], 'green');
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

};
