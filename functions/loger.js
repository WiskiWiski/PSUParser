const pref = require('./preferences.js');

const loger = this;

const ABORT_ON_FATAL_ERROR = true;

exports.SUB_ROW_TITLE_A = 'a';
exports.SUB_ROW_TITLE_B = 'b';

exports.NAME_LOG_ERROR = NAME_LOG_ERROR = 'LogError';

exports.Loger = function Loger() {
    const self = this;
    this.logPos = new LogPosition();
    this.logs = [];

    let infoNumber = 0;
    let warningNumber = 0;
    let errorNumber = 0;

    this.log = function (logObj) {
        if (logObj instanceof loger.LogObject) {
            logObj.logPos = new LogPosition(self.logPos);
            self.logs.push(logObj);

            switch (Math.floor(logObj.getCode() / 1000)) {
                case 1:
                    infoNumber++;
                    break;
                case 2:
                    warningNumber++;
                    break;
                case 3:
                    errorNumber++;
                    if (ABORT_ON_FATAL_ERROR) {
                        // кртическая ошибка - прерывание обработки
                        const error = new Error('Fatal processing error!');
                        error.name = NAME_LOG_ERROR;
                        throw error;
                    }
                    break;
            }
        } else {
            throw  Error('Object to log must instance of LogObject!');
        }
    };

    this.getInfoNumber = function () {
        return infoNumber;
    };

    this.getWarningNumber = function () {
        return warningNumber;
    };

    this.getErrorNumber = function () {
        return errorNumber;
    };


    this.printLogs = function (useColors) {
        self.logs.forEach(function (logItem) {
            console.log(logItem.toString(useColors));
        });
    };

    this.logsToJSONList = function () {
        const finalArr = [];
        self.logs.forEach(function (logItem) {
            finalArr.push(logItem.toJSON());
        });
        return finalArr;
    };

};

exports.LogObject = function LogObject() {
    const self = this;
    this.logPos = new LogPosition();

    let message; // техническая ошибка
    let displayText; // адаптированный тект
    let payload; // дополнительная текстовая информация
    let code = -1;

    this.toShow = []; // какие координаты отображать в логах
    /*
        ri - tableRowIndex
        li - dayLessonIndex
        ci - cellIndex
        c - weekColor
        di - weekDayIndex
        t - row time
     */

    function buildPos() {
        const posJSON = {};

        if (self.toShow.length <= 0) {
            return posJSON;
        }

        let val;

        val = self.logPos.tableRowIndex;
        if (self.toShow.includes('ri') && val !== -1) {
            posJSON['tableRowIndex'] = self.logPos.tableRowIndex;
        }

        val = self.logPos.dayLessonIndex;
        if (self.toShow.includes('dl') && val !== -1) {
            posJSON['dayLessonIndex'] = self.logPos.dayLessonIndex;
        }

        val = self.logPos.tableCellIndex;
        if (self.toShow.includes('ci') && val !== -1) {
            posJSON['tableCellIndex'] = self.logPos.tableCellIndex;
        }

        val = self.logPos.subRow;
        if (self.toShow.includes('sb') && val !== null) {
            posJSON['subRow'] = self.logPos.subRow;
        }

        val = self.logPos.weekDayIndex;
        if (self.toShow.includes('di') && val !== -1) {
            posJSON['weekDayIndex'] = self.logPos.weekDayIndex;
        }

        val = self.logPos.rowTime;
        if (self.toShow.includes('t') && val !== null) {
            posJSON['rowTime'] = self.logPos.rowTime;
        }
        return posJSON;
    }

    this.setMessage = function (value) {
        if (typeof value !== 'string') {
            throw new Error('Message must be a string!');
        } else {
            message = value;
        }
    };

    this.getMessage = function () {
        return message;
    };

    this.setDisplayText = function (value) {
        if (typeof value !== 'string') {
            throw new Error('Display text must be a string!');
        } else {
            displayText = value;
        }
    };

    this.getDisplayText = function () {
        return displayText;
    };

    this.setCode = function (value) {
        if (value >= 1000 && value < 4000) {
            code = value;
        } else {
            throw new Error('The message code must be between 1000 and 4000! \'' + value + '\' is incorrect!');
        }
    };

    this.getCode = function () {
        return code;
    };

    this.setPayload = function (value) {
        payload = value;
    };

    this.getPayload = function (value) {
        return payload;
    };

    this.toString = function (useColors) {
        let resStr;
        let statusStr;
        let color;

        switch (Math.floor(code / 1000)) {
            case 1:
                color = pref.FG_COLOR_CYAN;
                statusStr = 'INFO';
                break;
            case 2:
                color = pref.FG_COLOR_ORAGE;
                statusStr = 'WARN';
                break;
            case 3:
                color = pref.FG_COLOR_RED;
                statusStr = 'ERR';
                break;
            default:
                color = pref.COLORS_DEFAULT;
                statusStr = 'NONE';
        }

        if (useColors === true) {
            resStr = color + '[' + statusStr + ':' + code + ']: ' + message + pref.COLORS_DEFAULT;
        } else {
            resStr = '[' + statusStr + ':' + code + ']: ' + message;
        }
        return (self.logPos.where() + "   " + resStr);
    };

    this.toJSON = function () {
        return {
            where: buildPos(),
            code: code,
            payload: payload,
            message: message || '',
            displayText: displayText || '',
        };
    }
};


function LogPosition(pos) {
    const self = this;

    if (pos !== undefined) {
        self.tableRowIndex = pos.tableRowIndex;
        self.tableCellIndex = pos.tableCellIndex;
        self.dayLessonIndex = pos.dayLessonIndex;
        self.subRow = pos.subRow;
        self.weekDayIndex = pos.weekDayIndex;
        self.rowTime = pos.rowTime;
    } else {
        self.tableRowIndex = -1;
        self.tableCellIndex = -1;
        self.dayLessonIndex = -1; // индекс строки с уроков относительно текущего дня
        self.subRow = null;
        self.weekDayIndex = -1; // индекс дня недели
        self.rowTime = null;
    }

    self.where = function () {
        return '[ri:' + self.tableRowIndex + ' ci:' + self.tableCellIndex + ' dl:' + self.dayLessonIndex +
            ' di:' + self.weekDayIndex + ' t:\"' + self.rowTime + '\" sb:' + self.subRow + ']';
    };
}