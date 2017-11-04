exports.REG_EXPRESSION_FOR_DATE_CELL = /^[0-9.,\- \n]+$/;

exports.tableStyle = '<style type="text/css">TABLE { border-collapse: collapse; /* Убираем двойные линии между ячейками */} TD, TH {padding: 3px; /* Поля вокруг содержимого таблицы */border: 1px solid black; /* Параметры рамки */}</style>'


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