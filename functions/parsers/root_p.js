/* root parser */
const logerObjects = require('../loger/lobjects.js');
const pref = require('../preferences.js');
const utils = require('../p_utils.js');

const ROW_TYPE_NONE = 'none';
const ROW_TYPE_SIMPLE_TIME_ROW = 'simple_time_row'; // для строк расписания без ячейки дня
const ROW_TYPE_EXTENDED_TIME_ROW = 'extended_time_row'; // для строк расписания с ячейкой дня
const ROW_TYPE_GROUP_ROW = 'group_row';
const ROW_TYPE_UNKNOWN_ROW = 'empty_row';


exports.RootParser = function RootParser(course, maxGroupNumb, html, loger) {
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
            logMsg.setMessage('Groups row has not found!');
            logMsg.setErrorStatus();
            logMsg.setDisplayText('Не удалось распознать строку с группами. ' +
                'Сверьтесь с пунктов 1. и проверьте правильность офорления таблицы.');
            logMsg.setCode(logerObjects.MSG_CODE_GROUPS_ROW_NOT_FOUND);
            loger.log(logMsg);
        }
        return groups;
    };

    this.getRowInfo = function (htmlARowIndex) {
        // Поиск информации о строка подстроках в таблице расписания по индексу А-строки - htmlARowIndex
        // Возвращает структуру типа result (см. ниже)

        const SUBROW_A = 'a';
        const SUBROW_B = 'b';

        let result = {
            hasBRow: false,
            type: ROW_TYPE_NONE,
            data: {},
            aSubRow: {
                skipColonsN: 0
            },
            bSubRow: {
                skipColonsN: 0
            },
        };

        let subRow;
        let row;

        for (let i = 0; i < 1 || (result.hasBRow && i < 2); i++) {
            const htmlRow = scheduleTable.children('tr').eq(htmlARowIndex + i);
            if (i === 0) {
                subRow = SUBROW_A;
                row = result.aSubRow;
            } else {
                subRow = SUBROW_B;
                row = result.bSubRow;

            }

            let pCellHeight = -1;
            let forEachIsFinished = false; // устанавливать в true, когда тип строки определён
            htmlRow.children('td').each(function (k, elem) {
                if (result.hasBRow) {
                    // проверяем все ячейки для обнаружения строки-Б
                    return;
                }

                const cellHeight = getCellHeight(htmlRow.children(elem).first('td'));
                const cellText = utils.htmlToText(htmlRow.children(elem).html());


                if (!result.hasBRow && cellHeight <= 2) {
                    // <=2 для исключения ячеек с днем недели
                    if (pCellHeight !== -1 && cellHeight !== pCellHeight) {
                        result.hasBRow = true;
                    }
                    pCellHeight = cellHeight; // pCellHeight - высота предыдущей ячейки
                }

                if (isClockCell(cellText)) {
                    // Если строка с группами и текущая ячейка "Часы"

                    forEachIsFinished = true;
                    result.type = ROW_TYPE_GROUP_ROW;
                    row.skipColonsN++;

                } else if (subRow === SUBROW_A) {
                    // Если любая другая ячейка : подстрока А
                    if (isTimeCell(cellText)) {
                        // ячейка со временем

                        if (row.skipColonsN === 1) {
                            // если перед обнаружением TimeCell была только одна ячейка,то данная строка содержит день недели
                            const previewCellElement = htmlRow.children('td').eq(k - 1); // предыдущая ячейка
                            result.data['day'] = utils.htmlToText(previewCellElement.html());
                            result.type = ROW_TYPE_EXTENDED_TIME_ROW;
                        } else {
                            result.type = ROW_TYPE_SIMPLE_TIME_ROW;
                        }
                        row.skipColonsN++;

                        result.data['time'] = cellText.replace('\n', ' ');

                        // forEachIsFinished=true для переходя на следующую подстроку,
                        // т.к. после текущей ячейки точно будет расписание
                        forEachIsFinished = true;
                    }
                }
                if (result.type === ROW_TYPE_NONE) {
                    // если еще не определили какого типа строка и ячейка пустая - прибовляем индекс для пропуска ячейки
                    row.skipColonsN++;
                }
            });


            if (result.type === ROW_TYPE_NONE) {
                // если после анализа всех ячееек html-строки, тип остался неизвестен - строка пустая
                result.type = ROW_TYPE_UNKNOWN_ROW;
                return result;
            }
        }
        return result;

        function getCellHeight(htmlElement) {
            let cellHeight = parseInt(htmlElement.attr('rowspan'));
            if (isNaN(cellHeight)) {
                return 1;
            }
            return cellHeight;
        }

        function isTimeCell(cellText) {
            // проверка значения ячейки на содержание (1-9 или . или , или пробела)
            return utils.REG_EXPRESSION_FOR_DATE_CELL.test(cellText);
        }

        function isClockCell(cellText) {
            return cellText.toLowerCase().indexOf('часы') !== -1;
        }
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
    this.parseRow = function (aRowIndex, weekDayIndex, rowsInfo) {
        // Результирующий объект:
        // aSubRow & bSubRow содержат объекты cell: colSpan, element, text
        const timeRow = {
            hasBRow: false,
            aSubRow: [],
            bSubRow: [],
            time: null
        };

        let htmlTimeRow = scheduleTable.children('tr').eq(aRowIndex);

        if (rowsInfo === undefined || rowsInfo === null) {
            rowsInfo = self.getRowInfo(aRowIndex);
        }

        switch (rowsInfo.type) {
            case ROW_TYPE_NONE:
            case ROW_TYPE_UNKNOWN_ROW:
                // TODO: Неизвестный формат строки строка
                return timeRow;
                break;
            case ROW_TYPE_GROUP_ROW:
            case ROW_TYPE_EXTENDED_TIME_ROW:
            case ROW_TYPE_SIMPLE_TIME_ROW:
                timeRow.time = rowsInfo.data.time;

                let rowA = [];
                let rowB1 = [];
                let rowB2 = [];
                let subRow;

                // Цикл для обработки первичной и вторичной строки
                for (let i = 0; i < 1 || (rowsInfo.hasBRow && i < 2); i++) {
                    if (i === 0) {
                        subRow = rowsInfo.aSubRow;
                        htmlTimeRow = scheduleTable.children('tr').eq(aRowIndex);
                    } else {
                        subRow = rowsInfo.bSubRow;
                        htmlTimeRow = scheduleTable.children('tr').eq(aRowIndex + 1);
                    }
                    const processRowA = i === 0;


                    htmlTimeRow.children('td').each(function (k, elem) {
                        // пропускаем ячейки и компенсируем индекс
                        if (k < subRow.skipColonsN) {
                            return;
                        } else {
                            k = k - subRow.skipColonsN;
                        }

                        // Объект ячейки (cm. buildCell() )
                        const cell = self.buildCell(htmlTimeRow.children(elem));

                        if (processRowA) {
                            // Обработка строки А
                            rowA.push(cell);

                            const rowSpan = parseInt(htmlTimeRow.children(elem).attr("rowspan"));
                            if (!isNaN(rowSpan) && rowSpan > 1) {
                                if (rowSpan > 2 || (rowSpan > 1 && !rowsInfo.hasBRow)) {
                                    // ячека занимет более 2 строк
                                    const logMsg = new logerObjects.LogMessage();
                                    logMsg.setErrorStatus();
                                    logMsg.setCode(logerObjects.MSG_CODE_LESSONS_ROWSPAN_TOO_BIG);
                                    const weekDay = utils.getDayByIndex(weekDayIndex);
                                    logMsg.setMessage('[' + weekDay + ', ' + timeRow.time + ', ' + (k + 1) +
                                        ' lesson cell] Row has B-subgrow(' + rowsInfo.hasBRow + ') and lessons rowSpan=' + rowSpan);
                                    logMsg.setDisplayText('[' + weekDay + ', ' + timeRow.time + ', ' + (k + 1) +
                                        ' ячейка с предметом]: Проверьте правильность оформления ячейки предмета в строке - см. п.3');

                                    loger.log(logMsg);
                                } else {
                                    // Если ячейка строки А занимает строку B (rowspan = 2) заполняем B1

                                    const greenCell = Object.assign({}, cell); // копирование ячейки
                                    rowB1.push({
                                        cell: greenCell,
                                        index: k
                                    });
                                }
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
                timeRow.aSubRow = rowA; // сохраняем строку А

                if (rowsInfo.hasBRow) {
                    timeRow.hasBRow = true;
                    self.buildCleanBRow(timeRow, rowA, rowB1, rowB2); // строим строку Б
                } else {
                    timeRow.bSubRow = rowA; // сохраняем строку А как B
                }
                return timeRow;
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
        cell.text = utils.htmlToText(cellElement.html());

        let colSpan = parseInt(cellElement.attr("colspan"));
        if (isNaN(colSpan)) {
            colSpan = 1;
        }
        cell.colSpan = colSpan;
        return cell;
    };

    // Возвращает двумерный массив со строками для каждого дня
    this.getTimeRows = function () {
        // Возвращает двумерный массив
        // Массив данных для строки для каждого дня недели

        const DEBUG_LOGS = false;

        const days = [];
        let dayRows = [];

        const htmlRowNumb = scheduleTable.children('tr').length; // количество строк html таблицы

        for (let k = 0; k < htmlRowNumb && days.length <= 6; k++) {
            const rowInfo = self.getRowInfo(k);
            const rowType = rowInfo.type;
            if (dayRows.length > 0 && rowType === ROW_TYPE_EXTENDED_TIME_ROW) {
                days.push(dayRows);
                dayRows = [];
                if (DEBUG_LOGS) console.log('============DAY ' + (days.length + 1) + '============');
            }


            if (rowType === ROW_TYPE_SIMPLE_TIME_ROW ||
                rowType === ROW_TYPE_EXTENDED_TIME_ROW ||
                rowType === ROW_TYPE_UNKNOWN_ROW) {

                const row = self.parseRow(k, days.length, rowInfo);
                dayRows.push(row);

                if (DEBUG_LOGS) console.log('[%d]: %s', k, (row));
            }

            if (rowInfo.hasBRow) {
                k++;
            }
        }

        // для сохранения строк последнего дня
        if (dayRows.length > 0) {
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
                const weekDay = utils.getDayByIndex(dayIndex);

                logMsg.setMessage('Lessons colspan not match with groups colspan: ' + subRowColSpan
                    + ' vs ' + groupsColSpan + ' [' + weekDay + ' at ' + row.time + ', '
                    + weekColorTitle.toLowerCase() + ' week]');
                logMsg.setDisplayText('[' + weekColorTitle.toLowerCase() + ', ' + weekDay + ', '
                    + row.time + ']: Границы строки не совпадают с грацицами групп. ' +
                    'Выполните пункт 4. и проверьте правильность соответствия колонок расписания их группам.');
                logMsg.setWarningStatus();
                logMsg.setCode(logerObjects.MSG_CODE_COLSPAN_LESSON_NOT_MATCH_GROUPS);
                loger.log(logMsg);
            }

            const linked = self.linkLessonsGroupsForSubRow(maxGroupNumb, subRow, groups);
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
        return lessonOverBorders * 100 / groupColSpan >= requiredPresent || lessonOverBorders > (eLessonColSpan - sLessonColSpan) / 2;
    };

    // Связывает ячейки подстроки с группами
    this.linkLessonsGroupsForSubRow = function (maxGroupNumb, subRow, groups) {
        // subRow - массив объектов cell (cm. buildCell())
        // groups - массив групп
        // возвращает массив объектов: {groupName: [lesson1, lesson2}

        const DEBUG_LOGS = false;

        const result = [];

        const leftData = {
            sGroupColSpan: 0,
            sLessonColSpan: 0,
            lessonTaken: 0,
        };

        const rightData = {
            sGroupColSpan: 0,
            sLessonColSpan: 0,
            lessonTaken: 0,
        };


        subRow.forEach(function (lesson, k) {
            if (DEBUG_LOGS) console.log('[%d]: %d - %s', k, lesson.colSpan, lesson.text)
        });


        const groupsNumber = groups.length;
        const halfLen = Math.ceil(groupsNumber / 2);
        for (let halfIndex = 0; halfIndex < halfLen; halfIndex++) {
            const leftGroupIndex = halfIndex;
            if (DEBUG_LOGS) console.log('\n ===== GROUP[L]: ' + groups[leftGroupIndex].text);
            const leftGroupLessons = leftToRightProcessor(leftGroupIndex, leftData);
            result.push({
                groupName: groups[leftGroupIndex].text,
                lessons: leftGroupLessons
            });
            leftGroupLessons.forEach(function (item) {
                if (DEBUG_LOGS) console.log('\'%s\'', item.text);
            });

            if (groupsNumber - 1 - halfIndex < halfLen) {
                // если groupsNumber нечетное, то последняя обработка проводится только через leftToRightProcessor()
                break;
            }

            const rightGroupIndex = groupsNumber - 1 - halfIndex;
            if (DEBUG_LOGS) console.log('\n ===== GROUP[R]: ' + groups[rightGroupIndex].text);
            const rightGroupLessons = rightToLeftProcessor(rightGroupIndex, rightData);
            result.push({
                groupName: groups[rightGroupIndex].text,
                lessons: rightGroupLessons
            });
            rightGroupLessons.forEach(function (item) {
                if (DEBUG_LOGS) console.log('\'%s\'', item.text);
            });
        }


        function leftToRightProcessor(groupIndex, data) {
            // обработчик прохода с лева на право

            const group = groups[groupIndex];
            const lessonsForGroup = [];

            const sGroupColSpan = data.sGroupColSpan; // значение начала группы
            const eGroupColSpan = data.sGroupColSpan + group.colSpan; // значение конца группы

            let groupColSpan = group.colSpan;
            const colSpans = {
                sGroupColSpan: sGroupColSpan, // значение начала группы
                eGroupColSpan: eGroupColSpan, // значение конца группы
                sLessonColSpan: 0, // значение начала урока
                eLessonColSpan: 0// значение конца урока
            };

            for (data.lessonTaken; data.lessonTaken < subRow.length;) {
                colSpans.sLessonColSpan = data.sLessonColSpan; // установка значение начала урока
                colSpans.eLessonColSpan = data.sLessonColSpan + subRow[data.lessonTaken].colSpan; // установка значение конца урока

                const pResult = self.groupsAndLessonsProcess(maxGroupNumb, colSpans, groupColSpan, subRow[data.lessonTaken]);
                groupColSpan = pResult.leftGroupSolSpan; // обновление оставщегося свободного места для группы

                if (pResult.lessonTaken) {
                    // текущий урок использован,
                    // при следующих итерациях используем другой
                    data.sLessonColSpan += subRow[data.lessonTaken].colSpan;
                    data.lessonTaken++;
                }

                if (pResult.lesson !== null) {
                    // данный урок засчитан, добавляем его в результат к текущей группе
                    lessonsForGroup.push(pResult.lesson);
                }

                if (pResult.subGroupNumber >= maxGroupNumb || groupColSpan <= 0) {
                    // если максимальное кол-во подгруппы для группы достигнуто
                    // или место для записи уроков в группе закончилось - переходим к ледующей группе
                    data.sGroupColSpan = eGroupColSpan;
                    break;
                }
            }
            return lessonsForGroup;
        }

        function rightToLeftProcessor(groupIndex, data) {
            // обработчик прохода с лева на право

            const group = groups[groupIndex];
            const lessonsForGroup = [];

            const sGroupColSpan = data.sGroupColSpan; // значение начала группы
            const eGroupColSpan = data.sGroupColSpan + group.colSpan; // значение конца группы

            let groupColSpan = group.colSpan;
            const colSpans = {
                sGroupColSpan: sGroupColSpan, // значение начала группы
                eGroupColSpan: eGroupColSpan, // значение конца группы
                sLessonColSpan: 0, // значение начала урока
                eLessonColSpan: 0// значение конца урока
            };

            for (data.lessonTaken; data.lessonTaken < subRow.length;) {
                const lesson = subRow[subRow.length - 1 - data.lessonTaken];

                colSpans.sLessonColSpan = data.sLessonColSpan; // установка значение начала урока
                colSpans.eLessonColSpan = data.sLessonColSpan + lesson.colSpan; // установка значение конца урока

                const pResult = self.groupsAndLessonsProcess(maxGroupNumb, colSpans, groupColSpan, lesson);
                groupColSpan = pResult.leftGroupSolSpan; // обновление оставщегося свободного места для группы

                if (pResult.lessonTaken) {
                    // текущий урок использован,
                    // при следующих итерациях используем другой
                    data.sLessonColSpan += lesson.colSpan;
                    data.lessonTaken++;
                }

                if (pResult.lesson !== null) {
                    // данный урок засчитан, добавляем его в результат к текущей группе
                    lessonsForGroup.unshift(pResult.lesson); // unshift - push в начала массива
                }

                //console.log(colSpans);
                if (pResult.subGroupNumber >= maxGroupNumb || groupColSpan <= 0) {
                    // если максимальное кол-во подгруппы для группы достигнуто
                    // или место для записи уроков в группе закончилось - переходим к ледующей группе
                    data.sGroupColSpan = eGroupColSpan;
                    break;
                }
            }
            return lessonsForGroup;
        }

        return result;
    };

    this.groupsAndLessonsProcess = function (maxGroupNumb, colSpans, leftGroupSolSpan, lesson) {
        const DEBUG_LOGS = false;

        const sGroupColSpan = colSpans.sGroupColSpan;
        const eGroupColSpan = colSpans.eGroupColSpan;
        const sLessonColSpan = colSpans.sLessonColSpan;
        const eLessonColSpan = colSpans.eLessonColSpan;

        const result = {
            lessonTaken: false, // использовали ли постностью текущий урок
            subGroupNumber: 0, // количество погдгрупп для текущей группы
            lesson: null, // устанавливается, если текущий урок защитан для группы
            leftGroupSolSpan: leftGroupSolSpan // оставшееся свободное пространство для данной группы
        };

        if (sGroupColSpan === sLessonColSpan || eGroupColSpan === eLessonColSpan) {
            if (sGroupColSpan === sLessonColSpan && eGroupColSpan === eLessonColSpan) {
                // г
                result.lessonTaken = true;
                result.leftGroupSolSpan = 0;
                result.lesson = lesson;
                if (DEBUG_LOGS) console.log('g');
            } else if (sGroupColSpan === sLessonColSpan) {
                if (eGroupColSpan > eLessonColSpan) {
                    // д
                    result.lessonTaken = true;
                    result.leftGroupSolSpan = result.leftGroupSolSpan - (eLessonColSpan - sLessonColSpan);
                    result.subGroupNumber++;
                    result.lesson = lesson;
                    if (DEBUG_LOGS) console.log('d');
                } else {
                    // б1
                    result.leftGroupSolSpan = 0;
                    result.lesson = lesson;
                    if (DEBUG_LOGS) console.log('b1');
                }
            } else if (eGroupColSpan === eLessonColSpan) {
                // е или а1
                result.lessonTaken = true;
                result.leftGroupSolSpan = 0;
                result.lesson = lesson;
                if (DEBUG_LOGS) console.log('e - a1');
            }
        } else {
            if (sGroupColSpan > sLessonColSpan && eGroupColSpan < eLessonColSpan) {
                //в1
                result.leftGroupSolSpan = 0;
                result.lesson = lesson;
                if (DEBUG_LOGS) console.log('v1');
            } else {
                if (sGroupColSpan < sLessonColSpan && eLessonColSpan < eGroupColSpan) {
                    // в
                    result.lessonTaken = true;
                    result.leftGroupSolSpan = result.leftGroupSolSpan - (eLessonColSpan - sLessonColSpan);
                    result.subGroupNumber++;
                    result.lesson = lesson;
                    if (DEBUG_LOGS) console.log('v');
                } else if (eGroupColSpan > eLessonColSpan) {
                    // а
                    if (DEBUG_LOGS) console.log('a');
                    if (self.allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                        result.lesson = lesson;
                        if (DEBUG_LOGS) console.log('a-take');
                    }
                    result.lessonTaken = true;
                    result.leftGroupSolSpan = result.leftGroupSolSpan - (eLessonColSpan - sGroupColSpan);
                } else {
                    // б
                    if (DEBUG_LOGS) console.log('b');
                    if (self.allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                        result.lesson = lesson;
                        result.subGroupNumber++;
                        if (DEBUG_LOGS) console.log('b-take');
                    }
                    result.leftGroupSolSpan = result.leftGroupSolSpan - (eLessonColSpan - sGroupColSpan);
                }
            }
        }
        return result;
    };

};