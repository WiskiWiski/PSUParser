/* root parser */
const loger = require('../loger.js');
const pref = require('../preferences.js');
const utils = require('../p_utils.js');

const ROW_TYPE_NONE = 'none';
const ROW_TYPE_SIMPLE_TIME_ROW = 'simple_time_row'; // для строк расписания без ячейки дня
const ROW_TYPE_EXTENDED_TIME_ROW = 'extended_time_row'; // для строк расписания с ячейкой дня
const ROW_TYPE_GROUP_ROW = 'group_row';
const ROW_TYPE_UNKNOWN_ROW = 'empty_row';


exports.RootParser = function RootParser(course, maxGroupNumb, html, mLoger) {
    const self = this;

    this.getScheduleTable = function (html) {
        return html('table').eq(1).children('tbody');
    };
    let scheduleTable = this.getScheduleTable(html);

    // Получение списка групп
    this.getGroups = function () {
        // получает список групп для расписания
        // возвращает массив объектов cell (с группами в ячейках)

        let groups = [];
        const rowCount = scheduleTable.children('tr').length; // количество строк html таблицы

        for (let groupsRowIndex = 0; groupsRowIndex < 6 && groupsRowIndex < rowCount; groupsRowIndex++) {

            const rowInfo = self.getRowInfo(groupsRowIndex);
            if (rowInfo.type === ROW_TYPE_GROUP_ROW) {
                const groupsSubRows = self.parseRow(rowInfo);
                if (!groupsSubRows.hasBRow) {
                    groups = groupsSubRows.aSubRow;
                } else {
                    groups = groupsSubRows.bSubRow;
                }

                if (pref.CONSOLE_LOGS_ENABLE) {
                    groups.forEach(function (el) {
                        console.log('groups [col=%d] : %s', el.width, el.text);
                    });
                    console.log();
                }
            }
        }

        if (groups.length === 0) {
            // Groups has not be found!
            const logObj = new loger.LogObject();
            logObj.setMessage('Groups row has not found!');
            logObj.setDisplayText('Не удалось распознать строку с группами.');
            logObj.setCode(3001);
            mLoger.log(logObj);
        }
        return groups;
    };

    // Считывает всю возможную информацию со строки с индексом htmlARowIndex
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
                cells: [],
                skipColonsN: 0,
            },
            bSubRow: {
                cells: [],
                skipColonsN: 0
            },
        };

        let subRow;
        let row;

        for (let i = 0; i < 1 || (result.hasBRow && i < 2); i++) {
            if (i === 0) {
                mLoger.logPos.rowWeekColor = pref.WEEK_TITLE_WHITE;
                mLoger.logPos.htmlRowIndex = htmlARowIndex;
                subRow = SUBROW_A;
                row = result.aSubRow;
            } else {
                mLoger.logPos.rowWeekColor = pref.WEEK_TITLE_GREEN;
                mLoger.logPos.htmlRowIndex = htmlARowIndex + 1;
                subRow = SUBROW_B;
                row = result.bSubRow;
            }
            const htmlTimeRow = scheduleTable.children('tr').eq(htmlARowIndex + i);

            htmlTimeRow.children('td').each(function (k, elem) {
                mLoger.logPos.htmlCellIndex = k;

                const cellElement = htmlTimeRow.children(elem).first('td');
                const cell = buildCell(k, cellElement);
                row.cells.push(cell);

                if (isClockCell(cell.text)) {
                    // Если строка с группами и текущая ячейка "Часы"

                    result.type = ROW_TYPE_GROUP_ROW;
                    row.skipColonsN++;

                    if (cell.height >= 2) {
                        result.hasBRow = true;
                    }

                } else if (subRow === SUBROW_A) {
                    // Если любая другая ячейка : подстрока А
                    if (isTimeCell(cell.text)) {
                        // ячейка со временем

                        if (cell.height >= 2) {
                            result.hasBRow = true;
                        }

                        if (row.skipColonsN === 1) {
                            // если перед обнаружением TimeCell была только одна ячейка,то данная строка содержит день недели
                            const previewCellElement = htmlTimeRow.children('td').eq(k - 1); // предыдущая ячейка
                            result.data['day'] = utils.htmlToText(previewCellElement.html());
                            result.type = ROW_TYPE_EXTENDED_TIME_ROW;
                        } else {
                            result.type = ROW_TYPE_SIMPLE_TIME_ROW;
                        }
                        row.skipColonsN++;

                        result.data['time'] = cell.text.replace('\n', ' ');

                    }
                }
                if (subRow === SUBROW_A && result.type === ROW_TYPE_NONE) {
                    // если еще не определили какого типа строка и ячейка пустая - прибовляем индекс для пропуска ячейки
                    row.skipColonsN++;
                }
            });
        }

        if (result.type === ROW_TYPE_NONE) {
            // если после анализа всех ячееек html-строки, тип остался неизвестен
            result.type = ROW_TYPE_UNKNOWN_ROW;
        }
        return result;

        function buildCell(index, cellElement) {
            return {
                index: index,
                height: getCellHeight(cellElement),
                width: getCellWidth(cellElement),
                element: cellElement,
                text: utils.htmlToText(cellElement.html())
            };

            function getCellHeight(htmlElement) {
                let cellHeight = parseInt(htmlElement.attr('rowspan'));
                if (isNaN(cellHeight)) {
                    return 1;
                }
                return cellHeight;
            }

            function getCellWidth(htmlElement) {
                let cellWidth = parseInt(htmlElement.attr('colspan'));
                if (isNaN(cellWidth)) {
                    return 1;
                }
                return cellWidth;
            }
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

        const DEBUG_LOGS = false;

        function printResA(res) {
            console.log('===========ARR================');
            res.forEach(function (item, index) {
                console.log('Itm: %d [col=%d] \'%s\'', item.index, item.width, item.text);
            });
        }

        if (DEBUG_LOGS) {
            console.log('\n\nrowA: ');
            printResA(rowA);
            console.log('\nrowB1: ');
            printResA(rowB1);
            console.log('\nrowB2: ');
            printResA(rowB2);
        }

        const cleanARowCount = rowA.length - rowB1.length;
        if (cleanARowCount === rowB2.length) {
            // Случай - simple
            if (DEBUG_LOGS) console.log('\nSIMPLE-Type\n');
            let takeFromB2Count = 0;
            let item;
            for (let index = 0; index < rowB1.length; index++) {
                item = rowB1[index];
                if (item.index === index + takeFromB2Count) {
                    timeRowSch.bSubRow.push(item);
                } else {
                    takeFromB2Count++;
                    index--;
                    if (rowB2.length > 0) {
                        timeRowSch.bSubRow.push(rowB2.splice(0, 1)[0]);
                    }
                }
            }
            if (rowB2.length > 0) {
                // записываем оставшиеся в rowB2 ячейки в результат
                timeRowSch.bSubRow = timeRowSch.bSubRow.concat(rowB2)
            }


        } else if (cleanARowCount > rowB2.length) {
            // Случай - A
            if (DEBUG_LOGS) console.log('\nA-Type\n');

            let aItemIndex = 0;

            for (let index = 0; index < rowB2.length; index++) {
                const item = rowB2[index];
                let aItemSum = 0;
                if (rowB1.length > 0 && aItemIndex === rowB1[0].index) {
                    timeRowSch.bSubRow.push(rowB1.splice(0, 1)[0]);
                    aItemIndex++;
                    index--;
                } else {
                    while (aItemIndex < rowA.length) {
                        const aItem = rowA[aItemIndex];
                        aItemIndex++;
                        aItemSum += aItem.width;
                        if (aItemSum >= item.width || aItemIndex + 1 === rowA.length) {
                            timeRowSch.bSubRow.push(item);
                            break;
                        }
                    }
                }

            }
            if (rowB1.length > 0) {
                // записываем оставшиеся в rowB1 ячейки в результат
                timeRowSch.bSubRow = timeRowSch.bSubRow.concat(rowB1)
            }
        } else if (cleanARowCount < rowB2.length) {
            // Случай - B
            if (DEBUG_LOGS) console.log('\nB-Type\n');

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
                        b2ItemSum += b2Item.width;
                        timeRowSch.bSubRow.push(b2Item);
                        if (b2ItemSum >= item.width) {
                            break;
                        }
                    }
                }

            });
        }

        if (DEBUG_LOGS) printResA(timeRowSch.bSubRow);
    };

    // Возвращает объект содержащий строку А и B(см. timeRow obj)
    this.parseRow = function (timeRowInfo) {
        // Результирующий объект:
        // aSubRow & bSubRow содержат объекты cell: height, width, element, text (cm getRowInfo -> buildCell)
        const timeRow = {
            hasBRow: false,
            aSubRow: [],
            bSubRow: [],
            time: null
        };

        switch (timeRowInfo.type) {
            case ROW_TYPE_NONE:
            case ROW_TYPE_UNKNOWN_ROW:
                const logObj = new loger.LogObject();
                logObj.setCode(2001);
                logObj.setDisplayText('Не удалось распознать тип строки');
                logObj.setMessage('Не удалось распознать тип строки: parseRow()');
                mLoger.log(logObj);
                return timeRow;
                break;
            case ROW_TYPE_GROUP_ROW:
            case ROW_TYPE_EXTENDED_TIME_ROW:
            case ROW_TYPE_SIMPLE_TIME_ROW:
                timeRow.time = timeRowInfo.data.time;

                let rowA = [];
                let rowB1 = [];
                let rowB2 = [];
                let subRow;

                // Цикл для обработки первичной и вторичной строки
                for (let i = 0; i < 1 || (timeRowInfo.hasBRow && i < 2); i++) {
                    if (i === 0) {
                        mLoger.logPos.rowWeekColor = pref.WEEK_TITLE_WHITE;
                        subRow = timeRowInfo.aSubRow;
                    } else {
                        mLoger.logPos.rowWeekColor = pref.WEEK_TITLE_GREEN;
                        subRow = timeRowInfo.bSubRow;
                    }
                    const processRowA = i === 0;


                    subRow.cells.forEach(function (cell, k) {
                        // пропускаем ячейки и компенсируем индекс
                        if (k < subRow.skipColonsN) {
                            return;
                        } else {
                            mLoger.logPos.htmlCellIndex = k;
                            k = k - subRow.skipColonsN;
                            cell.index = k; // переписываем индексы ячеек с учётом пропускаемых ячеек
                            // до переписи индекс отчситывался с начала таблицы
                            // после - от первой ячейки передмета
                        }

                        if (processRowA) {
                            // Обработка строки А
                            rowA.push(cell);
                            if (cell.height > 1) {
                                if (cell.height > 2 || (cell.height > 1 && !timeRowInfo.hasBRow)) {
                                    // ячека занимет более 2 строк расписания
                                    const logObj = new loger.LogObject();
                                    logObj.toShow = ['ri', 'ci', 't', 'c', 'di'];
                                    logObj.setCode(3002);
                                    logObj.setMessage('Ячейка строки B-subRow(' + timeRowInfo.hasBRow + ') имеет rowSpan = ' + cell.height);
                                    logObj.setDisplayText('Ячека занимет более 1 строки расписания.');
                                    mLoger.log(logObj);
                                } else {
                                    // Если ячейка строки А занимает строку B (rowspan = 2) заполняем B1
                                    const greenCell = Object.assign({}, cell); // копирование ячейки
                                    rowB1.push(greenCell);
                                }
                            }
                        } else {
                            // Обработка строки B2
                            rowB2.push(cell);
                        }
                    });
                }
                timeRow.aSubRow = rowA; // сохраняем строку А

                if (timeRowInfo.hasBRow) {
                    timeRow.hasBRow = true;
                    self.buildCleanBRow(timeRow, rowA, rowB1, rowB2); // строим строку Б
                } else {
                    timeRow.bSubRow = rowA; // сохраняем строку А как B
                }
                return timeRow;
                break;
        }
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
            mLoger.logPos.htmlRowIndex = k;
            mLoger.logPos.weekDayIndex = dayRows.length;

            const rowInfo = self.getRowInfo(k);
            const rowType = rowInfo.type;
            if (dayRows.length > 0 && rowType === ROW_TYPE_EXTENDED_TIME_ROW) {
                days.push(dayRows);
                dayRows = [];
                if (DEBUG_LOGS) console.log('============ DAY ' + (days.length + 1) + ' ============');
            }


            if (rowType === ROW_TYPE_SIMPLE_TIME_ROW || rowType === ROW_TYPE_EXTENDED_TIME_ROW) {
                mLoger.logPos.rowTime = rowInfo.data.time;

                const row = self.parseRow(rowInfo);
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

    // Связывает ячейки строки с группами для зелёной и белой недели
    this.linkLessonsGroupsForRow = function (row, groups) {
        // row - объект из parseRow
        // groups - массив ячерек(cell) групп

        if (row === undefined) {
            return {};
        }

        const result = {};

        const groupsColSpan = calculateCellsColSpan(groups);

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
            mLoger.logPos.rowWeekColor = weekColorTitle;


            const subRowColSpan = calculateCellsColSpan(subRow);
            if (groupsColSpan !== subRowColSpan) {
                const logObj = new loger.LogObject();
                logObj.toShow = ['c', 'di', 't', 'li'];
                logObj.setMessage('Lessons colspan not match with groups colspan: ' + subRowColSpan
                    + ' vs ' + groupsColSpan);
                logObj.setDisplayText('Границы строки не совпадают с грацицами групп. ' +
                    'Выполните пункт 4. и проверьте правильность соответствия колонок расписания их группам.');
                logObj.setCode(2002);
                mLoger.log(logObj);
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

        // Посчитываем суммарное значение colSpan для массива объектов cell
        function calculateCellsColSpan(subRow) {
            let sum = 0;
            subRow.forEach(function (cell) {
                sum += cell.width;
            });
            return sum;
        }
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
            if (DEBUG_LOGS) console.log('[%d]: %d - %s', k, lesson.width, lesson.text)
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
            const eGroupColSpan = data.sGroupColSpan + group.width; // значение конца группы

            let groupColSpan = group.width;
            const colSpans = {
                sGroupColSpan: sGroupColSpan, // значение начала группы
                eGroupColSpan: eGroupColSpan, // значение конца группы
                sLessonColSpan: 0, // значение начала урока
                eLessonColSpan: 0// значение конца урока
            };

            for (data.lessonTaken; data.lessonTaken < subRow.length;) {
                colSpans.sLessonColSpan = data.sLessonColSpan; // установка значение начала урока
                colSpans.eLessonColSpan = data.sLessonColSpan + subRow[data.lessonTaken].width; // установка значение конца урока

                const pResult = self.groupsAndLessonsProcess(maxGroupNumb, colSpans, groupColSpan, subRow[data.lessonTaken]);
                groupColSpan = pResult.leftGroupSolSpan; // обновление оставщегося свободного места для группы

                if (pResult.lessonTaken) {
                    // текущий урок использован,
                    // при следующих итерациях используем другой
                    data.sLessonColSpan += subRow[data.lessonTaken].width;
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
            const eGroupColSpan = data.sGroupColSpan + group.width; // значение конца группы

            let groupColSpan = group.width;
            const colSpans = {
                sGroupColSpan: sGroupColSpan, // значение начала группы
                eGroupColSpan: eGroupColSpan, // значение конца группы
                sLessonColSpan: 0, // значение начала урока
                eLessonColSpan: 0// значение конца урока
            };

            for (data.lessonTaken; data.lessonTaken < subRow.length;) {
                const lesson = subRow[subRow.length - 1 - data.lessonTaken];

                colSpans.sLessonColSpan = data.sLessonColSpan; // установка значение начала урока
                colSpans.eLessonColSpan = data.sLessonColSpan + lesson.width; // установка значение конца урока

                const pResult = self.groupsAndLessonsProcess(maxGroupNumb, colSpans, groupColSpan, lesson);
                groupColSpan = pResult.leftGroupSolSpan; // обновление оставщегося свободного места для группы

                if (pResult.lessonTaken) {
                    // текущий урок использован,
                    // при следующих итерациях используем другой
                    data.sLessonColSpan += lesson.width;
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
                    if (allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                        result.lesson = lesson;
                        if (DEBUG_LOGS) console.log('a-take');
                    }
                    result.lessonTaken = true;
                    result.leftGroupSolSpan = result.leftGroupSolSpan - (eLessonColSpan - sGroupColSpan);
                } else {
                    // б
                    if (DEBUG_LOGS) console.log('b');
                    if (allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan)) {
                        result.lesson = lesson;
                        result.subGroupNumber++;
                        if (DEBUG_LOGS) console.log('b-take');
                    }
                    result.leftGroupSolSpan = result.leftGroupSolSpan - (eLessonColSpan - sGroupColSpan);
                }
            }
        }
        return result;

        function allowOverBorders(maxGroupNumb, sGroupColSpan, eGroupColSpan, sLessonColSpan, eLessonColSpan) {
            const requiredPresent = (100 / maxGroupNumb);
            const groupColSpan = eGroupColSpan - sGroupColSpan;
            const lessonOverBorders = (sLessonColSpan > sGroupColSpan ? eGroupColSpan - sLessonColSpan : eLessonColSpan - sGroupColSpan);
            return lessonOverBorders * 100 / groupColSpan >= requiredPresent || lessonOverBorders > (eLessonColSpan - sLessonColSpan) / 2;
        }
    };

};