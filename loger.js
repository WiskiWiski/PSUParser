const shared = require('./parsers/prs_shared.js');

let logs = [];


module.exports.CL_LOG = CL_LOG = 'cl_log';
module.exports.CL_PROGRESS = CL_PROGRESS = 'cl_progress';
module.exports.CL_FINISH = CL_FINISH = 'cl_finish';


module.exports.OPS_STATUS_NONE = OPS_STATUS_NONE = 'none';
module.exports.OPS_STATUS_ERROR = OPS_STATUS_ERROR = 'error';
module.exports.OPS_STATUS_WARNING = OPS_STATUS_WARNING = 'warning';

module.exports.OPS_CODE_NONE = OPS_CODE_NONE = -1;
module.exports.OPS_CODE_COLSPAN_LESSS_NOT_MATCH_GROUPS = 31;
module.exports.OPS_CODE_UNDEFINED_LESSON = 32;
module.exports.OPS_CODE_MORE_TWO_SUBROUPS = 33;
module.exports.OPS_CODE_GROUPS_NOT_FOUND = 34;
module.exports.OPS_CODE_GROUPS_ROW_NOT_FOUND = 35;


function logObjToString(logObj, useColors) {
    //console.log('%s[%s: %d]: %s%s', color, logObj.status.toUpperCase(), logObj.code, logObj.message, shared.DEFAUL_COLORS);
    if (useColors) {
        let color = shared.DEFAUL_COLORS;
        switch (logObj.status) {
            case OPS_STATUS_WARNING:
                color = shared.WARNING_COLOR;
                break;
            case OPS_STATUS_ERROR:
                color = shared.ERROR_COLOR;
                break;
        }
        return color + '[' + logObj.status.toUpperCase() + ': ' + logObj.code + ']: ' + logObj.message + shared.DEFAUL_COLORS;

    } else {
        return '[' + logObj.status.toUpperCase() + ': ' + logObj.code + ']: ' + logObj.message;

    }
}

function progressObjToString(progressObj, useColors) {
    //console.log('%s [STAGE:%d]: %d% %s %s', '\x1b[45m', progressObj.stage, progressObj.percent.toFixed(2), progressObj.title, shared.DEFAUL_COLORS);
    if (useColors) {
        return '\x1b[45m' + '[STAGE:' + progressObj.stage + ']: ' + progressObj.percent.toFixed(2) + '% ' + progressObj.title + shared.DEFAUL_COLORS;
    } else {
        return '[STAGE:' + progressObj.stage + ']: ' + progressObj.percent.toFixed(2) + '% ' + progressObj.title;
    }
}

module.exports.printLogs = function printLogs(clType) {
    let printedCount = 0;
    logs.forEach(function (item) {
        if (clType === undefined || item.clType === clType) {
            printedCount++;
            switch (item.clType) {
                case CL_LOG:
                    console.log(logObjToString(item.data, true));
                    break;
                case CL_PROGRESS:
                    console.log(progressObjToString(item.data, true));
                    break;
                case CL_FINISH:
                    console.log('Finish!');
                    break;
                default:
                    console.log('Unknown CL-Type: %s', item.clType);
            }
        }
    });
};

module.exports.newLogObj = function newLogObject() {
    return {
        status: OPS_STATUS_NONE,
        message: null,
        code: OPS_CODE_NONE,
        statusError: function () {
            this.status = OPS_STATUS_ERROR;
        },
        statusWarning: function () {
            this.status = OPS_STATUS_WARNING;
        }
    }
};

module.exports.newProgressObj = function newProgressObj() {
    return {
        title: null,
        percent: 0,
        stage: 0
    };
};

module.exports.finish = function finish() {
    const l = {
        clType: CL_FINISH,
        data: null
    };
    logs.push(l);
    sendToClient(l);
};

module.exports.updateProgress = function updateProgress(progressObj) {
    const l = {
        clType: CL_PROGRESS,
        data: progressObj
    };
    logs.push(l);
    sendToClient(l);
};

module.exports.sendLog = function sendLogs(logObj) {
    const l = {
        clType: CL_LOG,
        data: logObj
    };
    logs.push(l);
    sendToClient(l);
};


function sendToClient(clientLog) {

}

module.exports.clearLogs = function clearLogs() {
    logs = [];
};

module.exports.getLogs = function getLogs(clType) {
    if (clType !== undefined) {
        logs.map(function (item, n) {
            if (item.clType === clType) {
                return item;
            }
        });
    }
    return logs;
};

module.exports.getLogsString = function getLogsString(clType) {
    let arr;
    if (clType !== undefined) {
        arr = logs.filter(function (item) {
            if (item.clType === clType) {
                return item;
            }
        });
    } else {
        arr = logs;
    }

    let str = '';
    arr.forEach(function (item) {
        switch (item.clType) {
            case CL_LOG:
                str = str + '</br>' + logObjToString(item.data, false);
                break;
            case CL_PROGRESS:
                str = str + '</br>' + progressObjToString(item.data, false);
                break;
            case CL_FINISH:
                str = str + '</br>' + 'Finish!';
                break;
            default:
                str = str + '</br>' + 'Unknown CL-Type: ' + item.clType;
        }

    });

    return str;
};