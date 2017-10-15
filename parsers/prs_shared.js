/**
 * Created by WiskiW on 13.10.2017.
 */
const cheerio = require('cheerio');


class LessonCell {
    constructor(cell) {
        if (arguments.length > 0) {
            this.colSpan = cell.colSpan;
            this.element = cell.element;
            this.text = cell.text;
        } else {
            this.colSpan = 1;
            this.element = null;
            this.text = null;
        }
    }
}
class Group {
    constructor() {
        this.colSpan = 1;
        this.name = null;
    }
}

class TimeRowSchedule {
    constructor() {
        this.hasGreen = false;
        this.white_cells = [];
        this.green_cells = [];
        this.time = null;
    }
}

module.exports.getGroups = function parseGroupsRow(scheduleTable) {
    // получает список групп для расписания
    // возвращает массив

    let groupsRow = scheduleTable.children('tr').first();
    let group;
    const groups = [];
    groupsRow.children('td').each(function (k, elem) {
        if (k > 1) { // не сохраняем столбец "Часы" и день недели
            k = k - 2;
            group = new Group();
            group.name = groupsRow.children(elem).text().trim();

            group.colSpan = parseInt(groupsRow.children(elem).attr("colspan"));
            if (isNaN(group.colSpan)) {
                group.colSpan = 1;
            }
            groups[k] = group;

            //console.log("k:" + k + " - " + groups[k]);
        }
    });
    return groups;
};

module.exports.getScheduleForRow = function parseScheduleRow(scheduleTable, rowN) {
    // rowN - строка для парсинга
    // возвращает структуру TimeRowSchedule

    const result = TimeRowSchedule;

    let timeColumnN = 0; // номер колонки со временем [0...]
    let timeRow = scheduleTable.children('tr').eq(rowN);

    let colSpan;
    // расчёт позиции ячейки времени и проверка на наличее зелёной недели в строке
    let rowSpan = parseInt(timeRow.children().first().attr('rowspan'));
    if (!isNaN(rowSpan)) {
        if (rowSpan > 2) {
            // первая ячейка день недели
            timeColumnN = 1;
            rowSpan = parseInt(timeRow.children().eq(timeColumnN).attr('rowspan'));
            if (!isNaN(rowSpan) && rowSpan > 1) {
                // первая ячейка - время бело-зелёного дня
                result.hasGreen = true;
            }
        } else if (rowSpan > 1) {
            // первая ячейка - время бело-зелёного дня
            result.hasGreen = true;
        }
    }


    // Цикл используется для обработки второй строки(для зелёных пар)

    const whiteCells = [];
    const greenCells = [];

    for (let i = 0; i < 1 || (result.hasGreen && i < 2); i++) {
        let processWhiteWeek = true;
        if (i !== 0) {
            timeColumnN = timeColumnN - 1;

            // green week
            processWhiteWeek = false;
        }


        timeRow.children('td').each(function (k, elem) {
            if (k > timeColumnN) { // не сохраняем столбец "Часы" и/или день недели
                // приводим индекс текущего столбца к нулю (т к не считаем столбец часов и/или деня недели)
                k = k - timeColumnN - 1;

                const cell = new LessonCell();
                cell.element = timeRow.children(elem);
                cell.text = cell.element.text().trim().replace('\n', ' ');

                colSpan = parseInt(timeRow.children(elem).attr("colspan"));
                if (isNaN(colSpan)) {
                    colSpan = 1;
                }
                cell.colSpan = colSpan;

                if (processWhiteWeek) {
                    rowSpan = parseInt(timeRow.children(elem).attr("rowspan"));
                    if (!isNaN(rowSpan) && rowSpan > 1) {
                        const greenCell = new LessonCell(cell);
                        greenCells[k] = greenCell;
                        //console.log('add green cell k=%d, col=%d', k, greenCell.colSpan);
                    }

                    whiteCells[k] = cell;
                } else {
                    let c;
                    for (c = 0; greenCells[c] !== undefined; c++);
                    greenCells[c] = cell;
                }
            }
        });


        if (processWhiteWeek) {
            timeRow = scheduleTable.children('tr').eq(rowN + 1);
        }
    }

    result.white_cells = whiteCells;
    result.green_cells = greenCells;

    /*
    whiteCells.forEach(function (cell, i, arr) {
        console.log('w[i:%d][col:%d]: ', i, cell.colSpan, cell.text);

    });
    console.log('---------------');
    greenCells.forEach(function (cell, i, arr) {
        console.log('g[i:%d][col:%d]: ', i, cell.colSpan, cell.text);

    });
    */
    return result;
};