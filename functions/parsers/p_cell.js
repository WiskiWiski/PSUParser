const pref = require('../preferences.js');
const loger = require('../loger.js');
const utils = require('../p_utils.js');

const KEY_TEACHER_NAME = 'teacherName';
const KEY_ROOM = 'room';
const KEY_WEEK_NUMBERS = 'weekNumbers';
const KEY_DAYS = 'days';
const KEY_DATES = 'dates';
const KEY_TIME = 'time';
const KEY_LESSON = 'lesson';
const KEY_LESSON_TYPE = 'lessonType';
const KEY_COMMENTS = 'comments';

const DEBUG_LOGS = false;

const self = this;

exports.parseCellContent = function (mLoger, content, toShow) {
    content = content.replace(/\s\s+/g, ' '); // удаляем множественные пробелы
    const lessons = content.split(/;/g);
    const resultLessons = [];
    lessons.forEach(function (les, lesI) {
        les = les.trim();
        if (les !== '') {
            if (DEBUG_LOGS && lesI > 0) console.log('-------------И-------------');

            const REG_EXT_FOR_CHOOSE = /(По\s+выбору\s*)|(На\s+выбор\s*):/gi;
            const REG_EXT_OR = /\s+или\s+/gi;

            const hasOR_TEXT = REG_EXT_OR.test(les);
            const hasFOR_CHOOSE_TEXT = REG_EXT_FOR_CHOOSE.test(les);

            if (hasFOR_CHOOSE_TEXT && !hasOR_TEXT) {
                const logObj = new loger.LogObject();
                logObj.setPayload(les);
                logObj.toShow = toShow;
                logObj.setMessage('В тексте предметов ячейки был найден \"НА ВЫБОР\" текст, но не было найдено \"ИЛИ\"');
                logObj.setDisplayText('Проверьте правильность оформления ячекйи с предметами \"НА ВЫБОР\"');
                logObj.setCode(3102);
                mLoger.log(logObj);
                return;
            }

            const lessonForChooseList = []; // список предметов на выбор (объекты)

            if (hasOR_TEXT && hasFOR_CHOOSE_TEXT) {
                // если есть предметы по выбору

                // список предметов на выбор (простой текст)
                const textLessonForChooseList = les.replace(REG_EXT_FOR_CHOOSE, '').split(REG_EXT_OR);
                textLessonForChooseList.forEach((lessonForChoose, i) => {
                        if (DEBUG_LOGS && i > 0) console.log('--------ИЛИ--------');
                        lessonForChooseList.push(parseLesson(lessonForChoose))
                    }
                );
            } else {
                lessonForChooseList.push(parseLesson(les));
            }

            resultLessons.push(lessonForChooseList);
        }
    });
    if (DEBUG_LOGS) console.log('\n');
    return resultLessons;


    function parseLesson(lessonData) {
        let tooManyLogString = '';
        const originData = lessonData;
        const resultData = {};

        if (DEBUG_LOGS) console.log('LESSON before: \'%s\'', lessonData);
        lessonData = self.extractComments(lessonData, resultData);

        if (lessonData.trim() === '') {
            // если после того, как убрали комментария - ячейка пустая
            if (DEBUG_LOGS) console.log('LESSON after: \'%s\'', lessonData);
            if (DEBUG_LOGS) console.log(resultData);
            return lessonData;
        }

        lessonData = extractTeacherName(lessonData, resultData);
        lessonData = extractWeekNumbers(lessonData, resultData);
        lessonData = extractTime(lessonData, resultData);
        lessonData = extractDate(lessonData, resultData);
        lessonData = extractCalendarDays(lessonData, resultData);
        lessonData = extractRoom(lessonData, resultData);
        lessonData = extractLessonType(lessonData, resultData);
        lessonData = extractLesson(lessonData, resultData);
        if (DEBUG_LOGS) console.log('LESSON after: \'%s\'', lessonData);
        checkResidue(lessonData);
        if (DEBUG_LOGS) console.log(resultData);

        function extractTeacherName(source, resultData) {
            const REG_EXP_TEACHER = /\s+[-−–—]\s+([А-ЯA-ZЁ][а-яa-zё]*[-−–—]*)*\s*[А-ЯA-ZЁ]\s*\.([А-ЯA-ZЁ]\s*\.)?/g;
            let teacherList = getByRegExp(source, REG_EXP_TEACHER);
            switch (teacherList.length) {
                case 0:
                    // Перпод не найден
                    break;
                case 1:
                    let teacherName = teacherList[0];
                    source = source.replace(teacherName, '');

                    teacherName = teacherName.replace(/\s+[-−–—]\s+/g, ' ');
                    resultData[KEY_TEACHER_NAME] = teacherName.trim();

                    if (teacherName.includes('-')) {
                        // Log warning: имя преподавателя содержит -. Вы уверены?
                    }

                    break;
                default:
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько возможных имен преподавателей; '
            }

            return source;
        }

        function extractWeekNumbers(source, resultData) {
            const REG_EXP_WEEK_NUMBERS = /\(([0-9]|,|[-−–—]|н|\s)*\)/gi;

            let weekNumberList = getByRegExp(source, REG_EXP_WEEK_NUMBERS);

            const len = weekNumberList.length;
            switch (len) {
                case 0:
                    // недели не указаны
                    break;
                case 1:
                    let weekNumbersStr = weekNumberList[0];

                    source = source.replace(weekNumbersStr, '');
                    weekNumbersStr = weekNumbersStr.replace(/[\sн\(\)]*/gi, ''); // удаляем пробелы, 'н' и скобки

                    const weekNumbersStringGroupList = weekNumbersStr.split(',');

                    if (weekNumbersStringGroupList.length > 0) {
                        resultData[KEY_WEEK_NUMBERS] = [];
                        weekNumbersStringGroupList.forEach(function (weekNumberStringGroup) {
                            weekNumberStringGroup = weekNumberStringGroup.trim();

                            if (weekNumberStringGroup.includes('-') || weekNumberStringGroup.includes('–')) {
                                resultData[KEY_WEEK_NUMBERS] = resultData[KEY_WEEK_NUMBERS]
                                    .concat(parseWeeksDash(weekNumberStringGroup));

                            } else if (/[0-9]+/g.test(weekNumberStringGroup)) {
                                resultData[KEY_WEEK_NUMBERS] = resultData[KEY_WEEK_NUMBERS]
                                    .concat(parseWeeksNumber(weekNumberStringGroup));

                            } else {
                                const logObj = new loger.LogObject();
                                logObj.setCode(3104);
                                logObj.setMessage('Неверный формат текста группы конкретизации недель( XXX, .... н):\'' +
                                    weekNumberStringGroup + '\'');
                                logObj.toShow = toShow;
                                logObj.setPayload(originData);
                                logObj.setDisplayText('Проверьте правиль оформления недель для предмета');
                                mLoger.log(logObj);
                            }
                        });
                        if (resultData[KEY_WEEK_NUMBERS].length > 0) {
                            resultData[KEY_WEEK_NUMBERS].sort((a, b) => a - b)
                        }
                    }
                    break;
                default:
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько параметров недель(ХХн); '
            }


            var hasParseIntError = false;

            function parseIntError(str) {
                if (!hasParseIntError) {
                    hasParseIntError = true;
                    const logObj = new loger.LogObject();
                    logObj.setPayload(originData);
                    logObj.setMessage('Не удалось конвертировать строку \'' + str + '\' из недель предмета в число');
                    logObj.toShow = toShow;
                    logObj.setDisplayText('Проверьте правильность указания недель предмета');
                    logObj.setCode(2103);
                    mLoger.log(logObj);
                }
            }

            function parseWeeksDash(weekNumbersStr) {
                const weekNumbers = [];
                const startEndIndexes = weekNumbersStr.split(/[-−–—]/g);
                if (startEndIndexes.length !== 2) {
                    const logObj = new loger.LogObject();
                    logObj.setPayload(originData);
                    logObj.setMessage('При формате указания недель предмета: (X-XXн), было найдено ' + startEndIndexes.length +
                        ' числовых значений');
                    logObj.toShow = toShow;
                    logObj.setDisplayText('Проверьте правильность указания неделей для предмета');
                    logObj.setCode(2102);
                    mLoger.log(logObj);
                }

                startEndIndexes.forEach(function (strNumber, i) {
                    const number = parseInt(strNumber);
                    if (!isNaN(number)) {
                        startEndIndexes[i] = number;
                    } else {
                        parseIntError(strNumber);
                    }
                });
                const iFrom = startEndIndexes[0];
                const iTo = startEndIndexes[1];
                for (let k = iFrom; k <= iTo; k++) {
                    weekNumbers.push(k);
                }
                return weekNumbers;
            }

            function parseWeeksNumber(weekNumbersStr) {
                const number = parseInt(weekNumbersStr);
                if (!isNaN(number)) {
                    return [number];
                } else {
                    parseIntError(weekNumbersStr);
                }
                return [];
            }

            return source;
        }

        function extractCalendarDays(source, resultData) {
            const REG_EXP_DAYS = /[0-9]{1,2}\s+((январ|феврал|март|апрел|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]?|(май|мая))\s*,?/gi;
            let strDayList = getByRegExp(source, REG_EXP_DAYS); // прм: '21 сентября ,' '19 октября,' '16 ноября,' '21 декабря' '16 мая,'
            if (strDayList.length > 0) {

                const dayList = [];
                strDayList.forEach(function (date) {
                    source = source.replace(date, '');

                    date = date.replace(/\s*,\s*/, ''); // удаляем запятые
                    date = date.trim();

                    const REG_EXP_MONTH_WORDS = /[А-яё]{3,}/gi;
                    const REG_EXP_MONTH_DAYS = /[0-9]{1,2}/gi;
                    const monthList = getByRegExp(date, REG_EXP_MONTH_WORDS);
                    if (monthList.length === 1) {
                        const shortMonth = getShortMonth(monthList[0]);

                        const daysList = getByRegExp(date, REG_EXP_MONTH_DAYS);
                        if (daysList.length === 1) {
                            const day = daysList[0];
                            if (day.length < 1 || day.length > 2 || shortMonth === undefined || shortMonth.trim() === '') {
                                throwError(date);
                            } else {
                                const dateObj = utils.getDateFromFormat('d MMM', day + ' ' + shortMonth);
                                console.log('ДД МЕСЯЦ: ' + day + ' ' + shortMonth);
                                const ms = dateObj.getTime();
                                if (ms === 0) {
                                    throwError(date);
                                }
                                dayList.push(dateObj.getTime());
                            }
                        }

                    }
                });
                resultData[KEY_DAYS] = dayList;
            }

            function throwError(date) {
                const logObj = new loger.LogObject();
                logObj.setCode(3113);
                logObj.toShow = toShow;
                logObj.setPayload(originData);
                logObj.setMessage('Некорректный форматы календарной даты для пары: \"' + date + '\"');
                logObj.setDisplayText('Некорректный форматы календарных дней для пары: \"' + date + '\"');
                mLoger.log(logObj);
            }

            function getShortMonth(month) {
                let short;
                month = month.toLowerCase();
                utils.MONTH_NAMES.forEach(function (iName) {
                    if (short !== undefined) {
                        return;
                    }
                    if (month.includes(iName.toLowerCase())) {
                        short = iName;
                    }
                });
                return short;
            }

            return source;
        }

        function extractTime(source, resultData) {
            const REG_EXP_TIME = /[0-9]{1,2}:[0-9]{2}/g;

            let timeList = getByRegExp(source, REG_EXP_TIME);

            switch (timeList.length) {
                case 0:
                    // время не указано
                    break;
                case 1:
                    let time = timeList[0];
                    source = source.replace(time, '');
                    time = time.trim();
                    const newDate = utils.getDateFromFormat('H:mm', time);
                    const ms = newDate.getTime();
                    if (ms === 0) {
                        const logObj = new loger.LogObject();
                        logObj.setCode(3112);
                        logObj.toShow = toShow;
                        logObj.setPayload(originData);
                        logObj.setMessage('Некорректный форматы времени для пары: \"' + time + '\"');
                        logObj.setDisplayText('Некорректный форматы времени для пары: \"' + time + '\"');
                        mLoger.log(logObj);
                    }
                    resultData[KEY_TIME] = ms;
                    break;
                default:
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько параметров времени: XX:XX; '
            }

            return source;

        }

        function extractDate(source, resultData) {
            const REG_EXP_DATE = /([0-9]{1,2}\.[0-9]{2},?\s*)+/g;

            let dateList = getByRegExp(source, REG_EXP_DATE);

            switch (dateList.length) {
                case 0:
                    // дата не указана
                    break;
                case 1:
                    source = source.replace(dateList, '');
                    const clearDates = [];
                    dateList[0].split(/,\s*/g).forEach(function (date) {
                        date = date.trim();
                        const newDate = utils.getDateFromFormat('d.MM', date);
                        const ms = newDate.getTime();
                        if (ms === 0) {
                            const logObj = new loger.LogObject();
                            logObj.setCode(3111);
                            logObj.toShow = toShow;
                            logObj.setPayload(originData);
                            logObj.setMessage('Некорректный форматы даты для пары: \"' + date + '\"');
                            logObj.setDisplayText('Некорректный форматы даты для пары: \"' + date + '\"');
                            mLoger.log(logObj);
                        }
                        clearDates.push(ms);
                    });
                    resultData[KEY_DATES] = clearDates;
                    break;
                default:
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько параметров даты предмета: XX.XX; '
            }

            return source;
        }

        function extractRoom(source, resultData) {
            const REG_EXP_ROOM = /([0-9]){1,3}[А-ЖACE|Н|\s*]/gi;

            // для более точной обработки в конце строки должен быть пробел
            let roomList = getByRegExp(source + ' ', REG_EXP_ROOM);

            const roomsNumber = roomList.length;
            if (roomsNumber === 0) {
                // Аудитория не найдена
            } else {
                let room = roomList[roomsNumber - 1].trim();

                source = source.replace(room, '');
                room = room.replace(/\s*/g, ''); // удаляем пробелы
                resultData[KEY_ROOM] = room;

                if (roomsNumber > 1) {
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько возможных аудиторий для предмета; '
                }
            }

            return source;
        }

        function extractLessonType(source, resultData) {
            const REG_EXP_LESSON_TYPE = /\(\s*(л|пр|лаб)\s*\)/gi;

            let lessonTypeList = getByRegExp(source, REG_EXP_LESSON_TYPE);

            switch (lessonTypeList.length) {
                case 0:
                    // не найден
                    break;
                case 1:
                    let lessonType = lessonTypeList[0];
                    source = source.replace(lessonType, '');
                    lessonType = lessonType.replace(/\(|\)/g, ''); // удаление скобок
                    resultData[KEY_LESSON_TYPE] = lessonType.trim();
                    break;
                default:
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько параметров типа предмета: (л),(пр),(лаб); '
            }

            return source;

        }

        function extractLesson(source, resultData) {
            const REG_EXP_LESSON = /(([А-яЁё\w:.?!,"&\\](-|\s+)?)+){2,}/g;

            let lessonList = getByRegExp(source, REG_EXP_LESSON);

            switch (lessonList.length) {
                case 0:
                    // Пердмет не найден
                    const logObj = new loger.LogObject();
                    logObj.setPayload(originData);
                    logObj.toShow = toShow;
                    logObj.setMessage('Не удалось найти название предмета');
                    logObj.setDisplayText('Не удалось найти название предмета');
                    logObj.setCode(3201);
                    mLoger.log(logObj);
                    break;
                case 1:
                    let lesson = lessonList[0];

                    checkForTeacherName(lesson);
                    checkNumbers(lesson);

                    source = source.replace(lesson, '');

                    resultData[KEY_LESSON] = lesson.trim();
                    break;
                default:
                    // Слишком много найдено
                    tooManyLogString = tooManyLogString + 'Найдено несколько наименований предмета; '
            }

            return source;

            function checkForTeacherName(lesson) {
                const REG_EXP_CHECK_TEACHER = /[A-ZА-ЯЁ]\s*\./g; // Инициалы препода: И.О.
                if (REG_EXP_CHECK_TEACHER.test(lesson)) {
                    // если в название предмета попали инициалы (или что-то похожее)
                    const logObj = new loger.LogObject();
                    logObj.setPayload(originData);
                    logObj.toShow = toShow;
                    logObj.setMessage('Найдены подозрительные на иницалы символы в названии предмета: ' + lesson);
                    logObj.setDisplayText('Проверьте правильность оформления имени преподавателя');
                    logObj.setCode(2104);
                    mLoger.log(logObj);
                }
            }

            function checkNumbers(lesson) {
                const REG_EXT_WORDS_AROUND_NUMBER =
                    /([А-яЁёA-z][0-9])|([0-9][А-яЁёA-z])/g; // буквы рдом с цифрами: я9 1с
                if (REG_EXT_WORDS_AROUND_NUMBER.test(lesson)) {
                    // найдены цифры, рядом с которыми стоят буквы (без пробела)
                    const logObj = new loger.LogObject();
                    logObj.setPayload(originData);
                    logObj.toShow = toShow;
                    logObj.setMessage('В названии предмета найдены цифры с вплотную прилегающими к ним буквами: \'' +
                        lesson + '\'');
                    logObj.setDisplayText('Название предмета не может содержать числа ' +
                        'с вплотную прилегающими к ним буквами');
                    logObj.setCode(2105);
                    mLoger.log(logObj);
                }
            }

        }

        function checkResidue(source) {
            const REG_EXP_RESIDUE = /[А-яЁё\w]+/g;

            let restList = getByRegExp(source, REG_EXP_RESIDUE); // проверка остатка в строке

            if (restList.length > 0) {
                let dText = '';
                if (tooManyLogString === '') {
                    dText = 'Проверьте правильность оформления данных в ячейке'
                } else {
                    dText = 'Проверьте: ' + tooManyLogString;
                }
                const logObj = new loger.LogObject();
                logObj.setPayload(originData);
                logObj.setMessage(dText);
                logObj.toShow = toShow;
                logObj.setDisplayText(dText);
                logObj.setCode(3100);
                mLoger.log(logObj);
                if (DEBUG_LOGS) console.log('\n ' + pref.FG_COLOR_ORAGE + dText + pref.COLORS_DEFAULT)
            }
        }

        return resultData;
    }

    function getByRegExp(source, exp) {
        const res = source.match(exp);
        if (res === null) {
            return [];
        } else {
            return res;
        }
    }

};

exports.parseTimeCellContent = function (mLoger, content, toShow) {
    const DEBUG_LOGS = false;

    const originData = content;
    self.extractComments(content, {});

    const resultTime = {
        startTime: -1,
        endTime: -1
    };

    const REG_EXP_NON_TIME = /[^0-9\s:]\s*-?\s*[^0-9\s:]/gi;
    if (REG_EXP_NON_TIME.test(content)) {
        // ошибка в данных ячейки времени: содержит данные кроме времени
        const logObj = new loger.LogObject();
        logObj.setCode(3201);
        logObj.toShow = toShow;
        logObj.setPayload(originData);
        logObj.setMessage('Ячейка со временем расписания содержит недопустимые символы: \"' + content + '\"');
        logObj.setDisplayText('Ячейка со временем расписания содержит недопустимые символы');
        mLoger.log(logObj);
    } else {
        const REG_EXP_TIME_CELL = /[0-9]{1,2}\s*:\s*[0-9]{2}/gi;
        const timeList = getByRegExp(content, REG_EXP_TIME_CELL);
        if (timeList.length === 2) {
            const startTimeStr = timeList[0].replace(/\s*/g, '');
            const endTimeStr = timeList[1].replace(/\s*/g, '');

            resultTime.startTime = toMs(startTimeStr);
            if (DEBUG_LOGS) console.log('START TIME: %s = %d', startTimeStr, resultTime.startTime);

            resultTime.endTime = toMs(endTimeStr);
            if (DEBUG_LOGS) console.log('END TIME: %s = %d\n', endTimeStr, resultTime.startTime);

            function toMs(stringTime) {
                const time = utils.getDateFromFormat('H:mm', stringTime);
                const ms = time.getTime();
                if (ms === 0) {
                    // ошибка конвертации: неверный формат
                    const logObj = new loger.LogObject();
                    logObj.setCode(3203);
                    logObj.toShow = toShow;
                    logObj.setPayload(time);
                    logObj.setMessage('Не удалось пропарсить время по формату H:mm  : \"' + time + '\"');
                    logObj.setDisplayText('Не удалось прочитать время по формату ЧЧ:ММ (Ч:ММ)');
                    mLoger.log(logObj);
                }
                return ms;
            }

        } else {
            // много/мало времени найдено
            const logObj = new loger.LogObject();
            logObj.setCode(3202);
            logObj.toShow = toShow;
            logObj.setPayload(originData);
            logObj.setMessage('В ячейке со временем расписания было найдено ' + timeList.length +
                ' времён(время): \"' + content + '\"');
            logObj.setDisplayText('В ячейке со временем расписания было найдено ' + timeList.length +
                ' времён(время)');
            mLoger.log(logObj);
        }
    }

    return resultTime;
};

exports.extractComments = function (source, resultData) {
    const REG_EXP_COMMENT = /\/.*\//g;
    let commentList = getByRegExp(source, REG_EXP_COMMENT);
    if (commentList.length > 0) {
        const clearComments = [];
        commentList.forEach(function (comment) {
            source = source.replace(comment, '');
            comment = comment.replace(/\//g, '');
            comment = comment.trim();
            clearComments.push(comment)
        });
        resultData[KEY_COMMENTS] = clearComments;

    }
    return source;
};

exports.clearHTML = function (htmlString) {
    htmlString = htmlString.replace(/<\s*((br)|(p))\s*[\/]?>/gi, ' '); // замен <p> и <br> на пробел
    htmlString = htmlString.replace(/<[^>]*>/g, ''); // очиствка от каких-либо html тегов

    return htmlString.trim();
};


function getByRegExp(source, exp) {
    const res = source.match(exp);
    if (res === null) {
        return [];
    } else {
        return res;
    }
}

//debug();

function debug() {
    const contentList = readLessons();
    const mLoger = {
        log: function (logObj) {
            console.log(logObj.getMessage());
            return this;
        }
    };
    contentList.forEach(contentListFE);

    function contentListFE(content, i) {
        if (content.trim() !== '') {
            if (DEBUG_LOGS) console.log('======= ROW: %d', i + 1);
            const result = self.parseCellContent(mLoger, content, []);
            //console.log(result);
        }
    }

    function readLessons() {
        const fs = require('fs');
        const path = '/home/wiskiw/lessons.txt';

        let lessonsString = fs.readFileSync(path, 'utf8');
        const lessons = lessonsString.split("\n");

        if (arguments.length > 0) {
            return [lessons[arguments[0]]];
        } else {
            return lessons;
        }
    }
}
