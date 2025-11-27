"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
var fs_1 = require("fs");
var path_1 = require("path");
function loadConfig(args) {
    var config = {};
    // 設定ファイルの読み込み
    var configPath = args.config || 'kamox.config.json';
    var absoluteConfigPath = path_1.default.resolve(process.cwd(), configPath);
    if (fs_1.default.existsSync(absoluteConfigPath)) {
        try {
            var configFile = fs_1.default.readFileSync(absoluteConfigPath, 'utf8');
            config = JSON.parse(configFile);
            console.log("Loaded config from ".concat(absoluteConfigPath));
        }
        catch (e) {
            console.warn("Failed to parse config file: ".concat(absoluteConfigPath));
        }
    }
    // CLI引数で上書き（優先順位: CLI > Config > Default）
    var finalConfig = {
        environment: (args.environment || config.environment || 'chrome'),
        projectPath: args.projectPath || config.projectPath || './dist',
        port: parseInt(args.port || String(config.port) || '3000', 10),
        buildCommand: args.buildCommand || config.buildCommand || 'npm run build'
    };
    return finalConfig;
}
