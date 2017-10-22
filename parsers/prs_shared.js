/**
 * Created by WiskiW on 13.10.2017.
 */
const cheerio = require('cheerio');



module.exports.ERROR_COLOR = '\x1b[31m';
module.exports.WARNING_COLOR = '\x1b[33m';
module.exports.DEFAUL_COLORS = '\x1b[0m';

module.exports.PROGRESS_STATUS_LOGS = 'logs';
module.exports.PROGRESS_STATUS_FINISH = 'finish';

module.exports.TableCell = class TableCell {
    constructor(cell) {
        if (arguments.length > 0) {
            this.colSpan = cell.colSpan;
            this.element = cell.element;
            this.text = cell.text;
        } else {
            this.colSpan = 1;
            this.element = null;
            this.text = null;
        }
    }
};

module.exports.SubRows = class SubRows {
    constructor() {
        this.hasBRow = false;
        this.aRow = [];
        this.bRow = [];
        this.time = null;
    }
};

module.exports.OPS_STATUS_NONE = OPS_STATUS_NONE = 'none';
module.exports.OPS_STATUS_ERROR = OPS_STATUS_ERROR = 'error';
module.exports.OPS_STATUS_WARNING = OPS_STATUS_WARNING = 'warning';

module.exports.OPS_CODE_NONE = OPS_CODE_NONE = -1;
module.exports.OPS_CODE_COLSPAN_LESSS_NOT_MATCH_GROUPS = 31;
module.exports.OPS_CODE_UNDEFINED_LESSON = 32;
module.exports.OPS_CODE_MORE_TWO_SUBROUPS = 33;
module.exports.OPS_CODE_GROUPS_NOT_FOUND = 34;
module.exports.OPS_CODE_GROUPS_ROW_NOT_FOUND = 35;

module.exports.newStatusObject = function newOperationStatusObject() {
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

module.exports.clearForMultipleSpaces = function clearForMultipleSpaces(str) {
    return str.replace(/  +/g, ' ');
};