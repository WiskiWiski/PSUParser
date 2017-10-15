/**
 * Created by WiskiW on 13.10.2017.
 */
const shared = require('./prs_shared.js');

const MAX_SUB_GROUPS_NUMB = 2;
const X_VAR = 20; // миниматный процент от колСпана урока заходяций на группу необходимы для регистрации предмета группе
const LEFT_COL_SPAN_PROCCENT = 35; // миниматный процент от колСпана урока для регистрации предмета группе
const RIGHT_COL_SPAN_PROCCENT = 35; // миниматный процент от колСпана урока для регистрации предмета группе

module.exports.tag = TAG = 'fit';

function allowOverborders(sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan) {
    const requiredPresent = (100 / MAX_SUB_GROUPS_NUMB);
    const groupColSpan = eGroupColSpan - sGroupColSpan;
    const lessonOverborders = (sLessonColSpan > sGroupColSpan ? eGroupColSpan - sLessonColSpan : eLessonColSpan - sGroupColSpan);

    // console.log('OVB : %d / %d', (lessonOverborders * 100 / groupColSpan), requiredPresent);
    return lessonOverborders * 100 / groupColSpan >= requiredPresent;
}

function connectLessonsGroups3(groups, timeRow) {
    for (let y = 0; y < 1 || (timeRow.hasGreen && y < 2); y++) {
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
    console.log("\n\n=================== ROW: %d ===================", rowIndex);
    const timeRow = shared.getScheduleForRow(scheduleTable, rowIndex);
    connectLessonsGroups3(groups, timeRow);

}
module.exports.parse = function parse(course, scheduleTable) {
    const groups = shared.getGroups(scheduleTable);


    printRow(scheduleTable, groups, 11);

    /*
    const skipedRows = [3, 6, 8, 10, 13, 16, 18, 20, 24];
    const lastRow = 10;
    for (let rowIndex = 1; rowIndex <= lastRow; rowIndex++) {
        for (let si = 0; si < skipedRows.length; si++) {
            if (rowIndex === skipedRows[si]) {
                rowIndex++;
                break;
            }
        }
        if (rowIndex > lastRow) {
            break;
        }
        printRow(scheduleTable, groups, rowIndex);
    }
    */
};
