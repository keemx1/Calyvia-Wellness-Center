import { UnauthorizedException } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { TurnstileService } from './turnstile.service';
import { LoginDto } from './dto/auth.dto';

describe('SecurityController login Turnstile gate', () => {
  const dto: LoginDto = {
    email: 'nurse@calyviawellness.co.ke',
    password: 'ClinicalSecure#2026',
    turnstileToken: 'turnstile-token',
  };

  it('verifies Turnstile before validating credentials or minting tokens', async () => {
    const securityService = {
      login: jest.fn().mockResolvedValue({ tokens: { accessToken: 'jwt' } }),
    } as unknown as SecurityService;
    const turnstileService = {
      verify: jest.fn().mockResolvedValue(undefined),
    } as unknown as TurnstileService;
    const controller = new SecurityController(securityService, turnstileService);

    await controller.login(dto, '203.0.113.10');

    expect(turnstileService.verify).toHaveBeenCalledWith('turnstile-token', '203.0.113.10');
    expect(securityService.login).toHaveBeenCalledWith(dto);
    const verifyCall = (turnstileService.verify as jest.Mock).mock.invocationCallOrder[0];
    const loginCall = (securityService.login as jest.Mock).mock.invocationCallOrder[0];
    expect(verifyCall).toBeLessThan(loginCall);
  });

  it('never reaches credential validation when verification fails', async () => {
    const securityService = { login: jest.fn() } as unknown as SecurityService;
    const turnstileService = {
      verify: jest.fn().mockRejectedValue(new UnauthorizedException('Security verification failed.')),
    } as unknown as TurnstileService;
    const controller = new SecurityController(securityService, turnstileService);

    await expect(controller.login(dto, '203.0.113.10')).rejects.toThrow(UnauthorizedException);
    expect(securityService.login).not.toHaveBeenCalled();
  });
});
