import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'calyvia_jwt_access_super_secret_development_key_2026_xyz',
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
      if (this.prisma && this.prisma.user) {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
        });

        if (user) {
          if (
            !user.isActive ||
            user.approvalStatus === 'SUSPENDED' ||
            user.approvalStatus === 'DEACTIVATED' ||
            user.approvalStatus === 'REJECTED'
          ) {
            throw new UnauthorizedException('User account has been suspended or deactivated');
          }

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            mustChangePassword: !!user.mustChangePassword,
          };
        }
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
    };
  }
}
