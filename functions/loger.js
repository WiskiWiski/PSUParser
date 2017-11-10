const pref = require('./preferences.js');

const loger = this;

const ABORT_ON_FATAL_ERROR = true;

exports.NAME_LOG_ERROR = NAME_LOG_ERROR = 'LogError';

exports.Loger = function Loger() {
    const self = this;
    this.logPos = new LogPosition();
    this.logs = [];

    this.msgNumber = 0;
    this.warningNumber = 0;
    this.errorNumber = 0;

    this.log = function (logObj) {
        if (logObj instanceof loger.LogObject) {
            logObj.logPos = new LogPosition(self.logPos);
            self.logs.push(logObj);

            switch (Math.floor(logObj.getCode() / 1000)) {
                case 1:
                    self.msgNumber++;
                    break;
                case 2:
                    self.warningNumber++;
                    break;
                case 3:
                    self.errorNumber++;
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
    let code = -1;

    this.toShow = []; // какие координаты отображать в логах
    /*
        ri - htmlRowIndex
        li - lessonRowIndex
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

        if (self.toShow.includes('ri')) {
            posJSON['htmlRowIndex'] = self.logPos.htmlRowIndex;
        }

        if (self.toShow.includes('li')) {
            posJSON['lessonRowIndex'] = self.logPos.lessonRowIndex;
        }

        if (self.toShow.includes('ci')) {
            posJSON['htmlCellIndex'] = self.logPos.htmlCellIndex;
        }

        if (self.toShow.includes('c')) {
            posJSON['rowWeekColor'] = self.logPos.rowWeekColor;
        }

        if (self.toShow.includes('di')) {
            posJSON['weekDayIndex'] = self.logPos.weekDayIndex;
        }

        if (self.toShow.includes('t')) {
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

    this.toString = function (useColors) {
        let resStr;
        let statusStr;
        let color;

        switch (Math.floor(code / 1000)) {
            case 1:
                color = pref.COLORS_DEFAULT;
                statusStr = 'MSG';
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
        return (self.logPos.when() + "   " + resStr);
    };

    this.toJSON = function () {
        return {
            when: buildPos(),
            code: code,
            message: message || '',
            displayText: displayText || '',
        };
    }
};


function LogPosition(pos) {
    const self = this;

    if (pos !== undefined) {
        self.htmlRowIndex = pos.htmlRowIndex;
        self.lessonRowIndex = pos.lessonRowIndex;
        self.htmlCellIndex = pos.htmlCellIndex;
        self.rowWeekColor = pos.rowWeekColor;
        self.rowTime = pos.rowTime;
        self.weekDayIndex = pos.weekDayIndex;
    } else {
        self.htmlRowIndex = -1;
        self.htmlCellIndex = -1;
        self.lessonRowIndex = -1; // индекст строки с уроков относительно текущего дня
        self.rowWeekColor = null;
        self.weekDayIndex = -1;
        self.rowTime = null;
    }

    self.when = function () {
        return '[ri:' + self.htmlRowIndex + ' li:' + self.lessonRowIndex + ' ci:' + self.htmlCellIndex + '] c:' + self.rowWeekColor +
            ' di:' + self.weekDayIndex + ' t:' + self.rowTime;
    };
}