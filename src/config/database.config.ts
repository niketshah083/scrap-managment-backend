import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mysql',
      host: this.configService.get<string>('DB_HOST', 'staging-accomation-db.c0ra5fjyyxny.ap-south-1.rds.amazonaws.com'),
      port: this.configService.get<number>('DB_PORT', 3306),
      username: this.configService.get<string>('DB_USERNAME', 'acco_lotus'),
      password: this.configService.get<string>('DB_PASSWORD', 'Accomation@123'),
      database: this.configService.get<string>('DB_NAME', 'scrap-management'),
      entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: this.configService.get<string>('NODE_ENV') === 'development',
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      ssl: {
        rejectUnauthorized: false, // For AWS RDS
      },
      timezone: '+00:00', // UTC timezone
      charset: 'utf8mb4',
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
      },
    };
  }
}

// DataSource for migrations
const dataSourceOptions: DataSourceOptions = {
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

export const AppDataSource = new DataSource(dataSourceOptions);