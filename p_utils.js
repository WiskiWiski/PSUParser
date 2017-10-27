exports.REG_EXPRESSION_FOR_DATE_CELL = /^[0-9., \n]+$/;

exports.tableStyle = '<style type="text/css">TABLE { border-collapse: collapse; /* Убираем двойные линии между ячейками */} TD, TH {padding: 3px; /* Поля вокруг содержимого таблицы */border: 1px solid black; /* Параметры рамки */}</style>'


exports.clearForMultipleSpaces = function (str) {
    return str.replace(/  +/g, ' ');
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