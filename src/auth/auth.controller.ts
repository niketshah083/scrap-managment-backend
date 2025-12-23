import { Controller, Post, Body, UseGuards, Request, Get, Patch, Param } from '@nestjs/common';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { AuthDemoService } from './auth-demo.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from './guards/role.guard';
import { Roles } from './decorators/roles.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authDemoService: AuthDemoService,
  ) {}

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    // Don't return password hash
    const { passwordHash, ...result } = user;
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = await this.authService.findById(req.user.sub);
    if (!user) {
      return null;
    }
    const { passwordHash, ...result } = user;
    return result;
  }

  @Patch('users/:id/permissions')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async updatePermissions(
    @Param('id') userId: string,
    @Body() permissions: { levels: number[]; actions: string[] },
  ) {
    const user = await this.authService.updatePermissions(userId, permissions);
    const { passwordHash, ...result } = user;
    return result;
  }

  @Post('demo/setup')
  @Public()
  async setupDemoData() {
    await this.authDemoService.createDemoData();
    return { 
      message: 'Demo data created successfully',
      users: [
        { email: 'owner@scrapindustries.com', password: 'owner123', role: 'Owner' },
        { email: 'manager@scrapindustries.com', password: 'manager123', role: 'Manager' },
        { email: 'supervisor@scrapindustries.com', password: 'supervisor123', role: 'Supervisor' },
        { email: 'inspector@scrapindustries.com', password: 'inspector123', role: 'Inspector' },
        { email: 'security@scrapindustries.com', password: 'security123', role: 'Security' },
      ]
    };
  }
}