/**
 * Created by WiskiW on 13.10.2017.
 */
const shared = require('./prs_shared.js');

const MAX_SUB_GROUPS_NUMB = 2; // Максимальное количество подгрупп в группе
const MIN_REQUIRED_ROWSPAN_VALUE = 4; // минимальное значение атрибута rowspan при котором строка чситается новым днем в расписании
const REG_EXPRESSION_FOR_DATE_CELL = /^[0-9., \n]+$/;


module.exports.tag = TAG = 'fit';

class DayRow {
    constructor(rowIndex, text) {
        this.rowIndex = rowIndex;
        this.text = text;
    }
}

function parseGroupsRow(scheduleTable) {
    // получает список групп для расписания
    // возвращает массив

    let groupsRow = scheduleTable.children('tr').first();
    let group;
    const groups = [];
    groupsRow.children('td').each(function (k, elem) {
        if (k > 1) { // не сохраняем столбец "Часы" и день недели
            k = k - 2;
            group = new shared.Group();
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
}

function getLessonsForRow(scheduleTable, rowN) {
    // rowN - строка для парсинга
    // возвращает структуру TimeRowSchedule

    const result = new shared.TimeRowSchedule;

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
                const isDateCol = cellText.indexOf('\n') !== -1 && REG_EXPRESSION_FOR_DATE_CELL.test(cellText);
                if (processWhiteWeek) {
                    // для белой недели
                    if (celRowSpan > 2) {
                        colsToSkip++;
                        return;
                    } else if (isDateCol) {
                        result.time = cellText;
                        if (celRowSpan === 2) {
                            // если ячецка даты с rowspan = 2, то нужно обрабатывать зеленую неделю
                            result.hasGreen = true;
                        }
                        colsToSkip++;
                        return;
                    }
                } else {
                    // для зелёной недели
                    if (celRowSpan > 2) {
                        colsToSkip++;
                        return;
                    } else if (isDateCol) {
                        result.time = cellText;
                        colsToSkip++;
                        return;
                    }
                }
            }

            // приводим индекс текущего столбца к нулю (т к не считаем столбец часов и/или деня недели)
            k = k - colsToSkip;

            const cell = new shared.LessonCell();
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
                    const greenCell = new shared.LessonCell(cell);
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

    result.whiteCells = whiteCells;
    result.greenСells = greenCells;

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
}

function grabDaysIndexes(scheduleTable) {
    let indexes = [];
    scheduleTable.children('tr').each(function (index, elem) {
        const table = scheduleTable.children(elem);
        const rowspanAttr = parseInt(table.children().attr('rowspan'));
        if (rowspanAttr >= MIN_REQUIRED_ROWSPAN_VALUE) {
            const dayText = table.children().first().text();
            const day = new DayRow(index, dayText);
            indexes.push(day);
            //console.log('Attr: %s on %d row: %s', rowspanAttr, indexes[indexes.length - 1].rowIndex, dayText);
        }
    });
    return indexes;
}

function grabLessonsForDaysRowIndexes(scheduleTable, daysIndexes) {
    let lessonIndex = [];
    const dayLessonsRowIndexes = []; // двумерный массив, хранящий индексы строк с расписанием для каждого дня недели
    let currentDayIndex = 0; // индекс элемента из массива daysIndexes
    let skipNextRow = false; // для пропуска, следеющих за зелеными строками, строк
    scheduleTable.children('tr').each(function (index, elem) {
        if (index < daysIndexes[0].rowIndex) {
            // пропускаем индексы до первого дня (т е строку с группами)
            return;
        }


        if (currentDayIndex + 1 < daysIndexes.length && index === daysIndexes[currentDayIndex + 1].rowIndex) {
            // если индекс переходит на новый день,
            // создаем новый массив для запесе индексов строк для этого дня
            currentDayIndex++;
            //console.log('Save %s and push %d lessons', daysIndexes[currentDayIndex-1].text, lessonIndex.length);
            dayLessonsRowIndexes.push(lessonIndex);
            lessonIndex = [];
        }

        const table = scheduleTable.children(elem);

        // определяет какой столбец проверять на rowspan (0 для строки без дня недели, 1 - там где есть день недели)
        const colToCheck = index === daysIndexes[currentDayIndex].rowIndex ? 1 : 0;

        if (skipNextRow) {
            skipNextRow = false;
        } else {
            // сохраняем индекс строки
            lessonIndex.push(index);
            //console.log('[%d] reg: %d', index, index);
        }

        let rowSpan = table.children('td').eq(colToCheck).attr('rowspan');
        if (rowSpan > 1) {
            // текущая неделя белая, а следеющая зеленая - пропускаем её
            skipNextRow = true;
        }
    });
    dayLessonsRowIndexes.push(lessonIndex);
    return dayLessonsRowIndexes;
}

function allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan) {
    const requiredPresent = (100 / MAX_SUB_GROUPS_NUMB);
    const groupColSpan = eGroupColSpan - sGroupColSpan;
    const lessonOverborders = (sLessonColSpan > sGroupColSpan ? eGroupColSpan - sLessonColSpan : eLessonColSpan - sGroupColSpan);

    // console.log('OVB : %d / %d', (lessonOverborders * 100 / groupColSpan), requiredPresent);
    return lessonOverborders * 100 / groupColSpan >= requiredPresent;
}

function connectLessonsGroups(groups, timeRow) {
    for (let y = 0; y < 1 || (timeRow.hasGreen !== undefined && timeRow.hasGreen && y < 2); y++) {
        let lessonTaken = 0; // Количество взятых уроков
        let previewLessonsSum = 0; // Сумма взятых уроков
        let previewGroupSum = 0; // Суммы взятых групп


        let lessonsRow;
        if (y === 0) {
            lessonsRow = timeRow.whiteCells;
        } else {
            console.log("----------------------------");
            lessonsRow = timeRow.greenСells;
        }

        groups.forEach(function (group, i, groupList) {
                let subGroupsNumb = 0; // Количество подсчитанных подгупп
                let leftGroupSpan = group.colSpan; // оставшееся место в данной группе

                for (let k = lessonTaken; k < lessonsRow.length; k++) {

                    if (subGroupsNumb >= MAX_SUB_GROUPS_NUMB || leftGroupSpan <= 0) {
                        previewGroupSum += group.colSpan;
                        break;
                    }

                    if (lessonsRow[k] === undefined) {
                        continue;
                    }

                    const lessonColSpan = lessonsRow[k].colSpan; // размер урока

                    const sGroupColSpan = previewGroupSum; // значение начала группы
                    const eGroupColSpan = previewGroupSum + group.colSpan; // значение конца группы
                    const sLessonColSpan = previewLessonsSum; // значение начала урока
                    const eLessonColSpan = previewLessonsSum + lessonColSpan; // значение конца урока
                    //console.log('\nGroup:[%d - %d] Less:[%d - %d]', sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan);


                    if (sGroupColSpan === sLessonColSpan || eGroupColSpan === eLessonColSpan) {
                        if (sGroupColSpan === sLessonColSpan && eGroupColSpan === eLessonColSpan) {
                            // г
                            lessonTaken++;
                            previewLessonsSum += lessonColSpan;
                            previewGroupSum += group.colSpan;
                            console.log('[г]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                            break;
                        } else if (sGroupColSpan === sLessonColSpan) {
                            if (eGroupColSpan > eLessonColSpan) {
                                // д
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                subGroupsNumb++;
                                leftGroupSpan = leftGroupSpan - lessonColSpan;
                                console.log('[д]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                            } else {
                                // б1
                                previewGroupSum += group.colSpan;
                                console.log('[б1]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                                break;
                            }
                        } else if (eGroupColSpan === eLessonColSpan) {
                            if (sGroupColSpan < sLessonColSpan) {
                                // е
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                console.log('[e]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                                break;
                            } else {
                                // а1
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                console.log('[a1]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                                break;
                            }
                        }
                    } else {
                        if (sGroupColSpan > sLessonColSpan && eGroupColSpan < eLessonColSpan) {
                            //в1
                            previewGroupSum += group.colSpan;
                            console.log('[в1]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                            break;
                        } else {
                            if (sGroupColSpan < sLessonColSpan && eLessonColSpan < eGroupColSpan) {
                                // в
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan -= lessonColSpan;
                                console.log('[в]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                            } else if (eGroupColSpan > eLessonColSpan) {
                                // а
                                if (allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    console.log('[a]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                                }
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan = leftGroupSpan - (eLessonColSpan - sGroupColSpan);
                            } else {
                                // б
                                if (allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    console.log('[б]:' + (y === 0 ? 'w' : 'g') + ' : ' + group.name + " - " + lessonsRow[k].text);
                                }
                                previewGroupSum += group.colSpan;
                                break;
                            }
                        }
                    }
                }
            }
        );
    }
}

module.exports.parse = function parse(course, scheduleTable) {
    const groups = parseGroupsRow(scheduleTable); // массив с группами и их весами

    const dayRowIndexes = grabDaysIndexes(scheduleTable); // массив объектов, хранящий индекст строк с днями недели

    // двумерный массив, хранящий индексы строк строк с расписанием для каждого дня недели
    const dayLessonsRowIndexes = grabLessonsForDaysRowIndexes(scheduleTable, dayRowIndexes);


    for (let daysIndex = 0; daysIndex < dayLessonsRowIndexes.length; daysIndex++) {
        console.log('\n DAY: %s', dayRowIndexes[daysIndex].text);
        const lessonsIndexes = dayLessonsRowIndexes[daysIndex];
        for (let lessonsIndex = 0; lessonsIndex < lessonsIndexes.length; lessonsIndex++) {
            const rowIndex = lessonsIndexes[lessonsIndex];

            console.log("\n=================== ROW: %d ===================", rowIndex);
            const timeRow = getLessonsForRow(scheduleTable, rowIndex);
            console.log('TIME : %s\n', timeRow.time.replace('\n', ''));
            connectLessonsGroups(groups, timeRow);
        }
    }
};
