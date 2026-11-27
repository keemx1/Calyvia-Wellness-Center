import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'dev-only-access-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [SecurityController],
  providers: [SecurityService, JwtStrategy, PrismaService],
  exports: [SecurityService, JwtStrategy, PassportModule, JwtModule],
})
export class SecurityModule {}
