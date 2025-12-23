"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = exports.DatabaseConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
let DatabaseConfig = class DatabaseConfig {
    constructor(configService) {
        this.configService = configService;
    }
    createTypeOrmOptions() {
        return {
            type: 'mysql',
            host: this.configService.get('DB_HOST', 'staging-accomation-db.c0ra5fjyyxny.ap-south-1.rds.amazonaws.com'),
            port: this.configService.get('DB_PORT', 3306),
            username: this.configService.get('DB_USERNAME', 'acco_lotus'),
            password: this.configService.get('DB_PASSWORD', 'Accomation@123'),
            database: this.configService.get('DB_NAME', 'scrap-management'),
            entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
            migrations: [__dirname + '/../migrations/*{.ts,.js}'],
            synchronize: this.configService.get('NODE_ENV') === 'development',
            logging: this.configService.get('NODE_ENV') === 'development',
            ssl: {
                rejectUnauthorized: false,
            },
            timezone: '+00:00',
            charset: 'utf8mb4',
            extra: {
                connectionLimit: 10,
                acquireTimeout: 60000,
                timeout: 60000,
            },
        };
    }
};
exports.DatabaseConfig = DatabaseConfig;
exports.DatabaseConfig = DatabaseConfig = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DatabaseConfig);
const dataSourceOptions = {
    type: 'mysql',
    host: process.env.DB_HOST || 'staging-accomation-db.c0ra5fjyyxny.ap-south-1.rds.amazonaws.com',
    port: parseInt(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || 'acco_lotus',
    password: process.env.DB_PASSWORD || 'Accomation@123',
    database: process.env.DB_NAME || 'scrap-management',
    entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    ssl: {
        rejectUnauthorized: false,
    },
    timezone: '+00:00',
    charset: 'utf8mb4',
};
exports.AppDataSource = new typeorm_1.DataSource(dataSourceOptions);
//# sourceMappingURL=database.config.js.map