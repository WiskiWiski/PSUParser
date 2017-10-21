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

const ROW_TYPE_NONE = 'none';
const ROW_TYPE_TIME_ROW = 'time_row';
const ROW_TYPE_GROUP_ROW = 'group_row';
const ROW_TYPE_EMPTY_ROW = 'empty_row';

module.exports.tag = FAC_TAG = 'fit';

class DayRow {
    constructor(rowIndex, text) {
        this.rowIndex = rowIndex;
        this.text = text;
    }
}

function getGroups(scheduleTable) {
    // получает список групп для расписания
    // возвращает массив с группами и их весами

    function detectGroupsRowIndex(scheduleTable) {
        // Возвращает индекст строки из таблици, в которой находятся группы

        const rowCount = scheduleTable.children('tr').length;
        for (let k = 0; k < 6 && k < rowCount; k++) {
            // Крайне маловероятно, что строка с группами будет ниже 6-ого ряда
            if (getRowInfo(scheduleTable, k).type === ROW_TYPE_GROUP_ROW) {
                return k
            }
        }
        return -1;
    }


    let groups = [];

    const groupsRowIndex = detectGroupsRowIndex(scheduleTable);
    if (groupsRowIndex !== -1) {
        const groupsSubRows = getSubRows(scheduleTable, groupsRowIndex);
        groups = groupsSubRows.bRow;
        groups.forEach(function (el) {
            console.log('groups [col=%d] : %s', el.colSpan, el.text);
        });
    } else {
        // TODO : Groups not found!
    }
    return groups;
}

function getRowInfo(scheduleTable, aRowIndex) {
    /*
        Поиск информации о строка подстроках в таблице расписания по индексу А-строки - aRowIndex
        Возвращает структуру типа result (см. ниже)
     */

    const SUBROW_A = 'a';
    const SUBROW_B = 'b';

    let result = {
        day: null,
        has_b_row: false,
        type: ROW_TYPE_NONE,
        time: null,
        row_a: {
            skip_colons_n: 0,
            errors: null

        },
        row_b: {
            skip_colons_n: 0,
            errors: null
        },
    };

    let hasGreen = false;
    let timeRow = scheduleTable.children('tr').eq(aRowIndex);

    let subRow;
    let row;

    for (let i = 0; i < 1 || (hasGreen && i < 2); i++) {
        timeRow = scheduleTable.children('tr').eq(aRowIndex + i);
        if (i === 0) {
            subRow = SUBROW_A;
            row = result.row_a;
        } else {
            subRow = SUBROW_B;
            row = result.row_b;

        }
        let skipColonsN = 0;


        let forEachIsFinished = false;
        timeRow.children('td').each(function (k, elem) {
            if (forEachIsFinished) {
                return;
            }


            // проверяем, не содержит ли текущий столбце день недели или время
            const celRowSpan = parseInt(timeRow.children(elem).first('td').attr('rowspan'));
            const cellText = shared.clearForMultipleSpaces(timeRow.children(elem).text().trim());

            const isClockCell = cellText.toLowerCase().indexOf('часы') !== -1;
            if (isClockCell) {
                // Если строка с группами

                forEachIsFinished = true;
                result.type = ROW_TYPE_GROUP_ROW;
                skipColonsN++;
                if (celRowSpan === 2) {
                    hasGreen = true;
                    result.has_b_row = true;
                }

            } else {
                // Если любая другая строка

                if (subRow === SUBROW_A) {
                    // Подстрока А
                    if (celRowSpan > 2) {
                        // ячека с днём недели
                        skipColonsN++;
                        result.day = cellText;
                        return;
                    }

                    // проверка значения ячейки на содержание \n и (1-9 или . или , или пробела)
                    const isTimeCol = cellText.indexOf('\n') !== -1 && REG_EXPRESSION_FOR_DATE_CELL.test(cellText);
                    if (isTimeCol) {
                        // ячейка со временем
                        result.type = ROW_TYPE_TIME_ROW;
                        skipColonsN++;
                        result.time = cellText.replace('\n', ' ');

                        if (celRowSpan === 2) {
                            hasGreen = true;
                            result.has_b_row = true;
                        }
                        // forEachIsFinished=true для переходя на следующую подстроку, т.к. после неё точно будет расписание
                        forEachIsFinished = true;
                        return;
                    }

                } else {
                    // Подстрока B

                }

                if (result.type === ROW_TYPE_NONE && cellText === '') {
                    // если еще не определили какого типа строка и ячейка пустая - прибовляем индекс для пропуска ячейки

                    skipColonsN++;
                }

            }
        });

        if (result.type === ROW_TYPE_NONE) {
            // если после обработки строка А, тип остался неизвестен - строка пустая
            result.type = ROW_TYPE_EMPTY_ROW;
            return result;
        }
        row.skip_colons_n = skipColonsN;
    }
    return result;
}

function buildCleanBRow(timeRowSch, rowA, rowB1, rowB2) {
    /*
        Метод сбора второстепенной строки расписани
        Принимает главную строку из расписания (rowA)
        и две второстепенные:
            rowB1 - образованная от ячеек из rowA с rowSpan=2
            rowB2 - образованная ячейками строки за rowA
        Построенную второстепенную строку записывает в объект SubRows - timeRowSch
     */

    const logEnable = false;

    function printResA(res) {
        console.log('===========ARR================');
        res.forEach(function (item) {
            console.log('Itm: [col=%d] \'%s\'', item.colSpan, item.text);
        });
    }

    function printResB(res) {
        console.log('===========ARR================');
        res.forEach(function (item) {
            console.log('Itm: [index=%d] [col=%d] \'%s\'', item.index, item.cell.colSpan, item.cell.text);
        });
    }

    if (logEnable) {
        console.log('rowA: ');
        printResA(rowA);
        console.log('\nrowB1: ');
        printResB(rowB1);
        console.log('\nrowB2: ');
        printResB(rowB2);
    }

    const cleanARowCount = rowA.length - rowB1.length;
    if (cleanARowCount === rowB2.length) {
        // Случай - simple
        if (logEnable) console.log('\nSIMPLE-Type\n');
        let takeFromB2Count = 0;
        let item;
        for (let index = 0; index < rowB1.length; index++) {
            item = rowB1[index];
            if (item.index === index + takeFromB2Count) {
                timeRowSch.bRow.push(item.cell);
            } else {
                takeFromB2Count++;
                index--;
                if (rowB2.length > 0) {
                    timeRowSch.bRow.push(rowB2.splice(0, 1)[0].cell);
                }
            }
        }
        if (rowB2.length > 0) {
            // записываем оставшиеся в rowB2 ячейки в пезультат
            timeRowSch.bRow = timeRowSch.bRow.concat(rowB2.map(item => item.cell))
        }


    } else if (cleanARowCount > rowB2.length) {
        // Случай - A
        if (logEnable) console.log('\nA-Type\n');

        let aItemIndex = 0;
        rowB2.forEach(function (item) {
            let aItemSum = 0;
            if (rowB1.length > 0 && aItemIndex === rowB1[0].index) {
                timeRowSch.bRow.push(rowB1.splice(0, 1)[0].cell);
                aItemIndex++;
            } else {
                while (aItemIndex < rowA.length) {
                    const aItem = rowA[aItemIndex];
                    aItemIndex++;
                    aItemSum += aItem.colSpan;
                    if (aItemSum >= item.cell.colSpan) {
                        break;
                    }
                }
            }
            timeRowSch.bRow.push(item.cell);

        });
    } else if (cleanARowCount < rowB2.length) {
        // Случай - B
        if (logEnable) console.log('\nB-Type\n');

        let b2ItemIndex = 0;
        rowA.forEach(function (item, index) {
            let b2ItemSum = 0;
            if (rowB1.length > 0 && index === rowB1[0].index) {
                rowB1.splice(0, 1);
                timeRowSch.bRow.push(item);
            } else {
                while (b2ItemIndex < rowB2.length) {
                    const b2Item = rowB2[b2ItemIndex];
                    b2ItemIndex++;
                    b2ItemSum += b2Item.colSpan;
                    timeRowSch.bRow.push(b2Item.cell);
                    if (b2ItemSum >= item.colSpan) {
                        break;
                    }
                }
            }

        });
    }

    if (logEnable) printResA(timeRowSch.bRow);
}

function getSubRows(scheduleTable, aRowIndex) {
    // rowN - строка для парсинга
    // возвращает объект SubRows

    const result = new shared.SubRows;
    let timeRow = scheduleTable.children('tr').eq(aRowIndex);

    const rowsInfo = getRowInfo(scheduleTable, aRowIndex);

    switch (rowsInfo.type) {
        case ROW_TYPE_NONE:
        case ROW_TYPE_EMPTY_ROW:
            // Пустая строка
            return;
            break;
        case ROW_TYPE_GROUP_ROW:
        case ROW_TYPE_TIME_ROW:
            result.time = rowsInfo.time;

            let rowA = [];
            let rowB1 = [];
            let rowB2 = [];
            let row;

            // Цикл для обработки первичной и вторичной строки
            for (let i = 0; i < 1 || (rowsInfo.has_b_row && i < 2); i++) {
                if (i === 0) {
                    row = rowsInfo.row_a;
                    timeRow = scheduleTable.children('tr').eq(aRowIndex);
                } else {
                    row = rowsInfo.row_b;
                    timeRow = scheduleTable.children('tr').eq(aRowIndex + 1);
                }
                const processRowA = i === 0;


                timeRow.children('td').each(function (k, elem) {
                    // пропускаем ячейки и компенсируем индекс
                    if (k < row.skip_colons_n) {
                        return;
                    } else {
                        k = k - row.skip_colons_n;
                    }

                    const cell = new shared.TableCell();
                    cell.element = timeRow.children(elem);
                    cell.text = shared.clearForMultipleSpaces(cell.element.text()).trim().replace('\n', ' ');

                    let colSpan = parseInt(timeRow.children(elem).attr("colspan"));
                    if (isNaN(colSpan)) {
                        colSpan = 1;
                    }
                    cell.colSpan = colSpan;

                    if (processRowA) {
                        // Обработка строки А
                        rowA.push(cell);

                        const rowSpan = parseInt(timeRow.children(elem).attr("rowspan"));
                        if (!isNaN(rowSpan) && rowSpan > 1) {
                            // Если ячейка строки А занимает строку B (rowspan = 2) заполняем B1
                            const greenCell = new shared.TableCell(cell);
                            rowB1.push({
                                cell: greenCell,
                                index: k
                            });
                        }

                    } else {
                        // Обработка строки B2
                        rowB2.push({
                            cell: cell,
                            index: k
                        });
                    }
                });
            }
            result.aRow = rowA; // сохраняем строку А

            if (rowsInfo.has_b_row) {
                result.hasBRow = true;
                buildCleanBRow(result, rowA, rowB1, rowB2); // строим строку Б
            } else {
                result.bRow = rowA; // сохраняем строку А как B
            }
            return result;
            break;
    }
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
    for (let y = 0; y < 1 || (timeRow.hasBRow !== undefined && timeRow.hasBRow && y < 2); y++) {
        let lessonTaken = 0; // Количество взятых уроков
        let previewLessonsSum = 0; // Сумма взятых уроков
        let previewGroupSum = 0; // Суммы взятых групп

        const lessonTime = timeRow.time;
        let lessonsRow;
        let weekColor;
        if (y === 0) {
            lessonsRow = timeRow.aRow;
            weekColor = WHITE_WEEK_TITLE
        } else {
            console.log("----------------------------");
            weekColor = GREEN_WEEK_TITLE;
            lessonsRow = timeRow.bRow;
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
                            groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'г', weekColor, group.text, lessonsRow[k]);
                            break;
                        } else if (sGroupColSpan === sLessonColSpan) {
                            if (eGroupColSpan > eLessonColSpan) {
                                // д
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                subGroupsNumb++;
                                leftGroupSpan = leftGroupSpan - lessonColSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'д', weekColor, group.text, lessonsRow[k]);
                            } else {
                                // б1
                                previewGroupSum += group.colSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'б1', weekColor, group.text, lessonsRow[k]);
                                break;
                            }
                        } else if (eGroupColSpan === eLessonColSpan) {
                            if (sGroupColSpan < sLessonColSpan) {
                                // е
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'е', weekColor, group.text, lessonsRow[k]);
                                break;
                            } else {
                                // а1
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'а1', weekColor, group.text, lessonsRow[k]);
                                break;
                            }
                        }
                    } else {
                        if (sGroupColSpan > sLessonColSpan && eGroupColSpan < eLessonColSpan) {
                            //в1
                            previewGroupSum += group.colSpan;
                            groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'в1', weekColor, group.text, lessonsRow[k]);
                            break;
                        } else {
                            if (sGroupColSpan < sLessonColSpan && eLessonColSpan < eGroupColSpan) {
                                // в
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan -= lessonColSpan;
                                groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'в', weekColor, group.text, lessonsRow[k]);
                            } else if (eGroupColSpan > eLessonColSpan) {
                                // а
                                if (allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'а', weekColor, group.text, lessonsRow[k]);
                                }
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan = leftGroupSpan - (eLessonColSpan - sGroupColSpan);
                            } else {
                                // б
                                if (allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    groupData = saveToFinalJson(groupData, dayOfWeek, lessonTime, 'б', weekColor, group.text, lessonsRow[k]);
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

                json[weekColor][group.text][1][dayOfWeek].push(subGroupA);
                json[weekColor][group.text][2][dayOfWeek].push(subGroupB);

                // Если зелёной строки нет, то заполняем ей белой
                if (!timeRow.hasBRow) {
                    json[GREEN_WEEK_TITLE][group.text][1][dayOfWeek].push(subGroupA);
                    json[GREEN_WEEK_TITLE][group.text][2][dayOfWeek].push(subGroupB);
                }
            }
        );
    }
    return json;
}

module.exports.parse = function parse(course, scheduleTable) {
    const groups = getGroups(scheduleTable);


    //const timeRow = getSubRows(scheduleTable, 13);
    //console.log(timeRow);
    //return;


    let finalJson = {};
    finalJson[GREEN_WEEK_TITLE] = {};
    finalJson[WHITE_WEEK_TITLE] = {};
    groups.forEach(function (group) {
        finalJson.green[group.text] = {
            1: [],
            2: []
        };
        finalJson.white[group.text] = {
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

            const timeRow = getSubRows(scheduleTable, rowIndex);
            if (timeRow !== undefined) {
                console.log("\x1b[32m========ROW: %d === TIME: %s ========\x1b[0m", rowIndex, timeRow.time);
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