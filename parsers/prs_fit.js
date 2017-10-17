/**
 * Created by WiskiW on 13.10.2017.
 */
const shared = require('./prs_shared.js');
const database = require('../database.js');

const GREEN_WEEK_TITLE = 'green';
const WHITE_WEEK_TITLE = 'white';
const MAX_SUB_GROUPS_NUMB = 2; // Максимальное количество подгрупп в группе
const MIN_REQUIRED_ROWSPAN_VALUE = 4; // минимальное значение атрибута rowspan при котором строка чситается новым днем в расписании
const REG_EXPRESSION_FOR_DATE_CELL = /^[0-9., \n]+$/;


module.exports.tag = FAC_TAG = 'fit';

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
    let emptyRow = false;

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
                let cellText = timeRow.children(elem).text().trim();

                // проверка значения ячейки на содержание \n и (1-9 или . или , или пробела)
                const isDateCol = cellText.indexOf('\n') !== -1 && REG_EXPRESSION_FOR_DATE_CELL.test(cellText);
                if (processWhiteWeek) {
                    // для белой недели
                    if (celRowSpan > 2) {
                        colsToSkip++;
                        return;
                    } else if (isDateCol) {
                        result.time = shared.clearForMultipleSpaces(cellText.replace('\n', ' '));
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
                        result.time = shared.clearForMultipleSpaces(cellText.replace('\n', ' '));
                        colsToSkip++;
                        return;
                    }
                }
            } else if (processWhiteWeek && k === 3 && colsToSkip === 0) {
                // Если в первых трех ячейка нет времени и это строка с "белым" расписанием,
                // то вся строка пустая (пропускаем)
                emptyRow = true; // для выхода из цикла обработки белого/зелёного расписания
                return;
            }

            // приводим индекс текущего столбца к нулю (т к не считаем столбец часов и/или деня недели)
            k = k - colsToSkip;

            const cell = new shared.LessonCell();
            cell.element = timeRow.children(elem);
            cell.text = shared.clearForMultipleSpaces(cell.element.text()).trim().replace('\n', ' ');

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
                // Т. к. количество ячеек для белой и зелёной строк может отлиаться,
                // необходимо учитывать эту разницу

                let firstUndefinedIndex; // позиция первого undefined в greenCells массиве

                // lastUndefinedIndex - хранит позицию последнего undefined
                // в greenCells массиве от позикии первого - firstUndefinedIndex
                // при этом сумма всех colSpan'ов ячеек в промежутке [firstUndefinedIndex..firstUndefinedIndex] меньше или равна
                // colSpan ячейки, которую собираемся добавить в зелёную неделю
                let lastUndefinedIndex;

                // поиско позиции первого undefined
                for (firstUndefinedIndex = 0; greenCells[firstUndefinedIndex] !== undefined; firstUndefinedIndex++) ;

                // подсчёт lastUndefinedIndex
                let whiteCellsSum = 0;
                for (lastUndefinedIndex = firstUndefinedIndex; lastUndefinedIndex < whiteCells.length; lastUndefinedIndex++) {
                    whiteCellsSum += whiteCells[lastUndefinedIndex].colSpan;
                    if (whiteCellsSum >= cell.colSpan) {
                        break;
                    }
                }

                // Добавлении новой ячеёки в lastUndefinedIndex
                // провежуток [firstUndefinedIndex..lastUndefinedIndex-1] заполняется null-ячейками,
                // которые будут удалены при возврате результата
                for (let r = firstUndefinedIndex; r <= lastUndefinedIndex; r++) {
                    if (r === lastUndefinedIndex) {
                        greenCells[r] = cell;
                        //console.log('whrite cell at green c=%d', r);
                    } else {
                        greenCells[r] = null;
                        //console.log('whrite null at green c=%d', r);
                    }
                }
            }
        });

        if (emptyRow) {
            // если эта строка была определенна как пустая
            return;
        }

        if (processWhiteWeek) {
            timeRow = scheduleTable.children('tr').eq(rowN + 1);
        }
    }

    // переписываем ячейки из временного greenCells массива в результат без null-ячеек
    for (let cellId = 0; cellId < greenCells.length; cellId++) {
        let gCell = greenCells[cellId];
        if (gCell !== null) {
            result.greenCells.push(gCell);
        }
    }

    result.whiteCells = whiteCells;

    /*
    whiteCells.forEach(function (cell, i, arr) {
      console.log('w[i:%d][col:%d]: ', i, cell.colSpan, cell.text);

    });
    console.log('---------------');
    result.greenCells.forEach(function (cell, i, arr) {
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

function parseTime(lessonTimeStr) {
    const result = {start_time: '', end_time: ''};
    const clnLessonTime = shared.clearForMultipleSpaces(lessonTimeStr);
    const nIndex = clnLessonTime.indexOf('\n');
    result.start_time = clnLessonTime.substring(0, nIndex).trim();
    result.end_time = clnLessonTime.substring(nIndex, clnLessonTime.length).trim();
    return result;
}


function saveToFinalJson(groupData, dayOfWeek, lessonTime, m, weekColor, groupName, cell) {
    const times = parseTime(lessonTime);

    const lesson = cell.text;
    if (lesson === null || lesson === undefined || lesson.trim() === '') {
        groupData.push(null);
    } else {
        groupData.push({
            start_time: times.start_time,
            end_time: times.end_time,
            cell_html: cell.element.html(),
            lesson: cell.text
        });
    }

    console.log('[%s][%s]: %s - %s', weekColor, m, groupName, cell.text);
    return groupData;
}

function subtractSubGroups(groupData) {
    const res = [];
    switch (groupData.length) {
        case 0:
            res[0] = null;
            res[1] = null;
            break;
        case 1:
            res[0] = groupData[0];
            res[1] = groupData[0];
            break;
        case 2:
            res[0] = groupData[0];
            res[1] = groupData[1];
            break;
    }
    return res;

}

function connectLessonsGroups(groups, timeRow, json, dayOfWeek) {
    for (let y = 0; y < 1 || (timeRow.hasGreen !== undefined && timeRow.hasGreen && y < 2); y++) {
        let lessonTaken = 0; // Количество взятых уроков
        let previewLessonsSum = 0; // Сумма взятых уроков
        let previewGroupSum = 0; // Суммы взятых групп

        const lessonTime = timeRow.time;
        let lessonsRow;
        let weekColor;
        if (y === 0) {
            lessonsRow = timeRow.whiteCells;
            weekColor = WHITE_WEEK_TITLE
        } else {
            console.log("----------------------------");
            weekColor = GREEN_WEEK_TITLE;
            lessonsRow = timeRow.greenCells;
        }
        groups.forEach(function (group, i, groupList) {
                let subGroupsNumb = 0; // Количество подсчитанных подгупп
                let leftGroupSpan = group.colSpan; // оставшееся место в данной группе

                let groupData = [];


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
                            groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'г', weekColor, group.name, lessonsRow[k]);
                            break;
                        } else if (sGroupColSpan === sLessonColSpan) {
                            if (eGroupColSpan > eLessonColSpan) {
                                // д
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                subGroupsNumb++;
                                leftGroupSpan = leftGroupSpan - lessonColSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'д', weekColor, group.name, lessonsRow[k]);
                            } else {
                                // б1
                                previewGroupSum += group.colSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'б1', weekColor, group.name, lessonsRow[k]);
                                break;
                            }
                        } else if (eGroupColSpan === eLessonColSpan) {
                            if (sGroupColSpan < sLessonColSpan) {
                                // е
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'е', weekColor, group.name, lessonsRow[k]);
                                break;
                            } else {
                                // а1
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'а1', weekColor, group.name, lessonsRow[k]);
                                break;
                            }
                        }
                    } else {
                        if (sGroupColSpan > sLessonColSpan && eGroupColSpan < eLessonColSpan) {
                            //в1
                            previewGroupSum += group.colSpan;
                            groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'в1', weekColor, group.name, lessonsRow[k]);
                            break;
                        } else {
                            if (sGroupColSpan < sLessonColSpan && eLessonColSpan < eGroupColSpan) {
                                // в
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan -= lessonColSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'в', weekColor, group.name, lessonsRow[k]);
                            } else if (eGroupColSpan > eLessonColSpan) {
                                // а
                                if (allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'а', weekColor, group.name, lessonsRow[k]);
                                }
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan = leftGroupSpan - (eLessonColSpan - sGroupColSpan);
                            } else {
                                // б
                                if (allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'б', weekColor, group.name, lessonsRow[k]);
                                }
                                previewGroupSum += group.colSpan;
                                break;
                            }
                        }
                    }
                }

                const subgroups = subtractSubGroups(groupData);
                let subGroupA = subgroups[0];
                let subGroupB = subgroups[1];

                json[weekColor][group.name][1][dayOfWeek].push(subGroupA);
                json[weekColor][group.name][2][dayOfWeek].push(subGroupB);

                // Если зелёной строки нет, то заполняем ей белой
                if (!timeRow.hasGreen) {
                    json[GREEN_WEEK_TITLE][group.name][1][dayOfWeek].push(subGroupA);
                    json[GREEN_WEEK_TITLE][group.name][2][dayOfWeek].push(subGroupB);
                }
            }
        );
    }
    return json;
}

module.exports.parse = function parse(course, scheduleTable) {
    const groups = parseGroupsRow(scheduleTable); // массив с группами и их весами

    let finalJson = {};
    finalJson[GREEN_WEEK_TITLE] = {};
    finalJson[WHITE_WEEK_TITLE] = {};
    groups.forEach(function (group) {
        finalJson.green[group.name] = {
            1: [],
            2: []
        };
        finalJson.white[group.name] = {
            1: [],
            2: []
        };
    });

    const dayRowIndexes = grabDaysIndexes(scheduleTable); // массив объектов, хранящий индекст строк с днями недели

    // двумерный массив, хранящий индексы строк строк с расписанием для каждого дня недели
    const dayLessonsRowIndexes = grabLessonsForDaysRowIndexes(scheduleTable, dayRowIndexes);


    for (let daysIndex = 0; daysIndex < dayLessonsRowIndexes.length; daysIndex++) {
        //Цикл недели
        console.log('\n\x1b[42m        DAY: %s        \x1b[0m', dayRowIndexes[daysIndex].text);

        for (const groupName in finalJson.white) {
            //заполняем дни для зелёной недели
            finalJson.green[groupName][1][dayRowIndexes[daysIndex].text] = [];
            finalJson.green[groupName][2][dayRowIndexes[daysIndex].text] = [];

            //компенсируем индекс первой пары для зелёной недели
            finalJson.green[groupName][2][dayRowIndexes[daysIndex].text].push([]);
            finalJson.green[groupName][1][dayRowIndexes[daysIndex].text].push([]);


            //заполняем дни для белой недели
            finalJson.white[groupName][1][dayRowIndexes[daysIndex].text] = [];
            finalJson.white[groupName][2][dayRowIndexes[daysIndex].text] = [];

            //компенсируем индекс первой пары для белой недели
            finalJson.white[groupName][1][dayRowIndexes[daysIndex].text].push([]);
            finalJson.white[groupName][2][dayRowIndexes[daysIndex].text].push([]);
        }


        const lessonsIndexes = dayLessonsRowIndexes[daysIndex];


        for (let lessonsIndex = 0; lessonsIndex < lessonsIndexes.length; lessonsIndex++) {
            // цикл дня
            const rowIndex = lessonsIndexes[lessonsIndex];

            const timeRow = getLessonsForRow(scheduleTable, rowIndex);
            if (timeRow !== undefined) {
                console.log("\x1b[32m===========ROW: %d === TIME: %s ===========\x1b[0m", rowIndex, timeRow.time);
                finalJson = connectLessonsGroups(groups, timeRow, finalJson, dayRowIndexes[daysIndex].text);
            } else {
                // строка с индексом rowIndex - пустая
            }
            console.log();
        }
    }
    database.save(FAC_TAG, course, finalJson);
};


// color console - https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color