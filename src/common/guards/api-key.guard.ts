import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKeys: Set<string>;
  private readonly headerName: string;

  constructor(private configService: ConfigService) {
    const apiKeysString = this.configService.get<string>('API_KEYS', '');
    this.apiKeys = new Set(
      apiKeysString.split(',').map((key) => key.trim()).filter(Boolean),
    );
    this.headerName = this.configService.get<string>(
      'API_KEY_HEADER',
      'x-api-key',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers[this.headerName] as string;

    if (!apiKey) {
      throw new UnauthorizedException(
        `Missing API key in ${this.headerName} header`,
      );
    }

    if (!this.apiKeys.has(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}