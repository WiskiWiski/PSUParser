/* root parser */
const loger = require('../loger.js');
const pref = require('../preferences.js');
const utils = require('../p_utils.js');
const lessonParser = require('../p_lesson.js');

const ROW_TYPE_NONE = 'none';
const ROW_TYPE_SIMPLE_TIME_ROW = 'simple_time_row'; // для строк расписания без ячейки дня
const ROW_TYPE_EXTENDED_TIME_ROW = 'extended_time_row'; // для строк расписания с ячейкой дня
const ROW_TYPE_GROUP_ROW = 'group_row';
const ROW_TYPE_EMPTY_ROW = 'empty_row';
const ROW_TYPE_UNKNOWN_ROW = 'unknown_row';

function DoubleRowBuilder(mLoger, schedule) {
    const self = this;

    this.build = function (rowInfo) {
        const result = {};
        const secondRowExpected = rowInfo.secondRowExpected;

        let aSubRow = schedule[rowInfo.rowIndex];
        mLoger.logPos.tableRowIndex = rowInfo.rowIndex;
        mLoger.logPos.subRow = loger.SUB_ROW_TITLE_A;

        aSubRow = self._buildASubRow(result, aSubRow);
        analyzeRowForMultirowsCells(aSubRow, secondRowExpected);

        if (secondRowExpected) {
            let bSubRow = schedule[rowInfo.rowIndex + 1];
            mLoger.logPos.tableRowIndex = rowInfo.rowIndex + 1;
            mLoger.logPos.subRow = loger.SUB_ROW_TITLE_B;

            bSubRow = self._buildBSubRow(result, bSubRow);
            analyzeRowForMultirowsCells(bSubRow, secondRowExpected);

            const clearDoubleRow = buildClearDoubleRow(aSubRow, bSubRow);
            result['aSubRow'] = clearDoubleRow[0];
            result['bSubRow'] = clearDoubleRow[1];

        } else {
            result['aSubRow'] = aSubRow;
            result['bSubRow'] = aSubRow;
        }

        return result;
    };

    this._buildASubRow = function (result, sourceRow) {
        return sourceRow;
    };

    this._buildBSubRow = function (result, sourceRow) {
        return sourceRow;
    };

    // Вовзращает массив с ключами к логам, которые стоит показывать для текущей строки
    this._getToShow = function () {
        return ['ri', 't', 'sb', 'li'];
    };

    function buildClearDoubleRow(aSubRow, bSubRow) {
        const DEBUG_LOGS = false;

        const clearDoubleRow = [];

        let rowA = [];
        let rowB1 = [];
        let rowB2 = [];
        let subRow;

        // Цикл для обработки первичной и вторичной строки
        for (let i = 0; i < 2; i++) {
            if (i === 0) {
                mLoger.logPos.subRow = loger.SUB_ROW_TITLE_A;
                subRow = aSubRow;
            } else {
                mLoger.logPos.subRow = loger.SUB_ROW_TITLE_B;
                subRow = bSubRow;
            }
            const processRowA = i === 0;

            subRow.forEach(function (cell, k) {
                mLoger.logPos.tableCellIndex = k;
                cell['cellIndex'] = k;

                if (processRowA) {
                    // Обработка строки А
                    rowA.push(cell);
                    if (cell.height > 1) {
                        // Если ячейка строки А занимает строку B (rowspan = 2) заполняем B1
                        const greenCell = Object.assign({}, cell); // копирование ячейки
                        rowB1.push(greenCell);
                    }
                } else {
                    // Обработка строки B2
                    rowB2.push(cell);
                }
            });
        }
        clearDoubleRow[0] = rowA; // сохраняем строку А
        clearDoubleRow[1] = buildCleanBRow(rowA, rowB1, rowB2); // строим строку Б

        return clearDoubleRow;

        function buildCleanBRow(rowA, rowB1, rowB2) {
            /*
                       Метод сбора второстепенной строки расписани
                       Принимает главную строку из расписания (rowA)
                       и две второстепенные:
                           rowB1 - образованная от ячеек из rowA с rowSpan=2
                           rowB2 - образованная ячейками строки за rowA
                       Построенную второстепенную строку записывает в объект SubRows - timeRowSch
                    */

            let clearBSubRow = [];

            function printResA(res) {
                console.log('===========ARR================');
                res.forEach(function (item, index) {
                    console.log('Itm: %d [col=%d] \'%s\'', item.cellIndex, item.width, item.text);
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
                    if (item.cellIndex === index + takeFromB2Count) {
                        clearBSubRow.push(item);
                    } else {
                        takeFromB2Count++;
                        index--;
                        if (rowB2.length > 0) {
                            clearBSubRow.push(rowB2.splice(0, 1)[0]);
                        }
                    }
                }
                if (rowB2.length > 0) {
                    // записываем оставшиеся в rowB2 ячейки в результат
                    clearBSubRow = clearBSubRow.concat(rowB2)
                }


            } else if (cleanARowCount > rowB2.length) {
                // Случай - A
                if (DEBUG_LOGS) console.log('\nA-Type\n');

                let aItemIndex = 0;

                for (let index = 0; index < rowB2.length; index++) {
                    const item = rowB2[index];
                    let aItemSum = 0;
                    if (rowB1.length > 0 && aItemIndex === rowB1[0].cellIndex) {
                        clearBSubRow.push(rowB1.splice(0, 1)[0]);
                        aItemIndex++;
                        index--;
                    } else {
                        while (aItemIndex < rowA.length) {
                            const aItem = rowA[aItemIndex];
                            aItemIndex++;
                            aItemSum += aItem.width;
                            if (aItemSum >= item.width || aItemIndex + 1 === rowA.length) {
                                clearBSubRow.push(item);
                                break;
                            }
                        }
                    }

                }
                if (rowB1.length > 0) {
                    // записываем оставшиеся в rowB1 ячейки в результат
                    clearBSubRow = clearBSubRow.concat(rowB1)
                }
            } else if (cleanARowCount < rowB2.length) {
                // Случай - B
                if (DEBUG_LOGS) console.log('\nB-Type\n');

                let b2ItemIndex = 0;
                rowA.forEach(function (item, index) {
                    let b2ItemSum = 0;
                    if (rowB1.length > 0 && index === rowB1[0].cellIndex) {
                        rowB1.splice(0, 1);
                        clearBSubRow.push(item);
                    } else {
                        while (b2ItemIndex < rowB2.length) {
                            const b2Item = rowB2[b2ItemIndex];
                            b2ItemIndex++;
                            b2ItemSum += b2Item.width;
                            clearBSubRow.push(b2Item);
                            if (b2ItemSum >= item.width) {
                                break;
                            }
                        }
                    }

                });
            }

            if (DEBUG_LOGS) printResA(clearBSubRow);
            return clearBSubRow;
        }
    };

    // Поиск ячеек, выходящих за границы строки времени
    function analyzeRowForMultirowsCells(sourceRow, secondRowExpected) {
        const cellsNumber = sourceRow.length;
        for (let k = 0; k < cellsNumber; k++) {
            const cell = sourceRow[k];

            let logObj;
            if (secondRowExpected) {
                // двойная строка расписания: белая/зелёная
                if (cell.height > 2) {
                    logObj = new loger.LogObject();
                    logObj.setCode(3022);
                    logObj.setMessage('Ячейка двойной строки имеет высоту: ' + cell.height);
                    logObj.setDisplayText('Ячека занимет более 1 строки времени расписания.');
                }
            } else {
                // одиночная строка расписания: белая
                if (cell.height > 1) {
                    logObj = new loger.LogObject();
                    logObj.setCode(3012);
                    logObj.setMessage('Ячейка одиночной строки имеет высоту: ' + cell.height);
                    logObj.setDisplayText('Ячека занимет более 1 строки времени расписания.');
                }
            }

            if (logObj !== undefined) {
                logObj.toShow = self._getToShow();
                mLoger.log(logObj);
            }

        }
    }
}

function DoubleGroupRowBuilder() {
    DoubleRowBuilder.apply(this, arguments);

    this._buildASubRow = function (result, sourceRow) {
        return sourceRow.slice(2);
    };

}

function DoubleSimpleTimeRowBuilder(mLoger) {
    DoubleRowBuilder.apply(this, arguments);

    this._buildASubRow = function (result, sourceRow) {
        const time = sourceRow[0].text;
        mLoger.logPos.rowTime = time;
        result['time'] = time;
        const cells = sourceRow.slice(1);
        parseLessonCellsArray(mLoger, 1, cells);
        return cells;
    };

    this._buildBSubRow = function (result, sourceRow) {
        parseLessonCellsArray(mLoger, 0, sourceRow);
        return sourceRow;
    };

    this._getToShow = function () {
        return ['ri', 't', 'sb', 'li', 'di'];
    };

}

function DoubleExtendedTimeRowBuilder(mLoger) {
    DoubleRowBuilder.apply(this, arguments);

    this._buildASubRow = function (result, sourceRow) {
        result['day'] = sourceRow[0].text;

        const time = sourceRow[1].text;
        mLoger.logPos.rowTime = time;
        result['time'] = time;

        const cells = sourceRow.slice(2);
        parseLessonCellsArray(mLoger, 2, cells);
        return cells;
    };

    this._buildBSubRow = function (result, sourceRow) {
        parseLessonCellsArray(mLoger, 0, sourceRow);
        return sourceRow;
    };

    this._getToShow = function () {
        return ['ri', 't', 'sb', 'dl', 'di'];
    };
}

function parseLessonCellsArray(mLoger, skipped, cells) {
    if (cells === undefined) {
        return;
    }
    const toShow = ['t', 'ri', 'ci', 'dl', 'di', 'sb']; // какие данные записывать в логи при ошибках в parseCellContent()

    cells.forEach(function (cell, i) {
        mLoger.logPos.tableCellIndex = skipped + i;
        let content = cell.element.html();
        content = content.replace(/<\s*((br)|(p))\s*[\/]?>/gi, ' '); // замен <p> и <br> на пробел
        content = content.replace(/<[^>]*>/g, ''); // очиствка от каких-либо html тегов
        cell['cellLesson'] = lessonParser.parseCellContent(mLoger, content, toShow);
    });

}


exports.RootParser = function RootParser(mLoger, course, maxGroupNumb, html) {
    const self = this;

    this.readScheduleHTMLTable = function (html) {
        const scheduleTable = html('table').eq(1).children('tbody');
        const tableRows = [];
        scheduleTable.children('tr').each(function (k, elem) {
            const rowElement = scheduleTable.children(elem).first('tr');
            const rowCells = [];

            rowElement.children('td').each(function (k, elem) {
                const cellElement = rowElement.children(elem).first('td');

                rowCells[k] = {
                    height: getElementHeight(cellElement),
                    width: getElementWidth(cellElement),
                    element: cellElement,
                    text: cellElement.text().replace(/(\r\n|\n|\r)/gm, "").trim().replace(/\s\s+/gm, ' ')
                };
            });

            tableRows[k] = rowCells;
        });
        return tableRows;
    };
    let schedule = this.readScheduleHTMLTable(html);

    // Получение списка групп
    this.getGroups = function () {
        // получает список групп для расписания
        // возвращает массив объектов cell (с группами в ячейках)

        let groups = [];
        const rowNumber = schedule.length; // количество строк таблицы

        const doubleGroupRowBuilder = new DoubleGroupRowBuilder(mLoger, schedule);

        for (let groupsRowIndex = 0; groupsRowIndex < 6 && groupsRowIndex < rowNumber; groupsRowIndex++) {
            mLoger.logPos.tableRowIndex = groupsRowIndex;
            const rowInfo = self.getRowInfo(groupsRowIndex);
            if (rowInfo.type === ROW_TYPE_GROUP_ROW) {
                const clearDoubleGroupsRow = doubleGroupRowBuilder.build(rowInfo);
                groups = clearDoubleGroupsRow.bSubRow.map(function (element) {
                    if (pref.CONSOLE_LOGS_ENABLE) console.log('groups [width=%d] : %s', element.width, element.text);
                    if (!isCorrectFirebaseKey(element.text)) {
                        const logObj = new loger.LogObject();
                        logObj.setCode(3002);
                        logObj.toShow = ['ri'];
                        logObj.setMessage('Ячейка группы содержит недопустимый символ или пустая: \'' + element.text + '\'');
                        logObj.setDisplayText('Проверьте правильность оформления групп в таблице.');
                        logObj.setPayload(element.text);
                        mLoger.log(logObj);
                    }
                    return element;
                });

                if (pref.CONSOLE_LOGS_ENABLE) console.log();
                break;
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

    function isCorrectFirebaseKey(key) {
        if (key === undefined || key === null || key.trim() === '') {
            return false;
        }

        const denySymbols = ['[', ']', '.', '/', '$', '#'];
        denySymbols.forEach(function (s) {
            if (key.includes(s)) {
                return false;
            }
        });

        return true;
    }

    this.getRowInfo = function (rowIndex) {
        let resultType = {
            rowIndex: rowIndex,
            type: ROW_TYPE_NONE,
            secondRowExpected: false
        };

        let allCellsEmpty = true;

        const row = schedule[rowIndex];
        for (let k = 0; k < row.length; k++) {
            const cell = row[k];
            mLoger.logPos.tableCellIndex = k;

            if (resultType.secondRowExpected && resultType.type !== ROW_TYPE_NONE) {
                return resultType;
            }

            if (allCellsEmpty && cell.text.trim() !== '') {
                allCellsEmpty = false;
            }

            if (cell.text.toLowerCase().indexOf('часы') !== -1) {
                // Если текущая ячейка "Часы" - строка с группами
                resultType.type = ROW_TYPE_GROUP_ROW;

                // Определение наличия второй подстроки
                resultType.secondRowExpected = isSecondRowExpected(cell.height);
                break;
            }

            if (isTimeCell(cell.text)) {
                // ячейка со временем
                if (k === 1) {
                    // если перед обнаружением TimeCell была только одна ячейка,то данная строка содержит день недели
                    resultType.type = ROW_TYPE_EXTENDED_TIME_ROW;
                } else {
                    resultType.type = ROW_TYPE_SIMPLE_TIME_ROW;
                }
                resultType.secondRowExpected = isSecondRowExpected(cell.height);
                break;
            }
        }

        if (allCellsEmpty) {
            resultType.type = ROW_TYPE_EMPTY_ROW;
            const logObj = new loger.LogObject();
            logObj.setCode(2001);
            logObj.toShow = ['ri', 'di', 'dl'];
            logObj.setDisplayText('Найдена пустая строка');
            logObj.setMessage('Найдена пустая строка');
            mLoger.log(logObj);
        } else if (resultType.type === ROW_TYPE_NONE) {
            // если после анализа всех ячееек строки талицы, тип остался неизвестен
            resultType.type = ROW_TYPE_UNKNOWN_ROW;

            const logObj = new loger.LogObject();
            logObj.setCode(3004);
            logObj.toShow = ['ri', 'di', 'dl'];
            logObj.setDisplayText('Не удалось определить тип строки');
            logObj.setMessage('Не удалось определить тип строки');
            mLoger.log(logObj);
        }

        return resultType;

        function isSecondRowExpected(height) {
            // Определение наличия второй подстроки
            switch (height) {
                case 1:
                    return false;
                case 2:
                    return true;
                default:
                    const logObj = new loger.LogObject();
                    logObj.setCode(3003);
                    logObj.toShow = ['ri', 'di', 'ci', 'dl'];
                    logObj.setMessage('Проверьте праивльность оформления строки! Высота ячейки:' + height);
                    logObj.setDisplayText('Проверьте праивльность оформления строки!');
                    mLoger.log(logObj);

                    return false;
            }
        }

        function isTimeCell(cellText) {
            // проверка значения ячейки на содержание (1-9 или . или , или пробела)
            return utils.REG_EXPRESSION_FOR_DATE_CELL.test(cellText);
        }
    };

    function getElementHeight(htmlElement) {
        let cellHeight = parseInt(htmlElement.attr('rowspan'));
        if (isNaN(cellHeight)) {
            return 1;
        }
        return cellHeight;
    }

    function getElementWidth(htmlElement) {
        let cellWidth = parseInt(htmlElement.attr('colspan'));
        if (isNaN(cellWidth)) {
            return 1;
        }
        return cellWidth;
    }

    // Возвращает двумерный массив со строками для каждого дня
    this.getTimeRows = function () {
        // Возвращает двумерный массив
        // Массив данных для строки для каждого дня недели

        const DEBUG_LOGS = false;

        const days = [];
        let dayRows = [];

        const rowNumber = schedule.length; // количество строк таблицы

        for (let k = 0; k < rowNumber && days.length <= 6; k++) {
            mLoger.logPos.tableRowIndex = k;
            mLoger.logPos.weekDayIndex = days.length;
            mLoger.logPos.dayLessonIndex = dayRows.length;

            const rowInfo = self.getRowInfo(k);

            if (dayRows.length > 0 && rowInfo.type === ROW_TYPE_EXTENDED_TIME_ROW) {
                days.push(dayRows);
                dayRows = [];
                mLoger.logPos.weekDayIndex = days.length;
                mLoger.logPos.dayLessonIndex = 0;
                if (DEBUG_LOGS) console.log('============ DAY ' + (days.length + 1) + ' ============');
            }
            if (DEBUG_LOGS) console.log('row: %d; type: %s', k, rowInfo.type);

            const doubleSimpleTimeRowBuilder = new DoubleSimpleTimeRowBuilder(mLoger, schedule);
            const doubleExtendedTimeRowBuilder = new DoubleExtendedTimeRowBuilder(mLoger, schedule);
            if (rowInfo.type === ROW_TYPE_SIMPLE_TIME_ROW || rowInfo.type === ROW_TYPE_EXTENDED_TIME_ROW) {
                let clearDoubleTimeRow;
                switch (rowInfo.type) {
                    case ROW_TYPE_SIMPLE_TIME_ROW:
                        clearDoubleTimeRow = doubleSimpleTimeRowBuilder.build(rowInfo);
                        break;
                    case ROW_TYPE_EXTENDED_TIME_ROW:
                        clearDoubleTimeRow = doubleExtendedTimeRowBuilder.build(rowInfo);
                        break;
                }
                dayRows.push(clearDoubleTimeRow);
            }

            if (rowInfo.secondRowExpected) {
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
        // row - объект из buildDoubleRow
        // groups - массив ячерек(cell) групп

        if (row === undefined) {
            return {};
        }

        const result = {};

        const groupsColSpan = calculateCellsColSpan(groups);

        for (let k = 0; k < 2; k++) {
            let subRow;
            let subRowTitle;
            let bgWeekColor;
            let fgWeekColor;

            if (k === 0) {
                subRow = row.aSubRow;
                subRowTitle = loger.SUB_ROW_TITLE_A;
                if (pref.CONSOLE_LOGS_ENABLE) {
                    bgWeekColor = pref.BG_COLOR_WHITE;
                    fgWeekColor = pref.FG_COLOR_MARGENTA;
                    console.log(pref.FG_COLOR_BLUE + pref.STYLE_BRIGHT + pref.STYLE_BLINK + pref.STYLE_UNDERSCORE +
                        "\n================ TIME: %s ================" + pref.COLORS_DEFAULT, row.time);
                }
            } else {
                subRowTitle = loger.SUB_ROW_TITLE_B;
                subRow = row.bSubRow;
                if (pref.CONSOLE_LOGS_ENABLE) {
                    bgWeekColor = pref.BG_COLOR_GREEN;
                    fgWeekColor = pref.FG_COLOR_WHITE;
                    console.log(' ------------------------- ');
                }
            }
            mLoger.logPos.subRow = subRowTitle;


            const subRowColSpan = calculateCellsColSpan(subRow);
            if (groupsColSpan !== subRowColSpan) {
                const logObj = new loger.LogObject();
                logObj.toShow = ['sb', 'di', 't', 'dl'];
                logObj.setMessage('Ширина предметов (' + subRowColSpan + ') не совпадает с шириной групп (' +
                    groupsColSpan + ')');
                logObj.setDisplayText('Границы строки не совпадают с грацицами групп. ' +
                    'Выполните пункт 4. и проверьте правильность соответствия колонок расписания их группам.');
                logObj.setCode(2002);
                mLoger.log(logObj);
            }

            const linked = self.linkLessonsGroupsForSubRow(maxGroupNumb, subRow, groups);
            result[subRowTitle] = linked;

            if (pref.CONSOLE_LOGS_ENABLE) {
                linked.forEach(function (groupObject) {
                    groupObject.lessons.forEach(function (subGroupLesson, subGroupN) {
                        console.log(fgWeekColor + bgWeekColor + subRowTitle.charAt(0) + pref.COLORS_DEFAULT +
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