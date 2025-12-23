import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthDemoService } from './auth-demo.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RoleGuard } from './guards/role.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { Factory } from '../entities/factory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, Factory]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'scrap-operations-secret-key'),
        signOptions: {
          expiresIn: '24h',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthDemoService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    RoleGuard,
  ],
  exports: [AuthService, AuthDemoService, JwtAuthGuard, RoleGuard],
})
export class AuthModule {}