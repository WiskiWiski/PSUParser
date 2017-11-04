const lobjs = require('./lobjects.js');

/* === LOG TYPES === */
exports.LT_MSG = LT_MSG = 'lt_msg';
exports.LT_PROGRESS = LT_PROGRESS = 'lt_progress';


exports.Loger = function Loger() {
    const self = this;
    this.logs = [];

    this.log = function (logObj) {
        if (logObj instanceof lobjs.LogProgress) {
            self.logs.push({
                ltType: LT_PROGRESS,
                data: logObj
            });
        } else if (logObj instanceof lobjs.LogMessage) {
            self.logs.push({
                ltType: LT_MSG,
                data: logObj
            });
        } else {
            throw  Error('Object to log must instance of LogProgress or LogProgress!');
        }
    };


    this.printLogs = function (useColors, logsType) {
        if (logsType !== undefined && !self.isLogType(logsType)) {
            return;
        }
        self.logs.forEach(function (logItem) {
            if (logsType === undefined || (logsType !== undefined && logItem.ltType === logsType)) {
                console.log(logItem.data.toString(useColors));
            }
        });
    };

    this.logsToString = function (useColors, logsType, htmlString) {
        if (logsType !== undefined && !self.isLogType(logsType)) {
            return;
        }
        const newLine = htmlString ? '</br>' : '\n';
        let finalString = '';
        self.logs.forEach(function (logItem) {
            if (logsType === undefined || (logsType !== undefined && logItem.ltType === logsType)) {
                finalString = finalString + newLine + logItem.data.toString(useColors);
            }
        });
        return finalString;
    };

    this.logsToJSONList = function (logsType) {
        if (logsType !== undefined && !self.isLogType(logsType)) {
            return;
        }
        const finalArr = [];
        self.logs.forEach(function (logItem) {
            if (logsType === undefined || (logsType !== undefined && logItem.ltType === logsType)) {
                finalArr.push(logItem.data.toJSON());
            }
        });
        return finalArr;
    };

    this.isLogType = function (potentialLogType) {
        if (potentialLogType === LT_PROGRESS || potentialLogType === LT_MSG) {
            return true;
        } else {
            throw Error('Unknown log type!')
        }
    }


};
