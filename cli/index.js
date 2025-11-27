#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
var DevServerAPI_js_1 = require("@kamox/core/dist/DevServerAPI.js");
var ChromeExtensionAdapter_js_1 = require("@kamox/plugin-chrome/dist/ChromeExtensionAdapter.js");
var config_js_1 = require("./config.js");
var program = new commander_1.Command();
program
    .name('kamox')
    .description('Web Extension Dev Server')
    .version('0.1.0');
console.log('Raw argv:', process.argv);
program
    .command('chrome')
    .description('Start dev server for Chrome Extension')
    .option('-p, --project-path <path>', 'Path to extension directory (dist)')
    .option('--port <number>', 'Port number', '3000')
    .option('-c, --config <path>', 'Path to config file')
    .option('--build-command <command>', 'Build command to run on rebuild')
    .action(function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var config, adapter, api, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                config = (0, config_js_1.loadConfig)(__assign({ environment: 'chrome' }, options));
                console.log('Starting KamoX for Chrome Extension...');
                console.log('Config:', JSON.stringify(config, null, 2));
                adapter = new ChromeExtensionAdapter_js_1.ChromeExtensionAdapter(config);
                // 初回起動
                return [4 /*yield*/, adapter.launch()];
            case 1:
                // 初回起動
                _a.sent();
                api = new DevServerAPI_js_1.DevServerAPI(adapter);
                api.start(config.port);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Fatal error:', error_1.message);
                process.exit(1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
program.parse();
