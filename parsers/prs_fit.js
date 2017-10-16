/**
 * Created by WiskiW on 13.10.2017.
 */
const shared = require('./prs_shared.js');

const MAX_SUB_GROUPS_NUMB = 2;
const MIN_REQUIRED_ROWSPAN_VALUE = 4; // минимальное значение атрибута rowspan при котором строка чситается новым днем в расписании

module.exports.tag = TAG = 'fit';

class DayRow {
    constructor(rowIndex, text) {
        this.rowIndex = rowIndex;
        this.text = text;
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

function grabGreenRowsIndexes(scheduleTable, daysIndexes) {
    const greenRowsToSkip = [];
    let lastTakenDayIndex = 0;
    scheduleTable.children('tr').each(function (index, elem) {
        const table = scheduleTable.children(elem);
        let colToCheck = 0;
        for (let i = lastTakenDayIndex; i < daysIndexes.length; i++) {
            if (daysIndexes[i].rowIndex === index) {
                colToCheck = 1;
                lastTakenDayIndex = i;
                break;
            }
        }
        let rowSpan = table.children('td').eq(colToCheck).attr('rowspan');
        if (rowSpan !== undefined && rowSpan > 1) {
            greenRowsToSkip.push(index + 1); // пропускаем следующую строку за зелёной
            console.log('[%d] skpping: %d', index, index + 1);
        }
    });
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
            lessonsRow = timeRow.white_cells;
        } else {
            console.log("----------------------------");
            lessonsRow = timeRow.green_cells;
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

function printRow(scheduleTable, groups, rowIndex) {
    console.log("\n=================== ROW: %d ===================", rowIndex);
    const timeRow = shared.getScheduleForRow(scheduleTable, rowIndex);
    connectLessonsGroups(groups, timeRow);

}

module.exports.parse = function parse(course, scheduleTable) {
    const groups = shared.getGroups(scheduleTable);

    //printRow(scheduleTable, groups, 2);

    const dayRowIndexes = grabDaysIndexes(scheduleTable); // массив объектов, хранящий индекст строк с днями недели

    // двумерный массив, хранящий индексы строк с расписанием для каждого дня недели
    const dayLessonsRowIndexes = grabLessonsForDaysRowIndexes(scheduleTable, dayRowIndexes);


    for (let daysIndex = 0; daysIndex < dayLessonsRowIndexes.length; daysIndex++) {
        console.log('\n DAY: %s', dayRowIndexes[daysIndex].text);
        const lessonsIndexes = dayLessonsRowIndexes[daysIndex];
        for (let lessonsIndex = 0; lessonsIndex < lessonsIndexes.length; lessonsIndex++) {
            const rowIndex = lessonsIndexes[lessonsIndex];
            printRow(scheduleTable, groups, rowIndex);
        }
    }
};
