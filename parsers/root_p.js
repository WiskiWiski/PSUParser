/* root parser */
const logerObjects = require('../logs/lobjects.js');
const pref = require('../preferences.js');
const utils = require('../p_utils.js');

const ROW_TYPE_NONE = 'none';
const ROW_TYPE_TIME_ROW = 'time_row';
const ROW_TYPE_GROUP_ROW = 'group_row';
const ROW_TYPE_EMPTY_ROW = 'empty_row';


exports.RootParser = function RootParser(course, html, loger) {
    const self = this;

    this.getScheduleTable = function (html) {
        return html('table').eq(1).children('tbody');
    };
    let scheduleTable = this.getScheduleTable(html);


    // Получение списка групп
    this.getGroups = function () {
        // получает список групп для расписания
        // возвращает массив объектов cell (с группами в ячейках)

        function detectGroupsRowIndex(scheduleTable) {
            // Возвращает индекст строки из таблици, в которой находятся группы

            const rowCount = scheduleTable.children('tr').length;
            for (let k = 0; k < 6 && k < rowCount; k++) {
                // Крайне маловероятно, что строка с группами будет ниже 6-ого ряда
                if (self.getRowInfo(k).type === ROW_TYPE_GROUP_ROW) {
                    return k
                }
            }
            return -1;
        }

        let groups = [];

        const groupsRowIndex = detectGroupsRowIndex(scheduleTable);
        const logProg = new logerObjects.LogProgress();
        logProg.setMessage('Getting groups...');
        logProg.setStage(1);
        logProg.setPercent(40);
        loger.log(logProg);

        if (groupsRowIndex !== -1) {
            const groupsSubRows = self.parseRow(groupsRowIndex);
            groups = groupsSubRows.bSubRow;

            const logProg = new logerObjects.LogProgress();
            logProg.setMessage('Getting groups...');
            logProg.setStage(1);
            logProg.setPercent(100);
            loger.log(logProg);

            if (pref.CONSOLE_LOGS_ENABLE) {
                groups.forEach(function (el) {
                    console.log('groups [col=%d] : %s', el.colSpan, el.text);
                });
                console.log();
            }
        } else {
            // Groups row has not found!
            const logMsg = new logerObjects.LogMessage();
            logMsg.setCode();
            logMsg.setMessage('Groups row has not found!');
            logMsg.setErrorStatus();
            logMsg.setCode(logerObjects.MSG_CODE_GROUPS_ROW_NOT_FOUND);
            loger.log(logMsg);
        }
        return groups;
    };

    this.getRowInfo = function (aRowIndex) {
        /*
            Поиск информации о строка подстроках в таблице расписания по индексу А-строки - aRowIndex
            Возвращает структуру типа result (см. ниже)
         */

        const SUBROW_A = 'a';
        const SUBROW_B = 'b';

        let result = {
            day: null,
            hasBRow: false,
            type: ROW_TYPE_NONE,
            time: null,
            aSubRow: {
                skipColonsN: 0,
                errors: null

            },
            bSubRow: {
                skipColonsN: 0,
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
                row = result.aSubRow;
            } else {
                subRow = SUBROW_B;
                row = result.bSubRow;

            }
            let skipColonsN = 0;


            let forEachIsFinished = false;
            timeRow.children('td').each(function (k, elem) {
                if (forEachIsFinished) {
                    return;
                }


                // проверяем, не содержит ли текущий столбце день недели или время
                const celRowSpan = parseInt(timeRow.children(elem).first('td').attr('rowspan'));
                const cellText = utils.clearForMultipleSpaces(timeRow.children(elem).text().trim());

                const isClockCell = cellText.toLowerCase().indexOf('часы') !== -1;

                if (isClockCell) {
                    // Если строка с группами

                    forEachIsFinished = true;
                    result.type = ROW_TYPE_GROUP_ROW;
                    skipColonsN++;
                    if (celRowSpan === 2) {
                        hasGreen = true;
                        result.hasBRow = true;
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

                        // проверка значения ячейки на содержание (1-9 или . или , или пробела)
                        const isTimeCol = utils.REG_EXPRESSION_FOR_DATE_CELL.test(cellText);
                        if (isTimeCol) {
                            // ячейка со временем
                            result.type = ROW_TYPE_TIME_ROW;
                            skipColonsN++;
                            // TODO : разделить 9.0010.20 на два времени
                            result.time = cellText.replace('\n', ' ');

                            if (celRowSpan === 2) {
                                hasGreen = true;
                                result.hasBRow = true;
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
            row.skipColonsN = skipColonsN;
        }
        return result;
    };

    // Метод сбора второстепенной строки расписани
    this.buildCleanBRow = function (timeRowSch, rowA, rowB1, rowB2) {
        /*
            Метод сбора второстепенной строки расписани
            Принимает главную строку из расписания (rowA)
            и две второстепенные:
                rowB1 - образованная от ячеек из rowA с rowSpan=2
                rowB2 - образованная ячейками строки за rowA
            Построенную второстепенную строку записывает в объект SubRows - timeRowSch
         */

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

        if (pref.CONSOLE_LOGS_DEBUG_ENABLE) {
            console.log('\n\nrowA: ');
            printResA(rowA);
            console.log('\nrowB1: ');
            printResB(rowB1);
            console.log('\nrowB2: ');
            printResB(rowB2);
        }

        const cleanARowCount = rowA.length - rowB1.length;
        if (cleanARowCount === rowB2.length) {
            // Случай - simple
            if (pref.CONSOLE_LOGS_DEBUG_ENABLE) console.log('\nSIMPLE-Type\n');
            let takeFromB2Count = 0;
            let item;
            for (let index = 0; index < rowB1.length; index++) {
                item = rowB1[index];
                if (item.index === index + takeFromB2Count) {
                    timeRowSch.bSubRow.push(item.cell);
                } else {
                    takeFromB2Count++;
                    index--;
                    if (rowB2.length > 0) {
                        timeRowSch.bSubRow.push(rowB2.splice(0, 1)[0].cell);
                    }
                }
            }
            if (rowB2.length > 0) {
                // записываем оставшиеся в rowB2 ячейки в результат
                timeRowSch.bSubRow = timeRowSch.bSubRow.concat(rowB2.map(item => item.cell))
            }


        } else if (cleanARowCount > rowB2.length) {
            // Случай - A
            if (pref.CONSOLE_LOGS_DEBUG_ENABLE) console.log('\nA-Type\n');

            let aItemIndex = 0;

            for (let index = 0; index < rowB2.length; index++) {
                const item = rowB2[index];
                let aItemSum = 0;
                if (rowB1.length > 0 && aItemIndex === rowB1[0].index) {
                    timeRowSch.bSubRow.push(rowB1.splice(0, 1)[0].cell);
                    aItemIndex++;
                    index--;
                } else {
                    while (aItemIndex < rowA.length) {
                        const aItem = rowA[aItemIndex];
                        aItemIndex++;
                        aItemSum += aItem.colSpan;
                        if (aItemSum >= item.cell.colSpan || aItemIndex + 1 === rowA.length) {
                            timeRowSch.bSubRow.push(item.cell);
                            break;
                        }
                    }
                }

            }
            if (rowB1.length > 0) {
                // записываем оставшиеся в rowB1 ячейки в результат
                timeRowSch.bSubRow = timeRowSch.bSubRow.concat(rowB1.map(item => item.cell))
            }
        } else if (cleanARowCount < rowB2.length) {
            // Случай - B
            if (pref.CONSOLE_LOGS_DEBUG_ENABLE) console.log('\nB-Type\n');

            let b2ItemIndex = 0;
            rowA.forEach(function (item, index) {
                let b2ItemSum = 0;
                if (rowB1.length > 0 && index === rowB1[0].index) {
                    rowB1.splice(0, 1);
                    timeRowSch.bSubRow.push(item);
                } else {
                    while (b2ItemIndex < rowB2.length) {
                        const b2Item = rowB2[b2ItemIndex];
                        b2ItemIndex++;
                        b2ItemSum += b2Item.colSpan;
                        timeRowSch.bSubRow.push(b2Item.cell);
                        if (b2ItemSum >= item.colSpan) {
                            break;
                        }
                    }
                }

            });
        }

        if (pref.CONSOLE_LOGS_DEBUG_ENABLE) printResA(timeRowSch.bSubRow);
    };

    // Возвращает объект содержащий строку А и B(см. result)
    this.parseRow = function (aRowIndex) {
        // Результирующий объект:
        // aSubRow & bSubRow содержат объекты cell: colSpan, element, text
        const row = {
            hasBRow: false,
            aSubRow: [],
            bSubRow: [],
            time: null
        };

        let timeRow = scheduleTable.children('tr').eq(aRowIndex);

        const rowsInfo = self.getRowInfo(aRowIndex);

        switch (rowsInfo.type) {
            case ROW_TYPE_NONE:
            case ROW_TYPE_EMPTY_ROW:
                // Пустая строка
                return;
                break;
            case ROW_TYPE_GROUP_ROW:
            case ROW_TYPE_TIME_ROW:
                row.time = rowsInfo.time;

                let rowA = [];
                let rowB1 = [];
                let rowB2 = [];
                let subRow;

                // Цикл для обработки первичной и вторичной строки
                for (let i = 0; i < 1 || (rowsInfo.hasBRow && i < 2); i++) {
                    if (i === 0) {
                        subRow = rowsInfo.aSubRow;
                        timeRow = scheduleTable.children('tr').eq(aRowIndex);
                    } else {
                        subRow = rowsInfo.bSubRow;
                        timeRow = scheduleTable.children('tr').eq(aRowIndex + 1);
                    }
                    const processRowA = i === 0;


                    timeRow.children('td').each(function (k, elem) {
                        // пропускаем ячейки и компенсируем индекс
                        if (k < subRow.skipColonsN) {
                            return;
                        } else {
                            k = k - subRow.skipColonsN;
                        }

                        // Объект ячейки (cm. buildCell() )
                        const cell = self.buildCell(timeRow.children(elem));

                        if (processRowA) {
                            // Обработка строки А
                            rowA.push(cell);

                            const rowSpan = parseInt(timeRow.children(elem).attr("rowspan"));
                            if (!isNaN(rowSpan) && rowSpan > 1) {
                                // Если ячейка строки А занимает строку B (rowspan = 2) заполняем B1

                                const greenCell = Object.assign({}, cell); // копирование ячейки
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
                row.aSubRow = rowA; // сохраняем строку А

                if (rowsInfo.hasBRow) {
                    row.hasBRow = true;
                    self.buildCleanBRow(row, rowA, rowB1, rowB2); // строим строку Б
                } else {
                    row.bSubRow = rowA; // сохраняем строку А как B
                }
                return row;
                break;
        }
    };

    // Созданет объект cell по html данным ячейки - cellElement
    this.buildCell = function (cellElement) {
        // TODO: Обработать данные из cellElement
        const cell = {
            colSpan: 1,
            element: null,
            text: null
        };

        cell.element = cellElement;
        cell.text = utils.clearForMultipleSpaces(cellElement.text()).trim().replace('\n', ' ');

        let colSpan = parseInt(cellElement.attr("colspan"));
        if (isNaN(colSpan)) {
            colSpan = 1;
        }
        cell.colSpan = colSpan;
        return cell;
    };

    // Возвращает двумерный массив со строками для каждого дня
    this.getRows = function () {
        // Возвращает двумерный массив
        // Массив данных для строки для каждого дня недели

        const PROGRESS_STAGE = 2;
        const days = [];
        const rowNumb = scheduleTable.children('tr').length; // количество строк таблицы

        let dayRows;
        for (let k = 0; k < rowNumb && days.length <= 6; k++) {
            const info = self.getRowInfo(k);
            if (info.day !== null) {
                // новый день
                if (dayRows !== undefined) {
                    days.push(dayRows);
                }
                dayRows = [];
            }

            const logProg = new logerObjects.LogProgress();
            logProg.setMessage('Checking row ' + (k + 1) + ' for lessons...');
            logProg.setPercent((k + 1) * 100 / rowNumb);
            logProg.setStage(PROGRESS_STAGE);
            loger.log(logProg);


            if (info.type === ROW_TYPE_TIME_ROW) {
                // если строка с расписанием
                // то сохраняем строку

                const row = self.parseRow(k);

                if (row === undefined) {
                    const logMsg = new logerObjects.LogMessage();
                    logMsg.setMessage('Row is undefined on ' + k + ' row!');
                    logMsg.setErrorStatus();
                    logMsg.setCode(logerObjects.MSG_CODE_UNDEFINED_LESSONS_ROW);
                } else {
                    dayRows.push(row);
                }

            }
        }
        if (dayRows !== undefined) {
            days.push(dayRows);
        }
        return days;
    };

    // Посчитываем суммарное значение colSpan для массива объектов cell
    this.calculateCellsColSpan = function (subRow) {
        let sum = 0;
        subRow.forEach(function (cell) {
            sum += cell.colSpan;
        });
        return sum;
    };

    // Связывает ячейки строки с группами для зелёной и белой недели
    this.linkLessonsGroupsForRow = function (row, groups, dayIndex) {
        // row - объект из parseRow
        // groups - массив ячерек(cell) групп

        if (row === undefined) {
            return {};
        }

        const result = {};

        const groupsColSpan = self.calculateCellsColSpan(groups);

        for (let k = 1; k <= 1 || (row.hasBRow && k <= 2); k++) {
            let subRow;
            let weekColorTitle;
            let bgWeekColor;
            let fgWeekColor;

            if (k === 1) {
                subRow = row.aSubRow;
                weekColorTitle = pref.WEEK_TITLE_WHITE;
                if (pref.CONSOLE_LOGS_ENABLE) {
                    bgWeekColor = pref.BG_COLOR_WHITE;
                    fgWeekColor = pref.FG_COLOR_MARGENTA;
                    console.log(pref.FG_COLOR_BLUE + pref.STYLE_BRIGHT + pref.STYLE_BLINK + pref.STYLE_UNDERSCORE +
                        "\n================ TIME: %s ================" + pref.COLORS_DEFAULT, row.time);
                }
            } else {
                weekColorTitle = pref.WEEK_TITLE_GREEN;
                subRow = row.bSubRow;
                if (pref.CONSOLE_LOGS_ENABLE) {
                    bgWeekColor = pref.BG_COLOR_GREEN;
                    fgWeekColor = pref.FG_COLOR_WHITE;
                    console.log(' ------------------------- ');
                }
            }

            const subRowColSpan = self.calculateCellsColSpan(subRow);
            if (groupsColSpan !== subRowColSpan) {
                const logMsg = new logerObjects.LogMessage();
                logMsg.setMessage('Lessons colspan not match with groups colspan: ' + subRowColSpan
                    + ' vs ' + groupsColSpan + ' [' + utils.getDayByIndex(dayIndex) + ' at ' + row.time + ', '
                    + weekColorTitle.toLowerCase() + ' week]');
                logMsg.setWarningStatus();
                logMsg.setCode(logerObjects.MSG_CODE_COLSPAN_LESSON_NOT_MATCH_GROUPS);
                loger.log(logMsg);
            }

            const linked = self.linkLessonsGroupsForSubRow(subRow, groups);
            result[weekColorTitle] = linked;

            if (pref.CONSOLE_LOGS_ENABLE) {
                linked.forEach(function (groupObject) {
                    groupObject.lessons.forEach(function (subGroupLesson, subGroupN) {
                        console.log(fgWeekColor + bgWeekColor + weekColorTitle.charAt(0) + pref.COLORS_DEFAULT +
                            '[' + groupObject.groupName + ':' + (subGroupN + 1) + '] ' + pref.STYLE_BLINK +
                            subGroupLesson.text + pref.COLORS_DEFAULT);
                    });
                });
            }

        }
        return result;
    };

    this.allowOverBorders = function (maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan) {
        const requiredPresent = (100 / maxGroupNumb);
        const groupColSpan = eGroupColSpan - sGroupColSpan;
        const lessonOverBorders = (sLessonColSpan > sGroupColSpan ? eGroupColSpan - sLessonColSpan : eLessonColSpan - sGroupColSpan);
        return lessonOverBorders * 100 / groupColSpan >= requiredPresent;
    };

    // Связывает ячейки подстроки с группами
    this.linkLessonsGroupsForSubRow = function (maxGroupNumb, subRow, groups) {
        // subRow - массив объектов cell (cm. buildCell())
        // groups - массив групп
        // возвращает массив объектов: {groupName: [lesson1, lesson2}

        const result = [];

        let lessonTaken = 0; // Количество взятых уроков
        let previewLessonsSum = 0; // Сумма взятых уроков
        let previewGroupSum = 0; // Суммы взятых групп

        let groupsColSpanSum = 0;

        groups.forEach(function (group) {
                const groupObject = {
                    groupName: group.text,
                    lessons: []
                };
                result.push(groupObject);

                let subGroupsNumb = 0; // Количество подсчитанных подгупп
                let leftGroupSpan = group.colSpan; // оставшееся место в данной группе
                groupsColSpanSum += group.colSpan;


                for (let k = lessonTaken; k < subRow.length; k++) {
                    if (subGroupsNumb >= maxGroupNumb || leftGroupSpan <= 0) {
                        previewGroupSum += group.colSpan;
                        break;
                    }

                    if (subRow[k] === undefined) {
                        continue;
                    }

                    const lessonColSpan = subRow[k].colSpan; // размер урока

                    const sGroupColSpan = previewGroupSum; // значение начала группы
                    const eGroupColSpan = previewGroupSum + group.colSpan; // значение конца группы
                    const sLessonColSpan = previewLessonsSum; // значение начала урока
                    const eLessonColSpan = previewLessonsSum + lessonColSpan; // значение конца урока

                    if (sGroupColSpan === sLessonColSpan || eGroupColSpan === eLessonColSpan) {
                        if (sGroupColSpan === sLessonColSpan && eGroupColSpan === eLessonColSpan) {
                            // г
                            lessonTaken++;
                            previewLessonsSum += lessonColSpan;
                            previewGroupSum += group.colSpan;
                            groupObject.lessons.push(subRow[k]);
                            break;
                        } else if (sGroupColSpan === sLessonColSpan) {
                            if (eGroupColSpan > eLessonColSpan) {
                                // д
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                subGroupsNumb++;
                                leftGroupSpan = leftGroupSpan - lessonColSpan;
                                groupObject.lessons.push(subRow[k]);
                            } else {
                                // б1
                                previewGroupSum += group.colSpan;
                                groupObject.lessons.push(subRow[k]);
                                break;
                            }
                        } else if (eGroupColSpan === eLessonColSpan) {
                            if (sGroupColSpan < sLessonColSpan) {
                                // е
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                groupObject.lessons.push(subRow[k]);
                                break;
                            } else {
                                // а1
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                previewGroupSum += group.colSpan;
                                groupObject.lessons.push(subRow[k]);
                                break;
                            }
                        }
                    } else {
                        if (sGroupColSpan > sLessonColSpan && eGroupColSpan < eLessonColSpan) {
                            //в1
                            previewGroupSum += group.colSpan;
                            groupObject.lessons.push(subRow[k]);
                            break;
                        } else {
                            if (sGroupColSpan < sLessonColSpan && eLessonColSpan < eGroupColSpan) {
                                // в
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan -= lessonColSpan;
                                groupObject.lessons.push(subRow[k]);
                            } else if (eGroupColSpan > eLessonColSpan) {
                                // а
                                if (self.allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    groupObject.lessons.push(subRow[k]);
                                }
                                lessonTaken++;
                                previewLessonsSum += lessonColSpan;
                                leftGroupSpan = leftGroupSpan - (eLessonColSpan - sGroupColSpan);
                            } else {
                                // б
                                if (self.allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                                    groupObject.lessons.push(subRow[k]);
                                }
                                previewGroupSum += group.colSpan;
                                break;
                            }
                        }
                    }
                }
            }
        );
        return result;
    };


};