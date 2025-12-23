export declare const PERMISSIONS_KEY = "permissions";
export declare const RequirePermissions: (...permissions: {
    level: number;
    action: string;
}[]) => import("@nestjs/common").CustomDecorator<string>;
