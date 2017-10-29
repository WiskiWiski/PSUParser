exports.REG_EXPRESSION_FOR_DATE_CELL = /^[0-9.,\- \n]+$/;

exports.tableStyle = '<style type="text/css">TABLE { border-collapse: collapse; /* Убираем двойные линии между ячейками */} TD, TH {padding: 3px; /* Поля вокруг содержимого таблицы */border: 1px solid black; /* Параметры рамки */}</style>'


exports.clearForMultipleSpaces = function (str) {
    return str.replace(/  +/g, ' ');
};

exports.htmlToText = function (html) {
    if (typeof html !== "string") {
        html = html.html();
    }
    let text = html.replace(/<\s*((br)|(p))\s*[\/]?>/gi, '\n'); // замен <p> и <br> на перенос строки
    text = text.replace(/<[^>]*>/g, ''); // очиствка от каких-либо html тегов

    text = text.replace(/\s{1,2}(?=[^А-ЯA-Z\d\s])/gm, ''); // очистка от пробелов в слове
    text = text.replace(/\s{2,}/gm, ' '); // замена множественных пробелов на один пробел
    text = text.trim();
    //console.log('[%d]\'%s\'', 1, text);
    return text || html;
};

exports.getDayByIndex = function (dayIndex) {
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