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

    const result = new TimeRowSchedule;

    let timeRow = scheduleTable.children('tr').eq(rowN);

    // Цикл используется для обработки второй строки(для зелёных пар)

    const whiteCells = [];
    const greenCells = [];


    for (let i = 0; i < 1 || (result.hasGreen && i < 2); i++) {
        let processWhiteWeek = true;
        let colsToSkip = 0; // кол-во колонок которые пропускаем

        if (i !== 0) {
            // green week
            //timeColumnN = timeColumnN - 1;
            processWhiteWeek = false;

        }


        timeRow.children('td').each(function (k, elem) {
            if (k < 3) {
                // k<3 т к день недели или время не может быть дальше второго столбца (+1 для запаса)

                // проверяем, не содержит ли текущий столбце день недели или время
                const celRowSpan = parseInt(timeRow.first(elem).children('td').eq(k).attr('rowspan'));
                const cellText = timeRow.children(elem).text().trim();

                // проверка значения ячейки на содержание \n и (1-9 или . или , или пробела)
                const isDateCol = cellText.indexOf('\n') !== -1 && /^[0-9., \n]+$/.test(cellText);
                if (processWhiteWeek) {
                    // для белой недели
                    if (celRowSpan > 2) {
                        colsToSkip++;
                        return;
                    } else if (isDateCol) {
                        if (celRowSpan === 2) {
                            // если ячецка даты с rowspan = 2, то нужно обрабатывать зеленую неделю
                            result.hasGreen = true;
                        }
                        colsToSkip++;
                        return;
                    }
                } else {
                    // для зелёной недели
                    if (celRowSpan > 2 || isDateCol) {
                        colsToSkip++;
                        console.log('skiping k=%d text=%s', k, cellText);
                        return;
                    }
                }
            }

            // приводим индекс текущего столбца к нулю (т к не считаем столбец часов и/или деня недели)
            k = k - colsToSkip;

            const cell = new LessonCell();
            cell.element = timeRow.children(elem);
            cell.text = cell.element.text().trim().replace('\n', ' ');

            let colSpan = parseInt(timeRow.children(elem).attr("colspan"));
            if (isNaN(colSpan)) {
                colSpan = 1;
            }
            cell.colSpan = colSpan;

            if (processWhiteWeek) {
                const rowSpan = parseInt(timeRow.children(elem).attr("rowspan"));
                if (!isNaN(rowSpan) && rowSpan > 1) {
                    const greenCell = new LessonCell(cell);
                    greenCells[k] = greenCell;
                    //console.log('add green cell k=%d, col=%d', k, greenCell.colSpan);
                }

                whiteCells[k] = cell;
            } else {
                let c;
                for (c = 0; greenCells[c] !== undefined; c++);
                //console.log('find free at green c=%d', c);
                greenCells[c] = cell;
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