import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Scrap Operations Platform API is running!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'scrap-operations-platform',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected', // Will be updated with actual DB health check
    };
  }
}