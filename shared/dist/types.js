"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Priority = exports.TaskType = void 0;
var TaskType;
(function (TaskType) {
    TaskType["TASK"] = "task";
    TaskType["REMINDER"] = "reminder";
    TaskType["NOTE"] = "note";
    TaskType["EVENT"] = "event";
})(TaskType || (exports.TaskType = TaskType = {}));
var Priority;
(function (Priority) {
    Priority["LOW"] = "low";
    Priority["MEDIUM"] = "medium";
    Priority["HIGH"] = "high";
    Priority["URGENT"] = "urgent";
})(Priority || (exports.Priority = Priority = {}));
//# sourceMappingURL=types.js.map