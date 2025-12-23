import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: {level: number, action: string}[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);