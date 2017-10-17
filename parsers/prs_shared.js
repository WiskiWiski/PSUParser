/**
 * Created by WiskiW on 13.10.2017.
 */
const cheerio = require('cheerio');


module.exports.LessonCell = class LessonCell {
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

module.exports.Group = class Group {
    constructor() {
        this.colSpan = 1;
        this.name = null;
    }
};

module.exports.TimeRowSchedule = class TimeRowSchedule {
    constructor() {
        this.hasGreen = false;
        this.whiteCells = [];
        this.greenCells = [];
        this.time = null;
    }
};


module.exports.clearForMultipleSpaces = function clearForMultipleSpaces(str) {
    return str.replace(/  +/g, ' ');
};