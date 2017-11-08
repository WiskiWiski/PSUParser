const loger = require('./loger.js');
const pref = require('../preferences.js');

/* === MSG LOG STATUS === */
exports.MSG_STATUS_NONE = MSG_STATUS_NONE = 'msg_s_none';
exports.MSG_STATUS_ERROR = MSG_STATUS_ERROR = 'msg_s_error';
exports.MSG_STATUS_WARNING = MSG_STATUS_WARNING = 'msg_s_warning';

/* === MSG LOG CODE === */
/* must bee between 1000 - 2000 */
exports.MSG_CODE_NONE = MSG_CODE_NONE = -1;
exports.MSG_CODE_COLSPAN_LESSON_NOT_MATCH_GROUPS = MSG_CODE_COLSPAN_LESSS_NOT_MATCH_GROUPS = 1031;
exports.MSG_CODE_UNDEFINED_LESSON = MSG_CODE_UNDEFINED_LESSON = 1032;
exports.MSG_CODE_MORE_TWO_SUBROUPS = MSG_CODE_MORE_TWO_SUBROUPS = 1033;
exports.MSG_CODE_GROUPS_NOT_FOUND = MSG_CODE_GROUPS_NOT_FOUND = 1034;
exports.MSG_CODE_GROUPS_ROW_NOT_FOUND = MSG_CODE_GROUPS_ROW_NOT_FOUND = 1035;
exports.MSG_CODE_UNDEFINED_LESSONS_ROW = MSG_CODE_UNDEFINED_LESSONS_ROW = 1036;
exports.MSG_CODE_BAD_DAY_OR_DAY_LESSONS_ROWSPAN = MSG_CODE_BAD_DAY_OR_DAY_LESSONS_ROWSPAN = 1037;
exports.MSG_CODE_LESSONS_ROWSPAN_TOO_BIG = MSG_CODE_LESSONS_ROWSPAN_TOO_BIG = 1038;

const logObj = this;


exports.LogPosition = function LogPosition(pos) {
    const self = this;

    if (pos !== undefined){
        self.rowIndex = pos.rowIndex;
        self.cellIndex = pos.cellIndex;
        self.rowWeekColor = pos.rowWeekColor;
        self.rowWeekDay = pos.rowWeekDay;
        self.rowTime = pos.rowTime;
    } else {
        self.rowIndex = 0;
        self.cellIndex = 0;
        self.rowWeekColor = '';
        self.rowWeekDay = '';
        self.rowTime = '';
    }

    self.when = function () {
        return '[' + self.rowIndex + '] c:' + self.rowWeekColor + ' d:' + self.rowWeekDay + ' t:' + self.rowTime;
    };
};

exports.LogProgress = function LogProgress() {
    this.logPos = new logObj.LogPosition();

    let message; // техническая ошибка
    let displayText; // адаптированный тект
    let percent;
    let stage;

    this.setPercent = function (value) {
        if (value >= 0 && value <= 100) {
            percent = value;
        } else {
            throw new Error('The percent value must be between 0 and 100! \'' + value + '\' is incorrect!');
        }
    };

    this.getPercent = function () {
        return percent;
    };

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

    this.setStage = function (value) {
        if (value >= 1 && value <= 100) {
            stage = value;
        } else {
            throw new Error('The stage value must be between 1 and 100! \'' + value + '\' is incorrect!');
        }
    };

    this.getStage = function () {
        return stage;
    };


    this.toString = function () {
        return '[STAGE: ' + stage + ']: ' + percent.toFixed(2) + '% ' + message;
    };

    this.toJSON = function () {
        return {
            when: this.logPos.when(),
            stage: status,
            percent: percent,
            message: message || '',
            display_text: displayText || '',
        };
    }

};


exports.LogMessage = function LogMessage() {
    this.logPos = new logObj.LogPosition();

    let status = MSG_STATUS_NONE;
    let message; // техническая ошибка
    let displayText; // адаптированный тект
    let code = MSG_CODE_NONE;

    this.setErrorStatus = function () {
        status = MSG_STATUS_ERROR;
    };

    this.setWarningStatus = function () {
        status = MSG_STATUS_WARNING;
    };

    this.getStatus = function () {
        return status;
    };

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
        if (value >= 1000 && value <= 2000) {
            code = value;
        } else {
            throw new Error('The message code must be between 1000 and 2000! \'' + value + '\' is incorrect!');
        }
    };

    this.getCode = function () {
        return code;
    };

    this.toString = function (useColors) {
        let resStr;
        let statusStr;
        let color;

        switch (status) {
            case MSG_STATUS_WARNING:
                color = pref.FG_COLOR_ORAGE;
                statusStr = 'WARN';
                break;
            case MSG_STATUS_ERROR:
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
        return resStr;
    };

    this.toJSON = function () {
        return {
            when: this.logPos.when(),
            status: status,
            code: code,
            message: message || '',
            displayText: displayText || '',
        };
    }

};