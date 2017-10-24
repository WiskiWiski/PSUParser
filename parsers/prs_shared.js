/**
 * Created by WiskiW on 13.10.2017.
 */
module.exports.enableConsoleLogs = enableConsoleLogs = false;

module.exports.ERROR_COLOR = '\x1b[31m';
module.exports.WARNING_COLOR = '\x1b[33m';
module.exports.DEFAUL_COLORS = '\x1b[0m';

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

module.exports.clearForMultipleSpaces = function clearForMultipleSpaces(str) {
    return str.replace(/  +/g, ' ');
};