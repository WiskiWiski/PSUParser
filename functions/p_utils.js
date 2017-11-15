const self = this;

exports.REG_EXPRESSION_FOR_DATE_CELL = /^[0-9.,\- \n]+$/;

exports.tableStyle = '<style type="text/css">TABLE { border-collapse: collapse; /* Убираем двойные линии между ячейками */} TD, TH {padding: 3px; /* Поля вокруг содержимого таблицы */border: 1px solid black; /* Параметры рамки */}</style>'
exports.MONTH_NAMES = ['Янв', 'Фев', 'Мрт', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


exports.clearForMultipleSpaces = function (str) {
    return str.replace(/  +/g, ' ');
};

exports.htmlToText = function (str) {
    const DEBUG_LOGS = false;
    //console.log('\n\n' + str);
    if (typeof str !== "string") {
        str = str.html();
    }
    if (str.trim() === '') {
        return '';
    }

    let text = removeTags(str);
    const wordArr = text.match(/[\wА-я]+/gm);
    if (wordArr !== null) {
        // определение кол-ва пробелов
        const spacesNumber = (str.match(/\s{1,2}/gm) || []).length;
        const wordsNumber = wordArr.length;

        let averageWordLength = 0;
        let upCaseWordsNumber = 0;
        let lowCaseWordsNumber = 0;
        for (let i = 0; i < wordsNumber; i++) {
            const word = wordArr[i];

            // подсчёт суммы длинн слов
            averageWordLength += word.length;

            // определение кол-ва слов, начинающихся с верхнего/нижнего регистра
            const firstChar = word.charAt(0);
            if (firstChar.toUpperCase() === firstChar) {
                // Upper case
                upCaseWordsNumber++;
            } else {
                // Lower case
                lowCaseWordsNumber++;
            }
        }
        averageWordLength = averageWordLength / wordsNumber; // средняя длина слова в строке

        let ulr = upCaseWordsNumber / (lowCaseWordsNumber === 0 ? 1 : lowCaseWordsNumber); // соотношение верхнего-нижнего регистра

        const swr = spacesNumber / wordsNumber; // space / words number
        if (DEBUG_LOGS) console.log('[]: %d/%d = %d; averLen= %d ulr =%d', spacesNumber, wordsNumber, swr, averageWordLength, ulr);

        if (swr > 5) {
            // если много пробелов
            text = str.replace(/\s{1,2}(?=[^А-ЯA-Z\d\s])/gm, ''); // очистка от пробелов в слове
        } else if (averageWordLength < 2) {
            // если слова очень короткие
            if (ulr > 6) {
                // если в предложении преимущественно слова с большой буквы
                // очистка от пробелов в слове
                text = str.replace(/\s{1,2}(?=[^\d\s])/gm, '');
            } else {
                // очистка от пробелов в слове только перед слов с маленькой буквы
                text = str.replace(/\s{1,2}(?=[^А-ЯA-Z\d\s])/gm, '');
            }
        }

        text = removeTags(text);
        text = text.replace(/\s{2,}/gm, ' '); // замена множественных пробелов на один пробел
        text = text.trim();
        if (DEBUG_LOGS) console.log('text: %s \n', text);

        return text || str;
    } else {
        return '';
    }
};

function removeTags(htmlString) {
    htmlString = htmlString.replace(/<\s*((br)|(p))\s*[\/]?>/gi, '\n'); // замен <p> и <br> на перенос строки
    return htmlString.replace(/<[^>]*>/g, ''); // очиствка от каких-либо html тегов
}

exports.getDayByIndex = function (dayIndex) {
    switch (dayIndex) {
        case 0:
            return 'Пн';
        case 1:
            return 'Вт';
        case 2:
            return 'Ср';
        case 3:
            return 'Чт';
        case 4:
            return 'Пт';
        case 5:
            return 'Сб';
        case 6:
            return 'Вс';
        default:
            return '<undefined day>'
    }
};


exports.getDateFromFormat = function (format, val) {

    /*
    Thanks for http://www.mattkruse.com/javascript/date/ !

    Field        | Full Form          | Short Form
    -------------|--------------------|-----------------------
    Year         | yyyy (4 digits)    | yy (2 digits), y (2 or 4 digits)
    Month        | MMM (name or abbr.)| MM (2 digits), M (1 or 2 digits)
                 | NNN (abbr.)        |
    Day of Month | dd (2 digits)      | d (1 or 2 digits)
    Day of Week  | EE (name)          | E (abbr)
    Hour (1-12)  | hh (2 digits)      | h (1 or 2 digits)
    Hour (0-23)  | HH (2 digits)      | H (1 or 2 digits)
    Hour (0-11)  | KK (2 digits)      | K (1 or 2 digits)
    Hour (1-24)  | kk (2 digits)      | k (1 or 2 digits)
    Minute       | mm (2 digits)      | m (1 or 2 digits)
    Second       | ss (2 digits)      | s (1 or 2 digits)
    AM/PM        | a                  |
     */


    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    val = val + "";
    format = format + "";
    var i_val = 0;
    var i_format = 0;
    var c = "";
    var token = "";
    var token2 = "";
    var x, y;
    var now = new Date();
    var year = now.getYear();
    var month = now.getMonth() + 1;
    var date = 1;
    var hh = now.getHours();
    var mm = now.getMinutes();
    var ss = now.getSeconds();
    var ampm = "";
    while (i_format < format.length) {
        c = format.charAt(i_format);
        token = "";
        while ((format.charAt(i_format) == c) && (i_format < format.length)) {
            token += format.charAt(i_format++);
        }
        if (token == "yyyy" || token == "yy" || token == "y") {
            if (token == "yyyy") {
                x = 4;
                y = 4;
            }
            if (token == "yy") {
                x = 2;
                y = 2;
            }
            if (token == "y") {
                x = 2;
                y = 4;
            }
            year = _getInt(val, i_val, x, y);
            if (year == null) {
                return errorResult();
            }
            i_val += year.length;
            if (year.length == 2) {
                if (year > 70) {
                    year = 1900 + (year - 0);
                } else {
                    year = 2000 + (year - 0);
                }
            }
        } else if (token == "MMM" || token == "NNN") {
            month = 0;
            for (var i = 0; i < self.MONTH_NAMES.length; i++) {
                var month_name = self.MONTH_NAMES[i];
                if (val.substring(i_val, i_val + month_name.length).toLowerCase() == month_name.toLowerCase()) {
                    if (token == "MMM" || (token == "NNN" && i > 11)) {
                        month = i + 1;
                        if (month > 12) {
                            month -= 12;
                        }
                        i_val += month_name.length;
                        break;
                    }
                }
            }
            if ((month < 1) || (month > 12)) {
                return errorResult();
            }
        } else if (token == "EE" || token == "E") {
            for (var i = 0; i < DAY_NAMES.length; i++) {
                var day_name = DAY_NAMES[i];
                if (val.substring(i_val, i_val + day_name.length).toLowerCase() == day_name.toLowerCase()) {
                    i_val += day_name.length;
                    break;
                }
            }
        } else if (token == "MM" || token == "M") {
            month = _getInt(val, i_val, token.length, 2);
            if (month == null || (month < 1) || (month > 12)) {
                return errorResult();
            }
            i_val += month.length;
        } else if (token == "dd" || token == "d") {
            date = _getInt(val, i_val, token.length, 2);
            if (date == null || (date < 1) || (date > 31)) {
                return errorResult();
            }
            i_val += date.length;
        } else if (token == "hh" || token == "h") {
            hh = _getInt(val, i_val, token.length, 2);
            if (hh == null || (hh < 1) || (hh > 12)) {
                return errorResult();
            }
            i_val += hh.length;
        } else if (token == "HH" || token == "H") {
            hh = _getInt(val, i_val, token.length, 2);
            if (hh == null || (hh < 0) || (hh > 23)) {
                return errorResult();
            }
            i_val += hh.length;
        } else if (token == "KK" || token == "K") {
            hh = _getInt(val, i_val, token.length, 2);
            if (hh == null || (hh < 0) || (hh > 11)) {
                return errorResult();
            }
            i_val += hh.length;
        } else if (token == "kk" || token == "k") {
            hh = _getInt(val, i_val, token.length, 2);
            if (hh == null || (hh < 1) || (hh > 24)) {
                return errorResult();
            }
            i_val += hh.length;
            hh--;
        } else if (token == "mm" || token == "m") {
            mm = _getInt(val, i_val, token.length, 2);
            if (mm == null || (mm < 0) || (mm > 59)) {
                return errorResult();
            }
            i_val += mm.length;
        } else if (token == "ss" || token == "s") {
            ss = _getInt(val, i_val, token.length, 2);
            if (ss == null || (ss < 0) || (ss > 59)) {
                return errorResult();
            }
            i_val += ss.length;
        } else if (token == "a") {
            if (val.substring(i_val, i_val + 2).toLowerCase() == "am") {
                ampm = "AM";
            } else if (val.substring(i_val, i_val + 2).toLowerCase() == "pm") {
                ampm = "PM";
            } else {
                return errorResult();
            }
            i_val += 2;
        } else {
            if (val.substring(i_val, i_val + token.length) != token) {
                return errorResult();
            } else {
                i_val += token.length;
            }
        }
    }
    if (i_val != val.length) {
        return errorResult();
    }
    if (month == 2) {
        if (((year % 4 == 0) && (year % 100 != 0) ) || (year % 400 == 0)) {
            if (date > 29) {
                return errorResult();
            }
        } else {
            if (date > 28) {
                return errorResult();
            }
        }
    }
    if ((month == 4) || (month == 6) || (month == 9) || (month == 11)) {
        if (date > 30) {
            return errorResult();
        }
    }
    if (hh < 12 && ampm == "PM") {
        hh = hh - 0 + 12;
    } else if (hh > 11 && ampm == "AM") {
        hh -= 12;
    }
    return new Date(year, month - 1, date, hh, mm, ss);

    function errorResult() {
        return new Date(0);
    }

    function _isInteger(val) {
        var digits = "1234567890";
        for (var i = 0; i < val.length; i++) {
            if (digits.indexOf(val.charAt(i)) == -1) {
                return false;
            }
        }
        return true;
    }

    function _getInt(str, i, minlength, maxlength) {
        for (var x = maxlength; x >= minlength; x--) {
            var token = str.substring(i, i + x);
            if (token.length < minlength) {
                return null;
            }
            if (_isInteger(token)) {
                return token;
            }
        }
        return null;
    }

};


function getDayByIndex(dayIndex) {
    switch (dayIndex) {
        case 0:
            return 'Mon';
        case 1:
            return 'Tue';
        case 2:
            return 'Wed';
        case 3:
            return 'Thu';
        case 4:
            return 'Fri';
        case 5:
            return 'Sat';
        case 6:
            return 'Sun';
        default:
            return 'Undefined day'
    }
};